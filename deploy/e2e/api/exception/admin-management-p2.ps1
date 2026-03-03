param(
  [string]$BaseUrl = "http://127.0.0.1:18080"
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\..\..\lib\common.ps1"

$context = New-E2EContext -SuiteName "exception-admin-management-p2" -BaseUrl $BaseUrl
Assert-E2EApiReady -Context $context

$adminToken = Login-E2EToken -Context $context -Username "admin" -Password "admin123"
$reviewerToken = Login-E2EToken -Context $context -Username "reviewer" -Password "review123"

$stamp = (Get-Date).ToString("yyyyMMddHHmmss")
$rand = Get-Random -Minimum 1000 -Maximum 9999
$roleCode = "ROLE_E2E_NODE_RULE_${stamp}_${rand}"
$username = "e2eadm${stamp}${rand}".ToLower()
if ($username.Length -gt 64) {
  $username = $username.Substring(0, 64)
}
$displayName = "E2E Admin User $rand"
$password = "e2eAdmin123"

function Get-JsonField([object]$obj, [string]$name) {
  if ($null -eq $obj -or [string]::IsNullOrWhiteSpace($name)) {
    return $null
  }
  if ($obj -is [System.Collections.IDictionary]) {
    if ($obj.Contains($name)) {
      return $obj[$name]
    }
    return $null
  }
  $prop = $obj.PSObject.Properties[$name]
  if ($null -ne $prop) {
    return $prop.Value
  }
  return $null
}

function Resolve-SlotLabel([string]$slotKey, [string]$fallback) {
  switch ($slotKey) {
    "TECH_REVIEWER" { return "技术审核人" }
    "CONTENT_REVIEWER_TECH" { return "内容审核-技术" }
    "CONTENT_REVIEWER_MANAGEMENT" { return "内容审核-管理" }
    "CONTENT_REVIEWER_NETWORK" { return "内容审核-网络" }
    default {
      if ([string]::IsNullOrWhiteSpace($fallback)) { return $slotKey }
      return $fallback
    }
  }
}

$roleCreated = $false
$userCreated = $false
$originalRule = $null
$ruleMutated = $false
$cleanupErrors = New-Object System.Collections.Generic.List[string]

try {
  $forbiddenResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/admin/users" -Token $reviewerToken
  $forbiddenCode = [string](Get-JsonField -obj $forbiddenResp.body -name "code")
  $forbiddenPass = $forbiddenResp.status -eq 403 -and $forbiddenCode -eq "AUTH_FORBIDDEN"
  Add-E2EResult -Context $context `
    -CaseName "non_admin_forbidden_admin_users" `
    -Expected "403 + AUTH_FORBIDDEN" `
    -Actual "status=$($forbiddenResp.status), code=$forbiddenCode" `
    -Pass $forbiddenPass `
    -Detail $forbiddenResp.raw

  $createRolePayload = @{
    roleCode = $roleCode
    roleName = "E2E Node Rule Role $rand"
    description = "e2e role for admin-management-p2"
    enabled = $true
    resourceKeys = @("page.admin-workflow", "page.admin-audit-logs")
  }
  $createRoleResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/admin/roles" -Token $adminToken -Body $createRolePayload
  $createRoleData = Get-JsonField -obj $createRoleResp.body -name "data"
  $createdRoleCode = [string](Get-JsonField -obj $createRoleData -name "roleCode")
  $createRolePass = $createRoleResp.status -eq 200 -and $createdRoleCode -eq $roleCode
  Add-E2EResult -Context $context `
    -CaseName "admin_create_role_success" `
    -Expected "200 + roleCode created" `
    -Actual "status=$($createRoleResp.status), roleCode=$createdRoleCode" `
    -Pass $createRolePass `
    -Detail $createRoleResp.raw
  if ($createRolePass) {
    $roleCreated = $true
  }

  $createUserPayload = @{
    username = $username
    displayName = $displayName
    password = $password
    enabled = $true
    roles = @($roleCode)
  }
  $createUserResp = Invoke-E2EApi -Context $context -Method "Post" -Path "/api/v1/admin/users" -Token $adminToken -Body $createUserPayload
  $createUserData = Get-JsonField -obj $createUserResp.body -name "data"
  $createUsername = [string](Get-JsonField -obj $createUserData -name "username")
  $createUserRoles = @(Get-JsonField -obj $createUserData -name "roles")
  $createUserPass =
    $createUserResp.status -eq 200 -and
    $createUsername -eq $username -and
    $createUserRoles -contains $roleCode
  Add-E2EResult -Context $context `
    -CaseName "admin_create_user_with_custom_role" `
    -Expected "200 + user contains custom role" `
    -Actual "status=$($createUserResp.status), username=$createUsername" `
    -Pass $createUserPass `
    -Detail $createUserResp.raw
  if ($createUserPass) {
    $userCreated = $true
  }

  $customToken = ""
  try {
    $customToken = Login-E2EToken -Context $context -Username $username -Password $password
  } catch {
    $customToken = ""
  }

  $customRoleCodesResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/admin/workflow/role-codes" -Token $customToken
  $customRoleCodesPass = $customRoleCodesResp.status -eq 200
  Add-E2EResult -Context $context `
    -CaseName "custom_user_has_node_rule_manage_permission" `
    -Expected "200" `
    -Actual "status=$($customRoleCodesResp.status)" `
    -Pass $customRoleCodesPass `
    -Detail $customRoleCodesResp.raw

  $loadRuleResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/admin/workflow/node-rules/ON_SITE_ASSESSMENT" -Token $adminToken
  $loadRulePass = $loadRuleResp.status -eq 200 -and $null -ne $loadRuleResp.body.data
  Add-E2EResult -Context $context `
    -CaseName "load_original_on_site_rule" `
    -Expected "200 + rule payload" `
    -Actual "status=$($loadRuleResp.status)" `
    -Pass $loadRulePass `
    -Detail $loadRuleResp.raw

  if ($loadRulePass) {
    $originalRule = $loadRuleResp.body.data

    $newItems = New-Object System.Collections.Generic.List[object]
    foreach ($item in @($originalRule.items)) {
      $newItems.Add(@{
          slotKey = [string]$item.slotKey
          slotLabel = Resolve-SlotLabel -slotKey ([string]$item.slotKey) -fallback ([string]$item.slotLabel)
          roleCode = [string]$item.roleCode
          requiredFlag = [bool]$item.requiredFlag
          minCount = [int]$item.minCount
          maxCount = [int]$item.maxCount
          sortOrder = [int]$item.sortOrder
        }) | Out-Null
    }

    $exists = $false
    foreach ($item in $newItems) {
      if ($item.slotKey -eq "TECH_REVIEWER" -and $item.roleCode -eq $roleCode) {
        $exists = $true
        break
      }
    }
    if (-not $exists) {
      $newItems.Add(@{
          slotKey = "TECH_REVIEWER"
          slotLabel = "Technical Reviewer"
          roleCode = $roleCode
          requiredFlag = $true
          minCount = 1
          maxCount = 1
          sortOrder = 999
        }) | Out-Null
    }

    $itemsPayload = @()
    foreach ($entry in $newItems) {
      $itemsPayload += $entry
    }

    $upsertRulePayload = @{
      ruleName = [string]$originalRule.ruleName
      enabled = [bool]$originalRule.enabled
      'items' = $itemsPayload
    }
    $upsertRuleResp = Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/admin/workflow/node-rules/ON_SITE_ASSESSMENT" -Token $adminToken -Body $upsertRulePayload
    $upsertRulePass = $upsertRuleResp.status -eq 200
    Add-E2EResult -Context $context `
      -CaseName "admin_upsert_on_site_rule_success" `
      -Expected "200" `
      -Actual "status=$($upsertRuleResp.status)" `
      -Pass $upsertRulePass `
      -Detail $upsertRuleResp.raw

    if ($upsertRulePass) {
      $ruleMutated = $true
    }

    $ruleReadbackResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/admin/workflow/node-rules/ON_SITE_ASSESSMENT" -Token $adminToken
    $ruleItems = @($ruleReadbackResp.body.data.items)
    $matchedRows = @(
      $ruleItems | Where-Object {
        [string]$_.slotKey -eq "TECH_REVIEWER" -and [string]$_.roleCode -eq $roleCode
      }
    )
    $candidatePass = $ruleReadbackResp.status -eq 200 -and $matchedRows.Count -ge 1
    Add-E2EResult -Context $context `
      -CaseName "reviewer_candidates_include_custom_role_user" `
      -Expected "200 + node-rule TECH_REVIEWER includes custom role" `
      -Actual "status=$($ruleReadbackResp.status), matched=$($matchedRows.Count)" `
      -Pass $candidatePass `
      -Detail $ruleReadbackResp.raw

    $auditResp = Invoke-E2EApi -Context $context -Method "Get" -Path "/api/v1/admin/audit-logs?actionType=WORKFLOW_NODE_RULE_UPSERT&operator=admin&targetType=WORKFLOW_NODE_RULE&limit=50" -Token $adminToken
    $matched = 0
    foreach ($row in @($auditResp.body.data)) {
      if ([string]$row.targetId -eq "ON_SITE_ASSESSMENT") {
        $matched++
      }
    }
    $auditPass = $auditResp.status -eq 200 -and $matched -ge 1
    Add-E2EResult -Context $context `
      -CaseName "audit_log_contains_node_rule_upsert" `
      -Expected "200 + matched >= 1" `
      -Actual "status=$($auditResp.status), matched=$matched" `
      -Pass $auditPass `
      -Detail $auditResp.raw
  }
} finally {
  if ($ruleMutated -and $null -ne $originalRule) {
    $restoreItems = @()
    foreach ($item in @($originalRule.items)) {
      $restoreItems += @{
        slotKey = [string]$item.slotKey
        slotLabel = Resolve-SlotLabel -slotKey ([string]$item.slotKey) -fallback ([string]$item.slotLabel)
        roleCode = [string]$item.roleCode
        requiredFlag = [bool]$item.requiredFlag
        minCount = [int]$item.minCount
        maxCount = [int]$item.maxCount
        sortOrder = [int]$item.sortOrder
      }
    }
    $restorePayload = @{
      ruleName = [string]$originalRule.ruleName
      enabled = [bool]$originalRule.enabled
      'items' = $restoreItems
    }
    $restoreResp = Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/admin/workflow/node-rules/ON_SITE_ASSESSMENT" -Token $adminToken -Body $restorePayload
    if ($restoreResp.status -ne 200) {
      $cleanupErrors.Add("restore node rule failed: status=$($restoreResp.status)") | Out-Null
    }
  }

  if ($userCreated) {
    $disableUserPayload = @{
      displayName = $displayName
      password = ""
      enabled = $false
      roles = @("ROLE_USER")
    }
    $disableUserResp = Invoke-E2EApi -Context $context -Method "Put" -Path "/api/v1/admin/users/$username" -Token $adminToken -Body $disableUserPayload
    if ($disableUserResp.status -ne 200) {
      $cleanupErrors.Add("disable user failed: status=$($disableUserResp.status)") | Out-Null
    }
  }

  if ($roleCreated) {
    $deleteRoleResp = Invoke-E2EApi -Context $context -Method "Delete" -Path "/api/v1/admin/roles/$roleCode" -Token $adminToken
    if ($deleteRoleResp.status -ne 200) {
      $cleanupErrors.Add("delete role failed: status=$($deleteRoleResp.status)") | Out-Null
    }
  }

  $cleanupPass = $cleanupErrors.Count -eq 0
  $cleanupActual = "ok"
  if (-not $cleanupPass) {
    $cleanupActual = ($cleanupErrors -join "; ")
  }
  Add-E2EResult -Context $context `
    -CaseName "cleanup_restore_and_release_resources" `
    -Expected "all cleanup steps return 200" `
    -Actual $cleanupActual `
    -Pass $cleanupPass `
    -Detail ""

  Complete-E2EResults -Context $context
}



