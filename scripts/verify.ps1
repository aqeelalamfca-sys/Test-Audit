$ErrorActionPreference = 'Stop'

$pass = 0
$fail = 0

function Write-Pass($label) {
  Write-Host "  PASS  $label" -ForegroundColor Green
  $script:pass++
}

function Write-Fail($label) {
  Write-Host "  FAIL  $label" -ForegroundColor Red
  $script:fail++
}

function Invoke-Check {
  param(
    [string]$Label,
    [scriptblock]$Script
  )

  try {
    $result = & $Script
    if ($result) {
      Write-Pass $Label
    } else {
      Write-Fail $Label
    }
  } catch {
    Write-Fail $Label
  }
}

function Test-HttpStatus {
  param(
    [string]$Url,
    [int]$TimeoutSec = 5
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec -UseBasicParsing
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  } catch {
    return $false
  }
}

function Test-HttpContains {
  param(
    [string]$Url,
    [string]$Pattern,
    [int]$TimeoutSec = 5
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec -UseBasicParsing
    return $response.Content -match $Pattern
  } catch {
    return $false
  }
}

function Test-HttpsRedirect {
  param(
    [string]$Url,
    [int]$TimeoutSec = 5
  )

  try {
    Invoke-WebRequest -Uri $Url -Method Head -MaximumRedirection 0 -TimeoutSec $TimeoutSec -UseBasicParsing | Out-Null
    return $false
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) {
      return $false
    }

    $location = $response.Headers['Location']
    return $null -ne $location -and $location -match '^https://'
  }
}

function Test-DockerRunning {
  param([string]$ContainerName)

  $output = docker inspect --format="{{.State.Running}}" $ContainerName 2>$null
  return $LASTEXITCODE -eq 0 -and $output.Trim() -eq 'true'
}

function Test-DockerComposeRunning {
  $output = docker compose ps --status running -q 2>$null
  return $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($output)
}

function Test-PostgresReady {
  docker exec auditwise-db pg_isready -U auditwise -d auditwise *> $null
  return $LASTEXITCODE -eq 0
}

Write-Host '========================================'
Write-Host '  AuditWise Deployment Verification'
Write-Host ("  {0}" -f [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss UTC'))
Write-Host '========================================'
Write-Host ''

Write-Host '[1/4] Docker Status'
Invoke-Check 'docker compose running' { Test-DockerComposeRunning }
Invoke-Check 'auditwise-backend container up' { Test-DockerRunning 'auditwise-backend' }
Invoke-Check 'auditwise-frontend container up' { Test-DockerRunning 'auditwise-frontend' }
Invoke-Check 'auditwise-nginx container up' { Test-DockerRunning 'auditwise-nginx' }
Invoke-Check 'auditwise-db container up' { Test-DockerRunning 'auditwise-db' }
Write-Host ''

Write-Host '[2/4] Local Health Checks'
Invoke-Check 'GET backend /api/health (port 5000)' { Test-HttpStatus 'http://127.0.0.1:5000/api/health' 5 }
Invoke-Check 'GET /__healthz (liveness)' { Test-HttpStatus 'http://127.0.0.1:5000/__healthz' 5 }
Invoke-Check 'GET / returns HTML' { Test-HttpContains 'http://127.0.0.1:5000/' '<html' 5 }
Invoke-Check 'GET /login SPA route' { Test-HttpContains 'http://127.0.0.1:5000/login' '<html' 5 }
Invoke-Check 'GET /api/health/full (deep)' { Test-HttpStatus 'http://127.0.0.1:5000/api/health/full' 10 }
Invoke-Check 'GET nginx /api/health (port 80)' { Test-HttpStatus 'http://127.0.0.1/api/health' 5 }
Invoke-Check 'GET nginx / returns HTML' { Test-HttpContains 'http://127.0.0.1/' '<html' 5 }
Write-Host ''

Write-Host '[3/4] NGINX & SSL (skip if not on VPS)'
$domain = if ($env:DOMAIN) { $env:DOMAIN } else { 'auditwise.tech' }
$httpsHealthUrl = "https://{0}/api/health" -f $domain
$httpsHomeUrl = "https://{0}/" -f $domain
$httpHomeUrl = "http://{0}/" -f $domain
if (Test-HttpStatus -Url $httpsHealthUrl -TimeoutSec 5) {
  Invoke-Check ("HTTPS {0}/health" -f $domain) { Test-HttpStatus -Url $httpsHealthUrl -TimeoutSec 5 }
  Invoke-Check ("HTTPS {0}/ returns HTML" -f $domain) { Test-HttpContains -Url $httpsHomeUrl -Pattern '<html' -TimeoutSec 5 }
  Invoke-Check 'HTTP to HTTPS redirect' { Test-HttpsRedirect -Url $httpHomeUrl -TimeoutSec 5 }
} else {
  Write-Host '  SKIP  HTTPS checks (not reachable from this host)'
}
Write-Host ''

Write-Host '[4/4] Database'
Invoke-Check 'PostgreSQL accepting connections' { Test-PostgresReady }
Write-Host ''

Write-Host '========================================'
Write-Host ("  Results: {0} passed, {1} failed" -f $pass, $fail)
if ($fail -eq 0) {
  Write-Host '  ALL CHECKS PASSED' -ForegroundColor Green
} else {
  Write-Host '  SOME CHECKS FAILED' -ForegroundColor Red
}
Write-Host '========================================'

exit $fail