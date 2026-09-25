param(
    [Parameter(Mandatory = $true)][string]$Version,
    [switch]$SkipPreflight,
    [switch]$AllowRegistryPull
)

. (Join-Path $PSScriptRoot "common.ps1")
$root = Get-ArenaXRoot
$environmentFile = Join-Path $root ".env"
$environment = Read-ArenaXEnvironment $root
if (-not $environment.ContainsKey("ARENAX_VERSION")) {
    throw "Instalacao ARENAX nao encontrada."
}
$previousVersion = $environment["ARENAX_VERSION"]

if (-not $SkipPreflight) {
    & (Join-Path $PSScriptRoot "preflight.ps1") -SkipPortCheck
    if ($LASTEXITCODE -ne 0) { throw "Pre-requisitos ARENAX nao atendidos." }
}

Import-ArenaXImages $root
if ($AllowRegistryPull) {
    Invoke-ArenaXCompose -Root $root -Arguments @("pull", "postgres")
}
Invoke-ArenaXCompose -Root $root -Arguments @("up", "-d", "postgres")
Wait-ArenaXPostgres $root
Sync-ArenaXPostgresPassword $root
Assert-NoActiveSession $root
$backup = Backup-ArenaXDatabase $root
try {
    Set-ArenaXEnvironmentValue $environmentFile "ARENAX_VERSION" $Version
    if ($AllowRegistryPull) {
        Invoke-ArenaXCompose -Root $root -Arguments @("pull")
    }
    Invoke-ArenaXCompose -Root $root -Arguments @("run", "--rm", "migrate")
    Invoke-ArenaXCompose -Root $root -Arguments @("up", "-d")
} catch {
    Set-ArenaXEnvironmentValue $environmentFile "ARENAX_VERSION" $previousVersion
    try { Invoke-ArenaXCompose -Root $root -Arguments @("up", "-d") } catch { Write-Warning "A versao anterior exige recuperacao manual." }
    throw "Atualizacao interrompida. A versao anterior foi restaurada e o backup esta em $backup. $($_.Exception.Message)"
}
Write-Output "ARENAX atualizada de $previousVersion para $Version. Backup: $backup"
