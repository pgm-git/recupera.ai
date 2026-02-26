import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  })),
}));

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
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

describe('Authentication (current state: INSECURE)', () => {
  it('should allow unauthenticated access to webhooks (documents insecure state)', async () => {
    const res = await request(app)
      .post('/api/webhooks/any-client')
      .send({ random: 'data' });

    // Currently returns 400 (bad payload) NOT 401 — no auth check exists
    expect(res.status).not.toBe(401);
  });

  it('should allow unauthenticated access to whatsapp connect', async () => {
    const res = await request(app)
      .post('/api/whatsapp/connect/any-client');

    expect(res.status).not.toBe(401);
  });

  it('should allow unauthenticated access to whatsapp status', async () => {
    const res = await request(app)
      .get('/api/whatsapp/status/any-client');

    expect(res.status).not.toBe(401);
  });

  // Placeholders for post-auth implementation (Story 1.2)
  it.todo('should reject requests without valid JWT token');
  it.todo('should reject requests with expired JWT token');
  it.todo('should reject webhook access from unauthorized client');
  it.todo('should allow webhook access with valid platform token (hottok)');
  it.todo('should scope data access to authenticated client_id');
});
