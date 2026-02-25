# UX Specialist Review - Technical Debt DRAFT

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 6
**Agente:** @ux-design-expert (Uma)
**Status:** COMPLETE

---

## 1. Escopo da Revisao

Validacao da secao de frontend/UX do `docs/prd/technical-debt-DRAFT.md` conforme solicitado pelo @architect na Phase 4.

---

## 2. Respostas as Perguntas do @architect

### P1: Prioridades de UX estao corretas?

**SIM, com um ajuste de sequencia.**

A priorizacao por severidade (Critico > Alto > Medio) esta correta. Porem, dentro dos criticos, a **sequencia de execucao** importa:

1. **Tailwind local** (UX-CRIT-01) — Deve ser PRIMEIRO. Sem isso, qualquer trabalho de CSS/componente e instavel.
2. **Auth flow** (UX-CRIT-02) — SEGUNDO. Desbloqueia tudo que depende de usuario logado.
3. **Dashboard dados reais** (UX-CRIT-03) — TERCEIRO. Depende de auth + RLS funcionando.
4. **Error states** (UX-CRIT-04) — Pode ser paralelo a qualquer item acima.

### P2: Auth flow e o primeiro item certo ou onboarding vem antes?

**Auth PRIMEIRO, onboarding DEPOIS.** Razoes:

1. Onboarding depende de auth (precisa saber quem e o usuario)
2. Auth desbloqueia: RLS, multi-tenancy, dados reais, personalizacao
3. Onboarding e um "nice to have" para beta; auth e bloqueante

**Sequencia recomendada:**
```
Auth (login/signup) → Dashboard real → Lead detail → Onboarding
```

### P3: Estimativa de esforco esta realista?

**PARCIALMENTE.** Ajustes sugeridos:

| Item | DRAFT | Minha Estimativa | Motivo |
|------|-------|-----------------|--------|
| Auth flow (login + signup + forgot) | 12h | 16h | +Supabase Auth config, protected routes, token refresh, session management |
| Dashboard dados reais | 4h | 6h | +Views/functions no banco, formatacao de moeda, date ranges |
| Lead detail + conversation | 8h | 10h | +Conversation bubble UI, scroll behavior, real-time updates |
| Onboarding wizard | 6h | 8h | +Step persistence, skip logic, integration validation |
| Toast system | 3h | 2h | Libs prontas (react-hot-toast, sonner) |
| Error states | 4h | 3h | Patterns simples, error boundary + inline |
| **Total UX ajustado** | ~45h | ~55h | +10h |

### P4: Algum debito de UX faltando?

**SIM, 4 debitos adicionais:**

| ID | Debito | Severidade | Esforco |
|----|--------|-----------|---------|
| UX-FLOW-01 | Sem confirmacao de acoes destrutivas (delete product, disconnect WhatsApp) | ALTO | 2h |
| UX-FLOW-02 | Funcoes de search/filter nos Products sao visuais apenas (nao funcionam) | ALTO | 3h |
| UX-FLOW-03 | "Ver Relatorio Completo" e "Ver todos" nao fazem nada | MEDIO | 2h |
| UX-FLOW-04 | Select "Ultimos 30/7 dias" no Dashboard nao funciona | MEDIO | 2h |

---

## 3. Analise de Design System Recommendations

### Concordo com o DRAFT:
- Tailwind local e prioridade maxima
- Design tokens sao necessarios
- Importmap/CDN deve ser eliminado

### Adicao sugerida: Component Library Baseline

Antes de implementar novos componentes (auth, onboarding), recomendo criar componentes base reutilizaveis:

| Componente | Justificativa | Esforco |
|-----------|--------------|---------|
| `Button` (variants: primary, secondary, ghost, danger) | 5 estilos diferentes espalhados | 1h |
| `Input` (variants: text, password, email, select) | Forms em 3 paginas | 1h |
| `Modal` (base component) | ProductModal e QRModal duplicam logica | 1h |
| `Badge` (status variants) | 4 patterns diferentes de badges | 0.5h |
| `Alert/Toast` | Substitui alert() nativo | 1h |

**Esforco total: 4.5h** — mas economiza tempo em TODAS as features subsequentes.

---

## 4. Validacao de Fluxos Propostos

### Auth Flow (proposto no DRAFT)
```
Login page → Email + Password → Supabase Auth → Redirect Dashboard
Signup page → Email + Password + Name → Create auth.user → Create clients row → Redirect Onboarding
Forgot password → Email → Supabase reset link → Reset page
```

**Validacao:** OK, mas adicionar:
- **Magic link** como alternativa (Supabase suporta nativamente, UX superior)
- **Session persistence** (remember me)
- **Loading state** durante auth
- **Error messages** claros (email invalido, senha fraca, conta existente)

### Onboarding Flow (sugerido)
```
Step 1: Bem-vindo → Explicacao do produto
Step 2: Conectar WhatsApp → QR Code flow (reuso QRModal)
Step 3: Configurar primeiro produto → Simplified ProductModal
Step 4: Configurar webhook → Instrucoes por plataforma
Step 5: Enviar lead teste → Validar pipeline
```

**Nota:** Este flow deve ser skippable e retomavel (salvar step no banco).

---

## 5. Impacto Visual das Remediações

### Antes (estado atual):
- App parece demo/prototype
- Dados fake dao impressao de produto abandonado
- Sem login = ninguem leva a serio
- Erros silenciosos = usuario perde confianca

### Depois (pos-remediacao Fase 0-3):
- Auth flow profissional = "produto real"
- Dados reais no dashboard = valor imediato
- Error handling = confianca e transparencia
- Onboarding = baixa barreira de entrada

---

## 6. Veredito

| Aspecto | Veredito |
|---------|---------|
| Debitos de UX corretamente identificados? | **SIM** (+ 4 adicionais) |
| Prioridades corretas? | **SIM** (sequencia ajustada) |
| Esforcos realistas? | **PARCIAL** (+10h ajuste) |
| Recomendacoes de design system? | **SIM** (+ component library baseline) |
| Plano de remediacao viavel? | **SIM** |

### Resultado: **APROVADO COM AJUSTES**

Os ajustes sao:
1. Sequencia de execucao dentro dos criticos: Tailwind → Auth → Dashboard → Errors
2. Adicionar 4 debitos faltantes (UX-FLOW-01 a 04)
3. Ajustar esforco total de UX: 45h → 55h
4. Adicionar component library baseline antes de novas features (4.5h)
5. Auth flow com magic link como alternativa
6. Onboarding flow detalhado em 5 steps

---

*Review gerado por @ux-design-expert (Uma) - Brownfield Discovery Phase 6*
