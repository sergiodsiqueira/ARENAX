param([Parameter(Mandatory = $true)][string]$Version)

. (Join-Path $PSScriptRoot "common.ps1")
$root = Get-ArenaXRoot
$environmentFile = Join-Path $root ".env"
$environment = Read-ArenaXEnvironment $root
if (-not $environment.ContainsKey("ARENAX_VERSION")) { throw "Instalação ARENAX não encontrada." }
$previousVersion = $environment["ARENAX_VERSION"]

Assert-NoActiveSession $root
$backup = Backup-ArenaXDatabase $root
try {
    Set-ArenaXEnvironmentValue $environmentFile "ARENAX_VERSION" $Version
    Invoke-ArenaXCompose $root pull
    Invoke-ArenaXCompose $root up -d
} catch {
    Set-ArenaXEnvironmentValue $environmentFile "ARENAX_VERSION" $previousVersion
    try { Invoke-ArenaXCompose $root up -d } catch { Write-Warning "A versão anterior exige recuperação manual." }
    throw "Atualização interrompida. A versão anterior foi restaurada e o backup está em $backup. $($_.Exception.Message)"
}
Write-Output "ARENAX atualizada de $previousVersion para $Version. Backup: $backup"
