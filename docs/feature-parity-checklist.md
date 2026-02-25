# Feature Parity Checklist — Python (FastAPI) vs Node.js (Express)

**Purpose:** Map all Python backend behaviors to Node.js equivalents before Story 1.5 (Backend Consolidation).

## Endpoint Mapping

| # | Python Endpoint | Node.js Endpoint | Status | Notes |
|---|----------------|------------------|--------|-------|
| 1 | `POST /api/whatsapp/connect/{client_id}` | `POST /api/whatsapp/connect/:clientId` | EQUIVALENT | Both: init instance → get QR → upsert DB → fallback mock |
| 2 | `GET /api/whatsapp/status/{client_id}` | `GET /api/whatsapp/status/:clientId` | EQUIVALENT | Both: UAZAPI status → update DB → fallback to DB |
| 3 | `POST /api/whatsapp/webhook` | `POST /api/whatsapp/webhook` | MISSING LOGIC | Node is placeholder (`res.json({status:'processing'})`). Python has full message parsing + AI dispatch |
| 4 | `POST /api/webhooks/{platform}/{client_id}` | `POST /api/webhooks/:clientId` | DIFFERENT SIGNATURE | Python: platform in URL path. Node: platform detected from payload body |

## Detailed Behavior Comparison

### Endpoint 1: WhatsApp Connect

| Behavior | Python | Node.js | Parity |
|----------|--------|---------|--------|
| Init instance (UAZAPI) | httpx POST, swallow errors | axios POST, swallow errors | YES |
| Get QR code (UAZAPI) | httpx POST, extract `base64` | axios POST, extract `base64 \|\| qrCodeBase64` | YES (Node handles extra variant) |
| Upsert to `instances` table | `supabase.table().upsert()` | `supabase.from().upsert()` | YES |
| Fallback mock QR on failure | Returns fake base64 | Returns fake base64 + `mock: true` | YES (Node adds flag) |

### Endpoint 2: WhatsApp Status

| Behavior | Python | Node.js | Parity |
|----------|--------|---------|--------|
| Query UAZAPI status | httpx GET with params | axios GET with params | YES |
| Map `open` → `connected` | Yes | Yes | YES |
| Update `instances` table | Yes | Yes | YES |
| Fallback to DB query | `select("*").eq("client_id", ...)` | Same | YES |
| Default when no DB record | `{"status": "disconnected"}` | `{"status": "disconnected"}` | YES |

### Endpoint 3: WhatsApp Webhook (UAZAPI Messages)

| Behavior | Python | Node.js | Parity |
|----------|--------|---------|--------|
| Log payload | Yes | Yes | YES |
| Parse `instanceName` | Yes | NO | MISSING |
| Parse `message.key.remoteJid` | Yes — extracts phone | NO | MISSING |
| Filter `fromMe` messages | Yes — ignores own messages | NO | MISSING |
| Extract text from `conversation` | Yes | NO | MISSING |
| Extract text from `extendedTextMessage` | Yes | NO | MISSING |
| Ignore empty text | Yes | NO | MISSING |
| Dispatch to `ai_handler.process_conversation_step()` | Yes (BackgroundTask) | NO | MISSING |
| Return `{"status": "processing"}` | Yes | Yes | YES |

### Endpoint 4: Platform Webhooks (Hotmart/Kiwify/Eduzz)

| Behavior | Python | Node.js | Parity |
|----------|--------|---------|--------|
| Platform detection | From URL `{platform}` param | From payload markers (hottok, order_id, trans_cod) | DIFFERENT but functional |
| Hotmart event field | `body.get("event")` | `payload.event` | YES |
| Kiwify event field | Not explicitly handled (uses same `event`) | `payload.status` | DIFFERENT — Python doesn't handle Kiwify separately |
| Eduzz detection | Not in Python | Yes (trans_cod) | Node EXTRA |
| Product lookup | `eq("external_product_id", ...).eq("client_id", ...)` | Same | YES |
| Kill switch (purchase) | `update({"status": "converted_organically"})` | Same | YES |
| Kill switch events | `PURCHASE_APPROVED`, `ORDER_APPROVED` | `PURCHASE_APPROVED`, `paid`, `3` (Eduzz) | Node handles MORE |
| Create lead | Insert to `leads` table | Same | YES |
| Schedule Celery task | `schedule_recovery.delay(lead_id)` | Placeholder comment only | MISSING |
| Error handling | HTTPException 500 | `res.status(500).json()` | YES |

## Unique Python Logic NOT in Node.js

### 1. `ai_handler.process_conversation_step()` (ai_handler.py:52-137)

Full AI conversation loop:
- [ ] Look up lead by phone number (ilike match)
- [ ] Kill switch check (skip if converted/recovered/failed)
- [ ] Look up product for AI persona
- [ ] Build conversation history from `conversation_log` JSONB
- [ ] Construct system prompt with template variables:
  - `product_name`, `agent_name`, `lead_name`, `checkout_url`, `product_price`
  - `agent_persona`, `objection_handling`, `downsell_link`
- [ ] Limit conversation history to last 6 messages
- [ ] Call OpenAI `gpt-4o-mini` (max_tokens=150, temperature=0.7, presence_penalty=0.6)
- [ ] Send AI response via UAZAPI (`/message/text`)
- [ ] Append AI response to `conversation_log`
- [ ] Update lead status to `contacted`

### 2. `ai_handler.send_message_uazapi()` (ai_handler.py:139-160)

- [ ] POST to `{UAZAPI_BASE_URL}/message/text`
- [ ] Payload: `{instanceName, number, text}`
- [ ] Timeout: 10 seconds
- [ ] Error logging (non-throwing)

### 3. `celery_worker.schedule_recovery()` (celery_worker.py:41-100)

Background recovery task:
- [ ] Fetch lead by ID
- [ ] Kill switch check (`status != 'pending_recovery'` → abort)
- [ ] Fetch product config
- [ ] Fetch connected WhatsApp instance for client
- [ ] **BUG**: Calls `ai_handler.generate_message(lead, product, [])` which DOES NOT EXIST
  - Fallback: hardcoded message `"Olá {name}, vi que não concluiu a compra do {product_name}."`
- [ ] Send message via UAZAPI (async in sync Celery context via `asyncio.get_event_loop()`)
- [ ] Update lead: status → `contacted`, append to `conversation_log`

### 4. `celery_worker.send_whatsapp_async()` (celery_worker.py:27-39)

- [ ] Async HTTP POST to UAZAPI `/message/text`
- [ ] Same payload structure as `ai_handler.send_message_uazapi()`

## System Prompt Template (ai_handler.py:26-50)

```
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
```

## Migration Priority for Story 1.5

| Priority | Item | Effort |
|----------|------|--------|
| P0 | WhatsApp webhook message parsing (fromMe filter, text extraction) | 2h |
| P0 | AI conversation step (OpenAI integration) | 4h |
| P0 | UAZAPI message sending | 1h |
| P1 | Background task system (replace Celery with Node.js queue) | 4h |
| P1 | System prompt template | 1h |
| P2 | Fix `generate_message()` bug (doesn't exist in Python either) | 1h |

## Known Bugs in Python Backend

1. **celery_worker.py:74** — Calls `ai_handler.generate_message()` which doesn't exist. Falls back to hardcoded message.
2. **celery_worker.py:83** — `asyncio.get_event_loop()` deprecated pattern, may fail in newer Python.
3. **ai_handler.py:64** — `ilike("phone", f"%{clean_phone}%")` can match multiple leads; only takes first.
4. **main.py:194** — Phone concatenation: `phone_local_code + phone_number` may double the phone_number if both are present.
