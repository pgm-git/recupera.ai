# Ralph - Sistema de Desenvolvimento Autônomo Externo

**Criado:** 2026-02-12
**Autor:** Comunidade + Claude Sonnet 4.5

---

## 📚 Índice

1. [O Que É Ralph](#o-que-é-ralph)
2. [Por Que NÃO Funciona Dentro do Claude Code](#por-que-não-funciona-dentro-do-claude-code)
3. [Arquivos Nesta Pasta](#arquivos-nesta-pasta)
4. [Quick Start](#quick-start)
5. [Como Funciona](#como-funciona)
6. [Referências](#referências)

---

## O Que E Ralph

Ralph e uma **tecnica de desenvolvimento autonomo** criada por Geoffrey Huntley que permite IA completar tarefas complexas sem degradacao de qualidade.

### Conceito Central

**Contexto fresco a cada iteracao** = Performance maxima sempre

### Como Funciona (v2 - Agent Orchestration)

```
Loop Externo (PowerShell)
|
+-- ralph-parser.cjs detecta fase: implementation / qa-gate / ux-gate / complete
|
+-- FASE 1: IMPLEMENTATION (prompt com instrucoes de @dev)
|   +-- Iteracao 1: claude CLI -> Nova Sessao (0 tokens) -> Task 1 -> [x] -> Commit
|   +-- Iteracao 2: claude CLI -> Nova Sessao (0 tokens) -> Task 2 -> [x] -> Commit
|   +-- ... ate todas tasks [x]
|
+-- FASE 2: QA GATE (prompt com instrucoes de @qa)
|   +-- Iteracao N: claude CLI -> Nova Sessao -> Review -> ## QA Results
|   +-- Se REQUIRES_FIXES: volta pra FASE 1 (fix tasks)
|   +-- Se APPROVED: proximo gate
|
+-- FASE 3: UX GATE (prompt com instrucoes de @ux)
|   +-- Iteracao M: claude CLI -> Nova Sessao -> Review -> ## UX Review
|   +-- Se REQUIRES_REFINEMENT: volta pra FASE 1 (refinement tasks)
|   +-- Se APPROVED: STORY COMPLETE
|
+-- REPORT: Gera ralph-report.txt com metricas consolidadas
```

### Vantagens

| Aspecto            | Com Ralph               | Sem Ralph              |
| ------------------ | ----------------------- | ---------------------- |
| **Contexto**       | 0 tokens sempre         | Acumula até 200k       |
| **Performance**    | 100% inteligência       | Cai após ~100k tokens  |
| **Escalabilidade** | Infinitas iterações     | Limitado pelo contexto |
| **Memória**        | Arquivos (progress.txt) | Histórico da conversa  |

---

## Por Que NÃO Funciona Dentro do Claude Code

### O Problema

Você tentou criar um **squad ralph** (`.claude/commands/AIOS/agents/ralph.md`) para rodar Ralph **de dentro** do Claude Code via `@ralph`.

### Por Que Não Funciona

1. ❌ **Skills/agents rodam na MESMA sessão** do Claude Code
2. ❌ **Não dá pra criar nova sessão** de dentro da sessão atual
3. ❌ **Contexto acumula** na mesma conversa
4. ❌ **Performance cai** após ~100k tokens
5. ❌ **Não tem API** para criar janela/sessão automaticamente

### O Que Funciona

✅ **Ralph EXTERNO** (PowerShell/Bash) que chama `claude` CLI repetidamente

Cada chamada = nova instância = contexto 0 = máxima inteligência

---

## Arquivos Nesta Pasta

### 1. Documentação

| Arquivo                                                       | Descrição                             |
| ------------------------------------------------------------- | ------------------------------------- |
| **README.md**                                                 | Este arquivo - visão geral do sistema |
| **COMO-USAR-RALPH-EXTERNO.md**                                | Guia completo com exemplos detalhados |
| **CHEATSHEET.md**                                             | Comandos rápidos para copy-paste      |
| **Ralph Wiggum LOOP - Video NÃO USE RALPH NO CLAUDE CODE.md** | Explicação do conceito original       |

### 2. Scripts PowerShell

| Arquivo                      | Descrição                                                                 | Uso                                                            |
| ---------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **ralph(1).ps1**             | Script original (usa PRD.md)                                              | `.\ralph(1).ps1 -MaxIterations 20`                             |
| **ralph-story.ps1**          | **v2** com agent orchestration (@dev/@qa/@ux) + validation gates + report | `.\ralph-story.ps1 -StoryFile "docs/stories/3.8.*.md"`         |
| **run-multiple-stories.ps1** | Executa multiplas stories sequencialmente                                 | `.\run-multiple-stories.ps1 -Epic 3 -StartStory 1 -EndStory 5` |

### 3. Scripts Bash (Futuro)

| Arquivo      | Descrição                      |
| ------------ | ------------------------------ |
| **ralph.sh** | Script original para Mac/Linux |

---

## Quick Start

### Pré-requisitos

```powershell
# 1. Verificar Claude CLI instalado
claude --version

# 2. Navegar para o projeto
cd C:\caminho\do\seu\projeto

# 3. Verificar story file existe
ls docs/stories/3.8.*.md
```

### Executar Story Única

```powershell
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/3.8.implementation-design-system-mental-dna.md" `
  -MaxIterations 20 `
  -SleepSeconds 5
```

### Executar Múltiplas Stories

```powershell
.\\run-multiple-stories.ps1 `
  -Epic 3 `
  -StartStory 1 `
  -EndStory 5 `
  -MaxIterationsPerStory 30
```

### Monitorar Progresso

```powershell
# Em outro terminal
cat progress.txt -Tail 20
```

---

## Como Funciona

### 1. Inicialização

Ralph lê:

- **Story file** (`docs/stories/3.8.*.md`) → vê tasks `[ ]` e `[x]`
- **progress.txt** → learnings de iterações anteriores

### 2. Loop de Iteração

Para cada iteração:

```
1. Encontrar próxima task [ ] não completa
2. Ler learnings em progress.txt
3. Implementar task (código, config, etc)
4. Rodar testes/typecheck
5. SE testes passam:
   ├─ Marcar task como [x] no story file
   ├─ Fazer commit: "feat: [task description]"
   └─ Registrar learnings em progress.txt
6. SE testes falham:
   ├─ NÃO marcar [x]
   ├─ NÃO commitar código quebrado
   └─ Registrar erro em progress.txt
7. Verificar se todas tasks [x]
8. SE sim: output <promise>COMPLETE</promise> → exit 0
9. SE não: próxima iteração
```

### 3. Contexto Fresco

**Cada iteração = nova sessão do Claude Code**

```powershell
# Iteração 1
claude --dangerously-skip-permissions -p $prompt
# → Nova sessão (0 tokens)
# → Executa Task 1
# → Encerra sessão

# Iteração 2
claude --dangerously-skip-permissions -p $prompt
# → Nova sessão (0 tokens) ← SEM histórico da Iteração 1
# → Executa Task 2
# → Encerra sessão
```

**Memória entre iterações = arquivos** (`progress.txt`, `story file`)

### 4. Learnings Acumulados

**progress.txt** cresce a cada iteração:

```markdown
## Iteration 1 - Setup database schema

- Implemented Mind model in Prisma
- Files: packages/db/prisma/schema.prisma
- Learnings:
  - Project uses snake_case for columns
  - All models have createdAt/updatedAt

## Iteration 2 - Create tRPC router

- Implemented minds.ts router
- Files: apps/web/server/trpc/routers/minds.ts
- Learnings:
  - Routers go in apps/web/server/ not packages/db
  - Use protectedProcedure for auth
```

**Na Iteração 3**, Claude lê `progress.txt` e aprende:

- ✅ Usar snake_case para colunas
- ✅ Routers vão em `apps/web/server/`
- ✅ Usar `protectedProcedure`

**SEM contexto da conversa** — tudo em arquivo!

---

## Referências

### Vídeo Original

**Ralph Wiggum LOOP** - Geoffrey Huntley
https://youtu.be/yAE3ONleUas?si=VapH_tqQmFSZNWXx

### Conceitos Chave

- **Context Rot** - Modelos ficam "burros" após ~100k tokens
- **Context-Fresh Iterations** - Cada iteração começa com 0 tokens
- **External Loop** - Loop roda FORA do Claude Code (PowerShell/Bash)
- **File-Based Memory** - Memória em arquivos, não em histórico

### Scripts Originais

- `ralph.sh` - Versão Bash (Mac/Linux)
- `ralph.ps1` - Versão PowerShell (Windows)

### Adaptações para Seu Projeto

- `ralph-story.ps1` - Aceita story files (não só PRD.md)
- `run-multiple-stories.ps1` - Executa epic completo

---

## Próximos Passos

### Para Usar Agora

1. Leia: `CHEATSHEET.md` (comandos prontos)
2. Execute: `ralph-story.ps1` na story desejada
3. Monitore: `progress.txt` para ver o que está acontecendo

### Para Entender Melhor

1. Leia: `COMO-USAR-RALPH-EXTERNO.md` (guia completo)
2. Assista: Vídeo original do Geoffrey Huntley
3. Leia: `Ralph Wiggum LOOP - Video NÃO USE RALPH NO CLAUDE CODE.md`

---

## FAQ

### Ralph pode rodar de dentro do Claude Code?

**NÃO.** Ralph precisa rodar EXTERNAMENTE (PowerShell/Bash) chamando `claude` CLI.

### Por quê?

Porque cada iteração precisa ser uma NOVA sessão (contexto 0). De dentro do Claude Code, não dá pra criar nova sessão.

### E o squad ralph em squads/ralph/?

Os scripts em `squads/ralph/scripts/` (ralph-parser.cjs etc.) sao usados pelo ralph-story.ps1 v2
para parsing inteligente de stories. O agent ralph.md dentro do Claude Code NAO e recomendado
para loops longos (contexto acumula). Use sempre o loop externo.

### Entao como usar Ralph?

Execute `ralph-story.ps1` em PowerShell FORA do Claude Code.

### Quanto tempo demora?

- 1 iteração ≈ 2-5 min
- Story média (13 tasks) ≈ 1-2.5 horas
- Epic completo (10 stories) ≈ 10-25 horas

### Posso deixar rodando overnight?

SIM! Use `-MaxIterations 100 -SleepSeconds 10`

### Como parar o Ralph?

**Método recomendado:** Stop file

```powershell
# De outro terminal
cd C:\caminho\do\seu\projeto
New-Item ralph-stop
```

Ralph detecta o arquivo e para graciosamente após a iteração atual, gerando report completo.

**Por que não usar Ctrl+C?**

Ctrl+C não funciona quando o processo filho (`claude` CLI) está executando. O stop file funciona sempre.

### E se algo quebrar?

Ralph registra em `progress.txt`. Você pode:

1. Ler o erro
2. Corrigir manualmente
3. Marcar task como `[x]`
4. Retomar Ralph (ele continua da próxima `[ ]`)

---

## Features Recentes

### v2.1 (2026-02-13)

**Iteration Breakdown:**
- Report detalhado por iteração (fase, agent, duração)
- Sessions count (chamadas reais ao Claude CLI)
- Duração total vs efetiva (desconta sleep overhead)
- Média de tempo por sessão
- Commit count no report

**Stop Mechanism:**
- `New-Item ralph-stop` para parar graciosamente
- Detecta antes de cada iteração + durante sleep
- Gera report completo ao parar (exit code 4)
- Instrução visível no banner de inicialização

**Credit Protection:**
- Detecta quando créditos Claude acabam
- Para imediatamente (exit code 3)
- Previne explosão de memória/CPU

---

**Última atualização:** 2026-02-13
