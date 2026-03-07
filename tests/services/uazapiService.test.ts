import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockedAxiosPost, mockedAxiosGet } = vi.hoisted(() => ({
  mockedAxiosPost: vi.fn(),
  mockedAxiosGet: vi.fn(),
}));

vi.mock('axios', () => ({
  default: { post: mockedAxiosPost, get: mockedAxiosGet },
}));

vi.mock('../../lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ token: 'test-token' }] }),
    })),
  },
}));

import { sendMessageUazapi } from '../../services/uazapiService';

describe('sendMessageUazapi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send message with token header to /send/text', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ status: 200, data: {} });

    await sendMessageUazapi('instance-token-123', '5511999999999', 'Olá!');

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/send/text'),
      { number: '5511999999999', text: 'Olá!' },
      expect.objectContaining({
        headers: expect.objectContaining({ token: 'instance-token-123' }),
        timeout: 10000,
      }),
    );
  });

  it('should log error on non-200 status', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAxiosPost.mockResolvedValueOnce({ status: 500, data: 'Server Error' });

    await sendMessageUazapi('token', '5511999999999', 'Olá!');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[UAZAPI ERROR]'));
  });

  it('should not throw on connection error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAxiosPost.mockRejectedValueOnce(new Error('Network error'));

    await expect(sendMessageUazapi('token', '5511999999999', 'Olá!')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[UAZAPI CONNECTION ERROR]'));
  });
});
