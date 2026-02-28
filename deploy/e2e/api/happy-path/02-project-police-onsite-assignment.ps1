param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "happy-path-project-police-onsite-assignment" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$customerId = $null
$contractId = $null
$projectId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$tag = New-E2EUniqueTag -Prefix "hp2"

try {
  $contractYear = 2032

  $customerPayload = @{
    fullName = "e2e-customer-$tag"
    industry = "finance"
    region = "north"
    addressDetail = "e2e-address-$tag"
    uscc = "USCC-$tag"
    contactName = "contact"
    mobilePhone = "13800138000"
    remark = "created by e2e hp02"
  }
  $customerResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/customers" `
      -Token $adminToken `
      -Body $customerPayload
  $customerId = $customerResp.body.data.id
  Add-E2EResult -Context $context `
    -CaseName "create_customer_hp02" `
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
    remark = "created by e2e hp02"
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
    -CaseName "create_contract_hp02" `
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
    -CaseName "submit_contract_review_hp02" `
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
    -CaseName "approve_contract_review_hp02" `
    -Expected "200 + reviewStatus=APPROVED" `
    -Actual "status=$($approveContractResp.status), reviewStatus=$approveContractStatus" `
    -Pass ($approveContractResp.status -eq 200 -and $approveContractStatus -eq "APPROVED") `
    -Detail $approveContractResp.raw

  $archivePayload = @{
    signedAt = "2032-01-10 10:00:00"
    fileCount = 2
    storageLocation = "archive-room-A-02"
    remark = "archived by e2e hp02"
    archiveScanObjectKey = "e2e/$tag/archive.zip"
  }
  $archiveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/contracts/$contractId/archive" `
      -Token $adminToken `
      -Body $archivePayload
  Add-E2EResult -Context $context `
    -CaseName "archive_contract_hp02" `
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
        requiredEntryDate = "2032-01-15"
        requiredReportDeliveryDate = "2032-02-28"
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
    -CaseName "create_project_register_hp02" `
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
    -CaseName "submit_project_register_review" `
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
    throw "project register todo task not found for hp02"
  }
  $projectApproveResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/workflow/tasks/$([string]$projectTodoRows[0].taskId)/approve" `
      -Token $adminToken
  Add-E2EResult -Context $context `
    -CaseName "approve_project_register_review" `
    -Expected "200" `
    -Actual "status=$($projectApproveResp.status)" `
    -Pass ($projectApproveResp.status -eq 200) `
    -Detail $projectApproveResp.raw

  $projectDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/project-registers/$projectId" `
      -Token $adminToken
  $projectStatus = [string]$projectDetailResp.body.data.status
  Add-E2EResult -Context $context `
    -CaseName "project_register_status_approved" `
    -Expected "200 + status=APPROVED" `
    -Actual "status=$($projectDetailResp.status), projectStatus=$projectStatus" `
    -Pass ($projectDetailResp.status -eq 200 -and $projectStatus -eq "APPROVED") `
    -Detail $projectDetailResp.raw

  $policePayload = @{
    registerNo = "REG-$tag"
    filingAgency = "agency-police"
    contactName = "officer"
    contactPhone = "13600136000"
    remark = "saved by hp02"
  }
  $policeSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/police-registers/$projectId" `
      -Token $adminToken `
      -Body $policePayload
  $policeSaveStatus = [string]$policeSaveResp.body.data.status
  Add-E2EResult -Context $context `
    -CaseName "police_register_save" `
    -Expected "200 + status=DRAFT" `
    -Actual "status=$($policeSaveResp.status), registerStatus=$policeSaveStatus" `
    -Pass ($policeSaveResp.status -eq 200 -and $policeSaveStatus -eq "DRAFT") `
    -Detail $policeSaveResp.raw

  $policeSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/police-registers/$projectId/submit" `
      -Token $adminToken
  $policeSubmitStatus = [string]$policeSubmitResp.body.data.status
  Add-E2EResult -Context $context `
    -CaseName "police_register_submit" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($policeSubmitResp.status), registerStatus=$policeSubmitStatus" `
    -Pass ($policeSubmitResp.status -eq 200 -and $policeSubmitStatus -eq "SUBMITTED") `
    -Detail $policeSubmitResp.raw

  $policeDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/police-registers/$projectId" `
      -Token $adminToken
  $policeWorkflowNode = [string]$policeDetailResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "police_register_workflow_to_onsite" `
    -Expected "200 + workflowNode=ON_SITE_ASSESSMENT" `
    -Actual "status=$($policeDetailResp.status), workflowNode=$policeWorkflowNode" `
    -Pass ($policeDetailResp.status -eq 200 -and $policeWorkflowNode -eq "ON_SITE_ASSESSMENT") `
    -Detail $policeDetailResp.raw

  $onSitePayload = @{
    packageObjectKey = "e2e/$tag/on-site.zip"
    assessmentDetail = "on-site assessment by hp02"
  }
  $onSiteSaveResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/on-site-assessments/$projectId" `
      -Token $adminToken `
      -Body $onSitePayload
  $onSitePackage = [string]$onSiteSaveResp.body.data.packageObjectKey
  Add-E2EResult -Context $context `
    -CaseName "on_site_save_zip" `
    -Expected "200 + packageObjectKey=.zip" `
    -Actual "status=$($onSiteSaveResp.status), packageObjectKey=$onSitePackage" `
    -Pass ($onSiteSaveResp.status -eq 200 -and $onSitePackage.ToLower().EndsWith(".zip")) `
    -Detail $onSiteSaveResp.raw

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
    -CaseName "on_site_reviewer_candidates_ready" `
    -Expected "200 + tech+内容技术/管理/网络 all non-empty" `
    -Actual "status=$($candidatesResp.status), tech=$($techUsers.Count), A=$($aUsers.Count), B=$($bUsers.Count), C=$($cUsers.Count)" `
    -Pass $candidatePass `
    -Detail $candidatesResp.raw
  if (-not $candidatePass) {
    throw "reviewer candidates are not ready"
  }

  $assignPayload = @{
    techReviewer = [string]$techUsers[0]
    contentReviewerTech = [string]$aUsers[0]
    contentReviewerManagement = [string]$bUsers[0]
    contentReviewerNetwork = [string]$cUsers[0]
    versionNo = 0
  }
  $assignResp =
    Invoke-E2EApi -Context $context `
      -Method "Put" `
      -Path "/api/v1/on-site-assessments/$projectId/review-assignment" `
      -Token $adminToken `
      -Body $assignPayload
  $assignVersion = [int]$assignResp.body.data.assignmentVersionNo
  Add-E2EResult -Context $context `
    -CaseName "on_site_assignment_saved" `
    -Expected "200 + assignmentVersionNo>=1" `
    -Actual "status=$($assignResp.status), assignmentVersionNo=$assignVersion" `
    -Pass ($assignResp.status -eq 200 -and $assignVersion -ge 1) `
    -Detail $assignResp.raw

  $onSiteDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/on-site-assessments/$projectId" `
      -Token $adminToken
  $detailData = $onSiteDetailResp.body.data
  $detailPass =
    $onSiteDetailResp.status -eq 200 -and
    [string]$detailData.techReviewer -eq $assignPayload.techReviewer -and
    [string]$detailData.contentReviewerTech -eq $assignPayload.contentReviewerTech -and
    [string]$detailData.contentReviewerManagement -eq $assignPayload.contentReviewerManagement -and
    [string]$detailData.contentReviewerNetwork -eq $assignPayload.contentReviewerNetwork
  Add-E2EResult -Context $context `
    -CaseName "on_site_assignment_detail_assertion" `
    -Expected "200 + reviewer fields matched" `
    -Actual "status=$($onSiteDetailResp.status), tech=$($detailData.techReviewer), A=$($detailData.contentReviewerTech), B=$($detailData.contentReviewerManagement), C=$($detailData.contentReviewerNetwork)" `
    -Pass $detailPass `
    -Detail $onSiteDetailResp.raw

  $onSiteSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Post" `
      -Path "/api/v1/on-site-assessments/$projectId/submit" `
      -Token $adminToken
  $onSiteSubmitStatus = [string]$onSiteSubmitResp.body.data.status
  Add-E2EResult -Context $context `
    -CaseName "on_site_submit_success" `
    -Expected "200 + status=SUBMITTED" `
    -Actual "status=$($onSiteSubmitResp.status), onSiteStatus=$onSiteSubmitStatus" `
    -Pass ($onSiteSubmitResp.status -eq 200 -and $onSiteSubmitStatus -eq "SUBMITTED") `
    -Detail $onSiteSubmitResp.raw

  $onSiteAfterSubmitResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/on-site-assessments/$projectId" `
      -Token $adminToken
  $onSiteWorkflowNode = [string]$onSiteAfterSubmitResp.body.data.workflowNode
  Add-E2EResult -Context $context `
    -CaseName "on_site_workflow_to_report_tech" `
    -Expected "200 + workflowNode=REPORT_TECH_REVIEW_TASK" `
    -Actual "status=$($onSiteAfterSubmitResp.status), workflowNode=$onSiteWorkflowNode" `
    -Pass ($onSiteAfterSubmitResp.status -eq 200 -and $onSiteWorkflowNode -eq "REPORT_TECH_REVIEW_TASK") `
    -Detail $onSiteAfterSubmitResp.raw

  $qualityDetailResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/quality-reviews/$projectId" `
      -Token $adminToken
  $qualityStatus = [string]$qualityDetailResp.body.data.status
  Add-E2EResult -Context $context `
    -CaseName "quality_gateway_approved_after_onsite_submit" `
    -Expected "200 + qualityStatus=APPROVED" `
    -Actual "status=$($qualityDetailResp.status), qualityStatus=$qualityStatus" `
    -Pass ($qualityDetailResp.status -eq 200 -and $qualityStatus -eq "APPROVED") `
    -Detail $qualityDetailResp.raw
} finally {
  $cleanupSqlLines = New-Object System.Collections.Generic.List[string]
  if ($projectId) {
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



