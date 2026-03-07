import axios from 'axios';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';

// Read env vars lazily (not at module load time) to avoid ESM hoisting issue.
// In ESM, import statements are resolved before dotenv.config() runs in server.ts,
// so module-level process.env reads would get undefined.
const getBaseUrl = () => process.env.UAZAPI_BASE_URL || '';
const getAdminToken = () => process.env.UAZAPI_ADMIN_TOKEN || '';

// --- Instance Management ---

export async function createInstance(name: string): Promise<{ token: string; uazapiId: string }> {
  const url = `${getBaseUrl()}/instance/init`;
  const resp = await axios.post(url, { name }, {
    headers: { admintoken: getAdminToken(), 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  const token = resp.data.token;
  const uazapiId = resp.data.instance?.id || '';

  if (!token) {
    throw new Error('UAZAPI did not return an instance token');
  }

  console.log(`[UAZAPI] Instance "${name}" created (id: ${uazapiId})`);
  return { token, uazapiId };
}

export async function connectInstance(instanceToken: string): Promise<{ qrcode: string; status: string }> {
  const url = `${getBaseUrl()}/instance/connect`;
  const resp = await axios.post(url, {}, {
    headers: { token: instanceToken, 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  console.log(`[UAZAPI] Connect response keys: ${JSON.stringify(Object.keys(resp.data))}`);

  // Try multiple response paths — UAZAPI may use different structures
  const qrcode = resp.data.qrcode
    || resp.data.instance?.qrcode
    || resp.data.qr_code
    || resp.data.base64
    || resp.data.instance?.base64
    || '';
  const status = resp.data.instance?.status || (typeof resp.data.status === 'string' ? resp.data.status : 'disconnected');

  if (!qrcode) {
    console.log(`[UAZAPI] Connect response (no QR found): ${JSON.stringify(resp.data).substring(0, 500)}`);
  } else {
    console.log(`[UAZAPI] QR code received (${qrcode.length} chars), status: ${status}`);
  }

  return { qrcode, status };
}

export async function getInstanceStatus(instanceToken: string): Promise<{ status: string; connected: boolean }> {
  const url = `${getBaseUrl()}/instance/status`;
  const resp = await axios.get(url, {
    headers: { token: instanceToken },
    timeout: 10000,
  });

  const status = resp.data.instance?.status || 'disconnected';
  const connected = resp.data.status?.connected || false;

  return { status, connected };
}

// --- Webhook Configuration ---

export async function configureWebhook(instanceToken: string, webhookUrl: string): Promise<void> {
  const url = `${getBaseUrl()}/webhook`;
  await axios.post(url, {
    url: webhookUrl,
    events: ['messages', 'connection'],
    excludeMessages: ['wasSentByApi'],
  }, {
    headers: { token: instanceToken, 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  console.log(`[UAZAPI] Webhook configured: ${webhookUrl}`);
}

// --- Instance Deletion ---

export async function deleteInstance(instanceToken: string): Promise<void> {
  const url = `${getBaseUrl()}/instance/delete`;
  // UAZAPI uses GET for instance deletion
  await axios.get(url, {
    headers: { token: instanceToken },
    timeout: 15000,
  });

  console.log(`[UAZAPI] Instance deleted`);
}

// --- Messaging ---

export async function sendMessageUazapi(instanceToken: string, phone: string, text: string): Promise<void> {
  const url = `${getBaseUrl()}/send/text`;
  const payload = { number: phone, text };

  try {
    const resp = await axios.post(url, payload, {
      headers: { token: instanceToken, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    if (resp.status !== 200) {
      console.error(`[UAZAPI ERROR] Status: ${resp.status} - Body: ${JSON.stringify(resp.data)}`);
    } else {
      console.log(`[UAZAPI SENT] Para: ${phone}`);
    }
  } catch (error) {
    console.error(`[UAZAPI CONNECTION ERROR] ${error}`);
  }
}

// --- Helper: get instance token from DB ---

export async function getInstanceTokenByProduct(productId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('instances')
    .select('token')
    .eq('product_id', productId)
    .eq('status', 'connected')
    .limit(1);

  return data?.[0]?.token || null;
}

export async function getInstanceTokenByKey(instanceKey: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('instances')
    .select('token')
    .eq('instance_key', instanceKey)
    .limit(1);

  return data?.[0]?.token || null;
}
