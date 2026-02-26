import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const { mockSupabaseChain, mockFrom } = vi.hoisted(() => {
  const mockSupabaseChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  const mockFrom = vi.fn(() => mockSupabaseChain);
  return { mockSupabaseChain, mockFrom };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mockCreate } };
  },
}));

const { mockSendMessage } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
}));

vi.mock('../../services/uazapiService', () => ({
  sendMessageUazapi: mockSendMessage,
}));

import { cleanPhoneNumber, buildSystemPrompt, processConversationStep, generateInitialMessage } from '../../services/aiHandler';

const mockProduct = {
  id: 'prod-001',
  name: 'Curso Python Pro',
  external_product_id: 'python-pro-01',
  agent_persona: 'Amigável e prestativo',
  objection_handling: 'Foque no valor',
  downsell_link: 'https://downsell.com',
};

const mockLead = {
  id: 'lead-001',
  name: 'Carlos Silva',
  phone: '5511999999999',
  email: 'carlos@email.com',
  status: 'pending_recovery',
  product_id: 'prod-001',
  value: 297,
  checkout_url: 'https://pay.hotmart.com/checkout/abc123',
  conversation_log: [],
};

describe('cleanPhoneNumber', () => {
  it('should strip non-digit characters', () => {
    expect(cleanPhoneNumber('+55 (11) 99999-9999')).toBe('5511999999999');
  });

  it('should return digits unchanged', () => {
    expect(cleanPhoneNumber('5511999999999')).toBe('5511999999999');
  });
});

describe('buildSystemPrompt', () => {
  it('should interpolate product and lead data', () => {
    const prompt = buildSystemPrompt(mockProduct, mockLead);
    expect(prompt).toContain('Curso Python Pro');
    expect(prompt).toContain('Carlos Silva');
    expect(prompt).toContain('297');
    expect(prompt).toContain('Amigável e prestativo');
  });

  it('should use defaults for missing fields', () => {
    const prompt = buildSystemPrompt({}, {});
    expect(prompt).toContain('Produto');
    expect(prompt).toContain('Cliente');
    expect(prompt).toContain('não informado');
  });
});

describe('generateInitialMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return AI-generated message', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Olá Carlos, tudo bem?' } }],
    });

    const msg = await generateInitialMessage(mockProduct, mockLead);
    expect(msg).toBe('Olá Carlos, tudo bem?');
  });

  it('should return fallback on error', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API Error'));

    const msg = await generateInitialMessage(mockProduct, mockLead);
    expect(msg).toContain('Carlos Silva');
    expect(msg).toContain('Curso Python Pro');
  });
});

describe('processConversationStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain methods for each test
    mockSupabaseChain.select.mockReturnThis();
    mockSupabaseChain.eq.mockReturnThis();
    mockSupabaseChain.ilike.mockReturnThis();
    mockSupabaseChain.update.mockReturnThis();
  });

  it('should process message and send AI reply', async () => {
    // Mock ilike chain returns leads
    mockSupabaseChain.ilike.mockResolvedValueOnce({ data: [mockLead] });
    // Mock product fetch
    mockSupabaseChain.eq.mockResolvedValueOnce({ data: [mockProduct] });
    // Mock OpenAI
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Resposta da IA' } }],
    });
    // Mock update
    mockSupabaseChain.eq.mockResolvedValueOnce({ data: null, error: null });

    await processConversationStep('5511999999999', 'Oi, quanto custa?', 'instance_abc');

    expect(mockSendMessage).toHaveBeenCalledWith('instance_abc', '5511999999999', 'Resposta da IA');
  });

  it('should skip if lead not found', async () => {
    mockSupabaseChain.ilike.mockResolvedValueOnce({ data: [] });

    await processConversationStep('5500000000000', 'Oi', 'instance_abc');

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should skip if lead is already converted (kill switch)', async () => {
    mockSupabaseChain.ilike.mockResolvedValueOnce({
      data: [{ ...mockLead, status: 'converted_organically' }],
    });

    await processConversationStep('5511999999999', 'Oi', 'instance_abc');

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should skip if product not found', async () => {
    mockSupabaseChain.ilike.mockResolvedValueOnce({ data: [mockLead] });
    mockSupabaseChain.eq.mockResolvedValueOnce({ data: [] });

    await processConversationStep('5511999999999', 'Oi', 'instance_abc');

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
