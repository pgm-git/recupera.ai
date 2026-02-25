# Technical Debt Assessment - Recupera.AI (DRAFT)

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 4 (Initial Consolidation)
**Agente:** @architect (Aria)
**Status:** DRAFT — Pendente validacao de especialistas (Phases 5-7)

---

## 1. Resumo Executivo

### Visao Geral do Projeto

Recupera.AI e uma plataforma SaaS de recuperacao de vendas abandonadas via WhatsApp com IA. O sistema recebe webhooks de plataformas de e-commerce (Hotmart, Kiwify, Eduzz), aciona um agente conversacional GPT-4o-mini, e envia mensagens de recuperacao via WhatsApp (UAZAPI).

### Estado Atual: NAO PRONTO PARA PRODUCAO

| Dimensao | Score | Status | Fonte |
|----------|-------|--------|-------|
| Arquitetura de Sistema | 3/10 | CRITICO | Phase 1 (@architect) |
| Seguranca | 1/10 | CRITICO | Phase 1 (@architect) |
| Database (Schema + RLS) | 2.7/10 | CRITICO | Phase 2 (@data-engineer) |
| Frontend/UX | 3/10 | CRITICO | Phase 3 (@ux-design-expert) |
| **MEDIA GERAL** | **2.4/10** | **CRITICO** | Consolidado |

### Metricas do Codebase

| Metrica | Valor |
|---------|-------|
| Total LOC | ~2,000 |
| Testes | 0 |
| Endpoints sem autenticacao | 8/8 (100%) |
| Credenciais expostas | 6+ arquivos |
| Vulnerabilidades CVSS >= 8.0 | 5 |
| Debitos tecnicos totais | 72 |

---

## 2. Inventario Completo de Debitos Tecnicos

### 2.1 Classificacao por Severidade

| Severidade | Sistema | Database | Frontend | Total |
|-----------|---------|----------|----------|-------|
| CRITICO (bloqueia producao) | 7 | 6 | 4 | **17** |
| ALTO (bloqueia beta) | 7 | 7 | 11 | **25** |
| MEDIO (pre-v1.0) | 6 | 7 | 14 | **27** |
| BAIXO | 0 | 0 | 3 | **3** |
| **TOTAL** | **20** | **20** | **32** | **72** |

### 2.2 Classificacao por Dominio

| Dominio | Debitos | Esforco Estimado |
|---------|---------|-----------------|
| Seguranca & Autenticacao | 12 | ~30h |
| Arquitetura Backend | 5 | ~35h |
| Database Schema & Performance | 20 | ~55h |
| Frontend/UX | 32 | ~45h |
| DevOps & Infra | 3 | ~17h |
| **TOTAL** | **72** | **~182h** |

---

## 3. Debitos CRITICOS — Bloqueiam Producao

Estes debitos representam riscos de seguranca, perda de dados ou falhas que impedem qualquer uso em producao.

### SEC-01: Credenciais Hardcoded no Source Code (CVSS 9.8)

**Origem:** SYS-01 + DB-05
**Arquivos afetados:**
- `server.ts` (linhas 18-24): Supabase URL, Service Role Key, UAZAPI API Key
- `backend/main.py` (linhas 30-36): mesmas credenciais
- `backend/ai_handler.py`: OpenAI API Key
- `backend/celery_worker.py`: Supabase credentials
- `lib/supabase.ts` (linhas 4-5): Supabase URL + Anon Key como fallback

**Impacto:** Service Role Key exposta permite acesso irrestrito ao banco. API keys de servicos pagos (OpenAI, UAZAPI) podem ser exploradas.

**Remediacao:**
1. Remover TODAS as credenciais do codigo fonte
2. Implementar `.env` com `dotenv` (Node) e `python-dotenv` (Python)
3. Adicionar `.env` ao `.gitignore`
4. Rotacionar TODAS as chaves expostas no git history
5. Considerar git-filter-branch ou BFG para limpar historico

**Esforco:** 4h (implementacao) + 2h (rotacao de chaves)

---

### SEC-02: Zero Autenticacao em Todos os Endpoints (CVSS 9.1)

**Origem:** SYS-02
**Escopo:** 8 endpoints (4 Express + 4 FastAPI), todos sem qualquer autenticacao.

**Impacto:** Qualquer pessoa com a URL pode:
- Ver dados de qualquer cliente
- Criar/modificar leads
- Falsificar webhooks
- Acessar QR codes de WhatsApp de outros usuarios

**Remediacao:**
1. Implementar Supabase Auth no frontend (login/signup UI)
2. JWT validation middleware no Express
3. JWT validation dependency no FastAPI
4. Webhook signature verification (Hotmart/Kiwify)

**Esforco:** 8h

---

### SEC-03: RLS Completamente Ineficaz (CVSS 8.5)

**Origem:** DB-01 + DB-02 + SYS-13
**Situacao:**
```
Frontend → anon key → auth.uid() = NULL → policies retornam FALSE → NADA funciona via RLS
Backend → service_role → BYPASSA RLS completamente → sem restricao alguma
```

**O sistema funciona apenas porque:**
- Frontend usa fallback para mock data quando Supabase falha
- Backend usa service_role que ignora RLS

**Remediacao:**
1. Implementar Supabase Auth no frontend
2. Separar policies por operacao (SELECT, INSERT, UPDATE)
3. Criar funcoes SECURITY DEFINER para operacoes de backend
4. Testar RLS com usuario autenticado real

**Esforco:** 6h

---

### SEC-04: Webhook Spoofing sem Verificacao (CVSS 8.7)

**Origem:** SYS-03
**Escopo:** Webhooks de Hotmart, Kiwify e UAZAPI aceitos sem verificacao de assinatura.

**Impacto:** Atacante pode:
- Injetar leads falsos
- Disparar mensagens WhatsApp para numeros arbitrarios
- Manipular status de conversao (financial impact)

**Remediacao:**
1. Implementar verificacao HMAC para Hotmart webhooks
2. Implementar verificacao de assinatura Kiwify
3. Validar IP/token UAZAPI
4. Rate limiting nos endpoints de webhook

**Esforco:** 5h

---

### SEC-05: CORS Wildcard + Supabase Key no Bundle (CVSS 9.0)

**Origem:** SYS-06
**Situacao:** CORS configurado como `*` em ambos backends. Supabase anon key visivel no JavaScript bundle.

**Remediacao:**
1. Configurar CORS com dominio especifico
2. Anon key no frontend e ACEITAVEL (Supabase design), mas RLS DEVE funcionar
3. Service role key NUNCA deve estar no frontend

**Esforco:** 2h

---

### ARCH-01: Dual Backend sem Orquestracao

**Origem:** SYS-04
**Situacao:** Express (Node.js) e FastAPI (Python) servem endpoints duplicados sem orquestracao. Nao ha contrato definido entre eles.

| Endpoint | Express | FastAPI | Quem o frontend usa? |
|----------|---------|---------|---------------------|
| WhatsApp connect | SIM | SIM | Express |
| WhatsApp status | SIM | SIM | Express |
| WhatsApp webhook | SIM | SIM | Indeterminado |
| Platform webhooks | SIM | SIM | Indeterminado |

**Impacto:** Dados podem ir para backends diferentes, gerando inconsistencia. Manutenção duplicada.

**Recomendacao:** Consolidar para Node.js/Express unico:
- OpenAI SDK existe para Node.js
- BullMQ substitui Celery+Redis no mesmo runtime
- TypeScript compartilhado com frontend
- 1 runtime em vez de 2

**Esforco:** 20h

---

### ARCH-02: Celery Worker com Bug Critico em Runtime

**Origem:** SYS-14
**Situacao:** `celery_worker.py:68` chama `ai_handler.generate_message()` que NAO EXISTE. O metodo correto e `process_conversation_step()`.

**Impacto:** Pipeline de recuperacao NUNCA funciona via Celery. Recovery tasks sempre falham em runtime.

**Esforco:** 2h

---

### DB-CRIT-01: Schema MVP Desatualizado vs Schema Completo

**Origem:** DB-03
**Situacao:** Dois schemas concorrentes:
- MVP em `supabase/schema.sql` (4 tabelas basicas, em uso)
- Completo em `~/recupera_ai_schema.sql` (4 tabelas maduras, NAO em uso)

O schema completo tem ENUMs, triggers, soft deletes, 12+ indexes, agent_configs separado, subscription management — mas o codigo usa o MVP.

**Esforco:** 8h para migrar

---

### DB-CRIT-02: Sem Sistema de Migrations

**Origem:** DB-04
**Situacao:** Schema e DDL puro (`schema.sql`). Sem Supabase migrations, sem versionamento, sem rollback.

**Esforco:** 3h

---

### DB-CRIT-03: conversation_log JSONB Sem Limite

**Origem:** DB-06
**Projecao:** Com 100k leads e 50 msgs/lead = ~1 GB apenas em JSONB. Sem possibilidade de query individual ou indexes.

**Remediacao MVP:** Limitar a 50 mensagens por lead.
**Remediacao Producao:** Tabela `messages` separada.

**Esforco:** 3h (MVP) / 6h (producao)

---

### UX-CRIT-01: Tailwind via CDN

**Origem:** UX-DS-01
**Impacto:** Render-blocking, nao funciona offline, sem tree-shaking, sem purge.

**Esforco:** 2h

---

### UX-CRIT-02: Auth Flow Inexistente

**Origem:** UX — Fluxos Ausentes
**Impacto:** Sem login/signup/forgot password. Todo o app roda como "Usuario Demo" hardcoded. Impossivel multi-tenancy real.

**Esforco:** 12h (login + signup + forgot password + protected routes)

---

### UX-CRIT-03: Dashboard com Dados Hardcoded

**Origem:** UX-ST-01
**Impacto:** KPIs (`R$ 15.400,00`, `1.240`, `18.4%`) e status sidebar (45, 128, 84, 12) sao valores hardcoded. Grafico usa mock data.

**Esforco:** 4h

---

### UX-CRIT-04: Zero Error States

**Origem:** UX-ST-02
**Impacto:** Nenhum componente exibe erro visual. Erros vao para `console.error` ou `alert()` nativo. Usuario nao sabe o que aconteceu.

**Esforco:** 4h

---

## 4. Debitos ALTOS — Bloqueiam Beta

### 4.1 Sistema

| ID | Debito | Esforco |
|----|--------|---------|
| SYS-08 | Sem validacao de input (injection) | 6h |
| SYS-09 | Sem rate limiting | 3h |
| SYS-10 | Error handling inconsistente | 4h |
| SYS-11 | Python deps sem versao pinada | 1h |
| SYS-12 | Sem sistema de migrations | 2h |
| SYS-05 | Zero testes automatizados | 10h |
| SYS-07 | Sem validacao de env vars no startup | 2h |

### 4.2 Database

| ID | Debito | Esforco |
|----|--------|---------|
| DB-07 | Apenas 2 indexes (3 queries criticas sem index) | 2h |
| DB-08 | Sem `updated_at` em 3 tabelas | 2h |
| DB-09 | Sem triggers de auto-update timestamp | 1h |
| DB-10 | Sem UNIQUE constraint para leads (email+product_id) | 1h |
| DB-11 | Phone sem validacao de formato | 2h |
| DB-12 | Status como TEXT CHECK ao inves de ENUM | 2h |
| DB-13 | Valor monetario como NUMERIC sem precisao | 2h |

### 4.3 Frontend/UX

| ID | Debito | Esforco |
|----|--------|---------|
| UX-RES-01 | Safe area nao tratado em iPhones | 1h |
| UX-ST-03 | Sem estado offline/fallback visual | 3h |
| UX-ST-04 | ProductModal usa `alert()` para erros | 1h |
| UX-ST-06 | Sem toast/notification system | 3h |
| UX-PERF-04 | Sem caching de dados (TanStack Query) | 4h |
| UX-PERF-05 | importmap carrega deps de ESM CDN | 2h |
| UX-DS-02 | Config de cores inline no HTML | 2h |
| UX-DS-03 | Sem arquivo de tokens/theme | 2h |
| UX — Flows | Falta lead detail view + conversation view | 8h |
| UX — Flows | Falta onboarding wizard | 6h |
| UX — Flows | Falta profile/account page | 3h |

---

## 5. Debitos MEDIOS — Pre-v1.0

### 5.1 Sistema

| ID | Debito | Esforco |
|----|--------|---------|
| SYS-15 | Sem state management global | 6h |
| SYS-16 | Sem error boundaries React | 3h |
| SYS-17 | Polling ao inves de Supabase Realtime | 3h |
| SYS-18 | Sem CI/CD pipeline | 8h |
| SYS-19 | Sem monitoring/logging | 6h |
| SYS-20 | Sem feature flags | 3h |

### 5.2 Database

| ID | Debito | Esforco |
|----|--------|---------|
| DB-14 | Sem soft deletes | 3h |
| DB-15 | Sem tabela `agent_configs` separada | 4h |
| DB-16 | Sem tabela `messages` separada | 6h |
| DB-17 | Sem `recovery_attempts` tracking | 1h |
| DB-18 | Sem `next_contact_scheduled_at` | 1h |
| DB-19 | Schema sem COMMENT ON | 1h |
| DB-20 | Sem funcao/view para metricas do dashboard | 4h |

### 5.3 Frontend/UX

| ID | Debito | Esforco |
|----|--------|---------|
| UX-A11Y-01 a 05 | Acessibilidade (ARIA, focus trap, contraste, skip nav) | 8.5h |
| UX-CON-01 a 04 | Inconsistencias visuais (padding, icons, radius, fonts) | 4h |
| UX-PERF-02 | Google Fonts sem font-display:swap | 0.5h |
| UX-PERF-03 | Sem code splitting (React.lazy) | 2h |
| UX-RES-02 | Tabela de leads ilegivel em mobile | 2h |
| UX-RES-03 | ProductModal pode cortar conteudo | 1h |

---

## 6. Vulnerabilidades de Seguranca (Consolidado)

| # | Vulnerabilidade | CVSS | Status |
|---|----------------|------|--------|
| 1 | Credenciais expostas no source code | 9.8 | SEC-01 |
| 2 | Supabase Service Role Key no frontend | 9.0 | SEC-05 |
| 3 | Sem autenticacao API | 9.1 | SEC-02 |
| 4 | Sem verificacao de webhook | 8.7 | SEC-04 |
| 5 | RLS bypass via anon key sem auth | 8.5 | SEC-03 |
| 6 | AI prompt injection (msgs nao sanitizadas) | 7.8 | Novo |
| 7 | Sem validacao de input | 7.4 | SYS-08 |
| 8 | PII sem encriptacao (telefones, emails) | 6.5 | Medio |
| 9 | Sem rate limiting | 6.5 | SYS-09 |
| 10 | CORS wildcard | 6.1 | SEC-05 |

**5 vulnerabilidades com CVSS >= 8.0** — classificacao: **RISCO CRITICO**

---

## 7. Recomendacoes Arquiteturais

### 7.1 Decisao: Consolidar para Backend Unico (Node.js)

**Recomendacao FORTE: Eliminar o backend Python.**

| Aspecto | Estado Atual | Estado Alvo |
|---------|-------------|-------------|
| Runtime | Node.js + Python | Node.js unico |
| Task Queue | Celery + Redis | BullMQ + Redis |
| AI Integration | OpenAI Python SDK | OpenAI Node.js SDK |
| HTTP Server | Express + FastAPI | Express unico |
| Deploy | 2 containers/processos | 1 container/processo |
| Tipos | TypeScript + Python untyped | TypeScript end-to-end |

**Esforco de migracao:** ~20h
**ROI:** Elimina SYS-04, simplifica deploy, manutenção e debugging.

### 7.2 Decisao: Migrar para Schema Completo

**Recomendacao: Adotar o schema completo com ajustes.**

1. Renomear `clients` → `saas_customers` (ou manter `clients` com campos novos)
2. Manter `instances` como tabela separada
3. Adicionar `agent_configs` como tabela separada
4. Migrar CHECK → ENUMs
5. Adicionar soft deletes, triggers, indexes
6. Implementar migration system (Supabase CLI)

**Esforco:** ~8h schema + 3h migration system = 11h

### 7.3 Decisao: Auth-First Approach

**Sequencia recomendada:**
1. Supabase Auth (login/signup) no frontend
2. JWT middleware no Express
3. RLS policies corrigidas
4. Webhook signature verification

Sem auth, NADA mais funciona (RLS, multi-tenancy, personalizacao).

### 7.4 Estrutura de Pastas Alvo

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
│   └── api/                    # Express API (unico)
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/      # Auth, validation, rate-limit
│       │   ├── jobs/           # BullMQ (substitui Celery)
│       │   └── lib/            # OpenAI, UAZAPI, Supabase
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

## 8. Plano de Remediacao Proposto

### Fase 0: Emergencia de Seguranca (~8h)

| Prioridade | Acao | Esforco |
|-----------|------|---------|
| P0 | Remover credenciais do source code (.env) | 2h |
| P0 | Rotacionar todas as chaves expostas | 2h |
| P0 | Configurar CORS com dominio especifico | 1h |
| P0 | Adicionar .env ao .gitignore | 0.5h |
| P0 | Instalar Tailwind local (remover CDN) | 2h |
| P0 | Validacao de env vars no startup | 0.5h |

### Fase 1: Fundacao (~35h)

| Prioridade | Acao | Esforco |
|-----------|------|---------|
| P1 | Implementar Supabase Auth (login/signup) | 12h |
| P1 | Corrigir RLS policies | 4h |
| P1 | Implementar migration system | 3h |
| P1 | Migrar schema MVP → completo | 8h |
| P1 | Adicionar indexes criticos | 2h |
| P1 | Fix celery_worker bug (generate_message) | 2h |
| P1 | Webhook signature verification | 4h |

### Fase 2: Consolidacao Backend (~30h)

| Prioridade | Acao | Esforco |
|-----------|------|---------|
| P2 | Migrar FastAPI → Express (unificar backend) | 20h |
| P2 | Substituir Celery por BullMQ | 6h |
| P2 | Input validation middleware (Zod) | 4h |

### Fase 3: Frontend Producao (~35h)

| Prioridade | Acao | Esforco |
|-----------|------|---------|
| P3 | Dashboard com dados reais (queries Supabase) | 4h |
| P3 | Error states em todos os componentes | 4h |
| P3 | Toast/notification system | 3h |
| P3 | Lead detail + conversation view | 8h |
| P3 | Onboarding wizard | 6h |
| P3 | Data caching (TanStack Query) | 4h |
| P3 | Bundle deps com Vite (remover ESM CDN) | 2h |
| P3 | Design tokens/theme file | 2h |
| P3 | Acessibilidade basica (ARIA, focus trap) | 2h |

### Fase 4: Qualidade & DevOps (~25h)

| Prioridade | Acao | Esforco |
|-----------|------|---------|
| P4 | Testes unitarios (coverage minimo 60%) | 10h |
| P4 | CI/CD pipeline (GitHub Actions) | 8h |
| P4 | Monitoring/logging basico | 4h |
| P4 | Rate limiting | 3h |

### Total Consolidado

| Fase | Esforco | Acumulado |
|------|---------|-----------|
| Fase 0: Emergencia | ~8h | 8h |
| Fase 1: Fundacao | ~35h | 43h |
| Fase 2: Backend | ~30h | 73h |
| Fase 3: Frontend | ~35h | 108h |
| Fase 4: Qualidade | ~25h | 133h |
| **TOTAL** | **~133h** | |

**Nota:** O total de 133h e menor que a soma bruta dos debitos (182h) porque varias remediações resolvem multiplos debitos simultaneamente (ex: auth resolve SEC-02, SEC-03, DB-01, e UX-CRIT-02 juntos).

---

## 9. Dependencias entre Debitos

```
SEC-01 (credenciais)
  └── Bloqueia TUDO (deve ser resolvido primeiro)

SEC-02 (auth) + SEC-03 (RLS)
  ├── Requer: SEC-01
  ├── Desbloqueia: Multi-tenancy real
  ├── Desbloqueia: Dashboard com dados reais
  └── Desbloqueia: UX-CRIT-02 (auth flow)

DB-CRIT-01 (schema migration)
  ├── Requer: DB-CRIT-02 (migration system)
  ├── Desbloqueia: DB-07 a DB-20 (melhorias de schema)
  └── Desbloqueia: DB-CRIT-03 (messages table)

ARCH-01 (consolidar backend)
  ├── Requer: SEC-01 (credenciais)
  ├── Resolve: ARCH-02 (celery bug)
  ├── Resolve: SYS-11 (python deps)
  └── Desbloqueia: SYS-05 (testes em TypeScript unico)

UX-CRIT-01 (Tailwind local)
  └── Desbloqueia: UX-DS-02, UX-DS-03 (design tokens)
```

---

## 10. Matriz de Risco

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|-------------|---------|-----------|
| Vazamento de credenciais via git history | ALTA | CRITICO | BFG + rotacao imediata |
| Webhook spoofing causando dados falsos | ALTA | ALTO | Signature verification |
| RLS bypass expondo dados de clientes | MEDIA | CRITICO | Auth + RLS fix |
| Performance degradada com volume | MEDIA | ALTO | Indexes + phone normalization |
| Celery pipeline nunca funciona | CERTA | ALTO | Fix bug ou migrar BullMQ |
| Frontend crash sem error boundaries | MEDIA | MEDIO | Error boundaries React |

---

## 11. Perguntas para Validacao (Phases 5-7)

### Para @data-engineer (Phase 5):
1. O plano de migration do schema esta correto?
2. A estrategia de phone normalization e adequada?
3. Prioridades de indexes estao corretas?
4. Algum debito de DB faltando?

### Para @ux-design-expert (Phase 6):
1. Prioridades de UX estao corretas?
2. Auth flow e o primeiro item certo ou onboarding vem antes?
3. Estimativa de esforco esta realista?
4. Algum debito de UX faltando?

### Para @qa (Phase 7):
1. Plano de remediacao cobre todos os debitos criticos?
2. Dependencias entre debitos estao corretas?
3. Alguma vulnerabilidade nao mapeada?
4. Estimativas de esforco sao realistas?

---

*DRAFT gerado por @architect (Aria) - Brownfield Discovery Phase 4*
*Pendente validacao: @data-engineer (Phase 5), @ux-design-expert (Phase 6), @qa (Phase 7)*
