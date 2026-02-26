import OpenAI from 'openai';
import { supabaseAdmin } from '../lib/supabaseAdmin.ts';
import { sendMessageUazapi } from './uazapiService.ts';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT_TEMPLATE = `
Você é um especialista em recuperação de vendas do produto {product_name}.
Seu nome é {agent_name}.

CONTEXTO:
O cliente {lead_name} iniciou o checkout mas não finalizou.
Link de Checkout: {checkout_url}
Preço do produto: R$ {product_price}

SUA MISSÃO:
Descobrir educadamente por que ele não comprou e tentar reverter.
Use a técnica de vendas: Empatia -> Sondagem -> Solução.

DIRETRIZES DE COMPORTAMENTO:
- Persona: {agent_persona}
- Tratamento de Objeções: {objection_handling}
- Link de Downsell (OFERECER APENAS SE A OBJEÇÃO FOR PREÇO): {downsell_link}

REGRAS RÍGIDAS:
1. Respostas curtas e naturais para WhatsApp (máx 2 frases).
2. NUNCA invente dados que não estão aqui.
3. Se o cliente disser que já comprou, parabenize e encerre.
4. Se o cliente for rude ou pedir para parar, peça desculpas e encerre.
5. Aguarde a resposta do cliente antes de mandar a próxima info.
`;

export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function buildSystemPrompt(product: Record<string, any>, lead: Record<string, any>): string {
  return SYSTEM_PROMPT_TEMPLATE
    .replace('{product_name}', product.name || 'Produto')
    .replace('{agent_name}', 'Assistente')
    .replace('{lead_name}', lead.name || 'Cliente')
    .replace('{checkout_url}', lead.checkout_url || product.external_product_id || '')
    .replace('{product_price}', String(lead.value ?? 'não informado'))
    .replace('{agent_persona}', product.agent_persona || 'Amigável e prestativo')
    .replace('{objection_handling}', product.objection_handling || 'Foque no valor agregado')
    .replace('{downsell_link}', product.downsell_link || 'Não disponível');
}

export async function generateInitialMessage(product: Record<string, any>, lead: Record<string, any>): Promise<string> {
  const systemPrompt = buildSystemPrompt(product, lead);
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Inicie a conversa com uma mensagem de recuperação.' },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 150,
      temperature: 0.7,
      presence_penalty: 0.6,
    });
    return response.choices[0].message.content?.trim() || `Olá ${lead.name}, vi que não concluiu a compra do ${product.name}.`;
  } catch (error) {
    console.error(`[AI HANDLER] Error generating initial message: ${error}`);
    return `Olá ${lead.name}, vi que não concluiu a compra do ${product.name}.`;
  }
}

export async function processConversationStep(phoneNumber: string, incomingMessage: string, instanceKey: string): Promise<void> {
  console.log(`[AI AGENT] Processando mensagem de ${phoneNumber}: ${incomingMessage}`);

  const cleanPhone = cleanPhoneNumber(phoneNumber);

  // Find lead by phone
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('*')
    .ilike('phone', `%${cleanPhone}%`);

  if (!leads || leads.length === 0) {
    console.log(`[AI AGENT] Lead não encontrado para o telefone ${cleanPhone}`);
    return;
  }

  const lead = leads[0];
  const leadId = lead.id;

  // Kill switch
  if (['converted_organically', 'recovered_by_ai', 'failed'].includes(lead.status)) {
    console.log(`[AI AGENT] Lead ${leadId} já finalizado. Status: ${lead.status}`);
    return;
  }

  // Fetch product
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', lead.product_id);

  if (!products || products.length === 0) {
    console.log('[AI AGENT] Produto não encontrado.');
    return;
  }

  const product = products[0];

  // Build conversation history
  const currentLog: Array<{ role: string; content: string }> = lead.conversation_log || [];
  currentLog.push({ role: 'user', content: incomingMessage });

  const systemPrompt = buildSystemPrompt(product, lead);
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...currentLog.slice(-6) as OpenAI.ChatCompletionMessageParam[],
  ];

  try {
    console.log('[AI AGENT] Chamando OpenAI...');
    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 150,
      temperature: 0.7,
      presence_penalty: 0.6,
    });

    const aiReply = gptResponse.choices[0].message.content?.trim() || '';
    console.log(`[AI AGENT] Resposta gerada: ${aiReply}`);

    await sendMessageUazapi(instanceKey, phoneNumber, aiReply);

    currentLog.push({ role: 'assistant', content: aiReply });

    await supabaseAdmin
      .from('leads')
      .update({
        conversation_log: currentLog,
        status: 'contacted',
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);

  } catch (error) {
    console.error(`[AI AGENT CRITICAL ERROR] ${error}`);
  }
}
