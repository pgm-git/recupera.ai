# Database Specialist Review - Technical Debt DRAFT

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 5
**Agente:** @data-engineer (Dara)
**Status:** COMPLETE

---

## 1. Escopo da Revisao

Validacao da secao de database do `docs/prd/technical-debt-DRAFT.md` conforme solicitado pelo @architect na Phase 4.

---

## 2. Respostas as Perguntas do @architect

### P1: O plano de migration do schema esta correto?

**SIM, com ressalvas.**

O plano de migrar do schema MVP para o schema completo esta correto na direcao, mas precisa de ajustes:

1. **Manter o nome `clients`** ao inves de renomear para `saas_customers`. O codigo inteiro (frontend + 2 backends) referencia `clients`. Renomear exigiria mudancas em ~15 arquivos. Melhor adicionar os campos novos a tabela existente.

2. **Migration sequence importa.** A ordem correta e:
   ```
   001_create_enums.sql
   002_alter_clients_add_fields.sql
   003_alter_products_add_fields.sql
   004_alter_leads_add_fields.sql
   005_create_agent_configs.sql
   006_add_indexes.sql
   007_add_triggers.sql
   008_fix_rls_policies.sql
   ```

3. **Dados existentes** devem ser considerados. Se ja houver leads em producao, a migration precisa popular `phone_normalized` para registros existentes.

### P2: A estrategia de phone normalization e adequada?

**SIM.** A abordagem de coluna `phone_normalized` + trigger + index e a correta. Porem, sugiro um ajuste:

- Alem de `regexp_replace(phone, '[^0-9]', '', 'g')`, adicionar logica para normalizar DDI brasileiro:
  - `+55` → remover
  - `0xx` → remover prefixo
  - Garantir formato consistente: `{DDD}{NUMERO}` (11 digitos para celular)

- A funcao deve ser `IMMUTABLE` ou `STABLE` para permitir uso em indexes de expressao como alternativa.

### P3: Prioridades de indexes estao corretas?

**SIM.** Validacao:

| Index | Prioridade no DRAFT | Minha Avaliacao | Concordo? |
|-------|---------------------|-----------------|-----------|
| idx_leads_phone_norm | CRITICA | CRITICA | SIM — hot path do AI handler |
| idx_products_ext_id_client | CRITICA | CRITICA | SIM — hot path de webhooks |
| idx_leads_created_at | ALTA | ALTA | SIM — dashboard ordering |
| idx_products_client_active | ALTA | ALTA | SIM — product listing |
| idx_instances_client_status | ALTA | ALTA | SIM — Celery task lookup |
| idx_leads_email_product | ALTA | CRITICA (upgrade) | **Upgrade para UNIQUE** — previne leads duplicados, fundamental para data integrity |

**Adicao sugerida:**
- `idx_leads_status_created` (status, created_at DESC) — para filas de processamento do Celery

### P4: Algum debito de DB faltando?

**SIM, 3 debitos adicionais identificados:**

| ID | Debito | Severidade | Esforco |
|----|--------|-----------|---------|
| DB-21 | `clients.email` sem UNIQUE constraint | ALTO | 0.5h |
| DB-22 | `products.external_product_id + client_id` sem UNIQUE | ALTO | 0.5h |
| DB-23 | Sem backup strategy/retention policy | MEDIO | 2h |

---

## 3. Validacao de Esforcos

| Item | Esforco no DRAFT | Minha Estimativa | Nota |
|------|-----------------|------------------|------|
| Remover credenciais (.env) | 4h | 3h | Pode ser mais rapido |
| Schema migration | 8h | 10h | +2h para dados existentes |
| Migration system | 3h | 2h | Supabase CLI e simples |
| Indexes criticos | 2h | 2h | OK |
| RLS policies | 4h | 5h | +1h para testar com usuario real |
| Phone normalization | (incluso em indexes) | 2h | Separar como item proprio |
| **DB total ajustado** | ~17h | ~22h | +5h por cautela |

---

## 4. Riscos Adicionais de Database

### Risco: Migration de Dados em Producao

Se o banco ja tiver dados em producao, a migration precisa:
1. Criar backup antes de qualquer ALTER
2. Popular `phone_normalized` para leads existentes (pode levar tempo com volume)
3. Testar UNIQUE constraints contra dados existentes (podem falhar se ja houver duplicatas)
4. Manter compatibilidade retroativa durante transicao

### Risco: Performance de JSONB com Volume

O DRAFT menciona limitar `conversation_log` a 50 mensagens. Concordo, mas sugiro implementar via trigger:

```sql
CREATE FUNCTION limit_conversation_log() RETURNS TRIGGER AS $$
BEGIN
  IF jsonb_array_length(NEW.conversation_log) > 50 THEN
    NEW.conversation_log = (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem FROM jsonb_array_elements(NEW.conversation_log) AS elem
        ORDER BY (elem->>'timestamp')::timestamptz DESC
        LIMIT 50
      ) sub
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. Veredito

| Aspecto | Veredito |
|---------|---------|
| Debitos de DB corretamente identificados? | **SIM** (+ 3 adicionais) |
| Prioridades corretas? | **SIM** (1 upgrade sugerido) |
| Esforcos realistas? | **PARCIAL** (+5h ajuste) |
| Recomendacoes arquiteturais corretas? | **SIM** |
| Plano de remediacao viavel? | **SIM** |

### Resultado: **APROVADO COM AJUSTES**

Os ajustes sao:
1. Manter nome `clients` (nao renomear para `saas_customers`)
2. Upgrade `idx_leads_email_product` para UNIQUE
3. Adicionar 3 debitos faltantes (DB-21, DB-22, DB-23)
4. Ajustar esforco total de DB: 17h → 22h
5. Adicionar index `idx_leads_status_created`
6. Implementar trigger para limitar conversation_log

---

*Review gerado por @data-engineer (Dara) - Brownfield Discovery Phase 5*
