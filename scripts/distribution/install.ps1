param(
    [Parameter(Mandatory = $true)][string]$Version,
    [string]$DataPath = "$env:ProgramData\ARENAX",
    [string]$MediaPath = "$env:ProgramData\ARENAX\media"
)

. (Join-Path $PSScriptRoot "common.ps1")
$root = Get-ArenaXRoot
$environmentFile = Join-Path $root ".env"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker com Compose é um pré-requisito. Instale-o e execute novamente."
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

Invoke-ArenaXCompose $root pull
Invoke-ArenaXCompose $root up -d

$initialOwnerEmail = "admin@local.com"
$initialOwnerPassword = "Arenax@Temp!2026"
$previousInitialUserPassword = [Environment]::GetEnvironmentVariable("ARENAX_INITIAL_USER_PASSWORD", "Process")
try {
    $env:ARENAX_INITIAL_USER_PASSWORD = $initialOwnerPassword
    Invoke-ArenaXCompose $root run --rm -e ARENAX_INITIAL_USER_PASSWORD api python -m arenax.cli.create_user `
        --nome "Administrador" `
        --email $initialOwnerEmail `
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
}

Write-Output "ARENAX $Version instalada."
Write-Output "Usuario inicial: $initialOwnerEmail"
Write-Output "Senha temporaria: $initialOwnerPassword"
Write-Output "Troque a senha temporaria apos o primeiro acesso."
