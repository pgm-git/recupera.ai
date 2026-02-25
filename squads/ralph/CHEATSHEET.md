# Ralph v2 Cheatsheet - Comandos Prontos

**Atualizado:** 2026-02-13

---

## Pre-Requisitos

```powershell
# Verificar Claude CLI
claude --version

# Verificar Node.js (necessario para o parser)
node --version
```

---

## PROJETO: SEU PROJETO

```powershell
cd C:\caminho\do\seu\projeto
```

### Story Unica

```powershell
# Story 3.1 (schema + API)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/3.1.schema-componentes-api-base.md" `
  -MaxIterations 30 -SleepSeconds 5

# Story 3.2
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/3.2.profile-overview-dashboard.md" `
  -MaxIterations 30 -SleepSeconds 5

# Story 3.8 (design system)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/3.8.implementation-design-system-mental-dna.md" `
  -MaxIterations 30 -SleepSeconds 5

# Story 3.8.1
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/3.8.1.bigfive-profile-score-parity.md" `
  -MaxIterations 20 -SleepSeconds 5

# Story 3.8.2
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/3.8.2.mindprofile-ux-overhaul.md" `
  -MaxIterations 20 -SleepSeconds 5

# Qualquer story (substituir o nome)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/NOME_DA_STORY.md" `
  -MaxIterations 30 -SleepSeconds 5
```

### Multiplas Stories (Sequencial)

```powershell
# Stories 3.1 ate 3.5
.\\run-multiple-stories.ps1 `
  -Epic 3 -StartStory 1 -EndStory 5 -MaxIterationsPerStory 30

# Stories 3.8 ate 3.8 (sub-stories nao funcionam com Epic runner)
# Para sub-stories, rodar uma a uma

# Epic 4 completo (quando existir)
.\\run-multiple-stories.ps1 `
  -Epic 4 -StartStory 1 -EndStory 10 -MaxIterationsPerStory 40
```

### Monitor (Agent Ocioso) - Rodar em OUTRO Terminal

```powershell
# Terminal 2 - enquanto Ralph roda no Terminal 1
.\\ralph-monitor.ps1 `
  -StoryFile "docs/stories/3.1.schema-componentes-api-base.md" `
  -PollSeconds 30

# Monitor sem gerar relatorio automatico
.\\ralph-monitor.ps1 `
  -StoryFile "docs/stories/3.1.schema-componentes-api-base.md" `
  -NoReport
```

---

## PROJETO: SEU PROJETO

```powershell
cd C:\caminho\do\seu\projeto
```

### Story Unica

```powershell
# Story 1.0 (prerequisites)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/1.0.prerequisites-tooling-infrastructure.md" `
  -MaxIterations 20 -SleepSeconds 5

# Story 1.1 (design tokens)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/1.1.integrar-design-tokens.md" `
  -MaxIterations 20 -SleepSeconds 5

# Story 1.2 (atoms)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/1.2.implementar-atoms.md" `
  -MaxIterations 25 -SleepSeconds 5

# Story 1.3 (molecules)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/1.3.implementar-molecules.md" `
  -MaxIterations 25 -SleepSeconds 5

# Story 1.4 (organisms)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/1.4.implementar-organisms.md" `
  -MaxIterations 30 -SleepSeconds 5

# Story 1.5 (design system page)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/1.5.reformular-design-system-page.md" `
  -MaxIterations 25 -SleepSeconds 5

# Story 1.6 (paginas visuais)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/1.6.montar-paginas-visuais.md" `
  -MaxIterations 40 -SleepSeconds 5
```

### Multiplas Stories

```powershell
# Stories 1.0 ate 1.6 (epic 1 completo)
.\\run-multiple-stories.ps1 `
  -Epic 1 -StartStory 0 -EndStory 6 -MaxIterationsPerStory 30
```

### Monitor

```powershell
# Terminal 2
.\\ralph-monitor.ps1 `
  -StoryFile "docs/stories/1.6.montar-paginas-visuais.md" `
  -PollSeconds 30
```

---

## Modos de Execucao

```powershell
# DEBUG: 3 iteracoes, sem delay (testar se funciona)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/STORY.md" -MaxIterations 3 -SleepSeconds 0

# PRODUCAO: 30 iteracoes, 5s delay (recomendado)
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/STORY.md" -MaxIterations 30 -SleepSeconds 5

# OVERNIGHT: 100 iteracoes, 10s delay
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/STORY.md" -MaxIterations 100 -SleepSeconds 10
```

---

## Setup Completo (2 Terminais)

```
TERMINAL 1 (Ralph trabalhando):
  cd C:\caminho\do\seu\projeto
  .\\ralph-story.ps1 `
    -StoryFile "docs/stories/3.1.schema-componentes-api-base.md" `
    -MaxIterations 30 -SleepSeconds 5

TERMINAL 2 (Monitor observando):
  cd C:\caminho\do\seu\projeto
  .\\ralph-monitor.ps1 `
    -StoryFile "docs/stories/3.1.schema-componentes-api-base.md" `
    -PollSeconds 30
```

Ralph trabalha no Terminal 1, Monitor observa no Terminal 2.
Quando Ralph termina, Monitor gera relatorio executivo automaticamente.

---

## Fluxo do Ralph v2

```
1. Parser detecta proxima task [ ]
2. Classifica: database? devops? architecture? -> seleciona agent
3. Chama claude -p com Skill(AIOS:agents:dev) [ou outro agent]
4. Claude implementa, testa, marca [x], commita
5. Repete ate todas tasks [x]
6. QA gate: Skill(AIOS:agents:qa) revisa
7. UX gate: Skill(AIOS:agents:ux-design-expert) revisa
8. COMPLETE -> ralph-report.txt
9. Monitor detecta -> gera ralph-executive-report.md
```

---

## Verificar Progresso (Manual)

```powershell
# Parser - progresso de implementacao
node squads/ralph/scripts/ralph-parser.cjs impl-progress "docs/stories/STORY.md"

# Parser - proxima task
node squads/ralph/scripts/ralph-parser.cjs impl-next "docs/stories/STORY.md"

# Parser - status dos gates
node squads/ralph/scripts/ralph-parser.cjs gates "docs/stories/STORY.md"

# Ver learnings
cat progress.txt

# Ver report
cat ralph-report.txt

# Ver report executivo (gerado pelo monitor)
cat ralph-executive-report.md

# Git commits de hoje
git log --since="today" --oneline
```

---

## Interromper e Retomar

### Parar o Ralph

```powershell
# METODO 1: Stop file (RECOMENDADO - funciona sempre)
# De outro terminal, rode:
cd C:\caminho\do\seu\projeto
New-Item ralph-stop

# Ralph detecta o arquivo e para graciosamente apos a iteracao atual
# Gera report completo com status STOPPED_BY_USER
# Exit code: 4

# METODO 2: Ctrl+C (pode nao funcionar durante Claude CLI)
# Pressione Ctrl+C no terminal onde Ralph esta rodando
# Pode ser necessario fechar o terminal se Ctrl+C nao funcionar
```

### Retomar Execução

```powershell
# Retomar: rodar novamente (Ralph e stateless)
# Ele le o story file, ve quais tasks ja estao [x], continua da proxima [ ]
.\\ralph-story.ps1 `
  -StoryFile "docs/stories/STORY.md" -MaxIterations 30

# Ralph retoma de onde parou porque:
# - Le quais tasks estao [x] (completas)
# - Le quais gates estao APPROVED
# - Continua da proxima task [ ] pendente
```

---

## Troubleshooting

```powershell
# Claude nao encontrado
where.exe claude

# Story file nao encontrado
ls docs/stories/*.md

# Loop infinito (mesma task falhando)
cat progress.txt   # ver erro
# Corrigir manualmente, marcar [x] se ja implementou

# Desfazer ultimo commit do Ralph
git reset --soft HEAD~1
```

---

## Arquivos Necessarios

Para rodar Ralph em qualquer projeto, copie estes 4 arquivos:

```
ralph-story.ps1      # Script principal
ralph-monitor.ps1     # Monitor (agent ocioso)
run-multiple-stories.ps1  # Runner de multiplas stories
squads/ralph/scripts/ralph-parser.cjs               # Parser de tasks (Node.js)
```

O projeto precisa ter stories em `docs/stories/` com checkboxes `- [ ]` e `- [x]`.

---

---

## Exit Codes do Ralph

```
0 = Story COMPLETE (todas tasks + gates aprovados)
1 = Atingiu max iterations sem completar
2 = Erro fatal (arquivo nao encontrado, node indisponivel)
3 = Creditos/tokens Claude esgotados
4 = Parado pelo usuario (stop file)
```

---

## Features Recentes (v2.1)

### Iteration Breakdown (2026-02-13)
- Report mostra breakdown detalhado por iteracao
- Tempo por fase (implementation, qa-gate, ux-gate)
- Agent classificado automaticamente (Dev, QA, UX)
- Duracao total vs duracao efetiva (desconta sleep)
- Media de tempo por sessao Claude CLI

### Stop Mechanism (2026-02-13)
- `New-Item ralph-stop` em outro terminal para parar graciosamente
- Ralph detecta antes de cada iteracao
- Ralph detecta durante sleep (poll 1s)
- Gera report completo ao parar
- Limpa stop file automaticamente

### Credit Protection (2026-02-13)
- Detecta quando creditos Claude acabam
- Para imediatamente sem criar mais janelas
- Previne sobrecarga de memoria/CPU
- Exit code 3 especifico para creditos

---

**Ultima atualizacao:** 2026-02-13
