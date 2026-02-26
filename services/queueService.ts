import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let recoveryQueue: Queue | null = null;

function getQueue(): Queue {
  if (!recoveryQueue) {
    const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379/0', {
      maxRetriesPerRequest: null,
    });
    recoveryQueue = new Queue('recovery', { connection });
  }
  return recoveryQueue;
}

export async function scheduleRecovery(leadId: string, delayMinutes: number): Promise<void> {
  const queue = getQueue();
  await queue.add(
    'recover-lead',
    { leadId },
    {
      delay: delayMinutes * 60 * 1000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
    }
  );
  console.log(`[QUEUE] Recovery scheduled for lead ${leadId} in ${delayMinutes} minutes`);
}
