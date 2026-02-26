import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use a shared state object so we can reset the index between tests
const { mockFrom, state } = vi.hoisted(() => {
  const state = {
    queryResults: [] as Array<{ data: any }>,
    queryIndex: 0,
  };

  function createChain(): any {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockImplementation(() => {
      // Return a thenable chain that supports further .eq() calls
      const idx = state.queryIndex;
      const thenableChain: any = {};
      // Allow chaining more .eq() calls (e.g. .eq('client_id', x).eq('status', y))
      thenableChain.eq = vi.fn().mockReturnValue(thenableChain);
      thenableChain.then = (resolve: any) => {
        state.queryIndex++;
        resolve(state.queryResults[idx] || { data: null });
      };
      return thenableChain;
    });
    return chain;
  }

  const mockFrom = vi.fn(() => createChain());

  return { mockFrom, state };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

const { mockSendMessage } = vi.hoisted(() => ({
  mockSendMessage: vi.fn(),
}));

vi.mock('../../services/uazapiService', () => ({
  sendMessageUazapi: mockSendMessage,
}));

const { mockGenerateInitialMessage } = vi.hoisted(() => ({
  mockGenerateInitialMessage: vi.fn(),
}));

vi.mock('../../services/aiHandler', () => ({
  generateInitialMessage: mockGenerateInitialMessage,
}));

let capturedProcessor: any;
vi.mock('bullmq', () => ({
  Worker: class {
    constructor(_name: string, processor: any) {
      capturedProcessor = processor;
    }
    on = vi.fn();
  },
}));

vi.mock('ioredis', () => ({
  default: class {},
}));

import { createRecoveryWorker } from '../../services/recoveryWorker';

const mockLead = {
  id: 'lead-001',
  client_id: 'client-abc',
  product_id: 'prod-001',
  name: 'Carlos Silva',
  phone: '5511999999999',
  status: 'pending_recovery',
  conversation_log: [],
};

const mockProduct = {
  id: 'prod-001',
  name: 'Curso Python Pro',
};

const mockInstance = {
  instance_key: 'instance_client-abc',
  status: 'connected',
};

describe('recoveryWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.queryResults = [];
    state.queryIndex = 0;
    createRecoveryWorker();
  });

  it('should process recovery and send message', async () => {
    state.queryResults = [
      { data: [mockLead] },       // lead fetch
      { data: [mockProduct] },     // product fetch
      { data: [mockInstance] },    // instance fetch
      { data: null },              // update
    ];

    mockGenerateInitialMessage.mockResolvedValueOnce('Olá Carlos!');

    const result = await capturedProcessor({ data: { leadId: 'lead-001' } });

    expect(result).toBe('success_sent');
    expect(mockSendMessage).toHaveBeenCalledWith('instance_client-abc', '5511999999999', 'Olá Carlos!');
  });

  it('should return lead_not_found when lead missing', async () => {
    state.queryResults = [{ data: [] }];

    const result = await capturedProcessor({ data: { leadId: 'nonexistent' } });

    expect(result).toBe('lead_not_found');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should return aborted_kill_switch when lead already converted', async () => {
    state.queryResults = [{ data: [{ ...mockLead, status: 'converted_organically' }] }];

    const result = await capturedProcessor({ data: { leadId: 'lead-001' } });

    expect(result).toBe('aborted_kill_switch');
  });

  it('should return product_not_found when product missing', async () => {
    state.queryResults = [
      { data: [mockLead] },
      { data: [] },
    ];

    const result = await capturedProcessor({ data: { leadId: 'lead-001' } });

    expect(result).toBe('product_not_found');
  });

  it('should return no_whatsapp_instance when no connected instance', async () => {
    state.queryResults = [
      { data: [mockLead] },
      { data: [mockProduct] },
      { data: [] },
    ];

    const result = await capturedProcessor({ data: { leadId: 'lead-001' } });

    expect(result).toBe('no_whatsapp_instance');
  });
});
