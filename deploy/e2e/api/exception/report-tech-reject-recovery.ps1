param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-report-tech-reject-recovery" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$customerId = $null
$contractId = $null
$projectId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$tag = New-E2EUniqueTag -Prefix "rej11"

try {
  $contractYear = 2037

  $customerResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/customers" `
      -Token $adminToken `
      -Body @{
        fullName = "e2e-customer-$tag"
        industry = "finance"
        region = "north"
        addressDetail = "e2e-address-$tag"
        uscc = "USCC-$tag"
        contactName = "contact"
        mobilePhone = "13800138000"
        remark = "created by tech reject recovery"
      }
  $customerId = $customerResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_customer_tech_reject" `
    -Expected "200 + customerId" `
    -Actual "status=$($customerResp.status), id=$customerId" `
    -Pass ($customerResp.status -eq 200 -and [long]$customerId -gt 0) `
    -Detail $customerResp.raw

  $contractResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts" `
      -Token $adminToken `
      -Body @{
        customerId = [long]$customerId
        projectName = "e2e-contract-$tag"
        contactName = "contact"
        mobilePhone = "13800138000"
        paymentCompany = "e2e-payment-company-$tag"
        paymentAmount = 100000
        paymentMethod = "one-time"
        partnerName = "e2e-partner-$tag"
        salesPerson = "sales"
        performanceCity = "beijing"
        dealStatus = "won"
        remark = "created by tech reject recovery"
        contractType = "annual-service"
        contractFileObjectKey = "e2e/$tag/contract.zip"
        serviceYearDetail = "$contractYear"
        paymentStatus = "UNPAID"
        serviceYears = @($contractYear)
        systemItems = @(
          @{
            systemLevel = 2
            systemName = "biz-system-A-$tag"
          }
        )
      }
  $contractId = $contractResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_contract_tech_reject" `
    -Expected "200 + contractId" `
    -Actual "status=$($contractResp.status), id=$contractId" `
    -Pass ($contractResp.status -eq 200 -and [long]$contractId -gt 0) `
    -Detail $contractResp.raw

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/submit-review" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/approve" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/archive" -Token $adminToken -Body @{
    signedAt = "2037-01-10 10:00:00"
    fileCount = 2
    storageLocation = "archive-room-rej11"
    remark = "archived by tech reject recovery"
    archiveScanObjectKey = "e2e/$tag/archive.zip"
  } | Out-Null

  $projectResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/project-registers" `
      -Token $adminToken `
      -Body @{
        contractId = [long]$contractId
        contractYear = $contractYear
        systemItems = @(
          @{
            systemName = "assessed-system-$tag"
            filingAgency = "agency-A"
            securityLevel = "L3"
            reassessment = $false
            requiredEntryDate = "2037-01-15"
            requiredReportDeliveryDate = "2037-02-28"
            assessedUnitName = "assessed-unit-$tag"
            assessedUnitIndustry = "finance"
            assessedUnitContact = "project-contact"
            assessedUnitMobile = "13900139000"
            assessedUnitAddress = "beijing-haidian"
            hasFilingCertificate = $false
            filingCertificateFiles = @()
            filingCertificateNo = $null
            filingCertificateIssuedAt = $null
            hasFilingForm = $false
            filingFormFiles = @()
            hasClassificationReport = $false
            classificationReportFiles = @()
          }
        )
      }
  $projectId = $projectResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_project_tech_reject" `
    -Expected "200 + projectId" `
    -Actual "status=$($projectResp.status), id=$projectId" `
    -Pass ($projectResp.status -eq 200 -and [long]$projectId -gt 0) `
    -Detail $projectResp.raw

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/project-registers/$projectId/submit-review" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/PROJECT_REGISTER:$projectId/approve" -Token $adminToken | Out-Null

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/police-registers/$projectId" -Token $adminToken -Body @{
    registerNo = "REG-$tag"
    filingAgency = "agency-police"
    contactName = "officer"
    contactPhone = "13600136000"
    remark = "saved by tech reject recovery"
  } | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/police-registers/$projectId/submit" -Token $adminToken | Out-Null

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/on-site-assessments/$projectId" -Token $adminToken -Body @{
    packageObjectKey = "e2e/$tag/on-site.zip"
    assessmentDetail = "on-site assessment by tech reject recovery"
  } | Out-Null

  $candidatesResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/on-site-assessments/reviewer-candidates" -Token $adminToken
  $candidatesData = $candidatesResp.body.data
  $techUsers = @($candidatesData.techReviewers)
  $aUsers = @($candidatesData.contentReviewersA)
  $bUsers = @($candidatesData.contentReviewersB)
  $cUsers = @($candidatesData.contentReviewersC)
  $candidatePass =
    $candidatesResp.status -eq 200 -and
    $techUsers.Count -gt 0 -and
    $aUsers.Count -gt 0 -and
    $bUsers.Count -gt 0 -and
    $cUsers.Count -gt 0
  Add-E2EResult -Context $context `
    -CaseName "reviewer_candidates_ready_tech_reject" `
    -Expected "200 + tech/A/B/C all non-empty" `
    -Actual "status=$($candidatesResp.status), tech=$($techUsers.Count), A=$($aUsers.Count), B=$($bUsers.Count), C=$($cUsers.Count)" `
    -Pass $candidatePass `
    -Detail $candidatesResp.raw
  if (-not $candidatePass) {
    throw "reviewer candidates are not ready for tech reject recovery"
  }

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/on-site-assessments/$projectId/review-assignment" -Token $adminToken -Body @{
    techReviewer = [string]$techUsers[0]
    contentReviewerA = [string]$aUsers[0]
    contentReviewerB = [string]$bUsers[0]
    contentReviewerC = [string]$cUsers[0]
    versionNo = 0
  } | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/on-site-assessments/$projectId/submit" -Token $adminToken | Out-Null

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/report-tech-reviews/$projectId" -Token $adminToken -Body @{
    remark = "tech review draft by reject recovery"
    versionNo = 0
  } | Out-Null
  $techSubmitResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/report-tech-reviews/$projectId/submit" -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "tech_submit_before_reject" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($techSubmitResp.status), reviewStatus=$([string]$techSubmitResp.body.data.status)" `
    -Pass ($techSubmitResp.status -eq 200 -and [string]$techSubmitResp.body.data.status -eq "SUBMITTED") `
    -Detail $techSubmitResp.raw

  $techTodoBeforeRejectResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_TECH_REVIEW" -Token $adminToken
  $techTodoBeforeRejectRows = @($techTodoBeforeRejectResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  Add-E2EResult -Context $context `
    -CaseName "tech_todo_ready_before_reject" `
    -Expected "at least 1 pending task" `
    -Actual "status=$($techTodoBeforeRejectResp.status), matched=$($techTodoBeforeRejectRows.Count)" `
    -Pass ($techTodoBeforeRejectResp.status -eq 200 -and $techTodoBeforeRejectRows.Count -ge 1) `
    -Detail $techTodoBeforeRejectResp.raw
  if ($techTodoBeforeRejectRows.Count -lt 1) {
    throw "report tech review todo task not found before reject"
  }

  $rejectTask = $techTodoBeforeRejectRows | Select-Object -First 1
  $rejectResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$rejectTask.taskId)/reject" `
      -Token $adminToken `
      -Body @{ remark = "e2e tech reject" }
  Add-E2EResult -Context $context `
    -CaseName "tech_task_reject_success" `
    -Expected "200" `
    -Actual "status=$($rejectResp.status), taskId=$([string]$rejectTask.taskId)" `
    -Pass ($rejectResp.status -eq 200) `
    -Detail $rejectResp.raw

  $techDetailAfterRejectResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-tech-reviews/$projectId" -Token $adminToken
  $afterRejectStatus = [string]$techDetailAfterRejectResp.body.data.status
  $afterRejectNode = [string]$techDetailAfterRejectResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "tech_status_rejected_after_reject" `
    -Expected "200 + status=REJECTED + workflowNode=REPORT_TECH_REVIEW_TASK" `
    -Actual "status=$($techDetailAfterRejectResp.status), reviewStatus=$afterRejectStatus, workflowNode=$afterRejectNode" `
    -Pass ($techDetailAfterRejectResp.status -eq 200 -and $afterRejectStatus -eq "REJECTED" -and $afterRejectNode -eq "REPORT_TECH_REVIEW_TASK") `
    -Detail $techDetailAfterRejectResp.raw

  $techResubmitResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/report-tech-reviews/$projectId/submit" -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "tech_resubmit_after_reject" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($techResubmitResp.status), reviewStatus=$([string]$techResubmitResp.body.data.status)" `
    -Pass ($techResubmitResp.status -eq 200 -and [string]$techResubmitResp.body.data.status -eq "SUBMITTED") `
    -Detail $techResubmitResp.raw

  $techTodoAfterResubmitResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_TECH_REVIEW" -Token $adminToken
  $techTodoAfterResubmitRows = @($techTodoAfterResubmitResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  Add-E2EResult -Context $context `
    -CaseName "tech_todo_recreated_after_resubmit" `
    -Expected "at least 1 pending task" `
    -Actual "status=$($techTodoAfterResubmitResp.status), matched=$($techTodoAfterResubmitRows.Count)" `
    -Pass ($techTodoAfterResubmitResp.status -eq 200 -and $techTodoAfterResubmitRows.Count -ge 1) `
    -Detail $techTodoAfterResubmitResp.raw
  if ($techTodoAfterResubmitRows.Count -lt 1) {
    throw "report tech review todo task not found after resubmit"
  }

  $approveTask = $techTodoAfterResubmitRows | Select-Object -First 1
  $approveResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$approveTask.taskId)/approve" -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "tech_task_approve_after_resubmit" `
    -Expected "200" `
    -Actual "status=$($approveResp.status), taskId=$([string]$approveTask.taskId)" `
    -Pass ($approveResp.status -eq 200) `
    -Detail $approveResp.raw

  $techDetailAfterRecoveryResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-tech-reviews/$projectId" -Token $adminToken
  $afterRecoveryStatus = [string]$techDetailAfterRecoveryResp.body.data.status
  $afterRecoveryNode = [string]$techDetailAfterRecoveryResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "tech_recovery_to_content_review" `
    -Expected "200 + status=APPROVED + workflowNode=REPORT_CONTENT_REVIEW" `
    -Actual "status=$($techDetailAfterRecoveryResp.status), reviewStatus=$afterRecoveryStatus, workflowNode=$afterRecoveryNode" `
    -Pass ($techDetailAfterRecoveryResp.status -eq 200 -and $afterRecoveryStatus -eq "APPROVED" -and $afterRecoveryNode -eq "REPORT_CONTENT_REVIEW") `
    -Detail $techDetailAfterRecoveryResp.raw
} finally {
  $cleanupSqlLines = New-Object System.Collections.Generic.List[string]
  if ($projectId) {
    $cleanupSqlLines.Add("DELETE FROM material_archive WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_final_review_task WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_final_review_apply WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_compile_submission WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_compile_assignment WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_content_review_task WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_content_review_apply WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_tech_review_task WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM report_tech_review_apply WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM quality_review_task WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM quality_review_apply WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM workflow_assignment WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM on_site_assessment WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM police_register WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM project_system_item WHERE project_register_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM workflow_action_log WHERE biz_type = 'PROJECT_REGISTER' AND biz_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM workflow_instance WHERE biz_type = 'PROJECT_REGISTER' AND biz_id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM project_register WHERE id = $projectId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM system_notification WHERE ref_type = 'PROJECT_REGISTER' AND ref_id = $projectId;") | Out-Null
  }
  if ($contractId) {
    $cleanupSqlLines.Add("DELETE FROM contract_system_item WHERE contract_id = $contractId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM recycle_bin WHERE biz_type = 'CONTRACT' AND biz_id = $contractId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM contract WHERE id = $contractId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM system_notification WHERE ref_type = 'CONTRACT' AND ref_id = $contractId;") | Out-Null
  }
  if ($customerId) {
    $cleanupSqlLines.Add("DELETE FROM customer WHERE id = $customerId;") | Out-Null
  }

  if ($cleanupSqlLines.Count -gt 0) {
    Invoke-E2EMySql -Context $context -Sql ($cleanupSqlLines -join [Environment]::NewLine) | Out-Null
  }
}

Complete-E2EResults -Context $context
