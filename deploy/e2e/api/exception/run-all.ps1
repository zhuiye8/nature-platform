param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"

$scripts = @(
  "reviewer-candidates.ps1",
  "recycle-bin-forbidden.ps1",
  "assignment-conflict.ps1",
  "notification-unread-delete.ps1",
  "report-review-reject-recovery.ps1",
  "report-tech-reject-recovery.ps1",
  "report-final-reject-recovery.ps1",
  "notification-trigger-audit.ps1"
)

$failed = @()
foreach ($item in $scripts) {
  $path = Join-Path $PSScriptRoot $item
  Write-Output ""
  Write-Output ">>> running $item"
  try {
    & $path -BaseUrl $BaseUrl
  } catch {
    $failed += $item
    Write-Error "$item failed: $($_.Exception.Message)"
  }
}

if ($failed.Count -gt 0) {
  throw "exception suite failed: $($failed -join ', ')"
}

Write-Output ""
Write-Output "exception suite passed"
