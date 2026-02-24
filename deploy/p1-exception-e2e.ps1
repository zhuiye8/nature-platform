param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"

$entry = Join-Path $PSScriptRoot "e2e\api\exception\run-all.ps1"
if (-not (Test-Path $entry)) {
  throw "exception entry script not found: $entry"
}

& $entry -BaseUrl $BaseUrl
