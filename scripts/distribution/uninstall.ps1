param([switch]$RemoveData)

. (Join-Path $PSScriptRoot "common.ps1")
$root = Get-ArenaXRoot
Invoke-ArenaXCompose $root down

if ($RemoveData) {
    $confirmation = Read-Host "Digite REMOVER DADOS para apagar banco, configurações e Replays"
    if ($confirmation -cne "REMOVER DADOS") { throw "Remoção de dados cancelada." }
    $environment = Read-ArenaXEnvironment $root
    foreach ($name in @("ARENAX_DATA_PATH", "ARENAX_MEDIA_PATH")) {
        if ($environment.ContainsKey($name)) {
            $target = [IO.Path]::GetFullPath($environment[$name])
            $programDataRoot = [IO.Path]::GetFullPath($env:ProgramData).TrimEnd('\') + '\'
            if (-not $target.StartsWith($programDataRoot, [StringComparison]::OrdinalIgnoreCase)) {
                throw "Recusa de segurança: $target está fora de ProgramData."
            }
            if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        }
    }
    Remove-Item -LiteralPath (Join-Path $root ".env") -Force -ErrorAction SilentlyContinue
}
Write-Output "Serviços removidos. Dados preservados: $(-not $RemoveData)."
