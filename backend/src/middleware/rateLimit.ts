import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { AppError } from '../utils/errors';

/**
 * Redis-backed Fixed-Window Rate Limiter.
 * Scoped by client IP (or authenticated user ID when available).
 * Enforces a limit of 100 requests per 60-second window.
 */
export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).user?.id || req.ip || 'anonymous';
  const key = `ratelimit:${clientId}`;
  const limit = 100;
  const windowMs = 60 * 1000;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }

    const ttl = await redis.pttl(key);
    const resetTime = Math.ceil((Date.now() + (ttl > 0 ? ttl : windowMs)) / 1000);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (current > limit) {
      res.setHeader('Retry-After', Math.ceil((ttl > 0 ? ttl : windowMs) / 1000));
      return next(new AppError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'));
    }

    next();
  } catch (err) {
    // If Redis is temporarily down, fail open to avoid bringing down entire API
    next();
  }
};
