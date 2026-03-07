import express from 'express';
import cors from 'cors';
import { supabaseAdmin as supabase } from './lib/supabaseAdmin.ts';
import { processConversationStep } from './services/aiHandler.ts';
import { scheduleRecovery } from './services/queueService.ts';
import { createInstance, connectInstance, getInstanceStatus, getInstanceTokenByKey, configureWebhook, deleteInstance } from './services/uazapiService.ts';
import { rateLimiter } from './middleware/rateLimiter.ts';
import { logger, createRequestLogger } from './lib/logger.ts';

const app = express();

// Middleware
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(createRequestLogger());

// Health check
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { app: 'ok' };

  try {
    const { error } = await supabase.from('clients').select('id').limit(1);
    if (error) logger.error({ dbError: error }, 'Health check DB error');
    checks.database = error ? 'error' : 'ok';
  } catch (e) {
    logger.error({ err: e }, 'Health check DB exception');
    checks.database = 'error';
  }

  const allOk = Object.values(checks).every(v => v === 'ok');
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Rate limiting
app.use('/api/whatsapp/connect', rateLimiter({ windowMs: 60_000, max: 10, name: 'connect' }));
app.use('/api/whatsapp/status', rateLimiter({ windowMs: 60_000, max: 30, name: 'status' }));
app.use('/api/webhooks', rateLimiter({ windowMs: 60_000, max: 120, name: 'webhooks' }));
app.use('/api/products', rateLimiter({ windowMs: 60_000, max: 30, name: 'products' }));

// --- WhatsApp Instance Management ---

// Helper: create a fresh UAZAPI instance, save to DB, configure webhook
async function createFreshInstance(productId: string) {
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('client_id, name')
    .eq('id', productId)
    .single();

  if (productError) {
    logger.error({ err: productError, productId }, 'DB error looking up product');
  }

  if (!product) {
    throw Object.assign(new Error('product_not_found'), { statusCode: 404 });
  }

  const instanceKey = `recuperaai_${productId.substring(0, 8)}`;
  const { token, uazapiId } = await createInstance(instanceKey);

  // Save instance to DB (upsert by product_id to avoid duplicates)
  const { error: upsertError } = await supabase
    .from('instances')
    .upsert({
      client_id: product.client_id,
      product_id: productId,
      instance_key: instanceKey,
      token,
      uazapi_instance_id: uazapiId,
      status: 'connecting',
    }, { onConflict: 'instance_key' });

  if (upsertError) {
    logger.error({ err: upsertError, productId, instanceKey }, 'DB error upserting instance (UAZAPI instance was created, but DB record failed)');
  }

  // Configure webhook so UAZAPI sends incoming messages to our server
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  const webhookCallbackUrl = `${appUrl}/api/whatsapp/webhook`;
  try {
    await configureWebhook(token, webhookCallbackUrl);
  } catch (whErr: any) {
    logger.error({ err: whErr, productId }, 'Failed to configure UAZAPI webhook (instance still created)');
  }

  return { instanceToken: token, instanceKey };
}

// Create + Connect WhatsApp instance for a product
app.post('/api/whatsapp/connect/:productId', async (req, res) => {
  const { productId } = req.params;
  logger.info({ productId }, 'WhatsApp connect request received');

  try {
    let instanceToken: string;
    let instanceKey: string;

    // Check if instance already exists for this product
    const { data: existing, error: lookupError } = await supabase
      .from('instances')
      .select('*')
      .eq('product_id', productId)
      .limit(1);

    if (lookupError) {
      logger.error({ err: lookupError, productId }, 'DB error looking up existing instance (may need migration 003)');
    }

    if (existing && existing.length > 0) {
      instanceToken = existing[0].token;
      instanceKey = existing[0].instance_key;
      logger.info({ productId, instanceKey }, 'Found existing instance, attempting reconnect');

      // Try to connect with existing token
      try {
        const { qrcode, status } = await connectInstance(instanceToken);
        logger.info({ productId, qrLen: qrcode?.length || 0, status }, 'Reconnect successful');

        await supabase
          .from('instances')
          .update({ status: 'connecting', qr_code_base64: qrcode })
          .eq('instance_key', instanceKey);

        return res.json({
          product_id: productId,
          instance_key: instanceKey,
          status,
          qr_code_base64: qrcode,
        });
      } catch (connectErr: any) {
        // Stale token — delete old record and create fresh instance
        logger.info({ productId, instanceKey, errMsg: connectErr.message }, 'Existing instance token invalid, creating fresh instance');
        await supabase.from('instances').delete().eq('product_id', productId);
      }
    }

    // Create fresh UAZAPI instance
    logger.info({ productId }, 'Creating fresh UAZAPI instance');
    const fresh = await createFreshInstance(productId);
    instanceToken = fresh.instanceToken;
    instanceKey = fresh.instanceKey;

    // Connect and get QR code
    const { qrcode, status } = await connectInstance(instanceToken);
    logger.info({ productId, qrLen: qrcode?.length || 0, qrPrefix: qrcode?.substring(0, 30), status }, 'Fresh instance connected');

    // Update status + QR in DB
    const { error: updateError } = await supabase
      .from('instances')
      .update({ status: 'connecting', qr_code_base64: qrcode })
      .eq('instance_key', instanceKey);

    if (updateError) {
      logger.error({ err: updateError, instanceKey }, 'DB error updating instance status');
    }

    res.json({
      product_id: productId,
      instance_key: instanceKey,
      status,
      qr_code_base64: qrcode,
    });

  } catch (error: any) {
    logger.error({ err: error, productId }, 'WhatsApp connect error');
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'product_not_found' });
    }
    res.status(500).json({
      error: 'whatsapp_connect_failed',
      message: error.message || 'Falha ao conectar com a UAZAPI',
    });
  }
});

// Get WhatsApp status for a product
app.get('/api/whatsapp/status/:productId', async (req, res) => {
  const { productId } = req.params;

  try {
    // Get instance from DB
    const { data: instance } = await supabase
      .from('instances')
      .select('*')
      .eq('product_id', productId)
      .limit(1);

    if (!instance || instance.length === 0) {
      return res.json({ status: 'disconnected', message: 'no_instance' });
    }

    const inst = instance[0];

    // Check live status from UAZAPI
    try {
      const { status, connected } = await getInstanceStatus(inst.token);

      // Sync status to DB
      const newStatus = connected ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected';
      if (newStatus !== inst.status) {
        await supabase
          .from('instances')
          .update({ status: newStatus })
          .eq('id', inst.id);
      }

      return res.json({ status: newStatus, connected });
    } catch {
      // UAZAPI unreachable — return DB status
      return res.json({ status: inst.status, connected: inst.status === 'connected' });
    }

  } catch (error: any) {
    logger.error({ err: error, productId }, 'WhatsApp status error');
    res.json({ status: 'disconnected' });
  }
});

// Webhook for WhatsApp (UAZAPI incoming messages)
app.post('/api/whatsapp/webhook', async (req, res) => {
  const body = req.body;
  logger.info({ event: 'uazapi_webhook', instanceName: body.instanceName }, 'UAZAPI webhook received');

  const instanceKey = body.instanceName;
  const messageData = body.message;

  if (!messageData) {
    return res.json({ status: 'ignored', reason: 'no_message_data' });
  }

  // Ignore messages sent by ourselves
  if (messageData.key?.fromMe) {
    return res.json({ status: 'ignored', reason: 'from_me' });
  }

  // Extract phone from remoteJid
  const remoteJid = messageData.key?.remoteJid || '';
  const phoneNumber = remoteJid.split('@')[0];

  // Extract text content
  let textContent = '';
  if (messageData.message?.conversation) {
    textContent = messageData.message.conversation;
  } else if (messageData.message?.extendedTextMessage?.text) {
    textContent = messageData.message.extendedTextMessage.text;
  }

  if (!textContent) {
    return res.json({ status: 'ignored', reason: 'no_text_content' });
  }

  // Fire-and-forget AI dispatch (pass instanceKey to look up token)
  processConversationStep(phoneNumber, textContent, instanceKey).catch((err) => {
    logger.error({ err, phoneNumber, instanceKey }, 'AI processing error');
  });

  res.json({ status: 'processing' });
});

// --- Product Management ---

app.delete('/api/products/:productId', async (req, res) => {
  const { productId } = req.params;

  try {
    // 1. Find instance linked to this product
    const { data: instance } = await supabase
      .from('instances')
      .select('*')
      .eq('product_id', productId)
      .limit(1);

    // 2. Delete UAZAPI instance if it exists
    if (instance && instance.length > 0) {
      try {
        await deleteInstance(instance[0].token);
      } catch (uazErr: any) {
        logger.error({ err: uazErr, productId }, 'Failed to delete UAZAPI instance (continuing with DB cleanup)');
      }

      // 3. Remove instance record from DB
      await supabase
        .from('instances')
        .delete()
        .eq('product_id', productId);
    }

    // 4. Delete the product
    await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    logger.info({ productId }, 'Product and instance deleted');
    res.json({ status: 'deleted', productId });

  } catch (error: any) {
    logger.error({ err: error, productId }, 'Product deletion error');
    res.status(500).json({ error: 'deletion_failed' });
  }
});

// --- Platform Webhooks (Hotmart / Kiwify / Eduzz) ---

app.post('/api/webhooks/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const payload = req.body;

  logger.info({ clientId, event: 'platform_webhook' }, 'Platform webhook received');

  try {
    // 1. Identify Platform & Product ID
    let platform = 'unknown';
    let externalProductId = '';
    let email = '';
    let phone = '';
    let event = '';

    // Hotmart Detection
    if (payload.hottok || payload.hotmart_id) {
      platform = 'hotmart';
      externalProductId = payload.prod || payload.product_id;
      email = payload.email;
      phone = payload.phone_number || (payload.phone_local_code + payload.phone_number);
      event = payload.event;
    }
    // Kiwify Detection
    else if (payload.order_id && payload.product_id) {
      platform = 'kiwify';
      externalProductId = payload.product_id;
      email = payload.email;
      phone = payload.mobile;
      event = payload.status;
    }
    // Eduzz Detection
    else if (payload.trans_cod) {
      platform = 'eduzz';
      externalProductId = payload.product_cod;
      email = payload.cus_email;
      phone = payload.cus_cel;
      event = payload.trans_status;
    }

    logger.info({ platform, externalProductId, event }, 'Webhook parsed');

    if (!externalProductId) {
      return res.status(400).json({ status: 'ignored', reason: 'unknown_platform_or_product' });
    }

    // 2. Lookup Product in DB
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('client_id', clientId)
      .eq('external_product_id', String(externalProductId))
      .single();

    if (error || !product) {
      logger.info({ externalProductId, clientId }, 'Product not configured');
      return res.json({ status: 'ignored', reason: 'product_not_configured' });
    }

    // 3. Handle Event
    if (['PURCHASE_APPROVED', 'ORDER_APPROVED', 'paid', '3'].includes(event)) {
      // Kill Switch: Mark leads as converted
      await supabase
        .from('leads')
        .update({ status: 'converted_organically' })
        .eq('email', email)
        .eq('product_id', product.id);

      return res.json({ status: 'success', action: 'kill_switch' });
    }
    else if (['CART_ABANDONMENT', 'waiting_payment'].includes(event)) {
      // Create Lead
      const leadData = {
        client_id: clientId,
        product_id: product.id,
        email,
        phone,
        status: 'pending_recovery',
        name: payload.name || payload.first_name || 'Cliente',
        checkout_url: payload.checkout_url || '',
        value: payload.price || payload.amount || 0,
      };

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (leadError) {
        logger.error({ err: leadError }, 'Error creating lead');
        return res.status(500).json({ error: 'db_error' });
      }

      // Schedule AI recovery via BullMQ
      scheduleRecovery(lead.id, product.delay_minutes || 15).catch((err) => {
        logger.error({ err }, 'Error scheduling recovery');
      });

      return res.json({ status: 'queued', lead_id: lead.id });
    }

    res.json({ status: 'ignored', reason: 'unhandled_event' });

  } catch (error: any) {
    logger.error({ err: error, clientId }, 'Webhook error');
    res.status(500).json({ error: error.message });
  }
});

// --- LGPD Compliance Endpoints ---

app.get('/api/lgpd/export/:clientId', async (req, res) => {
  const { clientId } = req.params;

  try {
    const [clientRes, productsRes, leadsRes, instancesRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('products').select('*').eq('client_id', clientId),
      supabase.from('leads').select('*').eq('client_id', clientId),
      supabase.from('instances').select('id, instance_key, status').eq('client_id', clientId),
    ]);

    res.json({
      exportDate: new Date().toISOString(),
      client: clientRes.data,
      products: productsRes.data || [],
      leads: leadsRes.data || [],
      instances: instancesRes.data || [],
    });
  } catch (error: any) {
    logger.error({ err: error, clientId }, 'LGPD export error');
    res.status(500).json({ error: 'export_failed' });
  }
});

app.delete('/api/lgpd/delete/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const now = new Date().toISOString();

  try {
    await Promise.all([
      supabase.from('leads').update({ deleted_at: now }).eq('client_id', clientId),
      supabase.from('products').update({ deleted_at: now }).eq('client_id', clientId),
      supabase.from('instances').update({ deleted_at: now }).eq('client_id', clientId),
      supabase.from('clients').update({ deleted_at: now }).eq('id', clientId),
    ]);

    logger.info({ clientId }, 'LGPD data deletion completed');
    res.json({ status: 'deleted', clientId, deletedAt: now });
  } catch (error: any) {
    logger.error({ err: error, clientId }, 'LGPD deletion error');
    res.status(500).json({ error: 'deletion_failed' });
  }
});

export { app };
