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
    return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
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
    param(
        [string]$Root,
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    & docker compose --project-directory $Root -f (Join-Path $Root "docker-compose.production.yml") @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose falhou (código $LASTEXITCODE)." }
}

function Wait-ArenaXPostgres {
    param([string]$Root)
    $arguments = @(
        "compose",
        "--project-directory",
        $Root,
        "-f",
        (Join-Path $Root "docker-compose.production.yml"),
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        "arenax",
        "-d",
        "arenax",
        "-tAc",
        "SELECT 1"
    )

    for ($attempt = 1; $attempt -le 60; $attempt++) {
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            $first = & docker @arguments 2>$null
            $firstExitCode = $LASTEXITCODE
        }
        catch {
            $first = ""
            $firstExitCode = 1
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        if ($firstExitCode -eq 0 -and $first.Trim() -eq "1") {
            Start-Sleep -Seconds 2
            $previousErrorActionPreference = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            try {
                $second = & docker @arguments 2>$null
                $secondExitCode = $LASTEXITCODE
            }
            catch {
                $second = ""
                $secondExitCode = 1
            }
            finally {
                $ErrorActionPreference = $previousErrorActionPreference
            }

            if ($secondExitCode -eq 0 -and $second.Trim() -eq "1") {
                return
            }
        }
        Start-Sleep -Seconds 2
    }

    throw "PostgreSQL da ARENAX nao ficou pronto para migrations."
}

function Sync-ArenaXPostgresPassword {
    param([string]$Root)
    $environment = Read-ArenaXEnvironment $Root
    if (-not $environment.ContainsKey("ARENAX_POSTGRES_PASSWORD") -or [string]::IsNullOrWhiteSpace($environment["ARENAX_POSTGRES_PASSWORD"])) {
        throw "ARENAX_POSTGRES_PASSWORD nao foi definida."
    }

    $password = $environment["ARENAX_POSTGRES_PASSWORD"].Replace("'", "''")
    $sql = "ALTER USER arenax WITH PASSWORD '$password';"
    & docker compose --project-directory $Root -f (Join-Path $Root "docker-compose.production.yml") exec -T postgres psql -U arenax -d arenax -c $sql
    if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel alinhar a senha do PostgreSQL da ARENAX." }
}

function Get-ArenaXImageDirectory {
    param([string]$Root)
    return Join-Path $Root "images"
}

function Import-ArenaXImages {
    param([string]$Root)
    $imageDirectory = Get-ArenaXImageDirectory $Root
    if (-not (Test-Path -LiteralPath $imageDirectory)) {
        Write-Output "Diretorio de imagens offline nao encontrado; usando imagens ja presentes ou registry configurado."
        return
    }

    $archives = @(Get-ChildItem -LiteralPath $imageDirectory -Filter "*.tar" -File | Sort-Object Name)
    if ($archives.Count -eq 0) {
        Write-Output "Nenhuma imagem offline encontrada em $imageDirectory."
        return
    }

    foreach ($archive in $archives) {
        Write-Output "Carregando imagem Docker: $($archive.Name)"
        & docker load --input $archive.FullName
        if ($LASTEXITCODE -ne 0) { throw "Falha ao carregar imagem Docker $($archive.Name)." }
    }
}

function Test-ArenaXInstalled {
    param([string]$Root)
    return Test-Path -LiteralPath (Join-Path $Root ".env")
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
