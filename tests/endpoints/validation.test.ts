import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const { mockSupabaseChain } = vi.hoisted(() => {
  const mockSupabaseChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  return { mockSupabaseChain };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => mockSupabaseChain),
  })),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { app } from '../../express-app';

describe('Input Validation', () => {
  it('should return 400 for empty webhook body with no platform markers', async () => {
    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('unknown_platform_or_product');
  });

  it('should handle webhook with missing clientId gracefully', async () => {
    const res = await request(app)
      .post('/api/webhooks/')
      .send({ hottok: 'test', prod: '123', event: 'CART_ABANDONMENT' });

    expect(res.status).toBe(404);
  });

  it('should return 500 for non-JSON content type on webhook (no body parsing)', async () => {
    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .set('Content-Type', 'text/plain')
      .send('not json');

    // express.json() doesn't parse text/plain — body is undefined
    // The catch block returns 500 (TypeError accessing undefined.hottok)
    expect(res.status).toBe(500);
  });

  it('should handle whatsapp webhook with empty body', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');
  });
});
