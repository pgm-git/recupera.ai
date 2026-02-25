import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import {
  hotmartAbandonmentPayload,
  hotmartPurchasePayload,
  kiwifyAbandonmentPayload,
  kiwifyPurchasePayload,
  mockProduct,
  mockLead,
} from '../helpers/fixtures';

// Use vi.hoisted() so mocks are available when vi.mock() factory runs
const { mockSupabaseChain, mockFrom } = vi.hoisted(() => {
  const mockSupabaseChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };
  const mockFrom = vi.fn(() => mockSupabaseChain);
  return { mockSupabaseChain, mockFrom };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { app } from '../../express-app';

describe('POST /api/webhooks/:clientId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create lead on Hotmart CART_ABANDONMENT', async () => {
    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: mockProduct, error: null })
      .mockResolvedValueOnce({ data: mockLead, error: null });

    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send(hotmartAbandonmentPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('queued');
    expect(res.body.lead_id).toBeDefined();
  });

  it('should trigger kill switch on Hotmart PURCHASE_APPROVED', async () => {
    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: mockProduct, error: null });

    mockSupabaseChain.eq.mockReturnThis();

    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send(hotmartPurchasePayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.action).toBe('kill_switch');
  });

  it('should create lead on Kiwify waiting_payment', async () => {
    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: { ...mockProduct, platform: 'kiwify', external_product_id: 'mentoria-10x' }, error: null })
      .mockResolvedValueOnce({ data: { ...mockLead, id: 'lead-kiwify-001' }, error: null });

    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send(kiwifyAbandonmentPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('queued');
  });

  it('should trigger kill switch on Kiwify paid', async () => {
    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: { ...mockProduct, platform: 'kiwify', external_product_id: 'mentoria-10x' }, error: null });

    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send(kiwifyPurchasePayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.action).toBe('kill_switch');
  });

  it('should return 400 for unknown platform', async () => {
    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send({ random: 'data', no_platform_markers: true });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('unknown_platform_or_product');
  });

  it('should ignore unconfigured product', async () => {
    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } });

    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send(hotmartAbandonmentPayload);

    expect(res.status).toBe(200);
    expect(res.body.reason).toBe('product_not_configured');
  });

  it('should return 500 on DB error when creating lead', async () => {
    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: mockProduct, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

    const res = await request(app)
      .post('/api/webhooks/client-abc')
      .send(hotmartAbandonmentPayload);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db_error');
  });
});
