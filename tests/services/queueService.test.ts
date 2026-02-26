import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
}));

vi.mock('bullmq', () => ({
  Queue: class {
    add = mockAdd;
  },
}));

vi.mock('ioredis', () => ({
  default: class {},
}));

import { scheduleRecovery } from '../../services/queueService';

describe('scheduleRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add job to queue with correct delay', async () => {
    mockAdd.mockResolvedValueOnce({});

    await scheduleRecovery('lead-001', 15);

    expect(mockAdd).toHaveBeenCalledWith(
      'recover-lead',
      { leadId: 'lead-001' },
      {
        delay: 15 * 60 * 1000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
      },
    );
  });

  it('should compute delay from minutes', async () => {
    mockAdd.mockResolvedValueOnce({});

    await scheduleRecovery('lead-002', 30);

    expect(mockAdd).toHaveBeenCalledWith(
      'recover-lead',
      { leadId: 'lead-002' },
      expect.objectContaining({ delay: 30 * 60 * 1000 }),
    );
  });
});
