import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally for apiService (uses fetch, not axios)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock supabase module (apiService imports it)
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

import { connectInstance, checkInstanceStatus } from '../../services/apiService';

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('connectInstance()', () => {
    it('should POST and return instance data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          client_id: 'client-abc',
          instance_key: 'instance_client-abc',
          status: 'connecting',
          qr_code_base64: 'data:image/png;base64,QR123',
        }),
      });

      const result = await connectInstance('client-abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/whatsapp/connect/client-abc',
        { method: 'POST' }
      );
      expect(result.qrCodeBase64).toBe('data:image/png;base64,QR123');
    });

    it('should throw on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });

      await expect(connectInstance('client-abc')).rejects.toThrow(
        /Falha ao iniciar conexão: 503/
      );
    });
  });

  describe('checkInstanceStatus()', () => {
    it('should GET and return status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'connected',
          qr_code_base64: null,
        }),
      });

      const result = await checkInstanceStatus('client-abc');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/whatsapp/status/client-abc'
      );
      expect(result.status).toBe('connected');
    });

    it('should throw on network error (simulating timeout)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network timeout'));

      await expect(checkInstanceStatus('client-abc')).rejects.toThrow(
        'network timeout'
      );
    });
  });
});
