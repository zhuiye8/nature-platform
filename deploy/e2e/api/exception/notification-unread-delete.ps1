param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-notification-unread-delete" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$reviewerToken = Login-E2EToken -Context $context -Username "reviewer" -Password "review123"
$tag = New-E2EUniqueTag -Prefix "notify"
$seededId = $null

try {
  $beforeCountResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/notifications/unread-count" `
      -Token $reviewerToken
  $beforeCount = [int]$beforeCountResp.body.data.count

  $seedSql = @"
INSERT INTO system_notification (
  receiver_username, title, content, event_type, ref_type, ref_id, read_flag, deleted_flag
) VALUES (
  'reviewer', 'e2e-notify-$tag', 'e2e notification for unread delete test', 'E2E_NOTIFY', 'E2E', NULL, 0, 0
);
SELECT LAST_INSERT_ID();
"@
  $seededId = (Invoke-E2EMySql -Context $context -Sql $seedSql | Select-Object -Last 1).Trim()
  if ([string]::IsNullOrWhiteSpace($seededId)) {
    throw "seed notification id failed"
  }

  $listResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/notifications?limit=50" `
      -Token $reviewerToken
  $seededVisible = @($listResp.body.data | Where-Object { [long]$_.id -eq [long]$seededId }).Count -ge 1
  Add-E2EResult -Context $context `
    -CaseName "notification_seed_visible" `
    -Expected "seeded notification appears in list" `
    -Actual "status=$($listResp.status), seededId=$seededId, matched=$(@($listResp.body.data | Where-Object { [long]$_.id -eq [long]$seededId }).Count)" `
    -Pass ($listResp.status -eq 200 -and $seededVisible) `
    -Detail $listResp.raw
  if (-not $seededVisible) {
    throw "seeded notification not visible from API list"
  }

  $afterInsertResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/notifications/unread-count" `
      -Token $reviewerToken
  $afterInsertCount = [int]$afterInsertResp.body.data.count
  Add-E2EResult -Context $context `
    -CaseName "notification_unread_count_increase_after_seed" `
    -Expected "unread count should increase at least 1 after seed" `
    -Actual "before=$beforeCount, afterInsert=$afterInsertCount" `
    -Pass ($afterInsertResp.status -eq 200 -and $afterInsertCount -ge ($beforeCount + 1)) `
    -Detail $afterInsertResp.raw

  $deleteResp =
    Invoke-E2EApi -Context $context `
      -Method "Delete" `
      -Path "/api/v1/notifications/$seededId" `
      -Token $reviewerToken
  Add-E2EResult -Context $context `
    -CaseName "notification_delete_success" `
    -Expected "200" `
    -Actual "status=$($deleteResp.status), id=$seededId" `
    -Pass ($deleteResp.status -eq 200) `
    -Detail $deleteResp.raw

  $afterDeleteResp =
    Invoke-E2EApi -Context $context `
      -Method "Get" `
      -Path "/api/v1/notifications/unread-count" `
      -Token $reviewerToken
  $afterDeleteCount = [int]$afterDeleteResp.body.data.count
  Add-E2EResult -Context $context `
    -CaseName "notification_unread_count_decrement_realtime" `
    -Expected "afterDelete = afterInsert - 1" `
    -Actual "afterInsert=$afterInsertCount, afterDelete=$afterDeleteCount" `
    -Pass ($afterDeleteResp.status -eq 200 -and $afterDeleteCount -eq ($afterInsertCount - 1)) `
    -Detail $afterDeleteResp.raw
} finally {
  if ($seededId) {
    $cleanupSql = "DELETE FROM system_notification WHERE id = $seededId;"
    Invoke-E2EMySql -Context $context -Sql $cleanupSql | Out-Null
  } else {
    $cleanupSql = "DELETE FROM system_notification WHERE receiver_username = 'reviewer' AND title LIKE 'e2e-notify-$tag%';"
    Invoke-E2EMySql -Context $context -Sql $cleanupSql | Out-Null
  }
}

Complete-E2EResults -Context $context



