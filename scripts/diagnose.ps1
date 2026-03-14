$ErrorActionPreference = 'Continue'

function Write-Section {
  param([string]$Title)

  if ($Title) {
    Write-Host $Title
  }
  Write-Host '----------------------------------------'
}

function Invoke-ExternalOrMessage {
  param(
    [scriptblock]$Script,
    [string]$FallbackMessage
  )

  try {
    & $Script
    if ($LASTEXITCODE -ne 0) {
      Write-Host $FallbackMessage
    }
  } catch {
    Write-Host $FallbackMessage
  }
}

function Test-CommandAvailable {
  param([string]$CommandName)

  return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

Write-Host '========================================'
Write-Host '  AuditWise Diagnostics'
Write-Host ("  {0}" -f [DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss UTC'))
Write-Host '========================================'
Write-Host ''

Write-Host '[1/5] Container Status'
if (Test-CommandAvailable 'docker') {
  Invoke-ExternalOrMessage { docker compose ps } 'docker compose not available'
} else {
  Write-Host 'docker not available'
}
Write-Host ''

Write-Host '[2/5] App Container Logs (last 200 lines)'
Write-Section
Invoke-ExternalOrMessage { docker logs auditwise-backend --tail 200 } 'Backend container not running'
Write-Host ''

Write-Host '[3/5] Frontend + Nginx Logs (last 100 lines each)'
Write-Section
Invoke-ExternalOrMessage { docker logs auditwise-frontend --tail 100 } 'Frontend container not running'
Write-Host ''
Invoke-ExternalOrMessage { docker logs auditwise-nginx --tail 100 } 'Nginx container not running'
Write-Host ''

Write-Host '[4/5] DB Container Logs (last 50 lines)'
Write-Section
Invoke-ExternalOrMessage { docker logs auditwise-db --tail 50 } 'Container not running'
Write-Host ''

Write-Host '[5/5] Docker Build Cache'
Write-Section
Invoke-ExternalOrMessage { docker system df } 'Docker not available'
Write-Host ''

Write-Host '========================================'
Write-Host '  Diagnostics complete'
Write-Host '========================================'