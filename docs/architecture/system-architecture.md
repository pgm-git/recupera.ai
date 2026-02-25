# System Architecture - Recupera.AI

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 1
**Agente:** @architect (Aria)
**Status:** COMPLETE

---

## 1. Visao Geral

Recupera.AI e uma plataforma SaaS de recuperacao de vendas abandonadas via WhatsApp com IA. O sistema detecta checkouts abandonados em plataformas de e-commerce (Hotmart, Kiwify, Eduzz), aciona um agente conversacional via OpenAI GPT-4o-mini, e envia mensagens de recuperacao via WhatsApp (UAZAPI).

**Arquitetura atual:** Dual-backend monolito (Node.js + Python) com frontend React SPA.

---

## 2. Stack Tecnologico

| Camada | Tecnologia | Versao | Status |
|--------|-----------|--------|--------|
| Frontend | React + TypeScript | 19.2.4 | Atual |
| Build | Vite | 6.2.0 | Atual |
| Router | React Router | 7.13.0 | Atual |
| Charts | Recharts | 3.7.0 | Atual |
| Icons | Lucide React | 0.563.0 | Atual |
| CSS | Tailwind (CDN) | - | Nao versionado |
| Backend Node | Express | 5.2.1 | Breaking changes vs v4 |
| Backend Python | FastAPI | Nao pinado | Risco |
| Task Queue | Celery | Nao pinado | Risco |
| Message Broker | Redis | Nao pinado | Risco |
| Database | Supabase (PostgreSQL) | - | Sem migrations |
| AI/LLM | OpenAI GPT-4o-mini | Hardcoded | Nao configuravel |
| WhatsApp | UAZAPI | - | Dependencia terceiro |
| HTTP Client | Axios (Node) + httpx (Python) | ^1.13.5 | Ok |

---

## 3. Estrutura de Pastas

```
recuperaai/
├── App.tsx                     # React root (Router setup)
├── index.tsx                   # React DOM mount point
├── index.html                  # HTML entry (Tailwind CDN)
├── server.ts                   # Express backend (268 linhas)
├── types.ts                    # TypeScript interfaces (61 linhas)
├── tsconfig.json               # TypeScript config (strict)
├── vite.config.ts              # Vite + Express dev server
├── package.json                # Frontend + Node deps
├── package-lock.json           # Lock file
│
├── components/                 # React components
│   ├── Layout.tsx              # Sidebar nav + main container (107 loc)
│   ├── QRModal.tsx             # WhatsApp QR scan modal (111 loc)
│   ├── LeadsTable.tsx          # Leads data table (121 loc)
│   ├── ProductCard.tsx         # Product grid card (88 loc)
│   ├── ProductModal.tsx        # Product config form (251 loc)
│   ├── MetricCard.tsx          # KPI metric display (65 loc)
│   └── RecoveryChart.tsx       # Bar chart visualization (69 loc)
│
├── pages/                      # Route pages
│   ├── Dashboard.tsx           # Metricas + tabela leads (126 loc)
│   ├── Products.tsx            # Product CRUD interface (163 loc)
│   └── Settings.tsx            # Integracoes + API config (132 loc)
│
├── services/                   # Data access layer
│   ├── apiService.ts           # WhatsApp API calls
│   ├── dataService.ts          # Supabase queries + mock fallback
│   └── mockService.ts          # Demo data for dev mode
│
├── lib/
│   └── supabase.ts             # Supabase client init
│
├── backend/                    # Python FastAPI
│   ├── main.py                 # FastAPI app (234 loc)
│   ├── ai_handler.py           # OpenAI integration (155 loc)
│   ├── celery_worker.py        # Background tasks (94 loc)
│   └── requirements.txt        # Deps SEM versao
│
└── supabase/
    └── schema.sql              # DB schema (72 loc)
```

**Total LOC estimado:** ~2.000 linhas de codigo fonte

---

## 4. Fluxo de Dados Principal

```
[Hotmart/Kiwify/Eduzz]
      │ webhook (CART_ABANDONMENT)
      ▼
[Express/FastAPI] ─── cria lead (status: pending_recovery)
      │
      ▼
[Celery Worker] ─── aguarda delay_minutes
      │
      ▼
[AI Handler] ─── gera mensagem via OpenAI GPT-4o-mini
      │
      ▼
[UAZAPI] ─── envia WhatsApp para cliente
      │
      ▼
[Cliente responde] ─── webhook UAZAPI
      │
      ▼
[AI Handler] ─── processa resposta, atualiza conversation_log
      │
      ▼
[Loop conversacional ate conversao ou falha]
```

### Kill Switches
- **PURCHASE_APPROVED** webhook → status = `converted_organically` (para de contatar)
- Cliente pede para parar → status = `do_not_contact`
- Tentativas esgotadas → status = `failed`
- Compra confirmada via IA → status = `recovered_by_ai`

---

## 5. Endpoints API

### Express (server.ts)

| Endpoint | Method | Proposito | Auth |
|----------|--------|-----------|------|
| `/api/whatsapp/connect/:clientId` | POST | Inicia conexao WhatsApp (QR code) | NENHUMA |
| `/api/whatsapp/status/:clientId` | GET | Checa status da instancia | NENHUMA |
| `/api/whatsapp/webhook` | POST | Recebe msgs do UAZAPI | NENHUMA |
| `/api/webhooks/:clientId` | POST | Recebe webhooks plataformas | NENHUMA |

### FastAPI (backend/main.py)

| Endpoint | Method | Proposito | Auth |
|----------|--------|-----------|------|
| `/api/whatsapp/connect/{client_id}` | POST | Mesmo que Express (duplicado) | NENHUMA |
| `/api/whatsapp/status/{client_id}` | GET | Mesmo que Express (duplicado) | NENHUMA |
| `/api/whatsapp/webhook` | POST | Processa msgs com AI handler | NENHUMA |
| `/api/webhooks/{platform}/{client_id}` | POST | Webhooks + Celery task | NENHUMA |

---

## 6. Schema do Banco (Supabase)

| Tabela | Proposito | Campos-chave |
|--------|-----------|-------------|
| `clients` | Usuarios SaaS | id (UUID), email, name, api_key |
| `instances` | Conexoes WhatsApp | client_id (FK), instance_key, status, qr_code_base64 |
| `products` | Config do agente AI | client_id (FK), platform, agent_persona, delay_minutes |
| `leads` | Checkouts abandonados | client_id (FK), product_id (FK), status, conversation_log (JSONB) |

**RLS:** Habilitado mas ineficaz (frontend usa anon key, `auth.uid()` retorna NULL)

---

## 7. Dependencias Externas

| Servico | Uso | Criticidade | Risco |
|---------|-----|-------------|-------|
| **Supabase** | DB + Auth + Storage | CRITICA | Vendor lock-in moderado |
| **UAZAPI** | WhatsApp messaging | CRITICA | Single point of failure, sem SLA |
| **OpenAI** | Geracao de mensagens | CRITICA | Custo variavel, rate limits |
| **Hotmart** | Webhooks de vendas | ALTA | API pode mudar sem aviso |
| **Kiwify** | Webhooks de vendas | ALTA | API pode mudar sem aviso |
| **Eduzz** | Webhooks de vendas | MEDIA | Implementacao incompleta |
| **Redis** | Broker para Celery | ALTA | Necessario para recovery pipeline |

---

## 8. Debitos Tecnicos Identificados (Nivel Sistema)

### CRITICOS (bloqueiam producao)

| ID | Debito | Impacto | Esforco |
|----|--------|---------|---------|
| SYS-01 | Credenciais hardcoded em 6+ locais | Vazamento de chaves reais no git | 2h |
| SYS-02 | Zero autenticacao nos endpoints API | Qualquer pessoa acessa qualquer dado | 4h |
| SYS-03 | Verificacao de webhook ausente | Webhooks falsificaveis | 3h |
| SYS-04 | Dual backend sem orquestracao | Endpoints duplicados, dados inconsistentes | 20h |
| SYS-05 | Zero testes | Impossivel validar mudancas | 10h |
| SYS-06 | CORS configurado como `*` | XSS e CSRF possiveis | 1h |
| SYS-07 | Sem validacao de env vars no startup | Runtime errors em producao | 2h |

### ALTOS (bloqueiam beta)

| ID | Debito | Impacto | Esforco |
|----|--------|---------|---------|
| SYS-08 | Sem validacao de input | Injection possiveis | 6h |
| SYS-09 | Sem rate limiting | DDoS / abuso | 3h |
| SYS-10 | Error handling inconsistente | Erros silenciosos, debug impossivel | 4h |
| SYS-11 | Python deps sem versao pinada | Build nao reproduzivel | 1h |
| SYS-12 | Sem sistema de migrations | Schema nao versionado | 2h |
| SYS-13 | RLS ineficaz com anon key | Multi-tenancy comprometido | 2h |
| SYS-14 | `ai_handler.generate_message()` nao existe | Celery task falha em runtime | 2h |

### MEDIOS (pre-v1.0)

| ID | Debito | Impacto | Esforco |
|----|--------|---------|---------|
| SYS-15 | Sem state management global | Prop drilling, dados dessincronizados | 6h |
| SYS-16 | Sem error boundaries React | Crash cascata no frontend | 3h |
| SYS-17 | Polling ao inves de realtime | Carga desnecessaria no server | 3h |
| SYS-18 | Sem CI/CD pipeline | Deploy manual, risco humano | 8h |
| SYS-19 | Sem monitoring/logging | Cego em producao | 6h |
| SYS-20 | Sem feature flags | Impossivel rollback parcial | 3h |

---

## 9. Vulnerabilidades de Seguranca

| Vuln | CVSS | Descricao |
|------|------|-----------|
| Credenciais expostas no source code | 9.8 | Supabase + UAZAPI keys em plaintext |
| Sem autenticacao API | 9.1 | Endpoints abertos ao publico |
| Sem verificacao de webhook | 8.7 | Hotmart/Kiwify spoofaveis |
| RLS bypass via anon key | 8.5 | Frontend usa key publica |
| Supabase key no frontend | 9.0 | Chave visivel no bundle |
| AI prompt injection | 7.8 | Msgs do usuario nao sanitizadas |
| Sem validacao de input | 7.4 | POST body aceita qualquer JSON |
| CORS wildcard | 6.1 | Qualquer origem aceita |
| PII sem encriptacao | 6.5 | Telefones, emails em plaintext |
| Sem rate limiting | 6.5 | Endpoints vulneraveis a DDoS |

---

## 10. Recomendacoes Arquiteturais

### Decisao Principal: Consolidar para Backend Unico

**Recomendacao:** Manter Node.js/Express, migrar funcionalidade Python.

**Razoes:**
1. Frontend ja e TypeScript → tipos compartilhados
2. OpenAI SDK disponivel para Node.js
3. BullMQ substitui Celery com Redis no mesmo runtime
4. Deploy simplificado (1 runtime vs 2)
5. Menor custo operacional

### Arquitetura-Alvo

```
recuperaai/
├── apps/
│   ├── web/                    # React SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── services/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── index.html
│   │   └── vite.config.ts
│   └── api/                    # Express API
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   ├── jobs/           # BullMQ (substitui Celery)
│       │   └── lib/
│       └── tsconfig.json
├── packages/
│   └── types/                  # Shared TypeScript types
├── supabase/
│   ├── migrations/             # Versionadas
│   └── docs/
├── docs/
│   ├── architecture/
│   ├── stories/
│   └── prd/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 11. Perguntas para Especialistas

### Para @data-engineer:
1. O schema atual suporta multi-tenancy adequadamente?
2. Quais indexes sao essenciais para queries de dashboard?
3. RLS com anon key e viavel ou precisa migrar para service role?
4. conversation_log como JSONB e adequado ou melhor tabela separada?

### Para @ux-design-expert:
1. Design system existe ou componentes sao ad-hoc?
2. Estados de loading/error/empty estao cobertos?
3. Mobile-first ou desktop-first a abordagem atual?
4. Acessibilidade (a11y) esta minimamente coberta?

---

*Documento gerado por @architect (Aria) - Brownfield Discovery Phase 1*
