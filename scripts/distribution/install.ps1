param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$DataPath = "$env:ProgramData\ARENAX",
    [string]$MediaPath = "$env:ProgramData\ARENAX\media",
    [string]$OwnerFile = "",
    [switch]$SkipPreflight,
    [switch]$AllowRegistryPull
)

. (Join-Path $PSScriptRoot "common.ps1")
$root = Get-ArenaXRoot
$environmentFile = Join-Path $root ".env"

if (Test-ArenaXInstalled $root) {
    throw "Instalacao ARENAX existente encontrada. Execute update.ps1 para atualizar sem tocar nos dados."
}

if (-not $SkipPreflight) {
    & (Join-Path $PSScriptRoot "preflight.ps1")
    if ($LASTEXITCODE -ne 0) { throw "Pre-requisitos ARENAX nao atendidos." }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker com Compose e um pre-requisito. Instale-o e execute novamente."
}

if ([string]::IsNullOrWhiteSpace($OwnerFile) -or -not (Test-Path -LiteralPath $OwnerFile)) {
    throw "Arquivo do Proprietario inicial nao encontrado."
}

$owner = Get-Content -Raw -LiteralPath $OwnerFile | ConvertFrom-Json
$ownerName = [string]$owner.name
$ownerEmail = [string]$owner.email
$ownerPassword = [string]$owner.password
if ([string]::IsNullOrWhiteSpace($ownerName) -or [string]::IsNullOrWhiteSpace($ownerEmail) -or [string]::IsNullOrWhiteSpace($ownerPassword)) {
    throw "Nome, e-mail e senha do Proprietario inicial sao obrigatorios."
}

New-Item -ItemType Directory -Path $DataPath -Force | Out-Null
New-Item -ItemType Directory -Path $MediaPath -Force | Out-Null
Set-ArenaXEnvironmentValue $environmentFile "ARENAX_VERSION" $Version
Set-ArenaXEnvironmentValue $environmentFile "ARENAX_IMAGE_REGISTRY" "ghcr.io/sergiodsiqueira"
Set-ArenaXEnvironmentValue $environmentFile "ARENAX_DATA_PATH" ($DataPath.Replace('\', '/'))
Set-ArenaXEnvironmentValue $environmentFile "ARENAX_MEDIA_PATH" ($MediaPath.Replace('\', '/'))

$existing = Read-ArenaXEnvironment $root
foreach ($name in @("ARENAX_POSTGRES_PASSWORD", "ARENAX_LIVE_PATH_SECRET", "ARENAX_HOST_AGENT_SECRET")) {
    if (-not $existing.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($existing[$name])) {
        Set-ArenaXEnvironmentValue $environmentFile $name (New-ArenaXSecret)
    }
}

Import-ArenaXImages $root
if ($AllowRegistryPull) {
    Invoke-ArenaXCompose $root pull
}

Invoke-ArenaXCompose $root up -d postgres
Invoke-ArenaXCompose $root run --rm migrate

$previousInitialUserPassword = [Environment]::GetEnvironmentVariable("ARENAX_INITIAL_USER_PASSWORD", "Process")
try {
    $env:ARENAX_INITIAL_USER_PASSWORD = $ownerPassword
    Invoke-ArenaXCompose $root run --rm -e ARENAX_INITIAL_USER_PASSWORD api python -m arenax.cli.create_user `
        --nome $ownerName `
        --email $ownerEmail `
        --papel proprietario `
        --ignorar-se-existe
}
finally {
    if ($null -eq $previousInitialUserPassword) {
        Remove-Item Env:ARENAX_INITIAL_USER_PASSWORD -ErrorAction SilentlyContinue
    }
    else {
        $env:ARENAX_INITIAL_USER_PASSWORD = $previousInitialUserPassword
    }
    if (-not [string]::IsNullOrWhiteSpace($OwnerFile)) {
        Remove-Item -LiteralPath $OwnerFile -Force -ErrorAction SilentlyContinue
    }
}

Invoke-ArenaXCompose $root up -d

Write-Output "ARENAX $Version instalada."
Write-Output "Usuario inicial: $ownerEmail"
