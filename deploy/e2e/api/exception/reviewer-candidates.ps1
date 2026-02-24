param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-reviewer-candidates" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$response = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/on-site-assessments/reviewer-candidates" -Token $adminToken

$data = $response.body.data
$pass =
  $response.status -eq 200 -and
  $null -ne $data -and
  $null -ne $data.techReviewers -and
  $null -ne $data.contentReviewersA -and
  $null -ne $data.contentReviewersB -and
  $null -ne $data.contentReviewersC

Add-E2EResult -Context $context `
  -CaseName "reviewer_candidates_four_groups" `
  -Expected "200 + tech/A/B/C arrays" `
  -Actual "status=$($response.status)" `
  -Pass $pass `
  -Detail $response.raw

Complete-E2EResults -Context $context
