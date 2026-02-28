Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-E2EContext {
  param(
    [string]$SuiteName,
    [string]$BaseUrl = "http://127.0.0.1:18080",
    [string]$MysqlContainer = "nature-platform-mysql",
    [string]$DbName = "nature_platform",
    [string]$DbUser = "root",
    [string]$DbPassword = "123456",
    [string]$ReportDir = (Join-Path (Join-Path $PSScriptRoot "..") "reports\\api")
  )

  return [ordered]@{
    SuiteName = $SuiteName
    BaseUrl = $BaseUrl.TrimEnd("/")
    MysqlContainer = $MysqlContainer
    DbName = $DbName
    DbUser = $DbUser
    DbPassword = $DbPassword
    ReportDir = $ReportDir
    Results = New-Object System.Collections.Generic.List[object]
  }
}

function Test-E2EApiReady {
  param([hashtable]$Context)
  try {
    $resp = Invoke-RestMethod -Method Get -Uri "$($Context.BaseUrl)/actuator/health" -TimeoutSec 5
    return ($resp.status -eq "UP")
  } catch {
    return $false
  }
}

function Assert-E2EApiReady {
  param([hashtable]$Context)
  if (-not (Test-E2EApiReady -Context $Context)) {
    throw "API service is not ready at $($Context.BaseUrl)."
  }
}

function New-E2EUniqueTag {
  param([string]$Prefix = "e2e")
  $stamp = (Get-Date).ToString("yyyyMMddHHmmss")
  $rand = Get-Random -Minimum 1000 -Maximum 9999
  return "$Prefix-$stamp-$rand"
}

function Invoke-E2EMySql {
  param(
    [hashtable]$Context,
    [string]$Sql
  )
  return docker exec -i $Context.MysqlContainer mysql -N -B "-u$($Context.DbUser)" "-p$($Context.DbPassword)" $Context.DbName -e $Sql
}

function Ensure-E2EUser {
  param(
    [hashtable]$Context,
    [string]$Username,
    [string]$Password,
    [string]$DisplayName
  )
  $safeDisplayName = $DisplayName.Replace("'", "''")
  $safeUsername = $Username.Replace("'", "''")
  $safePassword = $Password.Replace("'", "''")
  $sql = @"
INSERT INTO user_account (username, password_hash, display_name, enabled, source_type)
SELECT '$safeUsername', '$safePassword', '$safeDisplayName', 1, 'LOCAL'
WHERE NOT EXISTS (SELECT 1 FROM user_account WHERE username = '$safeUsername');
"@
  Invoke-E2EMySql -Context $Context -Sql $sql | Out-Null
}

function Ensure-E2EUserByAdminApi {
  param(
    [hashtable]$Context,
    [string]$Username,
    [string]$Password,
    [string]$DisplayName,
    [string[]]$Roles = @("ROLE_USER")
  )

  if ($null -eq $Roles -or $Roles.Count -eq 0) {
    $Roles = @("ROLE_USER")
  }

  $adminToken = Login-E2EToken -Context $Context -Username "admin" -Password "admin123"
  if ([string]::IsNullOrWhiteSpace($adminToken)) {
    throw "cannot login admin account when ensuring e2e user: $Username"
  }

  $listResp = Invoke-E2EApi -Context $Context -Method "Get" -Path "/api/v1/admin/users" -Token $adminToken
  if ($listResp.status -ne 200 -or $null -eq $listResp.body) {
    throw "list admin users failed when ensuring e2e user: username=$Username, status=$($listResp.status)"
  }

  $userRows = @()
  if ($listResp.body.PSObject.Properties.Name -contains "data") {
    $userRows = @($listResp.body.data)
  }

  $exists = $false
  foreach ($row in $userRows) {
    if ([string]$row.username -eq $Username) {
      $exists = $true
      break
    }
  }

  if ($exists) {
    $updatePayload = @{
      displayName = $DisplayName
      password = $Password
      enabled = $true
      roles = $Roles
    }
    $encodedUsername = [uri]::EscapeDataString($Username)
    $updateResp =
      Invoke-E2EApi -Context $Context `
        -Method "Put" `
        -Path "/api/v1/admin/users/$encodedUsername" `
        -Token $adminToken `
        -Body $updatePayload
    if ($updateResp.status -ne 200) {
      throw "update e2e user failed: username=$Username, status=$($updateResp.status)"
    }
    return
  }

  $createPayload = @{
    username = $Username
    displayName = $DisplayName
    password = $Password
    enabled = $true
    roles = $Roles
  }
  $createResp =
    Invoke-E2EApi -Context $Context `
      -Method "Post" `
      -Path "/api/v1/admin/users" `
      -Token $adminToken `
      -Body $createPayload
  if ($createResp.status -ne 200) {
    throw "create e2e user failed: username=$Username, status=$($createResp.status)"
  }
}

function Login-E2EToken {
  param(
    [hashtable]$Context,
    [string]$Username,
    [string]$Password
  )
  $body = @{ username = $Username; password = $Password } | ConvertTo-Json -Compress
  $response = Invoke-RestMethod -Method Post -Uri "$($Context.BaseUrl)/api/v1/auth/login" -ContentType "application/json" -Body $body
  return [string]$response.data.token
}

function Invoke-E2EApi {
  param(
    [hashtable]$Context,
    [string]$Method,
    [string]$Path,
    [string]$Token,
    [object]$Body = $null
  )

  $uri = "$($Context.BaseUrl)$Path"
  $headers = @{}
  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $jsonBody = $null
  if ($null -ne $Body) {
    $jsonBody = $Body | ConvertTo-Json -Compress -Depth 10
  }

  try {
    $response =
      if ($null -ne $jsonBody) {
        Invoke-WebRequest -Method $Method -Uri $uri -Headers $headers -ContentType "application/json" -Body $jsonBody -UseBasicParsing
      } else {
        Invoke-WebRequest -Method $Method -Uri $uri -Headers $headers -UseBasicParsing
      }

    $parsed = $null
    try {
      $parsed = $response.Content | ConvertFrom-Json -ErrorAction Stop
    } catch {
      $parsed = $null
    }

    return [PSCustomObject]@{
      status = [int]$response.StatusCode
      body = $parsed
      raw = $response.Content
    }
  } catch {
    $status = [int]$_.Exception.Response.StatusCode
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $raw = $reader.ReadToEnd()
    $parsed = $null
    try {
      $parsed = $raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
      $parsed = $null
    }
    return [PSCustomObject]@{
      status = $status
      body = $parsed
      raw = $raw
    }
  }
}

function Get-E2EMessage {
  param([object]$Response)
  if ($null -eq $Response) {
    return ""
  }
  if ($null -eq $Response.body) {
    return ""
  }
  $msg = [string]$Response.body.message
  if ([string]::IsNullOrWhiteSpace($msg)) {
    return ""
  }
  return $msg
}

function Add-E2EResult {
  param(
    [hashtable]$Context,
    [string]$CaseName,
    [string]$Expected,
    [string]$Actual,
    [bool]$Pass,
    [string]$Detail
  )
  $Context.Results.Add(
    [PSCustomObject]@{
      case = $CaseName
      expected = $Expected
      actual = $Actual
      pass = $Pass
      detail = $Detail
    }
  ) | Out-Null
}

function Complete-E2EResults {
  param([hashtable]$Context)

  $reportPath = $null
  $reportDir = [string]$Context.ReportDir
  if (-not [string]::IsNullOrWhiteSpace($reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    $stamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
    $safeSuite = [string]$Context.SuiteName -replace "[^a-zA-Z0-9._-]", "_"
    $reportPath = Join-Path $reportDir "$safeSuite-$stamp.json"
    $Context.Results | ConvertTo-Json -Depth 10 | Set-Content -Encoding UTF8 $reportPath
  }

  Write-Output ""
  Write-Output "==== $($Context.SuiteName) ===="
  $Context.Results | Format-Table -AutoSize
  if ($reportPath) {
    Write-Output "report=$reportPath"
  }

  $failed = @($Context.Results | Where-Object { -not $_.pass })
  if ($failed.Count -gt 0) {
    throw "$($Context.SuiteName) failed: $($failed.Count) case(s)."
  }

  Write-Output "$($Context.SuiteName) passed"
}
