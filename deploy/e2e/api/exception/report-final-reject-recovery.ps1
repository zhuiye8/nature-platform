param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-report-final-reject-recovery" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$customerId = $null
$contractId = $null
$projectId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$tag = New-E2EUniqueTag -Prefix "rej15"

try {
  $contractYear = 2038

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
        remark = "created by final reject recovery"
      }
  $customerId = $customerResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_customer_final_reject" `
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
        remark = "created by final reject recovery"
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
    -CaseName "create_contract_final_reject" `
    -Expected "200 + contractId" `
    -Actual "status=$($contractResp.status), id=$contractId" `
    -Pass ($contractResp.status -eq 200 -and [long]$contractId -gt 0) `
    -Detail $contractResp.raw

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/submit-review" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/approve" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/archive" -Token $adminToken -Body @{
    signedAt = "2038-01-10 10:00:00"
    fileCount = 2
    storageLocation = "archive-room-rej15"
    remark = "archived by final reject recovery"
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
            requiredEntryDate = "2038-01-15"
            requiredReportDeliveryDate = "2038-02-28"
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
    -CaseName "create_project_final_reject" `
    -Expected "200 + projectId" `
    -Actual "status=$($projectResp.status), id=$projectId" `
    -Pass ($projectResp.status -eq 200 -and [long]$projectId -gt 0) `
    -Detail $projectResp.raw

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/project-registers/$projectId/submit-review" -Token $adminToken | Out-Null
  $projectTodoResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=PROJECT_REGISTER" -Token $adminToken
  $projectTodoRows = @($projectTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  if ($projectTodoRows.Count -lt 1) {
    throw "project register todo task not found for final reject recovery"
  }
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$projectTodoRows[0].taskId)/approve" -Token $adminToken | Out-Null

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/police-registers/$projectId" -Token $adminToken -Body @{
    registerNo = "REG-$tag"
    filingAgency = "agency-police"
    contactName = "officer"
    contactPhone = "13600136000"
    remark = "saved by final reject recovery"
  } | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/police-registers/$projectId/submit" -Token $adminToken | Out-Null

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/on-site-assessments/$projectId" -Token $adminToken -Body @{
    packageObjectKey = "e2e/$tag/on-site.zip"
    assessmentDetail = "on-site assessment by final reject recovery"
  } | Out-Null

  $candidatesResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/on-site-assessments/reviewer-candidates" -Token $adminToken
  $candidatesData = $candidatesResp.body.data
  $techUsers = @($candidatesData.techReviewers)
  $aUsers = @($candidatesData.contentReviewersTech)
  $bUsers = @($candidatesData.contentReviewersManagement)
  $cUsers = @($candidatesData.contentReviewersNetwork)
  $candidatePass =
    $candidatesResp.status -eq 200 -and
    $techUsers.Count -gt 0 -and
    $aUsers.Count -gt 0 -and
    $bUsers.Count -gt 0 -and
    $cUsers.Count -gt 0
  Add-E2EResult -Context $context `
    -CaseName "reviewer_candidates_ready_final_reject" `
    -Expected "200 + tech+内容技术/管理/网络 all non-empty" `
    -Actual "status=$($candidatesResp.status), tech=$($techUsers.Count), A=$($aUsers.Count), B=$($bUsers.Count), C=$($cUsers.Count)" `
    -Pass $candidatePass `
    -Detail $candidatesResp.raw
  if (-not $candidatePass) {
    throw "reviewer candidates are not ready for final reject recovery"
  }

  $techAssignee = "admin"
  $contentTechAssignee = "admin"
  $contentManagementAssignee = "admin"
  $contentNetworkAssignee = "admin"

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/on-site-assessments/$projectId/review-assignment" -Token $adminToken -Body @{
    techReviewer = $techAssignee
    contentReviewerTech = $contentTechAssignee
    contentReviewerManagement = $contentManagementAssignee
    contentReviewerNetwork = $contentNetworkAssignee
    versionNo = 0
  } | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/on-site-assessments/$projectId/submit" -Token $adminToken | Out-Null

  $techTodoResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_TECH_REVIEW" -Token $adminToken
  $techTodoRows = @($techTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  if ($techTodoRows.Count -lt 1) {
    throw "report tech review todo task not found"
  }
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$techTodoRows[0].taskId)/approve" -Token $adminToken | Out-Null

  $contentTodoResp = $null
  $contentTodoRows = @()
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $contentTodoResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_CONTENT_REVIEW" -Token $adminToken
    $contentTodoRows = @($contentTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
    if ($contentTodoResp.status -eq 200 -and $contentTodoRows.Count -eq 3) {
      break
    }
    Start-Sleep -Milliseconds 200
  }
  if ($contentTodoRows.Count -ne 3) {
    throw "report content review pending tasks should be 3"
  }
  foreach ($task in $contentTodoRows) {
    Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$task.taskId)/approve" -Token $adminToken | Out-Null
  }

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/report-compile-assignments/$projectId" -Token $adminToken -Body @{ assignee = "admin"; versionNo = 0 } | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/report-compile-assignments/$projectId/submit" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/report-compile-submissions/$projectId" -Token $adminToken -Body @{ reportObjectKey = "e2e/$tag/report.docx"; reportRemark = "report compiled" } | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/report-compile-submissions/$projectId/submit" -Token $adminToken | Out-Null

  $finalSaveResp = Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/report-final-reviews/$projectId" -Token $adminToken -Body @{
    reviewer = "admin"
    remark = "final review draft by final reject recovery"
    versionNo = 0
  }
  Add-E2EResult -Context $context `
    -CaseName "final_save_before_reject" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($finalSaveResp.status), reviewStatus=$([string]$finalSaveResp.body.data.status)" `
    -Pass ($finalSaveResp.status -eq 200 -and [string]$finalSaveResp.body.data.status -eq "SUBMITTED") `
    -Detail $finalSaveResp.raw

  $finalTodoBeforeRejectResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_FINAL_REVIEW" -Token $adminToken
  $finalTodoBeforeRejectRows = @($finalTodoBeforeRejectResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  Add-E2EResult -Context $context `
    -CaseName "final_todo_ready_before_reject" `
    -Expected "at least 1 pending task" `
    -Actual "status=$($finalTodoBeforeRejectResp.status), matched=$($finalTodoBeforeRejectRows.Count)" `
    -Pass ($finalTodoBeforeRejectResp.status -eq 200 -and $finalTodoBeforeRejectRows.Count -ge 1) `
    -Detail $finalTodoBeforeRejectResp.raw
  if ($finalTodoBeforeRejectRows.Count -lt 1) {
    throw "report final review todo task not found before reject"
  }

  $rejectTask = $finalTodoBeforeRejectRows | Select-Object -First 1
  $rejectResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$rejectTask.taskId)/reject" `
      -Token $adminToken `
      -Body @{ remark = "e2e final reject" }
  Add-E2EResult -Context $context `
    -CaseName "final_task_reject_success" `
    -Expected "200" `
    -Actual "status=$($rejectResp.status), taskId=$([string]$rejectTask.taskId)" `
    -Pass ($rejectResp.status -eq 200) `
    -Detail $rejectResp.raw

  $finalDetailAfterRejectResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-final-reviews/$projectId" -Token $adminToken
  $afterRejectStatus = [string]$finalDetailAfterRejectResp.body.data.status
  $afterRejectNode = [string]$finalDetailAfterRejectResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "final_status_rejected_after_reject" `
    -Expected "200 + status=REJECTED + workflowNode=REPORT_FINAL_REVIEW_TASK" `
    -Actual "status=$($finalDetailAfterRejectResp.status), reviewStatus=$afterRejectStatus, workflowNode=$afterRejectNode" `
    -Pass ($finalDetailAfterRejectResp.status -eq 200 -and $afterRejectStatus -eq "REJECTED" -and $afterRejectNode -eq "REPORT_FINAL_REVIEW_TASK") `
    -Detail $finalDetailAfterRejectResp.raw

  $finalResubmitResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/report-compile-submissions/$projectId/submit" -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "final_resubmit_after_reject_via_compile_submit" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($finalResubmitResp.status), compileStatus=$([string]$finalResubmitResp.body.data.status)" `
    -Pass ($finalResubmitResp.status -eq 200 -and [string]$finalResubmitResp.body.data.status -eq "SUBMITTED") `
    -Detail $finalResubmitResp.raw

  $finalTodoAfterResubmitResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_FINAL_REVIEW" -Token $adminToken
  $finalTodoAfterResubmitRows = @($finalTodoAfterResubmitResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  Add-E2EResult -Context $context `
    -CaseName "final_todo_recreated_after_resubmit" `
    -Expected "at least 1 pending task" `
    -Actual "status=$($finalTodoAfterResubmitResp.status), matched=$($finalTodoAfterResubmitRows.Count)" `
    -Pass ($finalTodoAfterResubmitResp.status -eq 200 -and $finalTodoAfterResubmitRows.Count -ge 1) `
    -Detail $finalTodoAfterResubmitResp.raw
  if ($finalTodoAfterResubmitRows.Count -lt 1) {
    throw "report final review todo task not found after resubmit"
  }

  $approveTask = $finalTodoAfterResubmitRows | Select-Object -First 1
  $approveResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$approveTask.taskId)/approve" -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "final_task_approve_after_resubmit" `
    -Expected "200" `
    -Actual "status=$($approveResp.status), taskId=$([string]$approveTask.taskId)" `
    -Pass ($approveResp.status -eq 200) `
    -Detail $approveResp.raw

  $finalDetailAfterRecoveryResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-final-reviews/$projectId" -Token $adminToken
  $afterRecoveryStatus = [string]$finalDetailAfterRecoveryResp.body.data.status
  $afterRecoveryNode = [string]$finalDetailAfterRecoveryResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "final_recovery_to_material_archive" `
    -Expected "200 + status=APPROVED + workflowNode=MATERIAL_ARCHIVE" `
    -Actual "status=$($finalDetailAfterRecoveryResp.status), reviewStatus=$afterRecoveryStatus, workflowNode=$afterRecoveryNode" `
    -Pass ($finalDetailAfterRecoveryResp.status -eq 200 -and $afterRecoveryStatus -eq "APPROVED" -and $afterRecoveryNode -eq "MATERIAL_ARCHIVE") `
    -Detail $finalDetailAfterRecoveryResp.raw
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
