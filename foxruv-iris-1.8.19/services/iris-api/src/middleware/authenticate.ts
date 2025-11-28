/**
 * Authentication Middleware
 * Validates API key and attaches userId to request
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
      });
    }

    // Validate API key format
    if (!/^iris_[a-zA-Z0-9]{32}$/.test(apiKey)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key format',
      });
    }

    // Get user by API key
    const { data: user, error } = await supabase
      .from('users')
      .select('id, tier')
      .eq('api_key', apiKey)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    // Attach userId to request
    (req as any).userId = user.id;
    (req as any).userTier = user.tier;

    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Authentication failed',
    });
  }
}
