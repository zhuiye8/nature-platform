param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-report-review-reject-recovery" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$customerId = $null
$contractId = $null
$projectId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$tag = New-E2EUniqueTag -Prefix "rej12"

try {
  $contractYear = 2035

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
        remark = "created by reject recovery"
      }
  $customerId = $customerResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_customer_reject_recovery" `
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
        remark = "created by reject recovery"
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
    -CaseName "create_contract_reject_recovery" `
    -Expected "200 + contractId" `
    -Actual "status=$($contractResp.status), id=$contractId" `
    -Pass ($contractResp.status -eq 200 -and [long]$contractId -gt 0) `
    -Detail $contractResp.raw

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/submit-review" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/approve" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/archive" -Token $adminToken -Body @{
    signedAt = "2035-01-10 10:00:00"
    fileCount = 2
    storageLocation = "archive-room-reject"
    remark = "archived by reject recovery"
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
            requiredEntryDate = "2035-01-15"
            requiredReportDeliveryDate = "2035-02-28"
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
    -CaseName "create_project_reject_recovery" `
    -Expected "200 + projectId" `
    -Actual "status=$($projectResp.status), id=$projectId" `
    -Pass ($projectResp.status -eq 200 -and [long]$projectId -gt 0) `
    -Detail $projectResp.raw

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/project-registers/$projectId/submit-review" -Token $adminToken | Out-Null
  $projectTodoResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=PROJECT_REGISTER" -Token $adminToken
  $projectTodoRows = @($projectTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  if ($projectTodoRows.Count -lt 1) {
    throw "project register todo task not found for reject recovery"
  }
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$projectTodoRows[0].taskId)/approve" -Token $adminToken | Out-Null

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/police-registers/$projectId" -Token $adminToken -Body @{
    registerNo = "REG-$tag"
    filingAgency = "agency-police"
    contactName = "officer"
    contactPhone = "13600136000"
    remark = "saved by reject recovery"
  } | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/police-registers/$projectId/submit" -Token $adminToken | Out-Null

  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/on-site-assessments/$projectId" -Token $adminToken -Body @{
    packageObjectKey = "e2e/$tag/on-site.zip"
    assessmentDetail = "on-site assessment by reject recovery"
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
    -CaseName "reviewer_candidates_ready_reject_recovery" `
    -Expected "200 + tech+内容技术/管理/网络 all non-empty" `
    -Actual "status=$($candidatesResp.status), tech=$($techUsers.Count), A=$($aUsers.Count), B=$($bUsers.Count), C=$($cUsers.Count)" `
    -Pass $candidatePass `
    -Detail $candidatesResp.raw
  if (-not $candidatePass) {
    throw "reviewer candidates are not ready for reject recovery"
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
  $techApproveResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$techTodoRows[0].taskId)/approve" -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "tech_task_approve_before_content_reject" `
    -Expected "200" `
    -Actual "status=$($techApproveResp.status)" `
    -Pass ($techApproveResp.status -eq 200) `
    -Detail $techApproveResp.raw
  if ($techApproveResp.status -ne 200) {
    throw "tech task approve failed: status=$($techApproveResp.status), raw=$($techApproveResp.raw)"
  }

  $contentAutoDetailResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-content-reviews/$projectId" -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "content_auto_submit_after_tech_approve" `
    -Expected "200 + status=SUBMITTED + workflowNode=REPORT_CONTENT_REVIEW_TASK" `
    -Actual "status=$($contentAutoDetailResp.status), reviewStatus=$([string]$contentAutoDetailResp.body.data.status), workflowNode=$([string]$contentAutoDetailResp.body.data.workflowNode)" `
    -Pass ($contentAutoDetailResp.status -eq 200 -and [string]$contentAutoDetailResp.body.data.status -eq "SUBMITTED" -and [string]$contentAutoDetailResp.body.data.workflowNode -eq "REPORT_CONTENT_REVIEW_TASK") `
    -Detail $contentAutoDetailResp.raw

  $contentSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-content-reviews/$projectId" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "content_auto_submit_before_reject" `
    -Expected "200 + status=SUBMITTED + workflowNode=REPORT_CONTENT_REVIEW_TASK" `
    -Actual "status=$($contentSubmitResp.status), reviewStatus=$([string]$contentSubmitResp.body.data.status)" `
    -Pass ($contentSubmitResp.status -eq 200 -and [string]$contentSubmitResp.body.data.status -eq "SUBMITTED" -and [string]$contentSubmitResp.body.data.workflowNode -eq "REPORT_CONTENT_REVIEW_TASK") `
    -Detail $contentSubmitResp.raw

  $contentTodoBeforeRejectResp = $null
  $contentTodoBeforeRejectRows = @()
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $contentTodoBeforeRejectResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_CONTENT_REVIEW" -Token $adminToken
    $contentTodoBeforeRejectRows = @($contentTodoBeforeRejectResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
    if ($contentTodoBeforeRejectResp.status -eq 200 -and $contentTodoBeforeRejectRows.Count -eq 3) {
      break
    }
    Start-Sleep -Milliseconds 200
  }
  Add-E2EResult -Context $context `
    -CaseName "content_todos_ready_before_reject" `
    -Expected "exactly 3 pending tasks" `
    -Actual "status=$($contentTodoBeforeRejectResp.status), matched=$($contentTodoBeforeRejectRows.Count)" `
    -Pass ($contentTodoBeforeRejectResp.status -eq 200 -and $contentTodoBeforeRejectRows.Count -eq 3) `
    -Detail $contentTodoBeforeRejectResp.raw
  if ($contentTodoBeforeRejectRows.Count -ne 3) {
    $allTodoResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo" -Token $adminToken
    $allTodoRows = @()
    if ($allTodoResp.status -eq 200) {
      $allTodoRows = @($allTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
    }
    $allTypes = @($allTodoRows | ForEach-Object { [string]$_.taskType }) -join ","
    throw "report content review pending tasks should be 3 before reject, contentStatus=$($contentTodoBeforeRejectResp.status), contentMatched=$($contentTodoBeforeRejectRows.Count), allStatus=$($allTodoResp.status), allMatched=$($allTodoRows.Count), allTypes=$allTypes"
  }

  $rejectTask = $contentTodoBeforeRejectRows | Select-Object -First 1
  $rejectResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$rejectTask.taskId)/reject" `
      -Token $adminToken `
      -Body @{ remark = "e2e reject for recovery" }
  Add-E2EResult -Context $context `
    -CaseName "content_task_reject_success" `
    -Expected "200" `
    -Actual "status=$($rejectResp.status), taskId=$([string]$rejectTask.taskId)" `
    -Pass ($rejectResp.status -eq 200) `
    -Detail $rejectResp.raw

  $contentDetailAfterRejectResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-content-reviews/$projectId" -Token $adminToken
  $afterRejectStatus = [string]$contentDetailAfterRejectResp.body.data.status
  $afterRejectNode = [string]$contentDetailAfterRejectResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "content_status_rejected_after_reject" `
    -Expected "200 + status=REJECTED + workflowNode=REPORT_CONTENT_REVIEW_TASK" `
    -Actual "status=$($contentDetailAfterRejectResp.status), reviewStatus=$afterRejectStatus, workflowNode=$afterRejectNode" `
    -Pass ($contentDetailAfterRejectResp.status -eq 200 -and $afterRejectStatus -eq "REJECTED" -and $afterRejectNode -eq "REPORT_CONTENT_REVIEW_TASK") `
    -Detail $contentDetailAfterRejectResp.raw

  $contentResubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/on-site-assessments/$projectId/submit" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "content_resubmit_after_reject_via_on_site_submit" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($contentResubmitResp.status), onSiteStatus=$([string]$contentResubmitResp.body.data.status)" `
    -Pass ($contentResubmitResp.status -eq 200 -and [string]$contentResubmitResp.body.data.status -eq "SUBMITTED") `
    -Detail $contentResubmitResp.raw

  $contentTodoAfterResubmitResp = $null
  $contentTodoAfterResubmitRows = @()
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $contentTodoAfterResubmitResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_CONTENT_REVIEW" -Token $adminToken
    $contentTodoAfterResubmitRows = @($contentTodoAfterResubmitResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
    if ($contentTodoAfterResubmitResp.status -eq 200 -and $contentTodoAfterResubmitRows.Count -eq 3) {
      break
    }
    Start-Sleep -Milliseconds 200
  }
  Add-E2EResult -Context $context `
    -CaseName "content_todos_recreated_after_resubmit" `
    -Expected "exactly 3 pending tasks" `
    -Actual "status=$($contentTodoAfterResubmitResp.status), matched=$($contentTodoAfterResubmitRows.Count)" `
    -Pass ($contentTodoAfterResubmitResp.status -eq 200 -and $contentTodoAfterResubmitRows.Count -eq 3) `
    -Detail $contentTodoAfterResubmitResp.raw
  if ($contentTodoAfterResubmitRows.Count -ne 3) {
    throw "report content review pending tasks should be 3 after resubmit, actual=$($contentTodoAfterResubmitRows.Count)"
  }

  $approveStatuses = New-Object System.Collections.Generic.List[int]
  foreach ($task in $contentTodoAfterResubmitRows) {
    $approveResp =
      Invoke-E2EApi -Context $context `
        -Method "Post" `
        -Path "/api/v1/workflow/tasks/$([string]$task.taskId)/approve" `
        -Token $adminToken
    $approveStatuses.Add([int]$approveResp.status) | Out-Null
  }
  $allApproved = @($approveStatuses | Where-Object { $_ -eq 200 }).Count -eq 3
  Add-E2EResult -Context $context `
    -CaseName "content_tasks_all_approved_after_resubmit" `
    -Expected "3 approvals all 200" `
    -Actual "statuses=$($approveStatuses -join ',')" `
    -Pass $allApproved `
    -Detail $contentTodoAfterResubmitResp.raw
  if (-not $allApproved) {
    throw "content approve after resubmit failed: $($approveStatuses -join ',')"
  }

  $contentDetailAfterRecoveryResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-content-reviews/$projectId" -Token $adminToken
  $afterRecoveryStatus = [string]$contentDetailAfterRecoveryResp.body.data.status
  $afterRecoveryNode = [string]$contentDetailAfterRecoveryResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "content_recovery_to_compile_assign" `
    -Expected "200 + status=APPROVED + workflowNode=REPORT_COMPILE_ASSIGN" `
    -Actual "status=$($contentDetailAfterRecoveryResp.status), reviewStatus=$afterRecoveryStatus, workflowNode=$afterRecoveryNode" `
    -Pass ($contentDetailAfterRecoveryResp.status -eq 200 -and $afterRecoveryStatus -eq "APPROVED" -and $afterRecoveryNode -eq "REPORT_COMPILE_ASSIGN") `
    -Detail $contentDetailAfterRecoveryResp.raw
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
    $cleanupSql = ($cleanupSqlLines -join [Environment]::NewLine)
    Invoke-E2EMySql -Context $context -Sql $cleanupSql | Out-Null
  }
}

Complete-E2EResults -Context $context
