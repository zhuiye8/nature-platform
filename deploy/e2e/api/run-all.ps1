param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"

$failed = @()
$jobs = @(
  @{
    name = "exception-suite"
    path = Join-Path $PSScriptRoot "exception\run-all.ps1"
  },
  @{
    name = "happy-path-suite"
    path = Join-Path $PSScriptRoot "happy-path\run-all.ps1"
  }
)

foreach ($job in $jobs) {
  Write-Output ""
  Write-Output "==== start $($job.name) ===="
  try {
    & $job.path -BaseUrl $BaseUrl
  } catch {
    $failed += $job.name
    Write-Error "$($job.name) failed: $($_.Exception.Message)"
  }
}

if ($failed.Count -gt 0) {
  throw "api e2e failed: $($failed -join ', ')"
}

Write-Output ""
Write-Output "api e2e passed"
