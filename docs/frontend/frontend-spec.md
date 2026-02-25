# Frontend/UX Specification - Recupera.AI

**Data:** 2026-02-24
**Fase:** Brownfield Discovery - Phase 3
**Agente:** @ux-design-expert (Uma)
**Status:** COMPLETE

---

## 1. Inventario de Componentes

### Pages (3)

| Page | Arquivo | LOC | Responsabilidade |
|------|---------|-----|-----------------|
| Dashboard | `pages/Dashboard.tsx` | 126 | KPIs, grafico, status leads, tabela recentes |
| Products | `pages/Products.tsx` | 163 | CRUD de produtos, grid cards, modal config |
| Settings | `pages/Settings.tsx` | 132 | WhatsApp connection, webhook URL, API keys |

### Components (7)

| Component | Arquivo | LOC | Tipo | Reusavel? |
|-----------|---------|-----|------|-----------|
| Layout | `components/Layout.tsx` | 107 | Structural | Sim (shell) |
| MetricCard | `components/MetricCard.tsx` | 65 | Display | Sim |
| RecoveryChart | `components/RecoveryChart.tsx` | 69 | Data Viz | Sim |
| LeadsTable | `components/LeadsTable.tsx` | 121 | Data Display | Sim |
| ProductCard | `components/ProductCard.tsx` | 88 | Display | Sim |
| ProductModal | `components/ProductModal.tsx` | 251 | Form/Modal | Parcial |
| QRModal | `components/QRModal.tsx` | 111 | Interactive | Nao (especifico) |

### Services (3)

| Service | Arquivo | LOC | Funcao |
|---------|---------|-----|--------|
| apiService | `services/apiService.ts` | ~50 | WhatsApp API (connect, status) |
| dataService | `services/dataService.ts` | 160 | Supabase queries + mock fallback |
| mockService | `services/mockService.ts` | ~80 | Dados de demonstracao |

---

## 2. Design System Audit

### Status: NAO EXISTE design system formal

| Aspecto | Estado Atual | Nota |
|---------|-------------|------|
| **Tipografia** | Inter (Google Fonts CDN) | Boa escolha, pesos 300-700 |
| **Cores** | Tailwind `brand-*` custom (blue palette) | Definido inline no `index.html` |
| **Espacamento** | Tailwind defaults (p-4, p-6, p-8) | Inconsistente entre componentes |
| **Border Radius** | Mix de `rounded-lg`, `rounded-xl`, `rounded-2xl` | Sem padrao claro |
| **Sombras** | `shadow-sm`, `shadow-md`, `shadow-xl` | Inconsistente |
| **Tokens** | Nenhum arquivo de tokens | Tudo inline no Tailwind |
| **CSS Framework** | Tailwind via CDN (`cdn.tailwindcss.com`) | NAO prodution-ready |

### Paleta de Cores Utilizada

```
Brand:     #3b82f6 (blue-500) → #1e3a8a (blue-900)
Success:   #10b981 (emerald-500)
Warning:   #f59e0b (amber-500)
Danger:    #ef4444 (red-500)
Neutral:   #64748b (slate-500) → #0f172a (slate-900)
Background:#f8fafc (slate-50)
Surface:   #ffffff (white)
```

### Problemas de Design System

| ID | Problema | Severidade | Impacto |
|----|---------|-----------|---------|
| UX-DS-01 | Tailwind via CDN (nao bundled) | CRITICO | Nao funciona offline, perf ruim, bloqueante para producao |
| UX-DS-02 | Config de cores inline no HTML | ALTO | Nao compartilhavel, dificil manter |
| UX-DS-03 | Sem arquivo de tokens/theme | ALTO | Impossivel tematizar, dark mode, white-label |
| UX-DS-04 | Border radius inconsistente | MEDIO | Visual inconsistente |
| UX-DS-05 | Sem component library documentada | MEDIO | Reuso por tentativa e erro |

---

## 3. Analise de Fluxos de Usuario

### Fluxo 1: Dashboard (View Only)

```
[Login] → (NAO EXISTE)
  ↓
[Dashboard] → Visualiza KPIs (hardcoded)
  ↓
  Visualiza grafico (mock data)
  ↓
  Visualiza status leads (hardcoded)
  ↓
  Visualiza tabela leads (Supabase ou mock)
```

**Problemas:**
- Metricas KPIs sao hardcoded (`R$ 15.400,00`, `1.240`, `18.4%`, `3.842`)
- Status leads sidebar tem dados hardcoded (45, 128, 84, 12)
- Grafico sempre retorna mock data (nenhuma query real)
- Botao "Ver Relatorio Completo" nao faz nada
- Botao "Ver todos" nos leads nao faz nada
- Select "Ultimos 30 dias / 7 dias" nao faz nada

### Fluxo 2: Products CRUD

```
[Products] → Lista grid de produtos
  ↓
  [+ Novo Produto] → Modal (2 tabs)
    ↓
    Tab "Basicas": nome, plataforma, ID externo, delay
    Tab "AI Config": persona, objecoes, downsell link
    ↓
    [Salvar] → upsert no Supabase
  ↓
  [Edit] → Modal preenchido com dados
  ↓
  [Pausar/Ativar] → toggle is_active
```

**Problemas:**
- Search bar nao funciona (apenas visual)
- Filter "Status" nao funciona
- Select "Todas Plataformas" nao funciona
- `alert()` nativo usado para erros (`Products.tsx:75`)
- Nenhuma validacao de input no modal
- `clientId` nao setado ao criar produto novo (Supabase requer)

### Fluxo 3: WhatsApp Connection

```
[Settings] → Click "Conectar Instancia"
  ↓
  [QR Modal] → Loading spinner
  ↓
  API call → POST /api/whatsapp/connect/user-id-placeholder
  ↓
  Exibe QR Code (ou fake QR)
  ↓
  Polling a cada 3s → GET /api/whatsapp/status/...
  ↓
  Se connected → tela de sucesso
```

**Problemas:**
- `mockClientId = "user-id-placeholder"` hardcoded
- Webhook URL hardcoded: `https://api.recupa.ai/...` (dominio inexistente)
- Status WhatsApp sempre "Desconectado" (sem persistencia)
- Nao ha timeout no polling (roda infinitamente se nao conectar)
- Nao ha botao "Tentar novamente" se QR expirar

### Fluxo Ausente: Autenticacao

```
[Login] → NAO EXISTE
[Signup] → NAO EXISTE
[Forgot Password] → NAO EXISTE
[Onboarding] → NAO EXISTE
```

---

## 4. Responsividade

### Layout Responsivo

| Breakpoint | Comportamento | Status |
|-----------|--------------|--------|
| Desktop (>768px) | Sidebar fixa 256px + content area | OK |
| Mobile (<768px) | Header top + bottom nav + content | OK |
| Tablet | Nao tratado explicitamente | PARCIAL |

### Analise por Componente

| Componente | Desktop | Mobile | Problemas |
|-----------|---------|--------|-----------|
| Layout | Sidebar + content | Header + bottom nav | Bottom nav nao tem safe area (notch) |
| Dashboard KPIs | Grid 4 cols | Grid 1 col | OK |
| Dashboard Chart | 2/3 width | Full width | OK |
| Products Grid | 3 cols | 1 col | OK |
| ProductModal | Max 2xl centered | Full width com padding | `max-h-[90vh]` pode cortar em mobile |
| QRModal | Max md centered | Full width | OK |
| LeadsTable | Scroll horizontal | Scroll horizontal | Colunas apertadas em mobile |
| Settings | Max 4xl centered | Full width | OK |

### Debitos de Responsividade

| ID | Problema | Severidade |
|----|---------|-----------|
| UX-RES-01 | Bottom nav sem `safe-area-inset-bottom` (iPhones com notch) | ALTO |
| UX-RES-02 | Tabela de leads ilegivel em mobile (muitas colunas) | MEDIO |
| UX-RES-03 | ProductModal pode cortar conteudo em telas baixas | MEDIO |
| UX-RES-04 | Sem breakpoint tablet especifico | BAIXO |

---

## 5. Acessibilidade (a11y)

### Score Estimado: 3/10

| Criterio | Status | Detalhes |
|---------|--------|---------|
| **Semantic HTML** | PARCIAL | Usa `<nav>`, `<main>`, `<table>`, mas botoes com `<button>` |
| **ARIA labels** | AUSENTE | Nenhum `aria-label`, `aria-describedby`, `role` |
| **Keyboard nav** | PARCIAL | Botoes sao focaveis, mas modais nao trap focus |
| **Color contrast** | PARCIAL | Maioria OK, mas `text-slate-400` em `bg-white` falha WCAG AA |
| **Screen reader** | AUSENTE | Nenhum `sr-only`, status nao anunciado |
| **Focus indicators** | PARCIAL | Tailwind default focus ring, nao customizado |
| **Alt text** | AUSENTE | QR code img sem alt descritivo util |
| **Skip navigation** | AUSENTE | Nao tem link "skip to content" |
| **Error messages** | AUSENTE | Erros via `alert()` ou `console.error` |
| **Form labels** | OK | Labels presentes nos formularios |

### Debitos de Acessibilidade

| ID | Problema | WCAG | Esforco |
|----|---------|------|---------|
| UX-A11Y-01 | Zero ARIA labels em componentes interativos | 4.1.2 | 3h |
| UX-A11Y-02 | Modais nao trappam focus (tab escapa) | 2.4.3 | 2h |
| UX-A11Y-03 | Contraste insuficiente em textos `slate-400` | 1.4.3 | 1h |
| UX-A11Y-04 | Status badges nao comunicam para screen readers | 4.1.3 | 2h |
| UX-A11Y-05 | Sem skip navigation link | 2.4.1 | 0.5h |

---

## 6. Estados de UI

### Analise de Estados por Componente

| Componente | Loading | Empty | Error | Success | Offline |
|-----------|---------|-------|-------|---------|---------|
| Dashboard KPIs | NAO | N/A | NAO | N/A | NAO |
| RecoveryChart | SIM (spinner) | NAO | NAO | N/A | NAO |
| LeadsTable | SIM (spinner) | SIM ("Nenhum lead") | NAO | N/A | NAO |
| ProductCard | NAO | N/A | NAO | N/A | NAO |
| Products Grid | SIM (skeleton) | NAO | NAO | N/A | NAO |
| ProductModal | SIM ("Salvando...") | N/A | NAO (`alert()`) | NAO | NAO |
| QRModal | SIM (spinner) | N/A | NAO | SIM (connected) | NAO |
| Settings | NAO | N/A | NAO | NAO | NAO |

### Debitos de Estados

| ID | Problema | Severidade |
|----|---------|-----------|
| UX-ST-01 | KPIs nao tem loading state (aparecem hardcoded imediatamente) | ALTO |
| UX-ST-02 | Nenhum componente tem estado de erro visual | CRITICO |
| UX-ST-03 | Sem estado offline/fallback visual (mock silencioso) | ALTO |
| UX-ST-04 | ProductModal usa `alert()` para erros | ALTO |
| UX-ST-05 | Sem confirmacao visual apos salvar produto | MEDIO |
| UX-ST-06 | Sem toast/notification system | ALTO |

---

## 7. Performance Percebida

| Aspecto | Status | Detalhe |
|---------|--------|---------|
| **First Paint** | LENTO | Tailwind CDN (render-blocking), Google Fonts CDN |
| **Skeleton loading** | PARCIAL | So na Products grid |
| **Optimistic updates** | SIM | Toggle product status |
| **Data caching** | NAO | Cada page mount refetch tudo |
| **Image optimization** | N/A | So QR code (base64) |
| **Code splitting** | NAO | Tudo em um bundle |
| **Lazy loading** | NAO | Todas as paginas carregam juntas |

### Debitos de Performance

| ID | Problema | Severidade | Esforco |
|----|---------|-----------|---------|
| UX-PERF-01 | Tailwind via CDN bloqueia render | CRITICO | 2h (instalar Tailwind local) |
| UX-PERF-02 | Google Fonts sem `font-display: swap` | MEDIO | 0.5h |
| UX-PERF-03 | Sem code splitting (React.lazy) | MEDIO | 2h |
| UX-PERF-04 | Sem caching de dados (refetch a cada mount) | ALTO | 4h (TanStack Query) |
| UX-PERF-05 | importmap carrega deps de ESM CDN | ALTO | 2h (bundle com Vite) |

---

## 8. Consistencia Visual

### Padroes Detectados

| Pattern | Uso Consistente? | Nota |
|---------|-----------------|------|
| Card borders | SIM | `border border-slate-200 rounded-xl` |
| Section titles | SIM | `text-lg font-bold text-slate-900` |
| Page titles | SIM | `text-2xl font-bold text-slate-900` |
| Button primary | SIM | `bg-brand-600 text-white rounded-lg` |
| Button secondary | PARCIAL | Mix de estilos |
| Input fields | SIM | `border border-slate-300 rounded-lg` |
| Badge styles | SIM | `rounded-full text-xs font-medium` |
| Spacing | PARCIAL | Mix de p-4, p-5, p-6, p-8 |
| Icon sizes | PARCIAL | Mix de 16, 18, 20, 22, 24 |
| Shadow levels | PARCIAL | Mix de shadow-sm e shadow-md |

### Inconsistencias Visuais

| ID | Local | Problema |
|----|-------|---------|
| UX-CON-01 | Paddings | Dashboard usa p-6, Products usa p-5, Settings usa p-6 |
| UX-CON-02 | Icon sizes | MetricCard=22, Layout=20/24, ProductCard=16/20 |
| UX-CON-03 | Borders radius | Cards=rounded-xl, QRModal=rounded-2xl, Buttons=rounded-lg |
| UX-CON-04 | Font size labels | Mix de text-sm e text-xs para labels |

---

## 9. Paginas/Fluxos Ausentes

| Pagina | Criticidade | Motivo |
|--------|------------|--------|
| **Login/Signup** | BLOQUEANTE | Sem auth, tudo e demo mode |
| **Onboarding wizard** | ALTA | Novo cliente nao sabe como comecar |
| **Lead detail view** | ALTA | Nao da pra ver conversa do lead |
| **Conversation view** | ALTA | conversation_log existe mas nao e exibido |
| **Billing/Plans** | MEDIA | Schema completo tem plans, UI nao |
| **Profile/Account** | MEDIA | "Usuario Demo" hardcoded |
| **Help/Docs** | BAIXA | Sem documentacao in-app |
| **404 page** | BAIXA | Redireciona para / (ok para SPA) |

---

## 10. Resumo de Debitos Frontend/UX

### Total: 32 debitos

| Categoria | Criticos | Altos | Medios | Baixos | Total |
|-----------|---------|-------|--------|--------|-------|
| Design System | 1 | 2 | 2 | 0 | 5 |
| Responsividade | 0 | 1 | 2 | 1 | 4 |
| Acessibilidade | 0 | 0 | 3 | 2 | 5 |
| Estados de UI | 1 | 3 | 1 | 0 | 5 |
| Performance | 1 | 2 | 2 | 0 | 5 |
| Consistencia | 0 | 0 | 4 | 0 | 4 |
| Fluxos Ausentes | 1 | 3 | 0 | 0 | 4 |
| **TOTAL** | **4** | **11** | **14** | **3** | **32** |

### Esforco Estimado: ~45h

| Prioridade | Esforco |
|-----------|---------|
| Criticos | ~8h |
| Altos | ~20h |
| Medios | ~14h |
| Baixos | ~3h |

---

## 11. Respostas ao @architect

### P1: Design system existe ou componentes sao ad-hoc?
**Ad-hoc.** Componentes seguem padroes visuais implicitamente (via copy-paste de classes Tailwind), mas nao existe design tokens, tema configuravel, ou documentacao de componentes. O mais proximo de um "design system" e a config de cores `brand` no `index.html`.

### P2: Estados de loading/error/empty estao cobertos?
**Parcialmente.** Loading existe em 3/7 componentes (LeadsTable, Products grid, QRModal). Empty state existe apenas em LeadsTable. **Error states nao existem em nenhum componente** — erros sao logados no console ou mostrados via `alert()` nativo.

### P3: Mobile-first ou desktop-first a abordagem atual?
**Desktop-first.** O Layout define sidebar 256px e usa `hidden md:flex` para mostrar/esconder. Mobile e um afterthought com bottom nav e header simplificado. Funciona, mas tem gaps (safe area, tabela apertada).

### P4: Acessibilidade (a11y) esta minimamente coberta?
**NAO.** Score estimado 3/10. Zero ARIA labels, zero screen reader support, modais nao trappam focus, contraste insuficiente em textos secundarios. Precisa de trabalho significativo para atingir WCAG AA minimo.

---

*Documento gerado por @ux-design-expert (Uma) - Brownfield Discovery Phase 3*
