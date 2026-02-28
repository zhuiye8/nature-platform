param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "happy-path-final-review-and-material-archive" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$customerId = $null
$contractId = $null
$projectId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$tag = New-E2EUniqueTag -Prefix "hp4"

try {
  $contractYear = 2034

  $customerPayload = @{
    fullName = "e2e-customer-$tag"
    industry = "finance"
    region = "north"
    addressDetail = "e2e-address-$tag"
    uscc = "USCC-$tag"
    contactName = "contact"
    mobilePhone = "13800138000"
    remark = "created by e2e hp04"
  }
  $customerResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/customers" `
      -Token $adminToken `
      -Body $customerPayload
  $customerId = $customerResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_customer_hp04" `
    -Expected "200 + customerId" `
    -Actual "status=$($customerResp.status), id=$customerId" `
    -Pass ($customerResp.status -eq 200 -and [long]$customerId -gt 0) `
    -Detail $customerResp.raw

  $contractPayload = @{
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
    remark = "created by e2e hp04"
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
  $contractResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts" `
      -Token $adminToken `
      -Body $contractPayload
  $contractId = $contractResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_contract_hp04" `
    -Expected "200 + contractId" `
    -Actual "status=$($contractResp.status), id=$contractId" `
    -Pass ($contractResp.status -eq 200 -and [long]$contractId -gt 0) `
    -Detail $contractResp.raw

  $submitContractResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts/$contractId/submit-review" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "submit_contract_review_hp04" `
    -Expected "200" `
    -Actual "status=$($submitContractResp.status)" `
    -Pass ($submitContractResp.status -eq 200) `
    -Detail $submitContractResp.raw

  $approveContractResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts/$contractId/approve" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "approve_contract_review_hp04" `
    -Expected "200 + reviewStatus=APPROVED" `
    -Actual "status=$($approveContractResp.status), reviewStatus=$([string]$approveContractResp.body.data.reviewStatus)" `
    -Pass ($approveContractResp.status -eq 200 -and [string]$approveContractResp.body.data.reviewStatus -eq "APPROVED") `
    -Detail $approveContractResp.raw

  $archivePayload = @{
    signedAt = "2034-01-10 10:00:00"
    fileCount = 2
    storageLocation = "archive-room-A-04"
    remark = "archived by e2e hp04"
    archiveScanObjectKey = "e2e/$tag/archive.zip"
  }
  $archiveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts/$contractId/archive" `
      -Token $adminToken `
      -Body $archivePayload
  Add-E2EResult -Context $context `
    -CaseName "archive_contract_hp04" `
    -Expected "200" `
    -Actual "status=$($archiveResp.status)" `
    -Pass ($archiveResp.status -eq 200) `
    -Detail $archiveResp.raw

  $projectPayload = @{
    contractId = [long]$contractId
    contractYear = $contractYear
    systemItems = @(
      @{
        systemName = "assessed-system-$tag"
        filingAgency = "agency-A"
        securityLevel = "L3"
        reassessment = $false
        requiredEntryDate = "2034-01-15"
        requiredReportDeliveryDate = "2034-02-28"
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
  $projectResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/project-registers" `
      -Token $adminToken `
      -Body $projectPayload
  $projectId = $projectResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_project_register_hp04" `
    -Expected "200 + projectId" `
    -Actual "status=$($projectResp.status), id=$projectId" `
    -Pass ($projectResp.status -eq 200 -and [long]$projectId -gt 0) `
    -Detail $projectResp.raw

  $projectSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/project-registers/$projectId/submit-review" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "submit_project_register_review_hp04" `
    -Expected "200" `
    -Actual "status=$($projectSubmitResp.status)" `
    -Pass ($projectSubmitResp.status -eq 200) `
    -Detail $projectSubmitResp.raw

  $projectTodoResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/workflow/tasks/todo?type=PROJECT_REGISTER" `
      -Token $adminToken
  $projectTodoRows = @($projectTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  if ($projectTodoRows.Count -lt 1) {
    throw "project register todo task not found for hp04"
  }
  $projectApproveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$projectTodoRows[0].taskId)/approve" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "approve_project_register_review_hp04" `
    -Expected "200" `
    -Actual "status=$($projectApproveResp.status)" `
    -Pass ($projectApproveResp.status -eq 200) `
    -Detail $projectApproveResp.raw

  $policePayload = @{
    registerNo = "REG-$tag"
    filingAgency = "agency-police"
    contactName = "officer"
    contactPhone = "13600136000"
    remark = "saved by hp04"
  }
  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/police-registers/$projectId" -Token $adminToken -Body $policePayload | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/police-registers/$projectId/submit" -Token $adminToken | Out-Null

  $onSitePayload = @{
    packageObjectKey = "e2e/$tag/on-site.zip"
    assessmentDetail = "on-site assessment by hp04"
  }
  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/on-site-assessments/$projectId" -Token $adminToken -Body $onSitePayload | Out-Null

  $candidatesResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/on-site-assessments/reviewer-candidates" `
      -Token $adminToken
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
    -CaseName "on_site_reviewer_candidates_ready_hp04" `
    -Expected "200 + tech+内容技术/管理/网络 all non-empty" `
    -Actual "status=$($candidatesResp.status), tech=$($techUsers.Count), A=$($aUsers.Count), B=$($bUsers.Count), C=$($cUsers.Count)" `
    -Pass $candidatePass `
    -Detail $candidatesResp.raw
  if (-not $candidatePass) {
    throw "reviewer candidates are not ready for hp04"
  }

  $techAssignee = "admin"
  $contentTechAssignee = "admin"
  $contentManagementAssignee = "admin"
  $contentNetworkAssignee = "admin"

  $assignPayload = @{
    techReviewer = $techAssignee
    contentReviewerTech = $contentTechAssignee
    contentReviewerManagement = $contentManagementAssignee
    contentReviewerNetwork = $contentNetworkAssignee
    versionNo = 0
  }
  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/on-site-assessments/$projectId/review-assignment" -Token $adminToken -Body $assignPayload | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/on-site-assessments/$projectId/submit" -Token $adminToken | Out-Null

  $techTodoResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/workflow/tasks/todo?type=REPORT_TECH_REVIEW" -Token $adminToken
  $techTodoRows = @($techTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  if ($techTodoRows.Count -lt 1) {
    throw "report tech review todo task not found for hp04"
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
    throw "report content review pending tasks should be 3 for hp04"
  }
  foreach ($task in $contentTodoRows) {
    Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/workflow/tasks/$([string]$task.taskId)/approve" -Token $adminToken | Out-Null
  }

  $compileAssignDetailBeforeResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/report-compile-assignments/$projectId" -Token $adminToken
  $compileAssignVersionNo = 0
  if ($compileAssignDetailBeforeResp.status -eq 200 -and $null -ne $compileAssignDetailBeforeResp.body -and $null -ne $compileAssignDetailBeforeResp.body.data) {
    $compileAssignVersionNo = [int]$compileAssignDetailBeforeResp.body.data.versionNo
  }
  $compileAssignSavePayload = @{ assignee = "admin"; versionNo = $compileAssignVersionNo }
  $compileAssignSaveResp = Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/report-compile-assignments/$projectId" -Token $adminToken -Body $compileAssignSavePayload
  if ($compileAssignSaveResp.status -ne 200) {
    throw "report compile assignment save failed: status=$($compileAssignSaveResp.status), raw=$($compileAssignSaveResp.raw)"
  }
  $compileAssignSubmitResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/report-compile-assignments/$projectId/submit" -Token $adminToken
  if ($compileAssignSubmitResp.status -ne 200) {
    throw "report compile assignment submit failed: status=$($compileAssignSubmitResp.status), raw=$($compileAssignSubmitResp.raw)"
  }
  $compileSubmissionSavePayload = @{ reportObjectKey = "e2e/$tag/report.docx"; reportRemark = "report compiled by hp04" }
  Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/report-compile-submissions/$projectId" -Token $adminToken -Body $compileSubmissionSavePayload | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/report-compile-submissions/$projectId/submit" -Token $adminToken | Out-Null

  $compileSubmissionDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-compile-submissions/$projectId" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "report_compile_ready_for_final_review_hp04" `
    -Expected "200 + status=SUBMITTED + workflowNode=REPORT_FINAL_REVIEW" `
    -Actual "status=$($compileSubmissionDetailResp.status), submitStatus=$([string]$compileSubmissionDetailResp.body.data.status), workflowNode=$([string]$compileSubmissionDetailResp.body.data.workflowNode)" `
    -Pass ($compileSubmissionDetailResp.status -eq 200 -and [string]$compileSubmissionDetailResp.body.data.status -eq "SUBMITTED" -and [string]$compileSubmissionDetailResp.body.data.workflowNode -eq "REPORT_FINAL_REVIEW") `
    -Detail $compileSubmissionDetailResp.raw

  $finalSavePayload = @{
    reviewer = "admin"
    remark = "final review draft by hp04"
    versionNo = 0
  }
  $finalSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/report-final-reviews/$projectId" `
      -Token $adminToken `
      -Body $finalSavePayload
  Add-E2EResult -Context $context `
    -CaseName "report_final_review_save_success" `
    -Expected "200 + status=SUBMITTED + reviewer=admin" `
    -Actual "status=$($finalSaveResp.status), reviewStatus=$([string]$finalSaveResp.body.data.status), reviewer=$([string]$finalSaveResp.body.data.reviewer)" `
    -Pass ($finalSaveResp.status -eq 200 -and [string]$finalSaveResp.body.data.status -eq "SUBMITTED" -and [string]$finalSaveResp.body.data.reviewer -eq "admin") `
    -Detail $finalSaveResp.raw

  $finalTodoResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/workflow/tasks/todo?type=REPORT_FINAL_REVIEW" `
      -Token $adminToken
  $finalTodoRows = @($finalTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  $finalTodo = $finalTodoRows | Select-Object -First 1
  Add-E2EResult -Context $context `
    -CaseName "report_final_review_todo_found" `
    -Expected "at least one todo task for this project" `
    -Actual "status=$($finalTodoResp.status), matched=$($finalTodoRows.Count), taskId=$([string]$finalTodo.taskId)" `
    -Pass ($finalTodoResp.status -eq 200 -and $finalTodoRows.Count -ge 1 -and -not [string]::IsNullOrWhiteSpace([string]$finalTodo.taskId)) `
    -Detail $finalTodoResp.raw
  if ($finalTodoRows.Count -lt 1 -or [string]::IsNullOrWhiteSpace([string]$finalTodo.taskId)) {
    throw "report final review todo task not found"
  }

  $finalApproveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$finalTodo.taskId)/approve" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "report_final_review_task_approved" `
    -Expected "200" `
    -Actual "status=$($finalApproveResp.status)" `
    -Pass ($finalApproveResp.status -eq 200) `
    -Detail $finalApproveResp.raw

  $finalDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-final-reviews/$projectId" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "report_final_review_detail_approved" `
    -Expected "200 + status=APPROVED + workflowNode=MATERIAL_ARCHIVE" `
    -Actual "status=$($finalDetailResp.status), reviewStatus=$([string]$finalDetailResp.body.data.status), workflowNode=$([string]$finalDetailResp.body.data.workflowNode)" `
    -Pass ($finalDetailResp.status -eq 200 -and [string]$finalDetailResp.body.data.status -eq "APPROVED" -and [string]$finalDetailResp.body.data.workflowNode -eq "MATERIAL_ARCHIVE") `
    -Detail $finalDetailResp.raw

  $materialSavePayload = @{
    reportFiles = @("e2e/$tag/final-report.pdf")
    formFiles = @("e2e/$tag/final-form.xlsx")
    remark = "material archive by hp04"
  }
  $materialSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/material-archives/$projectId" `
      -Token $adminToken `
      -Body $materialSavePayload
  Add-E2EResult -Context $context `
    -CaseName "material_archive_save_success" `
    -Expected "200 + status=DRAFT" `
    -Actual "status=$($materialSaveResp.status), archiveStatus=$([string]$materialSaveResp.body.data.status)" `
    -Pass ($materialSaveResp.status -eq 200 -and [string]$materialSaveResp.body.data.status -eq "DRAFT") `
    -Detail $materialSaveResp.raw

  $materialSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/material-archives/$projectId/submit" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "material_archive_submit_success" `
    -Expected "200 + status=ARCHIVED" `
    -Actual "status=$($materialSubmitResp.status), archiveStatus=$([string]$materialSubmitResp.body.data.status)" `
    -Pass ($materialSubmitResp.status -eq 200 -and [string]$materialSubmitResp.body.data.status -eq "ARCHIVED") `
    -Detail $materialSubmitResp.raw

  $materialDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/material-archives/$projectId" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "material_archive_status_archived" `
    -Expected "200 + status=ARCHIVED + workflowStatus=APPROVED" `
    -Actual "status=$($materialDetailResp.status), archiveStatus=$([string]$materialDetailResp.body.data.status), workflowStatus=$([string]$materialDetailResp.body.data.workflowStatus), reportFiles=$(@($materialDetailResp.body.data.reportFiles).Count), formFiles=$(@($materialDetailResp.body.data.formFiles).Count)" `
    -Pass ($materialDetailResp.status -eq 200 -and [string]$materialDetailResp.body.data.status -eq "ARCHIVED" -and [string]$materialDetailResp.body.data.workflowStatus -eq "APPROVED" -and @($materialDetailResp.body.data.reportFiles).Count -ge 1 -and @($materialDetailResp.body.data.formFiles).Count -ge 1) `
    -Detail $materialDetailResp.raw
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



