import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { verifyHotmartSignature } from '../../middleware/webhookSignature';

function createTestApp(secret: string) {
  const app = express();
  app.use(express.json());
  app.post('/test', verifyHotmartSignature(secret), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('verifyHotmartSignature', () => {
  const secret = 'my-hottok-secret';

  it('should pass when hottok matches secret', async () => {
    const app = createTestApp(secret);
    const res = await request(app)
      .post('/test')
      .send({ hottok: secret, event: 'CART_ABANDONMENT' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('should reject when hottok does not match secret', async () => {
    const app = createTestApp(secret);
    const res = await request(app)
      .post('/test')
      .send({ hottok: 'wrong-token', event: 'CART_ABANDONMENT' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid hottok signature');
  });

  it('should pass when no hottok and no header (no signature to verify)', async () => {
    const app = createTestApp(secret);
    const res = await request(app)
      .post('/test')
      .send({ event: 'CART_ABANDONMENT' });

    expect(res.status).toBe(200);
  });

  it('should pass with valid X-Hotmart-Hottok HMAC header', async () => {
    const app = createTestApp(secret);
    const body = { event: 'CART_ABANDONMENT', email: 'test@email.com' };
    const hmac = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

    const res = await request(app)
      .post('/test')
      .set('X-Hotmart-Hottok', hmac)
      .send(body);

    expect(res.status).toBe(200);
  });

  it('should reject with invalid X-Hotmart-Hottok HMAC header', async () => {
    const app = createTestApp(secret);
    const res = await request(app)
      .post('/test')
      .set('X-Hotmart-Hottok', 'invalid-hmac')
      .send({ event: 'CART_ABANDONMENT' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid HMAC signature');
  });
});
