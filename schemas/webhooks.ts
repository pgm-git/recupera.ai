import { z } from 'zod';

export const HotmartWebhookSchema = z.object({
  hottok: z.string().optional(),
  hotmart_id: z.string().optional(),
  prod: z.string().optional(),
  product_id: z.string().optional(),
  email: z.string().email(),
  phone_number: z.string().optional(),
  phone_local_code: z.string().optional(),
  event: z.string(),
  name: z.string().optional(),
  first_name: z.string().optional(),
  price: z.number().optional(),
  amount: z.number().optional(),
  checkout_url: z.string().optional(),
}).refine(data => data.hottok || data.hotmart_id, {
  message: 'Must have hottok or hotmart_id',
});

export const KiwifyWebhookSchema = z.object({
  order_id: z.string(),
  product_id: z.string(),
  email: z.string().email(),
  mobile: z.string().optional(),
  status: z.string(),
  name: z.string().optional(),
  amount: z.number().optional(),
  price: z.number().optional(),
  checkout_url: z.string().optional(),
});

export const EduzzWebhookSchema = z.object({
  trans_cod: z.string(),
  product_cod: z.string(),
  cus_email: z.string().email(),
  cus_cel: z.string().optional(),
  trans_status: z.string(),
  name: z.string().optional(),
});

export const UazapiWebhookSchema = z.object({
  instanceName: z.string(),
  message: z.object({
    key: z.object({
      remoteJid: z.string(),
      fromMe: z.boolean(),
      id: z.string().optional(),
    }),
    message: z.object({
      conversation: z.string().optional(),
      extendedTextMessage: z.object({
        text: z.string(),
      }).optional(),
    }).optional(),
  }),
});
