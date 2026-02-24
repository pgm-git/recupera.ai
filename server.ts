import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || 'https://epqtoaluztqldddskorj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_publishable_Szo7xCIdztMap1TYOvF60w_5XcZEIVr';
const supabase = createClient(supabaseUrl, supabaseKey);

// UAZAPI Config
const UAZAPI_BASE_URL = process.env.UAZAPI_BASE_URL || 'https://pgmventures.uazapi.com';
const UAZAPI_API_KEY = process.env.UAZAPI_API_KEY || 'no6pZaVQ93FRBB7cQqp6IMj6Jt6w4L93vKt02Men0EW0FCRRVF';

// --- API Routes ---

// Connect WhatsApp Instance
app.post('/api/whatsapp/connect/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const instanceKey = `instance_${clientId}`;
  
  const headers = {
    'apikey': UAZAPI_API_KEY,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Init Instance (Create if not exists)
    try {
      await axios.post(`${UAZAPI_BASE_URL}/instance/init`, {
        instanceName: instanceKey
      }, { headers });
    } catch (error) {
      console.error(`Error initializing instance: ${error}`);
      // Continue even if init fails (might already exist)
    }

    // 2. Get QR Code
    const connectRes = await axios.post(`${UAZAPI_BASE_URL}/instance/connect`, {
      instanceName: instanceKey
    }, { headers });

    if (connectRes.status === 200) {
      const respData = connectRes.data;
      const qrCode = respData.base64 || respData.qrCodeBase64; // Handle variations

      const data = {
        client_id: clientId,
        instance_key: instanceKey,
        status: 'connecting',
        qr_code_base64: qrCode
      };

      // Update Supabase
      const { error } = await supabase
        .from('instances')
        .upsert(data, { onConflict: 'instance_key' });
      
      if (error) console.error('Supabase error:', error);

      res.json(data);
    } else {
      res.status(connectRes.status).json({ error: `UAZAPI Error: ${connectRes.statusText}` });
    }

  } catch (error: any) {
    console.error('Connect error:', error.message);
    
    // Fallback Mock for development without internet/api
    const fakeQr = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    res.json({
      client_id: clientId,
      instance_key: instanceKey,
      status: 'connecting',
      qr_code_base64: fakeQr,
      mock: true
    });
  }
});

// Get WhatsApp Status
app.get('/api/whatsapp/status/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const instanceKey = `instance_${clientId}`;
  const headers = { 'apikey': UAZAPI_API_KEY };

  try {
    const response = await axios.get(`${UAZAPI_BASE_URL}/instance/status`, {
      headers,
      params: { instanceName: instanceKey }
    });

    if (response.status === 200) {
      const statusData = response.data;
      const state = statusData.instance?.state || 'disconnected';
      const status = state === 'open' ? 'connected' : 'disconnected';

      // Update Supabase
      await supabase
        .from('instances')
        .update({ status })
        .eq('instance_key', instanceKey);

      return res.json({ status });
    }
  } catch (error) {
    // Ignore error and fallback to DB
  }

  // Fallback to DB
  const { data } = await supabase
    .from('instances')
    .select('*')
    .eq('client_id', clientId)
    .single();

  res.json(data || { status: 'disconnected' });
});

// Webhook for WhatsApp (Placeholder)
app.post('/api/whatsapp/webhook', async (req, res) => {
  console.log('[WEBHOOK UAZAPI] Payload received:', JSON.stringify(req.body));
  // TODO: Implement AI Handler logic here
  res.json({ status: 'processing' });
});

// Webhook for Platforms (Generic)
app.post('/api/webhooks/:clientId', async (req, res) => {
  const { clientId } = req.params;
  const payload = req.body;
  
  console.log(`[WEBHOOK] Received for client ${clientId}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

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
          event = payload.event; // PURCHASE_APPROVED, CART_ABANDONMENT
      } 
      // Kiwify Detection
      else if (payload.order_id && payload.product_id) { // Kiwify usually sends order_id
          platform = 'kiwify';
          externalProductId = payload.product_id;
          email = payload.email;
          phone = payload.mobile;
          event = payload.status; // paid, refund, chargedback, waiting_payment
      }
      // Eduzz Detection (Example)
      else if (payload.trans_cod) {
          platform = 'eduzz';
          externalProductId = payload.product_cod;
          email = payload.cus_email;
          phone = payload.cus_cel;
          event = payload.trans_status;
      }

      console.log(`Detected Platform: ${platform}, Product ID: ${externalProductId}, Event: ${event}`);

      if (!externalProductId) {
          return res.status(400).json({ status: 'ignored', reason: 'unknown_platform_or_product' });
      }

      // 2. Lookup Product in DB
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('client_id', clientId)
        .eq('external_product_id', String(externalProductId)) // Ensure string comparison
        .single();

      if (error || !product) {
          console.log(`Product ${externalProductId} not configured for client ${clientId}`);
          return res.json({ status: 'ignored', reason: 'product_not_configured' });
      }

      // 3. Handle Event Logic
      // (This logic would be expanded based on specific platform event names)
      if (['PURCHASE_APPROVED', 'paid', '3'].includes(event)) { // 3 is Eduzz paid status example
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
              email: email,
              phone: phone,
              status: 'pending_recovery',
              name: payload.name || payload.first_name || 'Cliente',
              checkout_url: payload.checkout_url || '',
              value: payload.price || payload.amount || 0
          };

          const { data: lead, error: leadError } = await supabase
            .from('leads')
            .insert(leadData)
            .select()
            .single();
            
          if (leadError) {
              console.error('Error creating lead:', leadError);
              return res.status(500).json({ error: 'db_error' });
          }

          // Trigger AI Recovery Task (Placeholder for Celery/Queue)
          // schedule_recovery(lead.id); 
          
          return res.json({ status: 'queued', lead_id: lead.id });
      }

      res.json({ status: 'ignored', reason: 'unhandled_event' });

  } catch (error: any) {
      console.error('Webhook Error:', error);
      res.status(500).json({ error: error.message });
  }
});


// Vite Middleware (Must be last)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
