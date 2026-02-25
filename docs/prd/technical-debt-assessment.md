# Technical Debt Assessment - Recupera.AI (FINAL)

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 8 (Final Assessment)
**Agente:** @architect (Aria)
**Status:** FINAL — Aprovado pelo QA Gate (Phase 7)
**Versao:** 1.0

---

## 1. Resumo Executivo

### O Produto

Recupera.AI e uma plataforma SaaS de recuperacao de vendas abandonadas via WhatsApp com IA. Recebe webhooks de Hotmart/Kiwify/Eduzz, aciona GPT-4o-mini, e envia mensagens de recuperacao via WhatsApp (UAZAPI).

### Avaliacao Global

| Dimensao | Score | Status |
|----------|-------|--------|
| Arquitetura de Sistema | 3/10 | CRITICO |
| Seguranca | 1/10 | CRITICO |
| Database | 2.7/10 | CRITICO |
| Frontend/UX | 3/10 | CRITICO |
| Qualidade (Testes) | 0/10 | CRITICO |
| **MEDIA** | **1.9/10** | **NAO PRONTO PARA PRODUCAO** |

### Numeros-Chave

| Metrica | Valor |
|---------|-------|
| Total LOC | ~2,000 |
| Total de debitos tecnicos | **79** |
| Debitos CRITICOS | **20** |
| Debitos ALTOS | **27** |
| Vulnerabilidades CVSS >= 8.0 | **5** |
| Testes automatizados | **0** |
| Endpoints sem auth | **8/8 (100%)** |
| Credenciais expostas no git | **6+ arquivos** |
| Esforco total de remediacao | **~158h** |

---

## 2. Stack Tecnologico

| Camada | Tecnologia | Versao | Risco |
|--------|-----------|--------|-------|
| Frontend | React + TypeScript | 19.2.4 | Baixo |
| Build | Vite | 6.2.0 | Baixo |
| CSS | Tailwind (CDN) | - | CRITICO (CDN) |
| Backend Node | Express | 5.2.1 | Medio |
| Backend Python | FastAPI | Nao pinado | Alto |
| Task Queue | Celery + Redis | Nao pinado | Alto |
| Database | Supabase (PostgreSQL) | - | Medio |
| AI/LLM | OpenAI GPT-4o-mini | Hardcoded | Medio |
| WhatsApp | UAZAPI | - | Alto (vendor lock) |

---

## 3. Inventario Completo de Debitos

### 3.1 Por Severidade (79 total)

| Severidade | Count | Esforco |
|-----------|-------|---------|
| CRITICO | 20 | ~55h |
| ALTO | 27 | ~60h |
| MEDIO | 29 | ~38h |
| BAIXO | 3 | ~5h |
| **TOTAL** | **79** | **~158h** |

### 3.2 CRITICOS — Bloqueiam Producao (20)

#### Seguranca (5)

| ID | Debito | CVSS | Esforco |
|----|--------|------|---------|
| SEC-01 | Credenciais hardcoded em 6+ arquivos | 9.8 | 6h |
| SEC-02 | Zero autenticacao em 8 endpoints | 9.1 | 8h |
| SEC-03 | RLS completamente ineficaz (anon key + NULL auth.uid) | 8.5 | 6h |
| SEC-04 | Webhook spoofing (sem signature verification) | 8.7 | 5h |
| SEC-05 | CORS wildcard + service role key exposta | 9.0 | 2h |

#### Arquitetura (2)

| ID | Debito | Esforco |
|----|--------|---------|
| ARCH-01 | Dual backend (Express + FastAPI) sem orquestracao | 20h |
| ARCH-02 | Celery chama `generate_message()` que nao existe | 2h |

#### Database (6)

| ID | Debito | Esforco |
|----|--------|---------|
| DB-01 | RLS ineficaz (frontend anon key, auth.uid = NULL) | 4h |
| DB-02 | Backend service_role bypassa RLS sem restricao | 3h |
| DB-03 | Schema MVP desatualizado vs schema completo | 8h |
| DB-04 | Sem sistema de migrations | 3h |
| DB-05 | Credenciais Supabase hardcoded | 2h |
| DB-06 | conversation_log JSONB sem limite | 3h |

#### Frontend/UX (4)

| ID | Debito | Esforco |
|----|--------|---------|
| UX-CRIT-01 | Tailwind via CDN (render-blocking, offline fail) | 2h |
| UX-CRIT-02 | Auth flow inexistente (login/signup/forgot) | 16h |
| UX-CRIT-03 | Dashboard com dados 100% hardcoded | 6h |
| UX-CRIT-04 | Zero error states em todos componentes | 3h |

#### Qualidade (3) — *Upgrade de @qa*

| ID | Debito | Esforco |
|----|--------|---------|
| QA-01 | Zero testes automatizados | 10h |
| QA-02 | Sem LGPD compliance (PII em plaintext) | 4h |
| QA-03 | npm/pip audit nao executados | 1h |

### 3.3 ALTOS — Bloqueiam Beta (27)

#### Sistema (5)

| ID | Debito | Esforco |
|----|--------|---------|
| SYS-08 | Sem validacao de input | 6h |
| SYS-09 | Sem rate limiting | 3h |
| SYS-10 | Error handling inconsistente | 4h |
| SYS-11 | Python deps sem versao pinada | 1h |
| SYS-07 | Sem validacao de env vars no startup | 2h |

#### Database (9)

| ID | Debito | Esforco |
|----|--------|---------|
| DB-07 | Apenas 2 indexes (3 hot paths sem index) | 2h |
| DB-08 | Sem updated_at em 3 tabelas | 2h |
| DB-09 | Sem triggers de auto-update timestamp | 1h |
| DB-10 | Sem UNIQUE (email, product_id) em leads | 1h |
| DB-11 | Phone sem validacao de formato | 2h |
| DB-12 | Status como TEXT CHECK (deveria ser ENUM) | 2h |
| DB-13 | Valor monetario sem precisao | 2h |
| DB-21 | clients.email sem UNIQUE | 0.5h |
| DB-22 | products (ext_id + client_id) sem UNIQUE | 0.5h |

#### Frontend/UX (13)

| ID | Debito | Esforco |
|----|--------|---------|
| UX-RES-01 | Safe area nao tratado (iPhones) | 1h |
| UX-ST-03 | Sem estado offline/fallback visual | 3h |
| UX-ST-04 | ProductModal usa alert() para erros | 1h |
| UX-ST-06 | Sem toast/notification system | 2h |
| UX-PERF-04 | Sem caching de dados | 4h |
| UX-PERF-05 | importmap via ESM CDN | 2h |
| UX-DS-02 | Config de cores inline no HTML | 2h |
| UX-DS-03 | Sem arquivo de tokens/theme | 2h |
| UX-FLOW-01 | Sem confirmacao de acoes destrutivas | 2h |
| UX-FLOW-02 | Search/filter em Products nao funciona | 3h |
| UX — | Lead detail + conversation view | 10h |
| UX — | Onboarding wizard | 8h |
| UX — | Profile/account page | 3h |

### 3.4 MEDIOS — Pre-v1.0 (29)

*Ver documentos de origem para lista completa. Inclui:*
- 6 debitos de sistema (state management, error boundaries, realtime, CI/CD, monitoring, feature flags)
- 7 debitos de database (soft deletes, agent_configs, messages table, recovery tracking, schema comments, dashboard views, backup strategy)
- 14 debitos de frontend (acessibilidade, consistencia visual, performance, responsividade)
- 2 debitos de UX flows (botoes nao funcionais, date range selector)

---

## 4. Vulnerabilidades de Seguranca

| # | Vulnerabilidade | CVSS | Remediacao |
|---|----------------|------|-----------|
| 1 | Credenciais no source code | 9.8 | .env + rotacao |
| 2 | Service role key exposta | 9.0 | Remover do frontend |
| 3 | Sem autenticacao API | 9.1 | JWT middleware |
| 4 | Webhook spoofing | 8.7 | HMAC verification |
| 5 | RLS bypass | 8.5 | Supabase Auth + policies |
| 6 | AI prompt injection | 7.8 | Input sanitization |
| 7 | Sem validacao de input | 7.4 | Zod schema validation |
| 8 | PII sem encriptacao | 6.5 | Encryption at rest |
| 9 | Sem rate limiting | 6.5 | Express rate-limit |
| 10 | CORS wildcard | 6.1 | Dominio especifico |

---

## 5. Decisoes Arquiteturais

### D1: Consolidar para Backend Node.js Unico

**Decisao: APROVADA por todos os especialistas.**

| De | Para |
|----|------|
| Express + FastAPI | Express unico |
| Celery + Redis | BullMQ + Redis |
| OpenAI Python SDK | OpenAI Node.js SDK |
| TypeScript + Python | TypeScript end-to-end |

### D2: Migrar Schema MVP → Completo (com ajustes)

**Decisao: APROVADA com ajuste do @data-engineer.**

- Manter nome `clients` (nao renomear para saas_customers)
- Adicionar campos novos via ALTER TABLE
- Manter `instances` como tabela separada
- Adicionar `agent_configs` como tabela
- Migrar CHECK → ENUMs
- Adicionar soft deletes, triggers, indexes

### D3: Auth-First Approach

**Decisao: APROVADA por @ux-design-expert.**

Sequencia: Tailwind local → Auth → Dashboard real → Lead detail → Onboarding

### D4: Testes como Prioridade (upgrade de @qa)

**Decisao: APROVADA.**

Testes basicos ANTES da consolidacao backend (Fase 1.5). Impossivel validar migracao Python → Node.js sem testes.

---

## 6. Plano de Remediacao Final

### Fase 0: Emergencia de Seguranca (~10h)

| Acao | Esforco |
|------|---------|
| Remover credenciais do source code → .env | 2h |
| Rotacionar todas as chaves expostas | 2h |
| CORS com dominio especifico | 1h |
| Instalar Tailwind local (remover CDN) | 2h |
| Bundle deps com Vite (remover ESM CDN) | 2h |
| npm audit + pip audit | 1h |

### Fase 1: Fundacao (~37h)

| Acao | Esforco |
|------|---------|
| Supabase Auth (login/signup/forgot + magic link) | 16h |
| RLS policies corrigidas + SECURITY DEFINER functions | 5h |
| Migration system (Supabase CLI) | 2h |
| Migrar schema MVP → completo | 10h |
| Indexes criticos (6 indexes) | 2h |
| Validacao de env vars no startup | 1h |
| Fix celery_worker bug | 1h |

### Fase 1.5: Testes Basicos (~10h)

| Acao | Esforco |
|------|---------|
| Setup test framework (Vitest) | 2h |
| Testes de endpoints existentes | 4h |
| Testes de services (dataService, apiService) | 2h |
| Feature parity checklist (Python → Node.js) | 2h |

### Fase 2: Consolidacao Backend (~30h)

| Acao | Esforco |
|------|---------|
| Migrar FastAPI endpoints → Express | 12h |
| Migrar ai_handler.py → TypeScript | 6h |
| Substituir Celery por BullMQ | 6h |
| Input validation middleware (Zod) | 4h |
| Webhook signature verification | 2h |

### Fase 3: Frontend Producao (~55h)

| Acao | Esforco |
|------|---------|
| Component library baseline (Button, Input, Modal, Badge, Toast) | 4.5h |
| Dashboard com dados reais | 6h |
| Error states + error boundaries | 3h |
| Toast/notification system | 2h |
| Lead detail + conversation view | 10h |
| Onboarding wizard (5 steps) | 8h |
| Search/filter funcional em Products | 3h |
| Confirmacao de acoes destrutivas | 2h |
| Data caching (TanStack Query) | 4h |
| Design tokens/theme | 2h |
| Profile/account page | 3h |
| Rate limiting | 3h |
| Acessibilidade basica (ARIA, focus trap) | 4.5h |

### Fase 4: DevOps & Compliance (~16h)

| Acao | Esforco |
|------|---------|
| CI/CD pipeline (GitHub Actions) | 8h |
| Monitoring/logging basico | 4h |
| LGPD compliance basico | 4h |

### Resumo de Esforco

| Fase | Esforco | Acumulado |
|------|---------|-----------|
| Fase 0: Emergencia | 10h | 10h |
| Fase 1: Fundacao | 37h | 47h |
| Fase 1.5: Testes | 10h | 57h |
| Fase 2: Backend | 30h | 87h |
| Fase 3: Frontend | 55h | 142h |
| Fase 4: DevOps | 16h | 158h |
| **TOTAL** | | **~158h** |

### Timeline Estimada

| Cenario | Duracao |
|---------|---------|
| 1 developer full-time | ~20 dias uteis (~1 mes) |
| 2 developers full-time | ~12 dias uteis (~2.5 semanas) |
| 1 developer part-time (4h/dia) | ~40 dias uteis (~2 meses) |

---

## 7. Mapa de Dependencias

```
SEC-01 (credenciais .env)
  ├── Fase 0 — PRIMEIRO
  └── Desbloqueia tudo

UX-CRIT-01 (Tailwind local)
  ├── Fase 0 — PARALELO com SEC-01
  └── Desbloqueia: design tokens, component library

SEC-02 + SEC-03 (Auth + RLS)
  ├── Fase 1 — Requer SEC-01
  ├── Desbloqueia: multi-tenancy, dados reais
  └── Desbloqueia: UX-CRIT-02, UX-CRIT-03

DB-CRIT-01 (schema migration)
  ├── Fase 1 — Requer DB-CRIT-02 (migrations)
  └── Desbloqueia: DB-07 a DB-22

QA-01 (testes basicos)
  ├── Fase 1.5 — Requer Fase 1
  └── Desbloqueia: Fase 2 (backend consolidation)

ARCH-01 (consolidar backend)
  ├── Fase 2 — Requer Fase 1.5 (testes)
  ├── Resolve: ARCH-02 (celery bug)
  └── Resolve: SYS-11 (python deps)
```

---

## 8. Documentos de Referencia

| Documento | Fase | Autor |
|----------|------|-------|
| `docs/architecture/system-architecture.md` | Phase 1 | @architect |
| `supabase/docs/SCHEMA.md` | Phase 2 | @data-engineer |
| `supabase/docs/DB-AUDIT.md` | Phase 2 | @data-engineer |
| `docs/frontend/frontend-spec.md` | Phase 3 | @ux-design-expert |
| `docs/prd/technical-debt-DRAFT.md` | Phase 4 | @architect |
| `docs/reviews/db-specialist-review.md` | Phase 5 | @data-engineer |
| `docs/reviews/ux-specialist-review.md` | Phase 6 | @ux-design-expert |
| `docs/reviews/qa-review.md` | Phase 7 | @qa |

---

*Assessment FINAL gerado por @architect (Aria) - Brownfield Discovery Phase 8*
*Incorpora ajustes de: @data-engineer (Phase 5), @ux-design-expert (Phase 6), @qa (Phase 7)*
