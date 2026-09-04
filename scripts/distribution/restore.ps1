param([Parameter(Mandatory = $true)][string]$Backup)

. (Join-Path $PSScriptRoot "common.ps1")
$root = Get-ArenaXRoot
$backupPath = (Resolve-Path -LiteralPath $Backup).Path
$confirmation = Read-Host "A restauração substitui o banco atual. Digite RESTAURAR"
if ($confirmation -cne "RESTAURAR") { throw "Restauração cancelada." }

Invoke-ArenaXCompose $root stop api capture-service replay-worker
Get-Content -Raw -LiteralPath $backupPath | & docker compose --project-directory $root -f (Join-Path $root "docker-compose.production.yml") exec -T postgres psql -v ON_ERROR_STOP=1 -U arenax -d arenax
if ($LASTEXITCODE -ne 0) { throw "A restauração do PostgreSQL falhou; os serviços permaneceram parados." }
Invoke-ArenaXCompose $root up -d
Write-Output "Banco restaurado de $backupPath."
