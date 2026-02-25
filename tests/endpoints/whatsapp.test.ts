import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { uazapiWebhookPayload, mockInstance } from '../helpers/fixtures';

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

const { mockedAxiosPost, mockedAxiosGet } = vi.hoisted(() => ({
  mockedAxiosPost: vi.fn(),
  mockedAxiosGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    post: mockedAxiosPost,
    get: mockedAxiosGet,
  },
}));

import { app } from '../../express-app';

describe('POST /api/whatsapp/connect/:clientId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return QR code from UAZAPI on success', async () => {
    mockedAxiosPost
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({
        status: 200,
        data: { base64: 'data:image/png;base64,QRCODE123' },
      });

    const res = await request(app)
      .post('/api/whatsapp/connect/client-abc');

    expect(res.status).toBe(200);
    expect(res.body.client_id).toBe('client-abc');
    expect(res.body.instance_key).toBe('instance_client-abc');
    expect(res.body.qr_code_base64).toBe('data:image/png;base64,QRCODE123');
    expect(res.body.status).toBe('connecting');
  });

  it('should return fallback mock QR on UAZAPI failure', async () => {
    mockedAxiosPost.mockRejectedValue(new Error('UAZAPI unreachable'));

    const res = await request(app)
      .post('/api/whatsapp/connect/client-abc');

    expect(res.status).toBe(200);
    expect(res.body.mock).toBe(true);
    expect(res.body.qr_code_base64).toContain('data:image/png;base64,');
    expect(res.body.client_id).toBe('client-abc');
  });
});

describe('GET /api/whatsapp/status/:clientId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return connected when UAZAPI state is open', async () => {
    mockedAxiosGet.mockResolvedValueOnce({
      status: 200,
      data: { instance: { state: 'open' } },
    });

    const res = await request(app)
      .get('/api/whatsapp/status/client-abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connected');
  });

  it('should fallback to DB on UAZAPI failure', async () => {
    mockedAxiosGet.mockRejectedValueOnce(new Error('timeout'));

    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: mockInstance, error: null });

    const res = await request(app)
      .get('/api/whatsapp/status/client-abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connected');
  });

  it('should return disconnected when no DB record exists', async () => {
    mockedAxiosGet.mockRejectedValueOnce(new Error('timeout'));

    mockSupabaseChain.single
      .mockResolvedValueOnce({ data: null, error: null });

    const res = await request(app)
      .get('/api/whatsapp/status/client-abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disconnected');
  });
});

describe('POST /api/whatsapp/webhook', () => {
  it('should accept payload and return processing', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .send(uazapiWebhookPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');
  });
});
