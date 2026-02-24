param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "audit-notification-trigger-and-time" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$customerId = $null
$contractId = $null
$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$reviewerToken = Login-E2EToken -Context $context -Username "reviewer" -Password "review123"
$tag = New-E2EUniqueTag -Prefix "audit"

try {
  $beforeAdminResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/notifications/unread-count" -Token $adminToken
  $beforeReviewerResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/notifications/unread-count" -Token $reviewerToken
  $beforeAdmin = [int]$beforeAdminResp.body.data.count
  $beforeReviewer = [int]$beforeReviewerResp.body.data.count

  $contractYear = 2036
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
        remark = "created by notification audit"
      }
  $customerId = [long]$customerResp.body.data.id

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
        remark = "created by notification audit"
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
  $contractId = [long]$contractResp.body.data.id

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/submit-review" -Token $adminToken | Out-Null
  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/approve" -Token $adminToken | Out-Null

  $afterApproveAdminResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/notifications/unread-count" -Token $adminToken
  $afterApproveReviewerResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/notifications/unread-count" -Token $reviewerToken
  $afterApproveAdmin = [int]$afterApproveAdminResp.body.data.count
  $afterApproveReviewer = [int]$afterApproveReviewerResp.body.data.count

  Add-E2EResult -Context $context `
    -CaseName "contract_approve_notification_reviewer_increment" `
    -Expected "reviewer unread count increase at least 1" `
    -Actual "before=$beforeReviewer, afterApprove=$afterApproveReviewer" `
    -Pass ($afterApproveReviewer -ge ($beforeReviewer + 1)) `
    -Detail $afterApproveReviewerResp.raw

  Add-E2EResult -Context $context `
    -CaseName "contract_approve_notification_admin_increment" `
    -Expected "admin unread count increase at least 1" `
    -Actual "before=$beforeAdmin, afterApprove=$afterApproveAdmin" `
    -Pass ($afterApproveAdmin -ge ($beforeAdmin + 1)) `
    -Detail $afterApproveAdminResp.raw

  $reviewerListResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/notifications?limit=200" -Token $reviewerToken
  $reviewerMatched = @(
    $reviewerListResp.body.data |
      Where-Object {
        [string]$_.eventType -eq "CONTRACT_REVIEW_APPROVED" -and [long]$_.refId -eq [long]$contractId
      }
  )
  Add-E2EResult -Context $context `
    -CaseName "contract_approve_notification_event_present" `
    -Expected "reviewer notification list contains CONTRACT_REVIEW_APPROVED for contract" `
    -Actual "status=$($reviewerListResp.status), matched=$($reviewerMatched.Count), contractId=$contractId" `
    -Pass ($reviewerListResp.status -eq 200 -and $reviewerMatched.Count -ge 1) `
    -Detail $reviewerListResp.raw

  Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/contracts/$contractId/archive" -Token $adminToken -Body @{
    signedAt = "2036-01-10 10:00:00"
    fileCount = 2
    storageLocation = "archive-room-audit"
    remark = "archived by audit"
    archiveScanObjectKey = "e2e/$tag/archive.zip"
  } | Out-Null

  $afterArchiveAdminResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/notifications/unread-count" -Token $adminToken
  $afterArchiveAdmin = [int]$afterArchiveAdminResp.body.data.count
  Add-E2EResult -Context $context `
    -CaseName "contract_archive_notification_admin_increment" `
    -Expected "admin unread count increase at least 1 after archive" `
    -Actual "afterApprove=$afterApproveAdmin, afterArchive=$afterArchiveAdmin" `
    -Pass ($afterArchiveAdmin -ge ($afterApproveAdmin + 1)) `
    -Detail $afterArchiveAdminResp.raw

  $adminListResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/notifications?limit=200" -Token $adminToken
  $adminArchiveMatched = @(
    $adminListResp.body.data |
      Where-Object {
        [string]$_.eventType -eq "CONTRACT_ARCHIVED" -and [long]$_.refId -eq [long]$contractId
      }
  )
  Add-E2EResult -Context $context `
    -CaseName "contract_archive_notification_event_present" `
    -Expected "admin notification list contains CONTRACT_ARCHIVED for contract" `
    -Actual "status=$($adminListResp.status), matched=$($adminArchiveMatched.Count), contractId=$contractId" `
    -Pass ($adminListResp.status -eq 200 -and $adminArchiveMatched.Count -ge 1) `
    -Detail $adminListResp.raw

  $timeFilePath = Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\nature-platform-web\src\time.ts")
  $timeFileContent = Get-Content -Raw $timeFilePath
  $hasAsiaShanghai = $timeFileContent.Contains('timeZone: "Asia/Shanghai"')
  $hasOffsetNormalize = $timeFileContent.Contains('+08:00')
  Add-E2EResult -Context $context `
    -CaseName "frontend_time_formatter_uses_asia_shanghai" `
    -Expected "time.ts contains Asia/Shanghai and +08:00 normalization" `
    -Actual "hasAsiaShanghai=$hasAsiaShanghai, hasOffsetNormalize=$hasOffsetNormalize" `
    -Pass ($hasAsiaShanghai -and $hasOffsetNormalize) `
    -Detail "time.ts path=$timeFilePath"
} finally {
  $cleanupSqlLines = New-Object System.Collections.Generic.List[string]
  if ($contractId) {
    $cleanupSqlLines.Add("DELETE FROM system_notification WHERE ref_type = 'CONTRACT' AND ref_id = $contractId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM contract_system_item WHERE contract_id = $contractId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM recycle_bin WHERE biz_type = 'CONTRACT' AND biz_id = $contractId;") | Out-Null
    $cleanupSqlLines.Add("DELETE FROM contract WHERE id = $contractId;") | Out-Null
  }
  if ($customerId) {
    $cleanupSqlLines.Add("DELETE FROM customer WHERE id = $customerId;") | Out-Null
  }

  if ($cleanupSqlLines.Count -gt 0) {
    Invoke-E2EMySql -Context $context -Sql ($cleanupSqlLines -join [Environment]::NewLine) | Out-Null
  }
}

Complete-E2EResults -Context $context
