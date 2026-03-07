import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { uazapiWebhookPayload, uazapiFromMePayload, uazapiNoTextPayload } from '../helpers/fixtures';

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

const { mockProcessConversationStep } = vi.hoisted(() => ({
  mockProcessConversationStep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/aiHandler', () => ({
  processConversationStep: mockProcessConversationStep,
}));

vi.mock('../../services/queueService', () => ({
  scheduleRecovery: vi.fn().mockResolvedValue(undefined),
}));

const { mockCreateInstance, mockConnectInstance, mockGetInstanceStatus, mockGetInstanceTokenByKey } = vi.hoisted(() => ({
  mockCreateInstance: vi.fn().mockResolvedValue({ token: 'new-token-123', uazapiId: 'uaz-id-001' }),
  mockConnectInstance: vi.fn().mockResolvedValue({ qrcode: 'data:image/png;base64,QRCODE123', status: 'connecting' }),
  mockGetInstanceStatus: vi.fn().mockResolvedValue({ status: 'connected', connected: true }),
  mockGetInstanceTokenByKey: vi.fn().mockResolvedValue('instance-token-abc'),
}));

vi.mock('../../services/uazapiService', () => ({
  createInstance: mockCreateInstance,
  connectInstance: mockConnectInstance,
  getInstanceStatus: mockGetInstanceStatus,
  getInstanceTokenByKey: mockGetInstanceTokenByKey,
  sendMessageUazapi: vi.fn(),
  configureWebhook: vi.fn().mockResolvedValue(undefined),
  deleteInstance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  createRequestLogger: () => (_req: any, _res: any, next: any) => next(),
}));

import { app } from '../../express-app';

describe('POST /api/whatsapp/connect/:productId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create new instance and return QR code', async () => {
    // No existing instance
    mockSupabaseChain.limit.mockResolvedValueOnce({ data: [] });
    // Product lookup
    mockSupabaseChain.single.mockResolvedValueOnce({ data: { client_id: 'client-1', name: 'Test Product' }, error: null });
    // Insert instance
    mockSupabaseChain.insert.mockReturnValue({ select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: {}, error: null }) });
    // Update instance
    mockSupabaseChain.update.mockReturnThis();

    const res = await request(app)
      .post('/api/whatsapp/connect/product-abc');

    expect(res.status).toBe(200);
    expect(res.body.qr_code_base64).toBe('data:image/png;base64,QRCODE123');
    expect(res.body.status).toBe('connecting');
    expect(mockCreateInstance).toHaveBeenCalled();
    expect(mockConnectInstance).toHaveBeenCalled();
  });

  it('should return 500 error on UAZAPI failure', async () => {
    mockSupabaseChain.limit.mockResolvedValueOnce({ data: [] });
    mockSupabaseChain.single.mockResolvedValueOnce({ data: { client_id: 'client-1', name: 'Test' }, error: null });
    mockCreateInstance.mockRejectedValueOnce(new Error('UAZAPI unreachable'));

    const res = await request(app)
      .post('/api/whatsapp/connect/product-abc');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('whatsapp_connect_failed');
  });
});

describe('GET /api/whatsapp/status/:productId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return connected when UAZAPI reports connected', async () => {
    mockSupabaseChain.limit.mockResolvedValueOnce({
      data: [{ id: 'inst-1', token: 'tok-123', status: 'disconnected', instance_key: 'test' }],
    });

    const res = await request(app)
      .get('/api/whatsapp/status/product-abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connected');
  });

  it('should return disconnected when no instance exists', async () => {
    mockSupabaseChain.limit.mockResolvedValueOnce({ data: [] });

    const res = await request(app)
      .get('/api/whatsapp/status/product-abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disconnected');
    expect(res.body.message).toBe('no_instance');
  });

  it('should fallback to DB on UAZAPI failure', async () => {
    mockSupabaseChain.limit.mockResolvedValueOnce({
      data: [{ id: 'inst-1', token: 'tok-123', status: 'connected', instance_key: 'test' }],
    });
    mockGetInstanceStatus.mockRejectedValueOnce(new Error('timeout'));

    const res = await request(app)
      .get('/api/whatsapp/status/product-abc');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connected');
  });
});

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dispatch to AI handler and return processing', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .send(uazapiWebhookPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processing');
    expect(mockProcessConversationStep).toHaveBeenCalledWith(
      '5511999999999',
      'Oi, vi que abandonei o carrinho. Qual o desconto?',
      'instance_client-abc',
    );
  });

  it('should ignore fromMe messages', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .send(uazapiFromMePayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ignored');
    expect(res.body.reason).toBe('from_me');
    expect(mockProcessConversationStep).not.toHaveBeenCalled();
  });

  it('should ignore messages with no text content', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .send(uazapiNoTextPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ignored');
    expect(res.body.reason).toBe('no_text_content');
    expect(mockProcessConversationStep).not.toHaveBeenCalled();
  });

  it('should ignore payload without message data', async () => {
    const res = await request(app)
      .post('/api/whatsapp/webhook')
      .send({ instanceName: 'instance_abc' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ignored');
    expect(res.body.reason).toBe('no_message_data');
  });
});
