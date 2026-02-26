import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { sendMessageUazapi } from './uazapiService.ts';
import { generateInitialMessage } from './aiHandler.ts';

async function processRecoveryJob(job: Job<{ leadId: string }>): Promise<string> {
  const { leadId } = job.data;
  console.log(`[Worker] Processando Lead ${leadId}`);

  // 1. Fetch lead + kill switch
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', leadId);

  if (!leads || leads.length === 0) return 'lead_not_found';
  const lead = leads[0];

  if (lead.status !== 'pending_recovery') {
    console.log(`[Worker] Kill Switch: Lead status é ${lead.status}`);
    return 'aborted_kill_switch';
  }

  // 2. Fetch product
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', lead.product_id);

  if (!products || products.length === 0) return 'product_not_found';
  const product = products[0];

  // 3. Find connected WhatsApp instance
  const { data: instances } = await supabaseAdmin
    .from('instances')
    .select('instance_key, status')
    .eq('client_id', lead.client_id)
    .eq('status', 'connected');

  if (!instances || instances.length === 0) {
    console.log('[Worker] Nenhuma instância WhatsApp conectada para este cliente.');
    return 'no_whatsapp_instance';
  }
  const instanceKey = instances[0].instance_key;

  // 4. Generate AI message (fixes generate_message() bug from Python)
  const message = await generateInitialMessage(product, lead);

  // 5. Send via UAZAPI
  await sendMessageUazapi(instanceKey, lead.phone, message);

  // 6. Update status and log
  const newLog = lead.conversation_log || [];
  newLog.push({ role: 'assistant', content: message });

  await supabaseAdmin
    .from('leads')
    .update({
      status: 'contacted',
      conversation_log: newLog,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  return 'success_sent';
}

export function createRecoveryWorker(): Worker {
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379/0', {
    maxRetriesPerRequest: null,
  });

  const worker = new Worker('recovery', processRecoveryJob, { connection });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log('[Worker] Recovery worker started');
  return worker;
}
