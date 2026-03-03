param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "happy-path-report-reviews-and-compile-submit" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$customerId = $null
$contractId = $null
$projectId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$tag = New-E2EUniqueTag -Prefix "hp3"

try {
  $contractYear = 2033

  $customerPayload = @{
    fullName = "e2e-customer-$tag"
    industry = "finance"
    region = "north"
    addressDetail = "e2e-address-$tag"
    uscc = "USCC-$tag"
    contactName = "contact"
    mobilePhone = "13800138000"
    remark = "created by e2e hp03"
  }
  $customerResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/customers" `
      -Token $adminToken `
      -Body $customerPayload
  $customerId = $customerResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_customer_hp03" `
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
    remark = "created by e2e hp03"
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
    -CaseName "create_contract_hp03" `
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
    -CaseName "submit_contract_review_hp03" `
    -Expected "200" `
    -Actual "status=$($submitContractResp.status)" `
    -Pass ($submitContractResp.status -eq 200) `
    -Detail $submitContractResp.raw

  $approveContractResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts/$contractId/approve" `
      -Token $adminToken
  $approveContractStatus = [string]$approveContractResp.body.data.reviewStatus
  Add-E2EResult -Context $context `
    -CaseName "approve_contract_review_hp03" `
    -Expected "200 + reviewStatus=APPROVED" `
    -Actual "status=$($approveContractResp.status), reviewStatus=$approveContractStatus" `
    -Pass ($approveContractResp.status -eq 200 -and $approveContractStatus -eq "APPROVED") `
    -Detail $approveContractResp.raw

  $archivePayload = @{
    signedAt = "2033-01-10 10:00:00"
    fileCount = 2
    storageLocation = "archive-room-A-03"
    remark = "archived by e2e hp03"
    archiveScanObjectKey = "e2e/$tag/archive.zip"
  }
  $archiveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts/$contractId/archive" `
      -Token $adminToken `
      -Body $archivePayload
  Add-E2EResult -Context $context `
    -CaseName "archive_contract_hp03" `
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
        requiredEntryDate = "2033-01-15"
        requiredReportDeliveryDate = "2033-02-28"
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
    -CaseName "create_project_register_hp03" `
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
    -CaseName "submit_project_register_review_hp03" `
    -Expected "200" `
    -Actual "status=$($projectSubmitResp.status)" `
    -Pass ($projectSubmitResp.status -eq 200) `
    -Detail $projectSubmitResp.raw

  $assessmentMemberPayload = @{
    usernames = @("admin")
  }
  $assessmentMemberResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/project-registers/$projectId/assessment-members" `
      -Token $adminToken `
      -Body $assessmentMemberPayload
  $assessmentMembers = @()
  if ($assessmentMemberResp.status -eq 200 -and
      $null -ne $assessmentMemberResp.body -and
      $null -ne $assessmentMemberResp.body.data -and
      $assessmentMemberResp.body.data.PSObject.Properties.Name -contains "usernames") {
    $assessmentMembers = @($assessmentMemberResp.body.data.usernames)
  }
  Add-E2EResult -Context $context `
    -CaseName "project_assessment_members_saved_hp03" `
    -Expected "200 + usernames non-empty" `
    -Actual "status=$($assessmentMemberResp.status), count=$($assessmentMembers.Count)" `
    -Pass ($assessmentMemberResp.status -eq 200 -and $assessmentMembers.Count -gt 0) `
    -Detail $assessmentMemberResp.raw

  $projectTodoResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/workflow/tasks/todo?type=PROJECT_REGISTER" `
      -Token $adminToken
  $projectTodoRows = @($projectTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  if ($projectTodoRows.Count -lt 1) {
    throw "project register todo task not found for hp03"
  }
  $projectApproveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$projectTodoRows[0].taskId)/approve" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "approve_project_register_review_hp03" `
    -Expected "200" `
    -Actual "status=$($projectApproveResp.status)" `
    -Pass ($projectApproveResp.status -eq 200) `
    -Detail $projectApproveResp.raw

  $policePayload = @{
    registerNo = "REG-$tag"
    filingAgency = "agency-police"
    contactName = "officer"
    contactPhone = "13600136000"
    projectManagerUsername = "reviewer"
    remark = "saved by hp03"
  }
  $policeSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/police-registers/$projectId" `
      -Token $adminToken `
      -Body $policePayload
  Add-E2EResult -Context $context `
    -CaseName "police_register_save_hp03" `
    -Expected "200 + status=DRAFT" `
    -Actual "status=$($policeSaveResp.status), registerStatus=$([string]$policeSaveResp.body.data.status)" `
    -Pass ($policeSaveResp.status -eq 200 -and [string]$policeSaveResp.body.data.status -eq "DRAFT") `
    -Detail $policeSaveResp.raw

  $policeSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/police-registers/$projectId/submit" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "police_register_submit_hp03" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($policeSubmitResp.status), registerStatus=$([string]$policeSubmitResp.body.data.status)" `
    -Pass ($policeSubmitResp.status -eq 200 -and [string]$policeSubmitResp.body.data.status -eq "SUBMITTED") `
    -Detail $policeSubmitResp.raw

  $onSitePayload = @{
    packageObjectKey = "e2e/$tag/on-site.zip"
    assessmentDetail = "on-site assessment by hp03"
  }
  $onSiteSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/on-site-assessments/$projectId" `
      -Token $adminToken `
      -Body $onSitePayload
  Add-E2EResult -Context $context `
    -CaseName "on_site_save_zip_hp03" `
    -Expected "200 + packageObjectKey=.zip" `
    -Actual "status=$($onSiteSaveResp.status), packageObjectKey=$([string]$onSiteSaveResp.body.data.packageObjectKey)" `
    -Pass ($onSiteSaveResp.status -eq 200 -and [string]$onSiteSaveResp.body.data.packageObjectKey.ToLower().EndsWith(".zip")) `
    -Detail $onSiteSaveResp.raw

  $onSiteSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/on-site-assessments/$projectId/submit" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "on_site_submit_success_hp03" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($onSiteSubmitResp.status), onSiteStatus=$([string]$onSiteSubmitResp.body.data.status)" `
    -Pass ($onSiteSubmitResp.status -eq 200 -and [string]$onSiteSubmitResp.body.data.status -eq "SUBMITTED") `
    -Detail $onSiteSubmitResp.raw

  $techAutoDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-tech-reviews/$projectId" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "report_tech_review_auto_submit_after_on_site_submit" `
    -Expected "200 + status=SUBMITTED + workflowNode=REPORT_TECH_REVIEW_TASK" `
    -Actual "status=$($techAutoDetailResp.status), reviewStatus=$([string]$techAutoDetailResp.body.data.status), workflowNode=$([string]$techAutoDetailResp.body.data.workflowNode)" `
    -Pass ($techAutoDetailResp.status -eq 200 -and [string]$techAutoDetailResp.body.data.status -eq "SUBMITTED" -and [string]$techAutoDetailResp.body.data.workflowNode -eq "REPORT_TECH_REVIEW_TASK") `
    -Detail $techAutoDetailResp.raw

  $techTodoResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/workflow/tasks/todo?type=REPORT_TECH_REVIEW" `
      -Token $adminToken
  $techTodoRows = @($techTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
  $techTodo = $techTodoRows | Select-Object -First 1
  Add-E2EResult -Context $context `
    -CaseName "report_tech_review_todo_found" `
    -Expected "at least one todo task for this project" `
    -Actual "status=$($techTodoResp.status), matched=$($techTodoRows.Count), taskId=$([string]$techTodo.taskId)" `
    -Pass ($techTodoResp.status -eq 200 -and $techTodoRows.Count -ge 1 -and -not [string]::IsNullOrWhiteSpace([string]$techTodo.taskId)) `
    -Detail $techTodoResp.raw
  if ($techTodoRows.Count -lt 1 -or [string]::IsNullOrWhiteSpace([string]$techTodo.taskId)) {
    throw "report tech review todo task not found"
  }

  $techApproveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$techTodo.taskId)/approve" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "report_tech_review_task_approved" `
    -Expected "200" `
    -Actual "status=$($techApproveResp.status)" `
    -Pass ($techApproveResp.status -eq 200) `
    -Detail $techApproveResp.raw

  $techDetailAfterResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-tech-reviews/$projectId" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "report_tech_review_detail_approved" `
    -Expected "200 + status=APPROVED + workflowNode=REPORT_CONTENT_REVIEW_TASK" `
    -Actual "status=$($techDetailAfterResp.status), reviewStatus=$([string]$techDetailAfterResp.body.data.status), workflowNode=$([string]$techDetailAfterResp.body.data.workflowNode)" `
    -Pass ($techDetailAfterResp.status -eq 200 -and [string]$techDetailAfterResp.body.data.status -eq "APPROVED" -and [string]$techDetailAfterResp.body.data.workflowNode -eq "REPORT_CONTENT_REVIEW_TASK") `
    -Detail $techDetailAfterResp.raw

  $contentAutoDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-content-reviews/$projectId" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "report_content_review_auto_submit_after_tech_approve" `
    -Expected "200 + status=SUBMITTED + workflowNode=REPORT_CONTENT_REVIEW_TASK" `
    -Actual "status=$($contentAutoDetailResp.status), reviewStatus=$([string]$contentAutoDetailResp.body.data.status), workflowNode=$([string]$contentAutoDetailResp.body.data.workflowNode)" `
    -Pass ($contentAutoDetailResp.status -eq 200 -and [string]$contentAutoDetailResp.body.data.status -eq "SUBMITTED" -and [string]$contentAutoDetailResp.body.data.workflowNode -eq "REPORT_CONTENT_REVIEW_TASK") `
    -Detail $contentAutoDetailResp.raw

  $contentTodoResp = $null
  $contentTodoRows = @()
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    $contentTodoResp =
      Invoke-E2EApi -Context $context `
        -Method "Get" `
        -Path "/api/v1/workflow/tasks/todo?type=REPORT_CONTENT_REVIEW" `
        -Token $adminToken
    $contentTodoRows = @($contentTodoResp.body.data | Where-Object { [long]$_.bizId -eq [long]$projectId })
    if ($contentTodoResp.status -eq 200 -and $contentTodoRows.Count -eq 3) {
      break
    }
    Start-Sleep -Milliseconds 200
  }
  $contentTodoPass =
    $contentTodoResp.status -eq 200 -and
    $contentTodoRows.Count -eq 3 -and
    @($contentTodoRows | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.taskId) }).Count -eq 3
  Add-E2EResult -Context $context `
    -CaseName "report_content_review_three_tasks_ready" `
    -Expected "exactly 3 pending tasks for 技术/管理/网络" `
    -Actual "status=$($contentTodoResp.status), matched=$($contentTodoRows.Count)" `
    -Pass $contentTodoPass `
    -Detail $contentTodoResp.raw
  if (-not $contentTodoPass) {
    throw "report content review pending tasks should be 3"
  }

  $contentApproveStatuses = New-Object System.Collections.Generic.List[int]
  $contentApproveRaws = New-Object System.Collections.Generic.List[string]
  foreach ($task in $contentTodoRows) {
    $approveResp =
      Invoke-E2EApi -Context $context `
        -Method "Post" `
        -Path "/api/v1/workflow/tasks/$([string]$task.taskId)/approve" `
        -Token $adminToken
    $contentApproveStatuses.Add([int]$approveResp.status) | Out-Null
    $contentApproveRaws.Add([string]$approveResp.raw) | Out-Null
  }
  $contentApprovePass = @($contentApproveStatuses | Where-Object { $_ -eq 200 }).Count -eq 3
  Add-E2EResult -Context $context `
    -CaseName "report_content_review_all_tasks_approved" `
    -Expected "3 approvals all 200" `
    -Actual "statuses=$($contentApproveStatuses -join ',')" `
    -Pass $contentApprovePass `
    -Detail ($contentApproveRaws -join " | ")
  if (-not $contentApprovePass) {
    throw "report content review task approvals failed: statuses=$($contentApproveStatuses -join ','), raws=$($contentApproveRaws -join ' || ')"
  }

  $contentDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-content-reviews/$projectId" `
      -Token $adminToken
  $contentDetailStatus = ""
  $contentDetailWorkflowNode = ""
  if ($null -ne $contentDetailResp.body -and $null -ne $contentDetailResp.body.data) {
    if ($contentDetailResp.body.data.PSObject.Properties.Name -contains "status") {
      $contentDetailStatus = [string]$contentDetailResp.body.data.status
    }
    if ($contentDetailResp.body.data.PSObject.Properties.Name -contains "workflowNode") {
      $contentDetailWorkflowNode = [string]$contentDetailResp.body.data.workflowNode
    }
  }
  Add-E2EResult -Context $context `
    -CaseName "report_content_review_all_approved" `
    -Expected "200 + status=APPROVED + workflowNode=REPORT_COMPILE_ASSIGN" `
    -Actual "status=$($contentDetailResp.status), reviewStatus=$contentDetailStatus, workflowNode=$contentDetailWorkflowNode" `
    -Pass ($contentDetailResp.status -eq 200 -and $contentDetailStatus -eq "APPROVED" -and $contentDetailWorkflowNode -eq "REPORT_COMPILE_ASSIGN") `
    -Detail $contentDetailResp.raw
  if (-not ($contentDetailResp.status -eq 200 -and $contentDetailStatus -eq "APPROVED" -and $contentDetailWorkflowNode -eq "REPORT_COMPILE_ASSIGN")) {
    throw "report content review not approved after approvals: status=$($contentDetailResp.status), raw=$($contentDetailResp.raw)"
  }

  $compileAssignDetailBeforeResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-compile-assignments/$projectId" `
      -Token $adminToken
  $compileAssignVersionNo = 0
  if ($compileAssignDetailBeforeResp.status -eq 200 -and $null -ne $compileAssignDetailBeforeResp.body -and $null -ne $compileAssignDetailBeforeResp.body.data) {
    $compileAssignVersionNo = [int]$compileAssignDetailBeforeResp.body.data.versionNo
  }
  Add-E2EResult -Context $context `
    -CaseName "report_compile_assignment_detail_before_save" `
    -Expected "200/404 + calculable versionNo (default 0)" `
    -Actual "status=$($compileAssignDetailBeforeResp.status), versionNo=$compileAssignVersionNo" `
    -Pass ($compileAssignDetailBeforeResp.status -eq 200 -or $compileAssignDetailBeforeResp.status -eq 404) `
    -Detail $compileAssignDetailBeforeResp.raw

  $compileAssignSavePayload = @{
    assignee = "admin"
    versionNo = $compileAssignVersionNo
  }
  $compileAssignSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/report-compile-assignments/$projectId" `
      -Token $adminToken `
      -Body $compileAssignSavePayload
  $compileAssignSaveStatus = ""
  $compileAssignSaveAssignee = ""
  if ($null -ne $compileAssignSaveResp.body -and $null -ne $compileAssignSaveResp.body.data) {
    if ($compileAssignSaveResp.body.data.PSObject.Properties.Name -contains "status") {
      $compileAssignSaveStatus = [string]$compileAssignSaveResp.body.data.status
    }
    if ($compileAssignSaveResp.body.data.PSObject.Properties.Name -contains "assignee") {
      $compileAssignSaveAssignee = [string]$compileAssignSaveResp.body.data.assignee
    }
  }
  Add-E2EResult -Context $context `
    -CaseName "report_compile_assignment_save_success" `
    -Expected "200 + status=DRAFT + assignee=admin" `
    -Actual "status=$($compileAssignSaveResp.status), assignStatus=$compileAssignSaveStatus, assignee=$compileAssignSaveAssignee, versionNo=$compileAssignVersionNo" `
    -Pass ($compileAssignSaveResp.status -eq 200 -and $compileAssignSaveStatus -eq "DRAFT" -and $compileAssignSaveAssignee -eq "admin") `
    -Detail $compileAssignSaveResp.raw
  if ($compileAssignSaveResp.status -ne 200) {
    throw "report compile assignment save failed: status=$($compileAssignSaveResp.status), raw=$($compileAssignSaveResp.raw)"
  }

  $compileAssignSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/report-compile-assignments/$projectId/submit" `
      -Token $adminToken
  $compileAssignSubmitStatus = ""
  if ($null -ne $compileAssignSubmitResp.body -and $null -ne $compileAssignSubmitResp.body.data) {
    if ($compileAssignSubmitResp.body.data.PSObject.Properties.Name -contains "status") {
      $compileAssignSubmitStatus = [string]$compileAssignSubmitResp.body.data.status
    }
  }
  Add-E2EResult -Context $context `
    -CaseName "report_compile_assignment_submit_success" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($compileAssignSubmitResp.status), assignStatus=$compileAssignSubmitStatus" `
    -Pass ($compileAssignSubmitResp.status -eq 200 -and $compileAssignSubmitStatus -eq "SUBMITTED") `
    -Detail $compileAssignSubmitResp.raw
  if ($compileAssignSubmitResp.status -ne 200) {
    throw "report compile assignment submit failed: status=$($compileAssignSubmitResp.status), raw=$($compileAssignSubmitResp.raw)"
  }

  $compileSubmissionSavePayload = @{
    reportObjectKey = "e2e/$tag/report.docx"
    reportRemark = "report compiled by hp03"
  }
  $compileSubmissionSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/report-compile-submissions/$projectId" `
      -Token $adminToken `
      -Body $compileSubmissionSavePayload
  $compileSubmissionSaveStatus = ""
  if ($null -ne $compileSubmissionSaveResp.body -and $null -ne $compileSubmissionSaveResp.body.data) {
    if ($compileSubmissionSaveResp.body.data.PSObject.Properties.Name -contains "status") {
      $compileSubmissionSaveStatus = [string]$compileSubmissionSaveResp.body.data.status
    }
  }
  Add-E2EResult -Context $context `
    -CaseName "report_compile_submission_save_success" `
    -Expected "200 + status=DRAFT" `
    -Actual "status=$($compileSubmissionSaveResp.status), submitStatus=$compileSubmissionSaveStatus" `
    -Pass ($compileSubmissionSaveResp.status -eq 200 -and $compileSubmissionSaveStatus -eq "DRAFT") `
    -Detail $compileSubmissionSaveResp.raw
  if ($compileSubmissionSaveResp.status -ne 200) {
    throw "report compile submission save failed: status=$($compileSubmissionSaveResp.status), raw=$($compileSubmissionSaveResp.raw)"
  }

  $compileSubmissionSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/report-compile-submissions/$projectId/submit" `
      -Token $adminToken
  $compileSubmissionSubmitStatus = ""
  if ($null -ne $compileSubmissionSubmitResp.body -and $null -ne $compileSubmissionSubmitResp.body.data) {
    if ($compileSubmissionSubmitResp.body.data.PSObject.Properties.Name -contains "status") {
      $compileSubmissionSubmitStatus = [string]$compileSubmissionSubmitResp.body.data.status
    }
  }
  Add-E2EResult -Context $context `
    -CaseName "report_compile_submission_submit_success" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($compileSubmissionSubmitResp.status), submitStatus=$compileSubmissionSubmitStatus" `
    -Pass ($compileSubmissionSubmitResp.status -eq 200 -and $compileSubmissionSubmitStatus -eq "SUBMITTED") `
    -Detail $compileSubmissionSubmitResp.raw
  if ($compileSubmissionSubmitResp.status -ne 200) {
    throw "report compile submission submit failed: status=$($compileSubmissionSubmitResp.status), raw=$($compileSubmissionSubmitResp.raw)"
  }

  $compileSubmissionDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/report-compile-submissions/$projectId" `
      -Token $adminToken
  $compileSubmissionDetailStatus = ""
  $compileSubmissionDetailWorkflowNode = ""
  $compileSubmissionDetailObjectKey = ""
  if ($null -ne $compileSubmissionDetailResp.body -and $null -ne $compileSubmissionDetailResp.body.data) {
    if ($compileSubmissionDetailResp.body.data.PSObject.Properties.Name -contains "status") {
      $compileSubmissionDetailStatus = [string]$compileSubmissionDetailResp.body.data.status
    }
    if ($compileSubmissionDetailResp.body.data.PSObject.Properties.Name -contains "workflowNode") {
      $compileSubmissionDetailWorkflowNode = [string]$compileSubmissionDetailResp.body.data.workflowNode
    }
    if ($compileSubmissionDetailResp.body.data.PSObject.Properties.Name -contains "reportObjectKey") {
      $compileSubmissionDetailObjectKey = [string]$compileSubmissionDetailResp.body.data.reportObjectKey
    }
  }
  Add-E2EResult -Context $context `
    -CaseName "report_compile_workflow_to_final_review" `
    -Expected "200 + status=SUBMITTED + workflowNode=REPORT_FINAL_REVIEW_TASK" `
    -Actual "status=$($compileSubmissionDetailResp.status), submitStatus=$compileSubmissionDetailStatus, workflowNode=$compileSubmissionDetailWorkflowNode, reportObjectKey=$compileSubmissionDetailObjectKey" `
    -Pass ($compileSubmissionDetailResp.status -eq 200 -and $compileSubmissionDetailStatus -eq "SUBMITTED" -and $compileSubmissionDetailWorkflowNode -eq "REPORT_FINAL_REVIEW_TASK" -and $compileSubmissionDetailObjectKey -eq [string]$compileSubmissionSavePayload.reportObjectKey) `
    -Detail $compileSubmissionDetailResp.raw
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
    $cleanupSqlLines.Add("DELETE FROM project_assessment_member WHERE project_register_id = $projectId;") | Out-Null
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



