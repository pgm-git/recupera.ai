// --- Platform Webhook Payloads ---

export const hotmartAbandonmentPayload = {
  hottok: 'test-hottok-123',
  prod: 'python-pro-01',
  email: 'carlos@email.com',
  phone_number: '11999999999',
  phone_local_code: '55',
  event: 'CART_ABANDONMENT',
  name: 'Carlos Silva',
  price: 297.0,
  checkout_url: 'https://pay.hotmart.com/checkout/abc123',
};

export const hotmartPurchasePayload = {
  hottok: 'test-hottok-123',
  prod: 'python-pro-01',
  email: 'carlos@email.com',
  phone_number: '11999999999',
  event: 'PURCHASE_APPROVED',
  name: 'Carlos Silva',
};

export const kiwifyAbandonmentPayload = {
  order_id: 'kiwify-order-001',
  product_id: 'mentoria-10x',
  email: 'ana@email.com',
  mobile: '21988888888',
  status: 'waiting_payment',
  name: 'Ana Souza',
  amount: 997.0,
};

export const kiwifyPurchasePayload = {
  order_id: 'kiwify-order-002',
  product_id: 'mentoria-10x',
  email: 'ana@email.com',
  mobile: '21988888888',
  status: 'paid',
  name: 'Ana Souza',
};

export const eduzzPayload = {
  trans_cod: 'eduzz-trans-001',
  product_cod: 'ebook-low-carb',
  cus_email: 'marcos@email.com',
  cus_cel: '31977777777',
  trans_status: '3', // paid
  name: 'Marcos Oliveira',
};

export const uazapiWebhookPayload = {
  instanceName: 'instance_client-abc',
  message: {
    key: {
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: false,
      id: 'msg-001',
    },
    message: {
      conversation: 'Oi, vi que abandonei o carrinho. Qual o desconto?',
    },
  },
};

export const uazapiFromMePayload = {
  instanceName: 'instance_client-abc',
  message: {
    key: {
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: true,
      id: 'msg-002',
    },
    message: {
      conversation: 'Sent by me',
    },
  },
};

export const uazapiNoTextPayload = {
  instanceName: 'instance_client-abc',
  message: {
    key: {
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: false,
      id: 'msg-003',
    },
    message: {},
  },
};

// --- Mock DB Records ---

export const mockProduct = {
  id: 'prod-uuid-001',
  client_id: 'client-abc',
  name: 'Curso Python Pro',
  platform: 'hotmart',
  external_product_id: 'python-pro-01',
  is_active: true,
  agent_persona: 'Especialista amigável em tecnologia.',
  delay_minutes: 15,
  total_recovered: 15400.0,
};

export const mockLead = {
  id: 'lead-uuid-001',
  client_id: 'client-abc',
  product_id: 'prod-uuid-001',
  name: 'Carlos Silva',
  phone: '5511999999999',
  email: 'carlos@email.com',
  status: 'pending_recovery',
  value: 297.0,
  created_at: '2024-01-15T14:30:00Z',
  updated_at: '2024-01-15T14:30:00Z',
};

export const mockInstance = {
  id: 'inst-uuid-001',
  client_id: 'client-abc',
  instance_key: 'instance_client-abc',
  status: 'connected',
  qr_code_base64: null,
};
