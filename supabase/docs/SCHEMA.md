# Database Schema Documentation - Recupera.AI

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 2
**Agente:** @data-engineer (Dara)
**Status:** COMPLETE

---

## 1. Visao Geral

Existem **dois schemas** para este projeto:

| Schema | Local | Tabelas | Status |
|--------|-------|---------|--------|
| **In-Repo (MVP)** | `supabase/schema.sql` | 4 (clients, instances, products, leads) | Em uso pelo codigo |
| **Completo** | `~/recupera_ai_schema.sql` | 4 (saas_customers, products, agent_configs, leads) | Mais maduro, NAO em uso |

O schema em uso no codigo e o **MVP simplificado**. O schema completo tem enums, triggers, indexes parciais, soft deletes, e uma tabela separada `agent_configs` — mas nao esta integrado ao aplicativo.

---

## 2. Schema MVP (Em Uso)

### 2.1 Tabela `clients`

```sql
CREATE TABLE public.clients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  api_key TEXT DEFAULT uuid_generate_v4()::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

| Coluna | Tipo | Nullable | Default | Notas |
|--------|------|----------|---------|-------|
| id | UUID (PK) | NOT NULL | auth.users FK | Extensao do Supabase Auth |
| email | TEXT | NOT NULL | - | Sem UNIQUE constraint |
| name | TEXT | NULL | - | Sem NOT NULL |
| phone | TEXT | NULL | - | Sem validacao formato |
| api_key | TEXT | NULL | uuid_generate_v4() | Gerado automaticamente |
| created_at | TIMESTAMPTZ | NULL | NOW() | Sem updated_at |

### 2.2 Tabela `instances`

```sql
CREATE TABLE public.instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  instance_key TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('disconnected','connecting','connected')) DEFAULT 'disconnected',
  qr_code_base64 TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

| Coluna | Tipo | Nullable | Default | Notas |
|--------|------|----------|---------|-------|
| id | UUID (PK) | NOT NULL | uuid_generate_v4() | - |
| client_id | UUID (FK) | NOT NULL | - | CASCADE delete |
| instance_key | TEXT (UNIQUE) | NOT NULL | - | ID na UAZAPI |
| status | TEXT (CHECK) | NULL | 'disconnected' | Check constraint como enum |
| qr_code_base64 | TEXT | NULL | - | QR temporario, pode ser grande |
| updated_at | TIMESTAMPTZ | NULL | NOW() | Sem trigger de auto-update |

### 2.3 Tabela `products`

```sql
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('kiwify','hotmart','eduzz')) NOT NULL,
  external_product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  agent_persona TEXT DEFAULT 'Voce e um especialista de suporte...',
  objection_handling TEXT,
  downsell_link TEXT,
  delay_minutes INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT true,
  total_recovered NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

| Coluna | Tipo | Nullable | Default | Notas |
|--------|------|----------|---------|-------|
| id | UUID (PK) | NOT NULL | uuid_generate_v4() | - |
| client_id | UUID (FK) | NOT NULL | - | CASCADE delete |
| platform | TEXT (CHECK) | NOT NULL | - | Deveria ser ENUM |
| external_product_id | TEXT | NOT NULL | - | ID na plataforma de venda |
| name | TEXT | NOT NULL | - | - |
| agent_persona | TEXT | NULL | Default generico | System prompt para AI |
| objection_handling | TEXT | NULL | - | Texto livre |
| downsell_link | TEXT | NULL | - | URL desconto |
| delay_minutes | INTEGER | NULL | 15 | Delay antes de contatar |
| is_active | BOOLEAN | NULL | true | Toggle on/off |
| total_recovered | NUMERIC | NULL | 0 | Contador manual |
| created_at | TIMESTAMPTZ | NULL | NOW() | Sem updated_at |

### 2.4 Tabela `leads`

```sql
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  platform_lead_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  checkout_url TEXT,
  status TEXT CHECK (status IN ('pending_recovery','queued','contacted',
    'converted_organically','recovered_by_ai','failed')) DEFAULT 'pending_recovery',
  conversation_log JSONB DEFAULT '[]'::jsonb,
  value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  purchase_at TIMESTAMP WITH TIME ZONE
);
```

| Coluna | Tipo | Nullable | Default | Notas |
|--------|------|----------|---------|-------|
| id | UUID (PK) | NOT NULL | uuid_generate_v4() | - |
| client_id | UUID (FK) | NOT NULL | - | CASCADE delete |
| product_id | UUID (FK) | NULL | - | SET NULL on delete |
| platform_lead_id | TEXT | NULL | - | ID transacao na origem |
| name | TEXT | NULL | - | Nome do lead |
| email | TEXT | NULL | - | Sem UNIQUE, sem index |
| phone | TEXT | NULL | - | Sem validacao |
| checkout_url | TEXT | NULL | - | Link checkout original |
| status | TEXT (CHECK) | NULL | 'pending_recovery' | 6 status possiveis |
| conversation_log | JSONB | NULL | '[]' | Historico sem limite |
| value | NUMERIC | NULL | - | Valor do checkout |
| created_at | TIMESTAMPTZ | NULL | NOW() | - |
| purchase_at | TIMESTAMPTZ | NULL | - | Data de compra se converteu |

---

## 3. Indexes Existentes

| Index | Tabela | Colunas | Tipo |
|-------|--------|---------|------|
| `idx_leads_client_status` | leads | (client_id, status) | B-tree |
| `idx_webhooks_search` | leads | (email, product_id) | B-tree |

**Total: 2 indexes** (alem dos PKs automaticos)

---

## 4. RLS Policies

| Policy | Tabela | Operacao | Condicao |
|--------|--------|----------|----------|
| Users can view own client data | clients | SELECT | `auth.uid() = id` |
| Users can view own products | products | ALL | `auth.uid() = client_id` |
| Users can view own leads | leads | ALL | `auth.uid() = client_id` |
| Users can view own instances | instances | ALL | `auth.uid() = client_id` |

**RLS habilitado em:** clients, instances, products, leads (todas as 4 tabelas)

---

## 5. Triggers e Functions

**NENHUM** no schema MVP.

O schema completo (`~/recupera_ai_schema.sql`) tem:
- `update_updated_at_column()` — trigger function para auto-update
- Triggers em todas as tabelas

---

## 6. Diagrama ER

```
┌──────────────┐       ┌──────────────┐
│   clients    │       │  instances   │
│──────────────│       │──────────────│
│ id (PK/FK)   │──1:N──│ client_id    │
│ email        │       │ instance_key │
│ name         │       │ status       │
│ phone        │       │ qr_code_base64│
│ api_key      │       └──────────────┘
│ created_at   │
└──────┬───────┘
       │ 1:N
       ▼
┌──────────────┐       ┌──────────────┐
│   products   │       │    leads     │
│──────────────│       │──────────────│
│ id (PK)      │──1:N──│ product_id   │
│ client_id(FK)│       │ client_id(FK)│
│ platform     │       │ name, email  │
│ ext_prod_id  │       │ phone        │
│ name         │       │ status       │
│ agent_persona│       │ conv_log     │
│ delay_minutes│       │ value        │
│ is_active    │       │ created_at   │
└──────────────┘       └──────────────┘
```

---

## 7. Schema Completo (Nao Implementado)

O schema em `~/recupera_ai_schema.sql` e significativamente mais maduro:

### Diferencas principais vs MVP

| Feature | MVP | Completo |
|---------|-----|----------|
| Enums (PostgreSQL) | CHECK constraints | CREATE TYPE enum |
| Tabela principal | `clients` (ext auth.users) | `saas_customers` (standalone) |
| Agent config | Colunas em `products` | Tabela separada `agent_configs` |
| WhatsApp instances | Tabela separada | Colunas em `products` |
| Soft deletes | Nao | `deleted_at` em todas |
| Updated_at trigger | Nao | Sim, todas as tabelas |
| Indexes | 2 basicos | 12+ com filtros parciais |
| Onboarding tracking | Nao | `onboarding_step`, `onboarding_completed` |
| Subscription mgmt | Nao | `subscription_status`, `plan_type` |
| Objections tracking | Texto livre | JSONB estruturado + array |
| Recovery attempts | Nao | `recovery_attempts`, `next_contact_scheduled_at` |
| Conversation summary | Nao | `conversation_summary` campo |
| Schema comments | Nao | COMMENT ON em todas |

---

*Documento gerado por @data-engineer (Dara) - Brownfield Discovery Phase 2*
