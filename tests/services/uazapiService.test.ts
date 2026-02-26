import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockedAxiosPost } = vi.hoisted(() => ({
  mockedAxiosPost: vi.fn(),
}));

vi.mock('axios', () => ({
  default: { post: mockedAxiosPost },
}));

import { sendMessageUazapi } from '../../services/uazapiService';

describe('sendMessageUazapi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send message successfully', async () => {
    mockedAxiosPost.mockResolvedValueOnce({ status: 200, data: {} });

    await sendMessageUazapi('instance_abc', '5511999999999', 'Olá!');

    expect(mockedAxiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/message/text'),
      {
        instanceName: 'instance_abc',
        number: '5511999999999',
        text: 'Olá!',
      },
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it('should log error on non-200 status', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAxiosPost.mockResolvedValueOnce({ status: 500, data: 'Server Error' });

    await sendMessageUazapi('instance_abc', '5511999999999', 'Olá!');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[UAZAPI ERROR]'));
  });

  it('should not throw on connection error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAxiosPost.mockRejectedValueOnce(new Error('Network error'));

    await expect(sendMessageUazapi('instance_abc', '5511999999999', 'Olá!')).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[UAZAPI CONNECTION ERROR]'));
  });
});
