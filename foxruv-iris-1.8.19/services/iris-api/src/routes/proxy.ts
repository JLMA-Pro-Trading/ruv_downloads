/**
 * Proxy Routes
 * Proxy requests to Supabase/LLM APIs with user-specific RLS
 */

import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// All proxy routes require authentication
router.use(authenticate);

/**
 * POST /api/query
 * Query user data with RLS
 */
router.post('/query', async (req, res) => {
  try {
    const { table, select, filters } = req.body;
    const userId = (req as any).userId;

    // Build query with RLS
    let query = supabase
      .from(table)
      .select(select || '*')
      .eq('user_id', userId); // RLS enforcement

    // Apply additional filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Query failed',
    });
  }
});

/**
 * POST /api/llm/complete
 * Proxy LLM completion request
 * (Optional - users can provide their own LLM keys)
 */
router.post('/llm/complete', async (req, res) => {
  try {
    const { prompt, model = 'claude-3-5-sonnet-20241022' } = req.body;
    const userId = (req as any).userId;

    // Track usage for billing
    await supabase
      .from('llm_usage')
      .insert({
        user_id: userId,
        model,
        prompt_tokens: prompt.length / 4, // Rough estimate
        timestamp: new Date().toISOString(),
      });

    // Proxy to Anthropic (example)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
      }),
    });

    const data = await response.json();

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'LLM request failed',
    });
  }
});

export { router as proxyRouter };
