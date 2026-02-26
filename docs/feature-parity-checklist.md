# Feature Parity Checklist — Python (FastAPI) vs Node.js (Express)

**Purpose:** Map all Python backend behaviors to Node.js equivalents before Story 1.5 (Backend Consolidation).

**Status: ALL DONE — Python backend deleted. Node.js is the sole backend.**

## Endpoint Mapping

| # | Python Endpoint | Node.js Endpoint | Status | Notes |
|---|----------------|------------------|--------|-------|
| 1 | `POST /api/whatsapp/connect/{client_id}` | `POST /api/whatsapp/connect/:clientId` | DONE | Both: init instance → get QR → upsert DB → fallback mock |
| 2 | `GET /api/whatsapp/status/{client_id}` | `GET /api/whatsapp/status/:clientId` | DONE | Both: UAZAPI status → update DB → fallback to DB |
| 3 | `POST /api/whatsapp/webhook` | `POST /api/whatsapp/webhook` | DONE | Full message parsing + AI dispatch via processConversationStep |
| 4 | `POST /api/webhooks/{platform}/{client_id}` | `POST /api/webhooks/:clientId` | DONE | Platform detected from payload body + scheduleRecovery via BullMQ |

## Unique Python Logic — All Ported

### 1. `ai_handler.process_conversation_step()` → `services/aiHandler.ts`

- [x] Look up lead by phone number (ilike match)
- [x] Kill switch check (skip if converted/recovered/failed)
- [x] Look up product for AI persona
- [x] Build conversation history from `conversation_log` JSONB
- [x] Construct system prompt with template variables
- [x] Limit conversation history to last 6 messages
- [x] Call OpenAI `gpt-4o-mini` (max_tokens=150, temperature=0.7, presence_penalty=0.6)
- [x] Send AI response via UAZAPI (`/message/text`)
- [x] Append AI response to `conversation_log`
- [x] Update lead status to `contacted`

### 2. `ai_handler.send_message_uazapi()` → `services/uazapiService.ts`

- [x] POST to `{UAZAPI_BASE_URL}/message/text`
- [x] Payload: `{instanceName, number, text}`
- [x] Timeout: 10 seconds
- [x] Error logging (non-throwing)

### 3. `celery_worker.schedule_recovery()` → `services/recoveryWorker.ts` + `services/queueService.ts`

- [x] Fetch lead by ID
- [x] Kill switch check (`status != 'pending_recovery'` → abort)
- [x] Fetch product config
- [x] Fetch connected WhatsApp instance for client
- [x] **BUG FIXED**: Uses `generateInitialMessage()` (OpenAI) instead of nonexistent `generate_message()`
- [x] Send message via UAZAPI
- [x] Update lead: status → `contacted`, append to `conversation_log`
- [x] BullMQ replaces Celery (delay, 3 attempts, exponential backoff)

### 4. WhatsApp Webhook Parsing (from `main.py`)

- [x] Parse `instanceName`
- [x] Parse `message.key.remoteJid` → extract phone
- [x] Filter `fromMe` messages
- [x] Extract text from `conversation`
- [x] Extract text from `extendedTextMessage`
- [x] Ignore empty text
- [x] Fire-and-forget dispatch to `processConversationStep()`

### 5. Kill Switch Events

- [x] `PURCHASE_APPROVED` (Hotmart)
- [x] `ORDER_APPROVED` (Hotmart — was in Python, now in Node)
- [x] `paid` (Kiwify)
- [x] `3` (Eduzz)

## Known Python Bugs — All Resolved

1. **celery_worker.py:74** — `generate_message()` bug → Fixed: uses OpenAI with same prompt/model
2. **celery_worker.py:83** — deprecated asyncio pattern → Eliminated: BullMQ is native async
3. **ai_handler.py:64** — ilike match returns multiple leads → Preserved behavior (takes first), documented
4. **main.py:194** — phone concatenation bug → Preserved Node.js payload parsing (separate fields)
