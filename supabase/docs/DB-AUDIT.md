# Database Security & Quality Audit - Recupera.AI

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 2
**Agente:** @data-engineer (Dara)
**Status:** COMPLETE

---

## 1. Resumo Executivo

| Categoria | Score | Status |
|-----------|-------|--------|
| **Schema Design** | 3/10 | CRITICO |
| **Security (RLS)** | 2/10 | CRITICO |
| **Indexes** | 3/10 | INSUFICIENTE |
| **Data Integrity** | 4/10 | INSUFICIENTE |
| **Performance** | 3/10 | INSUFICIENTE |
| **Observability** | 1/10 | CRITICO |
| **TOTAL** | 2.7/10 | **NAO APROVADO** |

---

## 2. Debitos de Database

### CRITICOS (bloqueiam producao)

| ID | Debito | Impacto | Esforco | Risco |
|----|--------|---------|---------|-------|
| DB-01 | RLS ineficaz — frontend usa `anon key`, `auth.uid()` retorna NULL | **Todos os dados acessiveis por qualquer usuario** | 4h | CVSS 9.1 |
| DB-02 | Nenhuma policy para operacoes de backend (service_role bypassa RLS) | Backend com service_role nao tem restricoes | 3h | CVSS 8.5 |
| DB-03 | Schema MVP desatualizado vs schema completo — 2 schemas concorrentes | Confusao, divergencia de dados | 8h | Alto |
| DB-04 | Sem sistema de migrations — schema.sql e DDL puro | Impossivel versionamento, rollback, deploy automatizado | 3h | Alto |
| DB-05 | Credenciais Supabase hardcoded em 5 arquivos | Service role key exposta no git | 2h | CVSS 9.8 |
| DB-06 | `conversation_log` JSONB sem limite — pode crescer infinitamente | Memory pressure, queries lentas, custo storage | 3h | Alto |

### ALTOS (bloqueiam beta)

| ID | Debito | Impacto | Esforco | Risco |
|----|--------|---------|---------|-------|
| DB-07 | Apenas 2 indexes (excluindo PKs) | Dashboard queries serao lentas com volume | 2h | Performance |
| DB-08 | Sem `updated_at` em clients, products, leads (MVP) | Impossivel saber quando registro foi alterado | 2h | Auditoria |
| DB-09 | Sem triggers de auto-update timestamp | `updated_at` em instances nunca atualiza automaticamente | 1h | Data quality |
| DB-10 | `email` sem UNIQUE constraint em `leads` | Leads duplicados possiveis para mesmo email+produto | 1h | Data integrity |
| DB-11 | `phone` sem validacao de formato | Numeros inconsistentes (com/sem +55, DDI, etc.) | 2h | Match failure |
| DB-12 | `status` como TEXT com CHECK ao inves de ENUM | Sem type safety no banco, validacao fraca | 2h | Data integrity |
| DB-13 | `value` como NUMERIC sem precisao (deveria ser centavos BIGINT) | Problemas de arredondamento com moeda | 2h | Financial accuracy |

### MEDIOS (pre-v1.0)

| ID | Debito | Impacto | Esforco | Risco |
|----|--------|---------|---------|-------|
| DB-14 | Sem soft deletes (CASCADE em tudo) | Dados perdidos permanentemente | 3h | Data loss |
| DB-15 | Sem tabela `agent_configs` separada (tudo em products) | Acoplamento, dificil evoluir config do agente | 4h | Maintainability |
| DB-16 | Sem tabela `messages` separada (tudo em JSONB) | Impossivel query individual, sem indexes | 6h | Performance |
| DB-17 | Sem `recovery_attempts` tracking | Nao sabe quantas tentativas, nao pode limitar | 1h | Business logic |
| DB-18 | Sem `next_contact_scheduled_at` | Celery nao tem referencia no banco | 1h | Scheduling |
| DB-19 | Schema sem COMMENT ON | Documentacao zero dentro do banco | 1h | DX |
| DB-20 | Sem funcao/view para metricas do dashboard | Frontend calcula tudo client-side | 4h | Performance |

---

## 3. Analise de RLS (Row Level Security)

### Situacao Atual

```
Frontend (React) → supabase.createClient(url, ANON_KEY)
                    ↓
                    auth.uid() = NULL (ninguem logado)
                    ↓
                    RLS Policy: auth.uid() = client_id
                    ↓
                    NULL = client_id → SEMPRE FALSE
                    ↓
                    NENHUM DADO RETORNADO (ou TUDO via service_role)
```

### Problemas Especificos

| Policy | Problema | Impacto |
|--------|----------|---------|
| `clients` SELECT | `auth.uid() = id` assume user logado | Frontend sem auth UI = policy inutil |
| `products` ALL | `auth.uid() = client_id` para ALL ops | Sem separacao read/write/delete |
| `leads` ALL | `auth.uid() = client_id` para ALL ops | User pode deletar leads de outro user |
| `instances` ALL | `auth.uid() = client_id` para ALL ops | User pode ver QR de outro user |

### Por que funciona hoje?

O `dataService.ts` usa fallback para mocks quando Supabase falha. O `server.ts` usa `SUPABASE_SERVICE_ROLE_KEY` que **bypassa RLS completamente**. Ou seja, RLS nunca foi efetivamente testado.

### Recomendacao

```sql
-- 1. Separar policies por operacao
CREATE POLICY "clients_select" ON clients
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "clients_update" ON clients
  FOR UPDATE USING (auth.uid() = id);

-- NAO permitir DELETE direto (soft delete via app)

-- 2. Para backend (service_role), usar funcoes com SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_lead(p_client_id UUID, p_data JSONB)
RETURNS leads AS $$
  -- Validar que client_id existe
  -- Validar que product_id pertence ao client_id
  -- Inserir lead
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Frontend deve usar Supabase Auth (login/signup)
-- auth.uid() so funciona com usuario autenticado
```

---

## 4. Analise de Indexes

### Indexes Existentes

| Index | Colunas | Queries que atende |
|-------|---------|-------------------|
| PK clients | id | Lookup direto |
| PK instances | id | Lookup direto |
| PK products | id | Lookup direto |
| PK leads | id | Lookup direto |
| idx_leads_client_status | (client_id, status) | Dashboard: leads por cliente e status |
| idx_webhooks_search | (email, product_id) | Kill switch: busca por email+produto |

### Indexes Faltantes (Necessarios)

| Index Sugerido | Colunas | Justificativa | Prioridade |
|---------------|---------|---------------|------------|
| idx_leads_phone | (phone) | AI handler busca lead por telefone (ILIKE) | CRITICA |
| idx_leads_created_at | (created_at DESC) | Dashboard ordena por data | ALTA |
| idx_products_client_active | (client_id, is_active) | Listagem de produtos ativos | ALTA |
| idx_products_ext_id | (external_product_id, client_id) | Webhook busca produto por ID externo | CRITICA |
| idx_instances_client_status | (client_id, status) | Celery busca instancia conectada | ALTA |
| idx_leads_email_product | (email, product_id) UNIQUE | Prevenir leads duplicados | ALTA |

### Impacto sem indexes

A query mais critica e a do `ai_handler.py`:

```python
# ILIKE sem index = FULL TABLE SCAN
supabase.table("leads").select("*").ilike("phone", f"%{clean_phone}%").execute()
```

Com 10k leads, esta query levara **segundos**. Com 100k, **minutos**.

---

## 5. Analise de Data Integrity

### Constraints Faltantes

| Constraint | Tabela.Coluna | Problema |
|-----------|---------------|----------|
| UNIQUE(email) | clients.email | Dois clientes com mesmo email |
| UNIQUE(email, product_id) | leads | Leads duplicados para mesmo checkout |
| UNIQUE(external_product_id, client_id) | products | Produto duplicado para cliente |
| NOT NULL | leads.phone | Lead sem telefone nao pode ser contatado |
| CHECK(delay_minutes >= 1) | products | Delay 0 ou negativo possivel |
| CHECK(value >= 0) | leads | Valor negativo possivel |

### Orphaned Data Risks

| Cenario | Resultado | Mitigacao |
|---------|-----------|-----------|
| Cliente deletado | leads, products, instances CASCADE deletados | Soft delete + retention policy |
| Produto deletado | leads.product_id SET NULL | Perde referencia do produto |
| Schema reset | TODOS os dados perdidos | Migration system + backups |

---

## 6. Analise de Performance

### Queries Criticas (Hot Path)

| Query | Frequencia | Index? | Estimativa sem index |
|-------|-----------|--------|---------------------|
| Lead por telefone (ILIKE) | Cada msg WhatsApp | NAO | O(n) full scan |
| Leads por client+status | Cada load dashboard | SIM | O(log n) |
| Produto por ext_id+client | Cada webhook | NAO | O(n) full scan |
| Instancia por client+status | Cada recovery task | NAO | O(n) full scan |
| Kill switch (email+product) | Cada PURCHASE webhook | SIM | O(log n) |

### Recomendacao: ILIKE → Busca normalizada

```sql
-- Adicionar coluna normalizada
ALTER TABLE leads ADD COLUMN phone_normalized TEXT;

-- Trigger para normalizar na insercao
CREATE FUNCTION normalize_phone() RETURNS TRIGGER AS $$
BEGIN
  NEW.phone_normalized = regexp_replace(NEW.phone, '[^0-9]', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Index na coluna normalizada
CREATE INDEX idx_leads_phone_norm ON leads(phone_normalized);

-- Query otimizada: = ao inves de ILIKE
SELECT * FROM leads WHERE phone_normalized = '5511999999999';
```

---

## 7. Analise: conversation_log JSONB

### Problema

```sql
conversation_log JSONB DEFAULT '[]'::jsonb
-- Exemplo com 50 mensagens:
-- [{"role":"user","content":"oi"}, {"role":"assistant","content":"Ola! Vi que..."}, ...]
-- ~5-10 KB por lead ativo
```

### Projecao de Crescimento

| Leads | Msgs/Lead | Size/Lead | Total JSONB |
|-------|-----------|-----------|-------------|
| 1,000 | 10 | 2 KB | 2 MB |
| 10,000 | 10 | 2 KB | 20 MB |
| 100,000 | 10 | 2 KB | 200 MB |
| 100,000 | 50 | 10 KB | 1 GB |

### Recomendacao

Para MVP (< 10k leads): JSONB e aceitavel.
Para producao (> 10k leads): Migrar para tabela `messages`:

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant', 'system')) NOT NULL,
  content TEXT NOT NULL,
  message_type message_type_enum DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_lead ON messages(lead_id, created_at);
```

---

## 8. Schema Divergence Analysis

### Mapeamento MVP → Completo

| MVP | Completo | Divergencia |
|-----|----------|-------------|
| `clients` | `saas_customers` | Nome diferente, campos muito diferentes |
| `clients.id` (FK auth.users) | `saas_customers.id` (standalone) | Modelo de auth diferente |
| — | `saas_customers.plan_type` | Sem gestao de planos no MVP |
| — | `saas_customers.subscription_*` | Sem subscription no MVP |
| — | `saas_customers.onboarding_*` | Sem onboarding no MVP |
| `instances` (tabela) | `products.uazapi_*` (colunas) | Modelagem diferente |
| `products.agent_persona` (TEXT) | `agent_configs` (tabela) | Separacao de concerns |
| `products.objection_handling` (TEXT) | `products.product_objections` (JSONB) | Estruturado vs texto livre |
| `leads.status` (CHECK) | `leads.status` (ENUM) | Type safety diferente |
| — | `leads.recovery_attempts` | Sem tracking de tentativas |
| — | `leads.detected_objections` | Sem tracking de objecoes |
| — | `leads.conversation_summary` | Sem resumo |

### Recomendacao

**Migrar para o schema completo** com ajustes:
1. Usar `saas_customers` ao inves de `clients`
2. Manter `instances` como tabela separada (mais flexivel)
3. Adicionar `agent_configs` como tabela separada
4. Migrar CHECK constraints para ENUMs
5. Adicionar soft deletes, triggers, indexes parciais

---

## 9. Respostas ao @architect

### P1: O schema atual suporta multi-tenancy adequadamente?
**NAO.** RLS esta habilitado mas ineficaz porque frontend usa `anon key` sem auth. Service role no backend bypassa RLS. Qualquer bug no backend expoe dados de todos os clientes. Precisa: auth flow no frontend + policies corrigidas + funcoes SECURITY DEFINER no backend.

### P2: Quais indexes sao essenciais para queries de dashboard?
- `idx_leads_phone` (CRITICO para AI handler)
- `idx_products_ext_id_client` (CRITICO para webhooks)
- `idx_instances_client_status` (ALTO para Celery)
- `idx_leads_created_at` (ALTO para dashboard)
Ver secao 4 para lista completa.

### P3: RLS com anon key e viavel ou precisa migrar para service role?
**Precisa de ambos:** Anon key + Supabase Auth para frontend (RLS funciona). Service role para backend com funcoes SECURITY DEFINER (bypass controlado). O modelo atual de anon key sem auth torna RLS inutil.

### P4: conversation_log como JSONB e adequado ou melhor tabela separada?
**Para MVP (< 10k leads): JSONB e aceitavel** com limite de 50 mensagens por lead. **Para producao: tabela `messages` separada** com indexes. Ver secao 7 para projecao de crescimento.

---

## 10. Resumo de Esforco

| Categoria | Itens | Esforco Total |
|-----------|-------|---------------|
| Criticos (DB-01 a DB-06) | 6 | 23h |
| Altos (DB-07 a DB-13) | 7 | 12h |
| Medios (DB-14 a DB-20) | 7 | 20h |
| **TOTAL** | **20** | **55h** |

---

*Documento gerado por @data-engineer (Dara) - Brownfield Discovery Phase 2*
