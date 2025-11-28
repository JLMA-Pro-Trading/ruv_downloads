/**
 * Authentication Routes
 * Login, register, validate, refresh API keys
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { generateApiKey } from '../utils/api-key.js';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * POST /auth/register
 * Register new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required',
      });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate API key
    const apiKey = generateApiKey();

    // Create user
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email,
        name,
        password_hash: passwordHash,
        api_key: apiKey,
        tier: 'free',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      apiKey,
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

/**
 * POST /auth/login
 * Login with email/password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password required',
      });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    res.json({
      success: true,
      apiKey: user.api_key,
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
});

/**
 * POST /auth/validate
 * Validate API key
 */
router.post('/validate', async (req, res) => {
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
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    res.json({
      success: true,
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });
  } catch (error: any) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Validation failed',
    });
  }
});

/**
 * POST /auth/refresh
 * Refresh API key (generate new one)
 */
router.post('/refresh', async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
      });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('api_key', apiKey)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    // Generate new API key
    const newApiKey = generateApiKey();

    // Update user
    await supabase
      .from('users')
      .update({ api_key: newApiKey })
      .eq('id', user.id);

    res.json({
      success: true,
      apiKey: newApiKey,
      userId: user.id,
      email: user.email,
      tier: user.tier,
    });
  } catch (error: any) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Refresh failed',
    });
  }
});

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', async (req, res) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
      });
    }

    // Get user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, name, tier, created_at, last_login')
      .eq('api_key', apiKey)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    res.json({
      success: true,
      ...user,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user info',
    });
  }
});

export { router as authRouter };
