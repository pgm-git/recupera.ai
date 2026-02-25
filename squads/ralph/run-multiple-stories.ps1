#################################################################################
# Run Multiple Stories - Ralph Loop para Sequencia de Stories
#################################################################################
# Executa Ralph em multiplas stories sequencialmente (ex: 3.1, 3.2, 3.3, etc.)
#
# Uso:
#   .\run-multiple-stories.ps1 -Epic 3 -StartStory 1 -EndStory 5
#   .\run-multiple-stories.ps1 -Epic 3 -StartStory 8 -EndStory 10
#
# Exit Codes:
#   0 = Todas stories completas
#   1 = Uma ou mais stories incompletas
#   4 = Parado pelo usuario (stop file)
#
# Parar execucao:
#   De outro terminal, rode:  New-Item ralph-stop
#   Ralph para apos a iteracao/story atual terminar.
#################################################################################

param(
    [int]$Epic = 3,
    [int]$StartStory = 1,
    [int]$EndStory = 5,
    [int]$MaxIterationsPerStory = 30,
    [int]$SleepSeconds = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Determine project root (go up 3 levels from this script's directory)
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$REPORT_FILE = "ralph-report.txt"
$STOP_FILE   = "ralph-stop"

function Write-Section($msg) {
    Write-Host ""
    Write-Host ("=" * 60)
    Write-Host "  $msg"
    Write-Host ("=" * 60)
    Write-Host ""
}

function Write-Info($msg) { Write-Host "[ralph-multi] $msg" }

Write-Section "Ralph Multi-Story Runner"

Write-Info "Epic: $Epic"
Write-Info "Stories: $StartStory - $EndStory"
Write-Info "Max Iterations Per Story: $MaxIterationsPerStory"
Write-Info "Stop: New-Item $STOP_FILE (from another terminal)"
Write-Host ""

$startTime = Get-Date
$completedStories = @()
$failedStories = @()
$storyMetrics = @()

for ($i = $StartStory; $i -le $EndStory; $i++) {
    $storyId = "$Epic.$i"

    Write-Section "Starting Story $storyId"

    # Check if user requested stop
    $stopPath = Join-Path $projectRoot $STOP_FILE
    if (Test-Path $stopPath) {
        Remove-Item $stopPath -Force -ErrorAction SilentlyContinue
        Write-Info "STOPPED BY USER: Stop file detected"
        Write-Info "Skipping remaining stories"
        break
    }

    # Encontrar arquivo da story
    $storyFiles = @(Get-ChildItem -Path "docs/stories" -Filter "$storyId.*.md" -ErrorAction SilentlyContinue)

    if ($storyFiles.Count -eq 0) {
        Write-Info "WARN: Story file not found for $storyId (skipping)"
        $failedStories += $storyId
        continue
    }

    if ($storyFiles.Count -gt 1) {
        Write-Info "WARN: Multiple story files found for $storyId, using first one"
    }

    $storyFile = $storyFiles[0].FullName
    Write-Info "Found: $storyFile"
    Write-Host ""

    # Executar Ralph para esta story
    $ralphScript = Join-Path $PSScriptRoot "ralph-story.ps1"
    $storyStart = Get-Date

    & $ralphScript -StoryFile $storyFile -MaxIterations $MaxIterationsPerStory -SleepSeconds $SleepSeconds

    $storyDuration = (Get-Date) - $storyStart
    $storyExitCode = $LASTEXITCODE

    # Parse report file for metrics
    $storyData = @{
        Id       = $storyId
        ExitCode = $storyExitCode
        Duration = $storyDuration
        Sessions = 0
        Tasks    = "-"
        Result   = if ($storyExitCode -eq 0) { "COMPLETE" } else { "INCOMPLETE" }
    }

    $reportPath = Join-Path $projectRoot $REPORT_FILE
    if (Test-Path $reportPath) {
        $reportContent = Get-Content $reportPath -Raw -ErrorAction SilentlyContinue
        if ($reportContent) {
            if ($reportContent -match "Result:\s+(\S+)") { $storyData.Result = $Matches[1] }
            if ($reportContent -match "Sessions:\s+(\d+)") { $storyData.Sessions = [int]$Matches[1] }
            if ($reportContent -match "Tasks:\s+(.+)") { $storyData.Tasks = $Matches[1].Trim() }
        }
    }

    $storyMetrics += $storyData

    if ($storyExitCode -eq 0) {
        Write-Host ""
        Write-Info "OK: Story $storyId COMPLETE"
        $completedStories += $storyId
    } elseif ($storyExitCode -eq 3) {
        # CRITICAL: Credits exhausted - MUST stop immediately
        # Do NOT prompt, do NOT continue - this prevents spawning more windows
        Write-Host ""
        Write-Host ("!" * 60)
        Write-Info "FATAL: Credits/tokens Claude ESGOTADOS (exit code 3)"
        Write-Info "Parando IMEDIATAMENTE para proteger a maquina"
        Write-Info "Nenhuma nova sessao Claude sera criada"
        Write-Host ("!" * 60)
        Write-Host ""
        $failedStories += $storyId
        break
    } else {
        Write-Host ""
        Write-Info "INCOMPLETE: Story $storyId (exit code: $storyExitCode)"
        Write-Host ""
        Write-Host "Options:"
        Write-Host "  1. Continue with next story (press Enter)"
        Write-Host "  2. Stop execution (Ctrl+C)"
        Write-Host ""

        $response = Read-Host "Continue? [Y/n]"

        if ($response -eq 'n' -or $response -eq 'N') {
            Write-Info "Stopping execution..."
            $failedStories += $storyId
            break
        }

        $failedStories += $storyId
    }

    # Delay entre stories (check for stop during wait)
    if ($i -lt $EndStory) {
        Write-Host ""
        Write-Info "Waiting 5 seconds before next story..."
        for ($s = 0; $s -lt 5; $s++) {
            Start-Sleep -Seconds 1
            $stopPath = Join-Path $projectRoot $STOP_FILE
            if (Test-Path $stopPath) {
                Remove-Item $stopPath -Force -ErrorAction SilentlyContinue
                Write-Info "STOPPED BY USER during wait"
                break
            }
        }
    }
}

# ==============================================================================
# SUMMARY REPORT
# ==============================================================================

$duration = (Get-Date) - $startTime
$durationStr = "{0:hh\:mm\:ss}" -f $duration

$totalStories = $completedStories.Count + $failedStories.Count

$summary = @"

================================================================================
  RALPH MULTI-STORY - EXECUTION SUMMARY
================================================================================

  Epic:       $Epic
  Stories:    $totalStories total ($($completedStories.Count) completed, $($failedStories.Count) failed)
  Duration:   $durationStr
  Started:    $($startTime.ToString("yyyy-MM-dd HH:mm:ss"))
  Finished:   $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

"@

# Story breakdown table
if ($storyMetrics.Count -gt 0) {
    $summary += @"
--------------------------------------------------------------------------------
  STORY BREAKDOWN
--------------------------------------------------------------------------------

"@
    $header = "  {0,-4} {1,-8} {2,-15} {3,-10} {4,-13} {5}" -f "#", "Story", "Result", "Sessions", "Duration", "Tasks"
    $sep = "  {0,-4} {1,-8} {2,-15} {3,-10} {4,-13} {5}" -f "----", "--------", "---------------", "----------", "-------------", "---------------"
    $summary += "$header`n"
    $summary += "$sep`n"

    $idx = 1
    $totalSessions = 0
    foreach ($m in $storyMetrics) {
        $durStr = "{0:hh\:mm\:ss}" -f $m.Duration
        $line = "  {0,-4} {1,-8} {2,-15} {3,-10} {4,-13} {5}" -f $idx, $m.Id, $m.Result, $m.Sessions, $durStr, $m.Tasks
        $summary += "$line`n"
        $totalSessions += $m.Sessions
        $idx++
    }

    $summary += "`n"
    $summary += "  Totals:`n"
    $summary += "    Total sessions: $totalSessions Claude CLI calls`n"
}

# Git commits across all stories
try {
    $commits = (& git log --oneline --since="$($startTime.ToString('yyyy-MM-ddTHH:mm:ss'))" 2>&1 | Out-String).Trim()
    if ($commits) {
        $commitCount = ($commits -split "`n").Count
        $summary += "    Total commits:  $commitCount`n"
    }
}
catch { }

# Performance stats
if ($storyMetrics.Count -gt 1) {
    $sorted = $storyMetrics | Sort-Object { $_.Duration.TotalSeconds }
    $fastest = $sorted[0]
    $slowest = $sorted[-1]
    $avgSeconds = [int](($storyMetrics | ForEach-Object { $_.Duration.TotalSeconds } | Measure-Object -Sum).Sum / $storyMetrics.Count)
    $avgTs = [TimeSpan]::FromSeconds($avgSeconds)
    $avgStr = "{0:hh\:mm\:ss}" -f $avgTs

    $summary += @"

  Performance:
    Avg per story: $avgStr
    Fastest:       Story $($fastest.Id) ($("{0:hh\:mm\:ss}" -f $fastest.Duration))
    Slowest:       Story $($slowest.Id) ($("{0:hh\:mm\:ss}" -f $slowest.Duration))

"@
}

$summary += @"
================================================================================
"@

Write-Host $summary

if ($failedStories.Count -eq 0) {
    Write-Host "  All stories complete!"
    Write-Host ("=" * 80)
    exit 0
} else {
    Write-Host "  Some stories incomplete"
    Write-Host ("=" * 80)
    exit 1
}
