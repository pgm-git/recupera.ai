#################################################################################
# Ralph Monitor - Agent Ocioso / Observer
#################################################################################
#
# Roda em paralelo com ralph-story.ps1 em OUTRO terminal.
# Monitora o progresso em tempo real e gera relatorio executivo ao final.
#
# Funcionalidades:
#   - Monitora progress.txt a cada N segundos
#   - Mostra progresso de tasks via ralph-parser.js
#   - Detecta quando Ralph termina (ralph-report.txt aparece)
#   - Chama claude -p para gerar relatorio executivo consolidado
#   - Salva em ralph-executive-report.md
#
# Uso:
#   Terminal 1: .\ralph-story.ps1 -StoryFile "docs/stories/3.8.*.md" -MaxIterations 30
#   Terminal 2: .\ralph-monitor.ps1 -StoryFile "docs/stories/3.8.*.md"
#
# Exit Codes:
#   0 = Ralph terminou e relatorio foi gerado
#   1 = Timeout (Ralph nao terminou no tempo esperado)
#   2 = Erro
#
#################################################################################

param(
    [Parameter(Position=0)]
    [string]$StoryId,
    [string]$StoryFile,
    [int]$PollSeconds = 30,
    [int]$TimeoutMinutes = 480,
    [switch]$NoReport
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ==============================================================================
# CONSTANTS
# ==============================================================================

$PARSER_SCRIPT  = "squads/ralph/scripts/ralph-parser.cjs"
$PROGRESS_FILE  = "progress.txt"
$REPORT_FILE    = "ralph-report.txt"
$EXEC_REPORT    = "ralph-executive-report.md"
$STORIES_DIR    = "docs/stories"

# ==============================================================================
# RESOLVE STORY FILE
# ==============================================================================

if ($StoryId -and -not $StoryFile) {
    $found = Get-ChildItem -Path $STORIES_DIR -Filter "$StoryId.*.md" -ErrorAction SilentlyContinue
    if (-not $found -or $found.Count -eq 0) {
        $found = Get-ChildItem -Path $STORIES_DIR -Filter "$StoryId*.md" -ErrorAction SilentlyContinue
    }
    if ($found -and $found.Count -gt 0) {
        $StoryFile = $found[0].FullName
        Write-Host "[monitor] Resolved: $StoryId -> $StoryFile"
    } else {
        Write-Host "[monitor] ERROR: No story found matching '$StoryId' in $STORIES_DIR/"
        exit 2
    }
} elseif (-not $StoryFile) {
    Write-Host "[monitor] ERROR: No story specified. Usage: .\ralph-monitor.ps1 1.0"
    exit 2
}

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

function Write-Monitor($msg) { Write-Host "[monitor] $msg" }

function Get-Timestamp { return (Get-Date -Format "HH:mm:ss") }

function Show-Progress {
    <#
    .SYNOPSIS
    Mostra progresso atual da story
    #>
    param([string]$file)

    $ts = Get-Timestamp

    # Parser progress
    if (Test-Path $PARSER_SCRIPT) {
        try {
            $implJson = (& node $PARSER_SCRIPT impl-progress $file 2>&1 | Out-String).Trim()
            $impl = $implJson | ConvertFrom-Json

            $bar = ""
            $barLen = 30
            $filled = [math]::Floor($impl.percentage / 100 * $barLen)
            $empty = $barLen - $filled
            $bar = ("#" * $filled) + ("-" * $empty)

            Write-Host ""
            Write-Host "[$ts] [$bar] $($impl.completed)/$($impl.total) tasks ($($impl.percentage)%)"

            # Gates
            $gatesJson = (& node $PARSER_SCRIPT gates $file 2>&1 | Out-String).Trim()
            $gates = $gatesJson | ConvertFrom-Json

            if ($gates.qa.hasSection) {
                Write-Host "[$ts] QA Gate: $($gates.qa.status)"
            }
            if ($gates.ux.hasSection) {
                Write-Host "[$ts] UX Gate: $($gates.ux.status)"
            }
        }
        catch {
            Write-Host "[$ts] (parser unavailable)"
        }
    }

    # Last lines of progress.txt
    if (Test-Path $PROGRESS_FILE) {
        $lines = Get-Content $PROGRESS_FILE -Tail 5
        if ($lines) {
            Write-Host "[$ts] Last progress:"
            foreach ($line in $lines) {
                Write-Host "[$ts]   $line"
            }
        }
    }

    # Git status
    try {
        $lastCommit = (& git log --oneline -1 2>&1 | Out-String).Trim()
        Write-Host "[$ts] Last commit: $lastCommit"
    }
    catch {}

    Write-Host ""
}

function Generate-ExecutiveReport {
    <#
    .SYNOPSIS
    Chama claude -p para gerar relatorio executivo consolidado
    #>
    param([string]$file)

    Write-Section "Generating Executive Report"
    Write-Monitor "Calling claude for consolidated report..."

    $reportPrompt = @"
You are a project manager generating an executive report.

## Task

Read the following files and generate a comprehensive executive report in markdown:

1. Read the story file: $file (see what was planned vs completed)
2. Read progress.txt (iteration-by-iteration details and learnings)
3. Read ralph-report.txt (execution metrics)
4. Run: git log --oneline --since="12 hours ago" (see all commits made)

## Report Format

Generate the report in this EXACT format and save it to ralph-executive-report.md:

# Ralph Executive Report

## Summary
- **Story:** [story name]
- **Result:** [COMPLETE/PARTIAL]
- **Total Iterations:** [N]
- **Duration:** [time]
- **Tasks Completed:** [X/Y]

## What Was Built
[List the main features/changes implemented, grouped by category]

## Key Decisions Made
[Any architectural or implementation decisions from progress.txt learnings]

## Quality Gates
- **QA:** [status + summary of findings]
- **UX:** [status + summary of findings]

## Files Changed
[List of files created/modified, grouped logically]

## Commits
[List of git commits from this session]

## Learnings & Patterns
[Key learnings accumulated across all iterations]

## Issues & Risks
[Any unresolved issues, failed tasks, or risks identified]

---
Generated by Ralph Monitor
"@

    try {
        $result = (& claude --dangerously-skip-permissions -p $reportPrompt 2>&1 | Out-String)

        # Check for token/credit errors
        $tokenErrorPatterns = @(
            "credits",
            "credit limit",
            "quota exceeded",
            "rate limit",
            "usage limit",
            "billing",
            "insufficient credits",
            "out of credits"
        )

        $hasTokenError = $false
        foreach ($pattern in $tokenErrorPatterns) {
            if ($result -match [regex]::Escape($pattern)) {
                $hasTokenError = $true
                break
            }
        }

        if ($hasTokenError) {
            Write-Monitor "WARNING: Claude API returned token/credit error"
            Write-Monitor "Cannot generate executive report - credits exhausted"
            Write-Host $result
        } else {
            Write-Host $result

            if (Test-Path $EXEC_REPORT) {
                Write-Monitor "Executive report saved to: $EXEC_REPORT"
            } else {
                Write-Monitor "Report generated (check output above)"
            }
        }
    }
    catch {
        Write-Monitor "ERROR: Failed to generate report: $($_.Exception.Message)"
    }
}

# ==============================================================================
# MAIN
# ==============================================================================

Write-Section "Ralph Monitor - Observer Mode"

Write-Monitor "Story File:   $StoryFile"
Write-Monitor "Poll Interval: ${PollSeconds}s"
Write-Monitor "Timeout:       ${TimeoutMinutes} min"
Write-Monitor "Report:        $(if ($NoReport) { 'disabled' } else { 'enabled (claude -p)' })"
Write-Host ""

# Verify story file
if (-not (Test-Path $StoryFile -PathType Leaf)) {
    Write-Monitor "ERROR: Story file not found: $StoryFile"
    exit 2
}

Write-Monitor "Waiting for Ralph to start (watching for changes)..."
Write-Host ""

$startTime = Get-Date
$lastProgressSize = 0
$lastProgressContent = ""
$pollCount = 0
$ralphFinished = $false

# ==============================================================================
# MONITOR LOOP
# ==============================================================================

while ($true) {
    $elapsed = (Get-Date) - $startTime
    $pollCount++

    # Check timeout
    if ($elapsed.TotalMinutes -ge $TimeoutMinutes) {
        Write-Section "TIMEOUT ($TimeoutMinutes minutes)"
        Write-Monitor "Ralph did not finish in the expected time"

        if (-not $NoReport) {
            Generate-ExecutiveReport -file $StoryFile
        }

        exit 1
    }

    # Check if Ralph finished (ralph-report.txt exists and is recent)
    if (Test-Path $REPORT_FILE) {
        $reportAge = (Get-Date) - (Get-Item $REPORT_FILE).LastWriteTime
        # Report was written in the last 5 minutes = Ralph just finished
        if ($reportAge.TotalMinutes -lt 5) {
            $ralphFinished = $true

            Write-Section "RALPH FINISHED"
            Write-Monitor "Detected ralph-report.txt (age: $([math]::Round($reportAge.TotalSeconds))s)"
            Write-Host ""

            # Show final progress
            Show-Progress -file $StoryFile

            # Show ralph-report.txt content
            Write-Host ""
            Write-Monitor "--- Ralph Report ---"
            Get-Content $REPORT_FILE | ForEach-Object { Write-Host $_ }
            Write-Monitor "--- End Report ---"
            Write-Host ""

            # Generate executive report
            if (-not $NoReport) {
                Generate-ExecutiveReport -file $StoryFile
            }

            exit 0
        }
    }

    # Show progress
    if ($pollCount -eq 1) {
        Write-Monitor "First poll..."
    }

    Show-Progress -file $StoryFile

    # Detect changes in progress.txt
    if (Test-Path $PROGRESS_FILE) {
        $currentSize = (Get-Item $PROGRESS_FILE).Length
        if ($currentSize -ne $lastProgressSize) {
            if ($lastProgressSize -gt 0) {
                Write-Monitor "[CHANGE DETECTED] progress.txt updated ($lastProgressSize -> $currentSize bytes)"
            }
            $lastProgressSize = $currentSize
        }
    }

    # Status line
    $elapsedStr = "{0:hh\:mm\:ss}" -f $elapsed
    Write-Monitor "Monitoring... (elapsed: $elapsedStr, polls: $pollCount, next in ${PollSeconds}s)"

    # Sleep
    Start-Sleep -Seconds $PollSeconds
}
