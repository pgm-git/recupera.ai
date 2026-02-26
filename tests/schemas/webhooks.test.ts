import { describe, it, expect } from 'vitest';
import {
  HotmartWebhookSchema,
  KiwifyWebhookSchema,
  EduzzWebhookSchema,
  UazapiWebhookSchema,
} from '../../schemas/webhooks';

describe('HotmartWebhookSchema', () => {
  it('should accept valid Hotmart abandonment payload', () => {
    const result = HotmartWebhookSchema.safeParse({
      hottok: 'test-hottok-123',
      prod: 'python-pro-01',
      email: 'carlos@email.com',
      phone_number: '11999999999',
      event: 'CART_ABANDONMENT',
    });
    expect(result.success).toBe(true);
  });

  it('should accept payload with hotmart_id instead of hottok', () => {
    const result = HotmartWebhookSchema.safeParse({
      hotmart_id: 'hm-123',
      email: 'test@email.com',
      event: 'PURCHASE_APPROVED',
    });
    expect(result.success).toBe(true);
  });

  it('should reject payload without hottok or hotmart_id', () => {
    const result = HotmartWebhookSchema.safeParse({
      email: 'test@email.com',
      event: 'CART_ABANDONMENT',
    });
    expect(result.success).toBe(false);
  });

  it('should reject payload with invalid email', () => {
    const result = HotmartWebhookSchema.safeParse({
      hottok: 'test',
      email: 'not-an-email',
      event: 'CART_ABANDONMENT',
    });
    expect(result.success).toBe(false);
  });
});

describe('KiwifyWebhookSchema', () => {
  it('should accept valid Kiwify payload', () => {
    const result = KiwifyWebhookSchema.safeParse({
      order_id: 'kiwify-001',
      product_id: 'mentoria-10x',
      email: 'ana@email.com',
      mobile: '21988888888',
      status: 'waiting_payment',
    });
    expect(result.success).toBe(true);
  });

  it('should reject payload missing order_id', () => {
    const result = KiwifyWebhookSchema.safeParse({
      product_id: 'mentoria-10x',
      email: 'ana@email.com',
      status: 'paid',
    });
    expect(result.success).toBe(false);
  });
});

describe('EduzzWebhookSchema', () => {
  it('should accept valid Eduzz payload', () => {
    const result = EduzzWebhookSchema.safeParse({
      trans_cod: 'eduzz-001',
      product_cod: 'ebook-low-carb',
      cus_email: 'marcos@email.com',
      cus_cel: '31977777777',
      trans_status: '3',
    });
    expect(result.success).toBe(true);
  });

  it('should reject payload missing trans_cod', () => {
    const result = EduzzWebhookSchema.safeParse({
      product_cod: 'ebook-low-carb',
      cus_email: 'marcos@email.com',
      trans_status: '3',
    });
    expect(result.success).toBe(false);
  });
});

describe('UazapiWebhookSchema', () => {
  it('should accept valid UAZAPI payload with conversation', () => {
    const result = UazapiWebhookSchema.safeParse({
      instanceName: 'instance_client-abc',
      message: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'Hello',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid UAZAPI payload with extendedTextMessage', () => {
    const result = UazapiWebhookSchema.safeParse({
      instanceName: 'instance_client-abc',
      message: {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          extendedTextMessage: { text: 'Hello extended' },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject payload without instanceName', () => {
    const result = UazapiWebhookSchema.safeParse({
      message: {
        key: { remoteJid: '5511999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Hello' },
      },
    });
    expect(result.success).toBe(false);
  });
});
