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
    limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
  };
  return { mockSupabaseChain };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => mockSupabaseChain),
  })),
}));

vi.mock('axios', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('../../services/aiHandler', () => ({
  processConversationStep: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/queueService', () => ({
  scheduleRecovery: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  createRequestLogger: () => (_req: any, _res: any, next: any) => next(),
}));

import { app } from '../../express-app';

describe('GET /health', () => {
  it('should return healthy status', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.app).toBe('ok');
    expect(res.body.checks.database).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('LGPD endpoints', () => {
  it('GET /api/lgpd/export/:clientId should return exported data', async () => {
    mockSupabaseChain.single.mockResolvedValueOnce({ data: { id: 'c1', email: 'test@test.com' }, error: null });

    const res = await request(app).get('/api/lgpd/export/c1');

    expect(res.status).toBe(200);
    expect(res.body.exportDate).toBeDefined();
    expect(res.body.client).toBeDefined();
  });

  it('DELETE /api/lgpd/delete/:clientId should soft delete data', async () => {
    const res = await request(app).delete('/api/lgpd/delete/c1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('deleted');
    expect(res.body.deletedAt).toBeDefined();
  });
});
