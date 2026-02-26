import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const stores: Record<string, RateLimitStore> = {};

export function rateLimiter(options: {
  windowMs?: number;
  max?: number;
  name?: string;
}) {
  const { windowMs = 60_000, max = 60, name = 'default' } = options;

  if (!stores[name]) stores[name] = {};
  const store = stores[name];

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = { count: 1, resetTime: now + windowMs };
    } else {
      store[key].count++;
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - store[key].count)));

    if (store[key].count > max) {
      res.status(429).json({
        error: 'rate_limited',
        message: 'Muitas requisições. Tente novamente em alguns segundos.',
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000),
      });
      return;
    }

    next();
  };
}
