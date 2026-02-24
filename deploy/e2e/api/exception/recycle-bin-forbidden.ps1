param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-recycle-bin-forbidden" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$reviewerToken = Login-E2EToken -Context $context -Username "reviewer" -Password "review123"
$response = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/recycle-bin/PROJECT_REGISTER/999999/restore" -Token $reviewerToken

$pass = $response.status -eq 403
Add-E2EResult -Context $context `
  -CaseName "non_admin_restore_forbidden" `
  -Expected "403" `
  -Actual "status=$($response.status)" `
  -Pass $pass `
  -Detail $response.raw

Complete-E2EResults -Context $context
