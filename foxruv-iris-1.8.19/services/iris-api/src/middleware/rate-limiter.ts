/**
 * Rate Limiting Middleware
 */

import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Request, Response, NextFunction } from 'express';

const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
});

export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const key = req.ip || 'unknown';
    await rateLimiter.consume(key);
    next();
  } catch (error) {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
    });
  }
}
