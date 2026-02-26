import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSupabaseChain, mockFrom, mockIsConfigured } = vi.hoisted(() => {
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
  const mockIsConfigured = vi.fn(() => true);
  return { mockSupabaseChain, mockFrom, mockIsConfigured };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
  isSupabaseConfigured: mockIsConfigured,
}));

import { getLeads, getLead, updateLeadStatus, saveProductConfig } from '../../services/dataService';

describe('dataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLeads()', () => {
    it('should return mock data when Supabase is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);

      const leads = await getLeads();

      expect(leads.length).toBeGreaterThan(0);
      expect(leads[0]).toHaveProperty('name');
      expect(leads[0]).toHaveProperty('email');
    });

    it('should map snake_case to camelCase from Supabase', async () => {
      mockIsConfigured.mockReturnValue(true);

      const dbRow = {
        id: 'lead-1',
        name: 'Carlos',
        phone: '5511999',
        email: 'carlos@test.com',
        status: 'pending_recovery',
        product_name: 'Curso Python',
        value: '297.00',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        phone_normalized: '5511999999999',
        recovery_attempts: 2,
        next_contact_scheduled_at: null,
        conversation_summary: 'Interessado',
        detected_objections: ['price'],
      };

      mockSupabaseChain.limit.mockResolvedValueOnce({
        data: [dbRow],
        error: null,
      });

      const leads = await getLeads();

      expect(leads).toHaveLength(1);
      expect(leads[0].productName).toBe('Curso Python');
      expect(leads[0].phoneNormalized).toBe('5511999999999');
      expect(leads[0].recoveryAttempts).toBe(2);
      expect(leads[0].value).toBe(297);
    });

    it('should return mock data on Supabase error', async () => {
      mockIsConfigured.mockReturnValue(true);

      mockSupabaseChain.limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection failed' },
      });

      const leads = await getLeads();

      expect(leads.length).toBeGreaterThan(0);
    });
  });

  describe('getLead()', () => {
    it('should return mock lead when Supabase is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      const lead = await getLead('1');
      expect(lead).toBeDefined();
      expect(lead?.id).toBe('1');
    });

    it('should return null for non-existent lead in mock mode', async () => {
      mockIsConfigured.mockReturnValue(false);
      const lead = await getLead('nonexistent');
      expect(lead).toBeNull();
    });

    it('should fetch lead from Supabase', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockSupabaseChain.single.mockResolvedValueOnce({
        data: { id: 'lead-1', name: 'Test', phone: '123', email: 'test@test.com', status: 'contacted', value: '100', created_at: '2024-01-01T00:00:00Z' },
        error: null,
      });

      const lead = await getLead('lead-1');
      expect(lead).toBeDefined();
      expect(lead?.status).toBe('contacted');
    });
  });

  describe('updateLeadStatus()', () => {
    it('should update lead status in Supabase', async () => {
      mockIsConfigured.mockReturnValue(true);
      mockSupabaseChain.eq.mockResolvedValueOnce({ error: null });

      await updateLeadStatus('lead-1', 'recovered_by_ai');
      expect(mockFrom).toHaveBeenCalledWith('leads');
      expect(mockSupabaseChain.update).toHaveBeenCalledWith({ status: 'recovered_by_ai' });
    });

    it('should do nothing when Supabase is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);
      await updateLeadStatus('lead-1', 'failed');
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('saveProductConfig()', () => {
    it('should map camelCase to snake_case for upsert', async () => {
      mockIsConfigured.mockReturnValue(true);

      const savedProduct = {
        id: 'prod-1',
        name: 'Test Product',
        platform: 'hotmart',
        is_active: true,
        agent_persona: 'Friendly expert',
        delay_minutes: 15,
        external_product_id: 'ext-123',
      };

      mockSupabaseChain.single.mockResolvedValueOnce({
        data: savedProduct,
        error: null,
      });

      await saveProductConfig({
        id: 'prod-1',
        name: 'Test Product',
        platform: 'hotmart' as const,
        isActive: true,
        agentPersona: 'Friendly expert',
        delayMinutes: 15,
        externalProductId: 'ext-123',
      });

      expect(mockFrom).toHaveBeenCalledWith('products');
      expect(mockSupabaseChain.upsert).toHaveBeenCalled();
    });

    it('should set client_id from userId', async () => {
      mockIsConfigured.mockReturnValue(true);

      mockSupabaseChain.single.mockResolvedValueOnce({
        data: { id: 'prod-new', client_id: 'user-123' },
        error: null,
      });

      await saveProductConfig(
        { name: 'New Product', platform: 'kiwify' as const },
        'user-123'
      );

      const upsertCall = mockSupabaseChain.upsert.mock.calls[0][0];
      expect(upsertCall.client_id).toBe('user-123');
    });

    it('should return mock product when Supabase is not configured', async () => {
      mockIsConfigured.mockReturnValue(false);

      const result = await saveProductConfig({
        name: 'Demo Product',
        platform: 'hotmart' as const,
      });

      expect(result).toBeDefined();
      expect(result!.name).toBe('Demo Product');
    });
  });
});
