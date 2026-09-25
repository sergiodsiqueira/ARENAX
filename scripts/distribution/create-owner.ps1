param([string]$Name = "Proprietário", [Parameter(Mandatory = $true)][string]$Email)

. (Join-Path $PSScriptRoot "common.ps1")
$root = Get-ArenaXRoot
Invoke-ArenaXCompose -Root $root -Arguments @(
    "run",
    "--rm",
    "api",
    "python",
    "-m",
    "arenax.cli.create_user",
    "--nome",
    $Name,
    "--email",
    $Email,
    "--papel",
    "proprietario"
)
