Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ArenaXRoot {
    return (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
}

function Read-ArenaXEnvironment {
    param([string]$Root)
    $values = @{}
    $path = Join-Path $Root ".env"
    if (Test-Path -LiteralPath $path) {
        foreach ($line in Get-Content -LiteralPath $path) {
            if ($line -match '^([^#=]+)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
        }
    }
    return $values
}

function New-ArenaXSecret {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

function Set-ArenaXEnvironmentValue {
    param([string]$Path, [string]$Name, [string]$Value)
    $lines = if (Test-Path -LiteralPath $Path) { @(Get-Content -LiteralPath $Path) } else { @() }
    $setting = "$Name=$Value"
    $found = $false
    $updated = @(foreach ($line in $lines) {
        if ($line -match "^$([regex]::Escape($Name))=") { $found = $true; $setting } else { $line }
    })
    if (-not $found) { $updated += $setting }
    [IO.File]::WriteAllLines($Path, $updated, [Text.UTF8Encoding]::new($false))
}

function Invoke-ArenaXCompose {
    param([string]$Root, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & docker compose --project-directory $Root -f (Join-Path $Root "docker-compose.production.yml") @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose falhou (código $LASTEXITCODE)." }
}

function Assert-NoActiveSession {
    param([string]$Root)
    $result = & docker compose --project-directory $Root -f (Join-Path $Root "docker-compose.production.yml") exec -T postgres psql -U arenax -d arenax -tAc "SELECT count(*) FROM sessoes WHERE status = 'in_progress'" 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Não foi possível confirmar se há Sessão em andamento." }
    if ([int]($result.Trim()) -gt 0) { throw "Atualização bloqueada: existe uma Sessão em andamento." }
}

function Backup-ArenaXDatabase {
    param([string]$Root)
    $environment = Read-ArenaXEnvironment $Root
    $backupDirectory = Join-Path $environment["ARENAX_DATA_PATH"] "backups"
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    $path = Join-Path $backupDirectory ("arenax-{0}.sql" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
    & docker compose --project-directory $Root -f (Join-Path $Root "docker-compose.production.yml") exec -T postgres pg_dump -U arenax -d arenax --clean --if-exists | Out-File -LiteralPath $path -Encoding utf8
    if ($LASTEXITCODE -ne 0) { throw "O backup do PostgreSQL falhou." }
    return $path
}
