#################################################################################
# Ralph Story Runner v2 - Orchestration with AIOS Agent Delegation
#################################################################################
#
# Loop EXTERNO (contexto fresco) com delegacao inteligente para agents AIOS:
#   - @dev  : Implementacao de codigo (tasks de implementacao)
#   - @qa   : QA review (validation gate - secao ## QA Results)
#   - @ux   : UX review (validation gate - secao ## UX Review)
#
# Fases:
#   1. IMPLEMENTATION - tasks [ ] na secao ## Tasks
#   2. QA GATE        - se story tem ## QA Results (preenche e valida)
#   3. UX GATE        - se story tem ## UX Review (preenche e valida)
#   4. REPORT         - gera relatorio consolidado em progress.txt
#
# Uso:
#   .\ralph-story.ps1 1.0                              # encontra docs/stories/1.0.*.md automaticamente
#   .\ralph-story.ps1 3.8 -MaxIterations 30             # story 3.8 com 30 iteracoes
#   .\ralph-story.ps1 3.8.1                             # sub-story 3.8.1
#   .\ralph-story.ps1 -StoryFile "docs/stories/3.8.*.md" -MaxIterations 30  # caminho completo (tambem funciona)
#
# Exit Codes:
#   0 = Story COMPLETE (todas tasks + gates aprovados)
#   1 = Atingiu max iterations
#   2 = Erro fatal (arquivo nao encontrado, node indisponivel, etc)
#   3 = Creditos/tokens Claude esgotados
#   4 = Parado pelo usuario (stop file)
#
# Parar execucao:
#   De outro terminal, rode:  New-Item ralph-stop
#   Ralph para apos a iteracao atual terminar.
#
#################################################################################

param(
    [Parameter(Position=0)]
    [string]$StoryId,
    [string]$StoryFile,
    [int]$MaxIterations = 10,
    [int]$SleepSeconds = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ==============================================================================
# CONSTANTS
# ==============================================================================

# Determine project root (go up 3 levels from this script's directory)
# This script is in 
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

# Use relative path for parser (relative to project root where node will run)
$PARSER_SCRIPT = "squads/ralph/scripts/ralph-parser.cjs"
$PROGRESS_FILE = "progress.txt"
$REPORT_FILE   = "ralph-report.txt"
$STORIES_DIR   = "docs/stories"
$STOP_FILE     = "ralph-stop"

# ==============================================================================
# RESOLVE STORY FILE
# ==============================================================================

if ($StoryId -and -not $StoryFile) {
    # User passed just the ID: 1.0, 3.8, 3.8.1, etc.
    $matches = Get-ChildItem -Path $STORIES_DIR -Filter "$StoryId.*.md" -ErrorAction SilentlyContinue
    if (-not $matches -or $matches.Count -eq 0) {
        # Try exact match
        $matches = Get-ChildItem -Path $STORIES_DIR -Filter "$StoryId*.md" -ErrorAction SilentlyContinue
    }
    if ($matches -and $matches.Count -gt 0) {
        if ($matches.Count -gt 1) {
            Write-Host "[ralph] Found multiple stories for '$StoryId':"
            $idx = 1
            foreach ($m in $matches) {
                Write-Host "  $idx. $($m.Name)"
                $idx++
            }
            Write-Host ""
            $pick = Read-Host "Which one? (number)"
            $StoryFile = "$STORIES_DIR/$($matches[[int]$pick - 1].Name)"
        } else {
            $StoryFile = "$STORIES_DIR/$($matches[0].Name)"
        }
        Write-Host "[ralph] Resolved: $StoryId -> $StoryFile"
    } else {
        Write-Host "[ralph] ERROR: No story found matching '$StoryId' in $STORIES_DIR/"
        Write-Host "[ralph] Available stories:"
        Get-ChildItem -Path $STORIES_DIR -Filter "*.md" | ForEach-Object { Write-Host "  $($_.Name)" }
        exit 2
    }
} elseif (-not $StoryFile) {
    Write-Host "[ralph] ERROR: No story specified."
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\ralph-story.ps1 1.0                    # by story ID"
    Write-Host "  .\ralph-story.ps1 3.8 -MaxIterations 30  # with options"
    Write-Host "  .\ralph-story.ps1 -StoryFile path/to.md  # by full path"
    Write-Host ""
    Write-Host "Available stories:"
    if (Test-Path $STORIES_DIR) {
        Get-ChildItem -Path $STORIES_DIR -Filter "*.md" | ForEach-Object { Write-Host "  $($_.Name)" }
    } else {
        Write-Host "  (no $STORIES_DIR/ directory found)"
    }
    exit 2
}

# Normalize path to relative for parser
# If absolute path, convert to relative to project root
if ([System.IO.Path]::IsPathRooted($StoryFile)) {
    # Convert absolute to relative
    $StoryFile = (Resolve-Path -Path $StoryFile -Relative).TrimStart('.\')
}
# Convert backslashes to forward slashes for Node.js
$StoryFile = $StoryFile -replace '\\', '/'

# ==============================================================================
# HELPERS
# ==============================================================================

function Write-Section($msg) {
    Write-Host ""
    Write-Host ("=" * 60)
    Write-Host "  $msg"
    Write-Host ("=" * 60)
    Write-Host ""
}

function Write-Info($msg)  { Write-Host "[ralph] $msg" }
function Write-Ok($msg)    { Write-Host "[ralph] OK: $msg" }
function Write-Warn($msg)  { Write-Host "[ralph] WARN: $msg" }
function Write-Err($msg)   { Write-Host "[ralph] ERROR: $msg" }

function Test-StopRequested {
    <#
    .SYNOPSIS
    Verifica se o usuario pediu para parar via stop file.
    De outro terminal: New-Item ralph-stop
    #>
    $stopPath = Join-Path $projectRoot $STOP_FILE
    if (Test-Path $stopPath) {
        Remove-Item $stopPath -Force -ErrorAction SilentlyContinue
        return $true
    }
    return $false
}

function Get-StoryPhase {
    <#
    .SYNOPSIS
    Determina em que fase a story esta usando ralph-parser.js
    Retorna: "implementation", "qa-gate", "ux-gate", "complete", ou "error"
    #>
    param([string]$file)

    # Check if parser exists
    if (-not (Test-Path $PARSER_SCRIPT)) {
        Write-Warn "Parser not found at $PARSER_SCRIPT - using basic mode"
        return "basic"
    }

    try {
        # Set up environment to run from project root
        $savedLocation = Get-Location
        Set-Location $projectRoot

        try {
            # Get implementation progress
            $implJson = (& node $PARSER_SCRIPT impl-progress $file 2>&1 | Out-String).Trim()

            # If parser failed, it means node couldn't run the script - fall back to basic mode
            if ($LASTEXITCODE -ne 0 -or -not $implJson) {
                Write-Warn "Parser not available - using basic mode"
                Set-Location $savedLocation
                return "basic"
            }

            $impl = $implJson | ConvertFrom-Json

            # If there are uncompleted implementation tasks, we're in implementation phase
            if ($impl.remaining -gt 0) {
                Set-Location $savedLocation
                Write-Info "Implementation: $($impl.completed)/$($impl.total) tasks done ($($impl.remaining) remaining)"
                return "implementation"
            }

            Write-Ok "All $($impl.total) implementation tasks complete"

            # All impl tasks done - check validation gates
            $gatesJson = (& node $PARSER_SCRIPT gates $file 2>&1 | Out-String).Trim()
            $gates = $gatesJson | ConvertFrom-Json
        }
        finally {
            Set-Location $savedLocation
        }

        # QA gate
        if ($gates.qa.hasSection) {
            $qaStatus = $gates.qa.status
            Write-Info "QA Gate status: $qaStatus"
            if ($qaStatus -ne "APPROVED") {
                return "qa-gate"
            }
        }

        # UX gate
        if ($gates.ux.hasSection) {
            $uxStatus = $gates.ux.status
            Write-Info "UX Gate status: $uxStatus"
            if ($uxStatus -ne "APPROVED") {
                return "ux-gate"
            }
        }

        return "complete"
    }
    catch {
        Write-Warn "Parser error: $($_.Exception.Message)"
        return "basic"
    }
}

function Get-NextImplTask {
    param([string]$file)
    try {
        $json = (& node $PARSER_SCRIPT impl-next $file 2>&1 | Out-String).Trim()
        return ($json | ConvertFrom-Json)
    }
    catch {
        return $null
    }
}

function Classify-TaskAgent {
    <#
    .SYNOPSIS
    Classifica uma task pelo texto e retorna o agent AIOS mais adequado.
    Retorna hashtable com: skillName, agentName, agentLabel
    #>
    param([string]$taskText)

    $text = $taskText.ToLower()

    # Data Engineer: banco de dados, migrations, schemas
    $dataKeywords = @('prisma', 'migration', 'migrate', 'schema', 'database', 'db ', 'sql', 'seed', 'model ', 'table', 'column', 'index ', 'foreign key', 'relation', 'etl', 'data pipeline')
    foreach ($kw in $dataKeywords) {
        if ($text -match [regex]::Escape($kw)) {
            return @{ skillName = "AIOS:agents:data-engineer"; agentName = "@data-engineer"; agentLabel = "Data Engineer" }
        }
    }

    # DevOps: deploy, CI/CD, docker, git operations
    $devopsKeywords = @('deploy', 'ci/cd', 'pipeline', 'docker', 'dockerfile', 'kubernetes', 'k8s', 'nginx', 'github action', 'workflow yml', 'vercel', 'netlify', 'aws', 'infra')
    foreach ($kw in $devopsKeywords) {
        if ($text -match [regex]::Escape($kw)) {
            return @{ skillName = "AIOS:agents:devops"; agentName = "@devops"; agentLabel = "DevOps (Gage)" }
        }
    }

    # Architect: decisoes de arquitetura, patterns, system design
    $archKeywords = @('architect', 'architecture', 'system design', 'pattern', 'refactor major', 'restructure', 'adr', 'decision record', 'monorepo', 'microservice')
    foreach ($kw in $archKeywords) {
        if ($text -match [regex]::Escape($kw)) {
            return @{ skillName = "AIOS:agents:architect"; agentName = "@architect"; agentLabel = "Architect (Archie)" }
        }
    }

    # Analyst: pesquisa, analise, investigacao
    $analystKeywords = @('research', 'pesquisa', 'analys', 'analis', 'investigat', 'benchmark', 'compare', 'evaluate')
    foreach ($kw in $analystKeywords) {
        if ($text -match [regex]::Escape($kw)) {
            return @{ skillName = "AIOS:agents:analyst"; agentName = "@analyst"; agentLabel = "Analyst" }
        }
    }

    # Default: Dev (Dex) - implementacao geral
    return @{ skillName = "AIOS:agents:dev"; agentName = "@dev"; agentLabel = "Dev (Dex)" }
}

function Build-ImplementationPrompt {
    <#
    .SYNOPSIS
    Monta prompt para iteracao de implementacao - ativa agent AIOS via Skill tool
    O agent e selecionado automaticamente via Classify-TaskAgent
    #>
    param(
        [string]$file,
        [int]$iteration,
        [string]$taskText,
        [string]$skillName
    )

    # Escape single quotes for PowerShell heredoc
    $escapedSkill = $skillName -replace "'", "''"

    return @'
RALPH AUTONOMOUS MODE - NO QUESTIONS, JUST EXECUTE

Activate agent and execute task immediately in YOLO mode.

Story: {0}
Iteration: {1}
Task: {2}

AGENT ACTIVATION:
Use Skill tool: skill="{3}", args="RALPH AUTO MODE"

EXECUTION PROTOCOL (NO USER INTERACTION):
1. Read {0} completely (story context + acceptance criteria)
2. Read progress.txt if exists (check Learnings)
3. Implement the task above - follow existing patterns
4. Complete ALL subtasks if task has indented checkboxes
5. Run validation: npm run lint, npm run typecheck (if applicable)

ON SUCCESS:
- Mark task [x] in story file (change [ ] to [x] for task + all subtasks)
- Commit: "feat: [task description] [Story iteration {1}]"
- Append to progress.txt:
  ## Iteration {1} - [Task Name]
  - What: [implemented]
  - Files: [changed]
  - Learnings: [discovered patterns/gotchas]
  ---

ON FAILURE:
- DO NOT mark [x]
- DO NOT commit
- Append error to progress.txt

END SIGNAL:
- If ALL tasks [x]: output <promise>PHASE_DONE</promise>
- If tasks remain [ ]: just end
'@ -f $file, $iteration, $taskText, $escapedSkill
}

function Build-QAGatePrompt {
    <#
    .SYNOPSIS
    Monta prompt para QA review - ativa /AIOS:agents:qa via Skill tool
    #>
    param(
        [string]$file,
        [int]$iteration
    )

    return @'
RALPH QA GATE - NO QUESTIONS, AUTO EXECUTE

Story: {0}
Iteration: {1}
Phase: QA VALIDATION (all impl tasks [x])

AGENT ACTIVATION:
Use Skill tool: skill="AIOS:agents:qa", args="RALPH QA AUTO MODE"

QA PROTOCOL (YOLO MODE):
1. Read {0} completely (acceptance criteria + completed tasks)
2. Read progress.txt (what was implemented + known issues)
3. Review code changes (check File List section in story)
4. Run: npm run lint, npm run typecheck, npm test (if available)
5. Fill ## QA Results section in story

RESULTS FORMAT:
## QA Results
**Status:** APPROVED or REQUIRES_FIXES
**Reviewer:** QA Agent (Ralph Loop)
**Date:** [today]

### Summary
[2-3 sentences on quality]

### Findings
- [issue 1]
- [issue 2]

### Fix Tasks (only if REQUIRES_FIXES)
- [ ] **QA Fix: [description]**

RULES:
- Focus on real issues, not nitpicks
- APPROVED = all criteria met + good quality
- REQUIRES_FIXES = add fix tasks to ## Tasks section
- Commit: "fix: QA gate review [Story {1}]"

END SIGNAL:
- APPROVED: output <promise>PHASE_DONE</promise>
- REQUIRES_FIXES: just end
'@ -f $file, $iteration
}

function Build-UXGatePrompt {
    <#
    .SYNOPSIS
    Monta prompt para UX review - ativa /AIOS:agents:ux-design-expert via Skill tool
    #>
    param(
        [string]$file,
        [int]$iteration
    )

    return @'
RALPH UX GATE - NO QUESTIONS, AUTO EXECUTE

Story: {0}
Iteration: {1}
Phase: UX VALIDATION (impl + QA done)

AGENT ACTIVATION:
Use Skill tool: skill="AIOS:agents:ux-design-expert", args="RALPH UX AUTO MODE"

UX PROTOCOL (YOLO MODE):
1. Read {0} completely (UX acceptance criteria)
2. Read progress.txt (implementation context)
3. Review component code (visual consistency + accessibility + responsive + design tokens)
4. Fill ## UX Review section in story

RESULTS FORMAT:
## UX Review
**Status:** APPROVED or REQUIRES_REFINEMENT
**Reviewer:** UX Agent (Ralph Loop)
**Date:** [today]

### Visual Consistency
[assessment]

### Accessibility
[assessment]

### Checklist Results
- [x] [item]: [pass/fail + notes]

### Refinement Tasks (only if REQUIRES_REFINEMENT)
- [ ] **UX Fix: [description]**

RULES:
- Focus on real UX issues (accessibility/visual), not preferences
- APPROVED = meets UX standards
- REQUIRES_REFINEMENT = add fix tasks to ## Tasks section
- Commit: "fix: UX gate review [Story {1}]"

END SIGNAL:
- APPROVED: output <promise>PHASE_DONE</promise>
- REQUIRES_REFINEMENT: just end
'@ -f $file, $iteration
}

function Build-BasicPrompt {
    <#
    .SYNOPSIS
    Prompt basico quando parser nao esta disponivel (fallback)
    #>
    param(
        [string]$file,
        [int]$iteration
    )

    return @'
RALPH BASIC MODE - NO QUESTIONS, AUTO EXECUTE

Story: {0}
Iteration: {1}

YOLO PROTOCOL:
1. Read {0} - find first [ ] task
2. Read progress.txt (check Learnings)
3. Implement ONE task only
4. Run: npm run lint, npm run typecheck (if available)

ON SUCCESS:
- Mark task [x] in story
- Commit: "feat: [task description]"
- Append to progress.txt:
  ## Iteration {1} - [Task Name]
  - What: [implemented]
  - Files: [changed]
  - Learnings: [patterns/gotchas]
  ---

ON FAILURE:
- DO NOT mark [x]
- DO NOT commit
- Append error to progress.txt

END SIGNAL:
- ALL tasks [x]: output <promise>COMPLETE</promise>
- Tasks remain [ ]: just end
'@ -f $file, $iteration
}

function Generate-Report {
    <#
    .SYNOPSIS
    Gera relatorio consolidado final com iteration breakdown
    #>
    param(
        [string]$file,
        [int]$totalIterations,
        [string]$finalPhase,
        [datetime]$startTime,
        [array]$iterationLog = @()
    )

    $duration = (Get-Date) - $startTime
    $durationStr = "{0:hh\:mm\:ss}" -f $duration

    # Calculate effective duration (only time spent in Claude CLI calls)
    $sessionCount = $iterationLog.Count
    $effectiveDuration = [TimeSpan]::Zero
    foreach ($entry in $iterationLog) {
        $effectiveDuration += $entry.Duration
    }
    $effectiveStr = "{0:hh\:mm\:ss}" -f $effectiveDuration

    $report = @"
================================================================================
  RALPH STORY RUNNER - EXECUTION REPORT
================================================================================

  Story:      $file
  Result:     $finalPhase
  Iterations: $totalIterations
  Sessions:   $sessionCount Claude CLI calls
  Duration:   $durationStr (effective: $effectiveStr)
  Started:    $($startTime.ToString("yyyy-MM-dd HH:mm:ss"))
  Finished:   $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@

    # Add parser data if available
    if (Test-Path (Join-Path $projectRoot $PARSER_SCRIPT)) {
        try {
            $savedLocation = Get-Location
            Set-Location $projectRoot

            try {
                $progressJson = (& node $PARSER_SCRIPT impl-progress $file 2>&1 | Out-String).Trim()
                $progress = $progressJson | ConvertFrom-Json
                $report += @"
  Tasks:      $($progress.completed)/$($progress.total) ($($progress.percentage)%)

"@

                $gatesJson = (& node $PARSER_SCRIPT gates $file 2>&1 | Out-String).Trim()
                $gates = $gatesJson | ConvertFrom-Json
                if ($gates.qa.hasSection) {
                    $report += "  QA Gate:    $($gates.qa.status)`n"
                }
                if ($gates.ux.hasSection) {
                    $report += "  UX Gate:    $($gates.ux.status)`n"
                }
            }
            finally {
                Set-Location $savedLocation
            }
        }
        catch {
            $report += "  [parser error - manual check needed]`n"
        }
    }

    # Add iteration breakdown
    if ($iterationLog.Count -gt 0) {
        $report += @"

--------------------------------------------------------------------------------
  ITERATION BREAKDOWN
--------------------------------------------------------------------------------

"@
        $header = "  {0,-4} {1,-18} {2,-22} {3}" -f "#", "Phase", "Agent", "Duration"
        $separator = "  {0,-4} {1,-18} {2,-22} {3}" -f "----", "------------------", "----------------------", "--------"
        $report += "$header`n"
        $report += "$separator`n"

        foreach ($entry in $iterationLog) {
            $durStr = "{0:mm\:ss}" -f $entry.Duration
            $line = "  {0,-4} {1,-18} {2,-22} {3}" -f $entry.Number, $entry.Phase, $entry.Agent, $durStr
            $report += "$line`n"
        }

        # Average per session
        $avgSeconds = [int]($effectiveDuration.TotalSeconds / $iterationLog.Count)
        $avgMin = [int]($avgSeconds / 60)
        $avgSec = $avgSeconds % 60
        $avgStr = if ($avgMin -gt 0) { "${avgMin}min ${avgSec}s" } else { "${avgSec}s" }
        $report += "`n  Avg per session: $avgStr`n"
    }

    # Add git log
    $report += @"

--------------------------------------------------------------------------------
  GIT COMMITS (this session)
--------------------------------------------------------------------------------

"@
    try {
        $commits = (& git log --oneline --since="$($startTime.ToString('yyyy-MM-ddTHH:mm:ss'))" 2>&1 | Out-String).Trim()
        if ($commits) {
            $report += "$commits`n"
            $commitCount = ($commits -split "`n").Count
            $report += "`n  Total: $commitCount commits`n"
        } else {
            $report += "  (no commits)`n"
        }
    }
    catch {
        $report += "  (git log unavailable)`n"
    }

    $report += @"

================================================================================
  Full progress details in: progress.txt
================================================================================
"@

    # Write report file (use absolute paths from project root)
    $report | Out-File -FilePath (Join-Path $projectRoot $REPORT_FILE) -Encoding utf8

    # Also display
    Write-Host $report

    return $report
}

# ==============================================================================
# MAIN
# ==============================================================================

Write-Section "Ralph Story Runner v2 - Agent Orchestration"

# Clean up stale stop file from previous runs
$stopPath = Join-Path $projectRoot $STOP_FILE
if (Test-Path $stopPath) {
    Remove-Item $stopPath -Force -ErrorAction SilentlyContinue
    Write-Info "Cleaned up stale stop file"
}

Write-Info "Story File:     $StoryFile"
Write-Info "Max Iterations: $MaxIterations"
Write-Info "Sleep Between:  ${SleepSeconds}s"
Write-Info "Parser:         $PARSER_SCRIPT"
Write-Info "Stop:           New-Item $STOP_FILE (from another terminal)"
Write-Host ""

# Verify story file exists
if (-not (Test-Path $StoryFile -PathType Leaf)) {
    Write-Err "Story file not found: $StoryFile"
    exit 2
}

Write-Ok "Story file found: $StoryFile"

# Verify node is available (for parser)
$nodeAvailable = $false
try {
    $null = & node --version 2>&1
    $nodeAvailable = $true
    Write-Ok "Node.js available"
}
catch {
    Write-Warn "Node.js not found - using basic mode (no agent delegation)"
}

# Track metrics
$startTime = Get-Date
$iterationCount = 0
$currentPhase = "unknown"
$phaseHistory = @()
$iterationLog = @()

# ==============================================================================
# MAIN LOOP
# ==============================================================================

for ($i = 1; $i -le $MaxIterations; $i++) {
    $iterationCount = $i

    Write-Section "Iteration $i of $MaxIterations"

    # Check if user requested stop
    if (Test-StopRequested) {
        Write-Section "STOPPED BY USER"
        Write-Info "Stop file detected. Finishing gracefully..."

        Generate-Report -file $StoryFile -totalIterations $iterationCount -finalPhase "STOPPED_BY_USER" -startTime $startTime -iterationLog $iterationLog

        exit 4
    }

    # Determine current phase
    if ($nodeAvailable -and (Test-Path $PARSER_SCRIPT)) {
        $currentPhase = Get-StoryPhase -file $StoryFile
    } else {
        $currentPhase = "basic"
    }

    # Track phase transitions
    if ($phaseHistory.Count -eq 0 -or $phaseHistory[-1] -ne $currentPhase) {
        $phaseHistory += $currentPhase
        Write-Info "Phase: $currentPhase"
    }

    # Check for completion
    if ($currentPhase -eq "complete") {
        Write-Section "STORY COMPLETE"
        Write-Ok "All tasks done + all validation gates approved!"

        # Generate report
        Generate-Report -file $StoryFile -totalIterations $iterationCount -finalPhase "COMPLETE" -startTime $startTime -iterationLog $iterationLog

        exit 0
    }

    # Build prompt based on phase
    $iterAgent = "Generic"
    switch ($currentPhase) {
        "implementation" {
            $nextTask = Get-NextImplTask -file $StoryFile
            $taskText = if ($nextTask -and -not $nextTask.done) { $nextTask.text } else { "(check story for next task)" }
            $agent = Classify-TaskAgent -taskText $taskText
            $iterAgent = $agent.agentLabel
            Write-Info "Agent: $($agent.agentName) ($($agent.agentLabel))"
            Write-Info "Skill: $($agent.skillName)"
            Write-Info "Task:  $taskText"
            $prompt = Build-ImplementationPrompt -file $StoryFile -iteration $i -taskText $taskText -skillName $agent.skillName
        }
        "qa-gate" {
            $iterAgent = "QA (Quinn)"
            Write-Info "Agent: @qa (QA Gate Review)"
            $prompt = Build-QAGatePrompt -file $StoryFile -iteration $i
        }
        "ux-gate" {
            $iterAgent = "UX Expert"
            Write-Info "Agent: @ux (UX Gate Review)"
            $prompt = Build-UXGatePrompt -file $StoryFile -iteration $i
        }
        default {
            $iterAgent = "Generic"
            Write-Info "Agent: generic (basic mode)"
            $prompt = Build-BasicPrompt -file $StoryFile -iteration $i
        }
    }

    Write-Host ""
    Write-Info "Calling claude CLI (new session = fresh context)..."
    Write-Host ""

    # Execute Claude with fresh context + per-iteration timing
    $iterStart = Get-Date
    $result = ($prompt | & claude --dangerously-skip-permissions 2>&1 | Out-String)
    $iterDuration = (Get-Date) - $iterStart

    Write-Host $result
    Write-Host ""

    # Log iteration metrics
    $iterationLog += [PSCustomObject]@{
        Number   = $i
        Phase    = $currentPhase
        Agent    = $iterAgent
        Duration = $iterDuration
    }
    $iterDurationStr = "{0:mm\:ss}" -f $iterDuration
    Write-Info "Iteration $i completed in $iterDurationStr"

    # =========================================================================
    # CREDIT/TOKEN EXHAUSTION DETECTION (multi-layer protection)
    # =========================================================================

    # Layer 1: Text pattern matching on output
    $tokenErrorPatterns = @(
        "credits",
        "credit limit",
        "quota exceeded",
        "rate limit",
        "usage limit",
        "billing",
        "insufficient credits",
        "out of credits",
        "exceeded your",
        "limit reached",
        "no remaining",
        "payment required",
        "402",
        "429",
        "too many requests",
        "capacity",
        "overloaded"
    )

    $hasTokenError = $false
    foreach ($pattern in $tokenErrorPatterns) {
        if ($result -match [regex]::Escape($pattern)) {
            $hasTokenError = $true
            Write-Warn "Credit pattern detected: '$pattern'"
            break
        }
    }

    # Layer 2: Empty or very short output (Claude failed to respond)
    $trimmedResult = $result.Trim()
    if (-not $hasTokenError -and $trimmedResult.Length -lt 50) {
        $hasTokenError = $true
        Write-Warn "Claude returned empty/minimal output ($($trimmedResult.Length) chars) - likely credit exhaustion"
    }

    # Layer 3: Rapid failure detection (iteration < 10 seconds = something is wrong)
    if (-not $hasTokenError -and $iterDuration.TotalSeconds -lt 10) {
        $hasTokenError = $true
        Write-Warn "Iteration completed in $($iterDuration.TotalSeconds)s (< 10s threshold) - likely credit exhaustion or fatal error"
    }

    # Layer 4: Non-zero exit code + short output = almost certainly a problem
    if (-not $hasTokenError -and $LASTEXITCODE -ne 0 -and $trimmedResult.Length -lt 200) {
        $hasTokenError = $true
        Write-Warn "Claude exited with code $LASTEXITCODE and short output ($($trimmedResult.Length) chars)"
    }

    if ($hasTokenError) {
        Write-Section "CREDITS/TOKENS ESGOTADOS"
        Write-Err "Claude CLI retornou erro de créditos/tokens"
        Write-Err "Interrompendo loop para evitar sobrecarga do sistema"
        Write-Host ""
        Write-Host "Output do Claude ($($trimmedResult.Length) chars):"
        if ($trimmedResult.Length -gt 0) {
            Write-Host $trimmedResult
        } else {
            Write-Host "(empty output)"
        }
        Write-Host ""
        Write-Host "Exit code: $LASTEXITCODE"
        Write-Host "Iteration duration: $iterDurationStr"
        Write-Host ""

        # Generate report
        Generate-Report -file $StoryFile -totalIterations $iterationCount -finalPhase "CREDITS_EXHAUSTED" -startTime $startTime -iterationLog $iterationLog

        exit 3
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "claude exited with code $LASTEXITCODE (continuing)"
    }

    # Layer 5: Track consecutive failures for gradual degradation detection
    if (-not (Test-Path variable:script:consecutiveShortIterations)) {
        $script:consecutiveShortIterations = 0
    }
    if ($iterDuration.TotalSeconds -lt 30) {
        $script:consecutiveShortIterations++
        Write-Warn "Short iteration detected ($($script:consecutiveShortIterations) consecutive)"
    } else {
        $script:consecutiveShortIterations = 0
    }

    if ($script:consecutiveShortIterations -ge 3) {
        Write-Section "ANOMALIA DETECTADA: 3 ITERACOES RAPIDAS CONSECUTIVAS"
        Write-Err "3 iteracoes consecutivas com duracao < 30s"
        Write-Err "Possivel esgotamento de creditos ou erro persistente"
        Write-Err "Interrompendo para evitar loop infinito"
        Write-Host ""

        Generate-Report -file $StoryFile -totalIterations $iterationCount -finalPhase "ANOMALY_DETECTED" -startTime $startTime -iterationLog $iterationLog

        exit 3
    }

    # Check for phase completion or full completion
    if ($result -match "<promise>COMPLETE</promise>") {
        Write-Section "STORY COMPLETE (all tasks done)"
        Generate-Report -file $StoryFile -totalIterations $iterationCount -finalPhase "COMPLETE" -startTime $startTime -iterationLog $iterationLog
        exit 0
    }

    if ($result -match "<promise>PHASE_DONE</promise>") {
        Write-Ok "Phase '$currentPhase' completed - checking next phase..."
        # Loop will re-evaluate phase on next iteration
    }

    # Check for stuck iterations (same task failing 3x in a row)
    # The parser will detect this naturally - if same task keeps not being marked [x],
    # the loop continues but eventually hits MaxIterations

    # Sleep before next iteration (also check for stop during sleep)
    if ($i -lt $MaxIterations) {
        Write-Info "Sleeping ${SleepSeconds}s before next iteration..."
        # Check for stop during sleep (poll every second)
        for ($s = 0; $s -lt $SleepSeconds; $s++) {
            Start-Sleep -Seconds 1
            if (Test-StopRequested) {
                Write-Section "STOPPED BY USER"
                Write-Info "Stop file detected during sleep. Finishing gracefully..."

                Generate-Report -file $StoryFile -totalIterations $iterationCount -finalPhase "STOPPED_BY_USER" -startTime $startTime -iterationLog $iterationLog

                exit 4
            }
        }
    }
}

# ==============================================================================
# MAX ITERATIONS REACHED
# ==============================================================================

Write-Section "MAX ITERATIONS REACHED ($MaxIterations)"
Write-Warn "Some tasks may remain incomplete"

# Generate report
Generate-Report -file $StoryFile -totalIterations $iterationCount -finalPhase "MAX_ITERATIONS" -startTime $startTime -iterationLog $iterationLog

exit 1
