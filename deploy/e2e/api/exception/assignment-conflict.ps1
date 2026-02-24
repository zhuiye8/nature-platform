param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-assignment-conflict" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$projectId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"

try {
  $contractId = Get-Random -Minimum 980000 -Maximum 999999
  $seedSql = @"
INSERT INTO project_register (contract_id, contract_year, application_name, status, created_by, deleted_flag)
VALUES ($contractId, 2030, 'e2e-assignment-conflict-$contractId', 'APPROVED', 'admin', 0);
SET @project_id = LAST_INSERT_ID();
INSERT INTO on_site_assessment (project_register_id, package_object_key, assessment_detail, status, created_by, updated_by)
VALUES (@project_id, 'e2e-assignment-conflict.zip', 'seed', 'SUBMITTED', 'admin', 'admin');
INSERT INTO workflow_assignment (project_register_id, tech_reviewer, content_reviewer_a, content_reviewer_b, content_reviewer_c, version_no, updated_by)
VALUES (@project_id, 'admin', 'reviewer', 'reviewer', 'reviewer', 1, 'admin');
SELECT @project_id;
"@
  $projectId = (Invoke-E2EMySql -Context $context -Sql $seedSql | Select-Object -Last 1).Trim()

  if ([string]::IsNullOrWhiteSpace($projectId)) {
    throw "seed project id failed"
  }

  $requestBody = @{
    techReviewer = "admin"
    contentReviewerA = "reviewer"
    contentReviewerB = "reviewer"
    contentReviewerC = "reviewer"
    versionNo = 0
  }
  $response =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/quality-reviews/$projectId/assignment" `
      -Token $adminToken `
      -Body $requestBody

  $message = Get-E2EMessage -Response $response
  $pass = $response.status -eq 409 -and -not [string]::IsNullOrWhiteSpace($message)

  Add-E2EResult -Context $context `
    -CaseName "assignment_conflict_message" `
    -Expected "409 + conflict message" `
    -Actual "status=$($response.status), message=$message" `
    -Pass $pass `
    -Detail $response.raw
} finally {
  if ($projectId) {
    $cleanupSql = @"
DELETE FROM quality_review_task WHERE project_register_id = $projectId;
DELETE FROM quality_review_apply WHERE project_register_id = $projectId;
DELETE FROM workflow_assignment WHERE project_register_id = $projectId;
DELETE FROM on_site_assessment WHERE project_register_id = $projectId;
DELETE FROM workflow_action_log WHERE biz_type = 'PROJECT_REGISTER' AND biz_id = $projectId;
DELETE FROM workflow_instance WHERE biz_type = 'PROJECT_REGISTER' AND biz_id = $projectId;
DELETE FROM project_register WHERE id = $projectId;
"@
    Invoke-E2EMySql -Context $context -Sql $cleanupSql | Out-Null
  }
}

Complete-E2EResults -Context $context
