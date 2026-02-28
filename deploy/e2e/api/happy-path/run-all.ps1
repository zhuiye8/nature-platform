param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"

$scripts = @(
  "01-contract-archive-project-register.ps1",
  "02-project-police-onsite-assignment.ps1",
  "03-report-reviews-and-compile-submit.ps1",
  "04-final-review-and-material-archive.ps1"
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
  throw "happy-path suite failed: $($failed -join ', ')"
}

Write-Output ""
Write-Output "happy-path suite passed"



