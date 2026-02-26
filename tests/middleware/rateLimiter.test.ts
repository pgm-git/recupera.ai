import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimiter } from '../../middleware/rateLimiter';

describe('rateLimiter', () => {
  const createMocks = () => {
    const req: any = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };
    const next = vi.fn();
    return { req, res, next };
  };

  it('should allow requests under the limit', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 5, name: 'test1' });
    const { req, res, next } = createMocks();

    limiter(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block requests over the limit', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 2, name: 'test2' });

    for (let i = 0; i < 2; i++) {
      const { req, res, next } = createMocks();
      limiter(req, res, next);
    }

    const { req, res, next } = createMocks();
    limiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'rate_limited' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should set rate limit headers', () => {
    const limiter = rateLimiter({ windowMs: 60000, max: 10, name: 'test3' });
    const { req, res, next } = createMocks();

    limiter(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '9');
  });
});
