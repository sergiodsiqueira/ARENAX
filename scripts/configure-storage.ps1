param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$target = [System.IO.Path]::GetFullPath($Path)
$targetRoot = [System.IO.Path]::GetPathRoot($target)

if ($target -eq $targetRoot -or $target -eq $workspace) {
    throw "Escolha uma pasta dedicada para a mídia da ARENAX."
}

New-Item -ItemType Directory -Path $target -Force | Out-Null
$probe = Join-Path $target ".arenax-write-test"
[System.IO.File]::WriteAllText($probe, "ok")
Remove-Item -LiteralPath $probe

$environmentFile = Join-Path $workspace ".env"
$lines = if (Test-Path -LiteralPath $environmentFile) {
    @(Get-Content -LiteralPath $environmentFile)
} else {
    @()
}
$setting = "ARENAX_MEDIA_HOST_PATH=$($target.Replace('\', '/'))"
$replaced = $false
$configuredCurrentPath = ($lines | Where-Object { $_ -match '^ARENAX_MEDIA_HOST_PATH=' } | Select-Object -First 1) -replace '^ARENAX_MEDIA_HOST_PATH=', ''
$updated = @(foreach ($line in $lines) {
    if ($line -match '^ARENAX_MEDIA_HOST_PATH=') {
        $replaced = $true
        $setting
    } else {
        $line
    }
})
if (-not $replaced) { $updated += $setting }

$currentMedia = if ($configuredCurrentPath) {
    if ([System.IO.Path]::IsPathRooted($configuredCurrentPath)) {
        [System.IO.Path]::GetFullPath($configuredCurrentPath)
    } else {
        [System.IO.Path]::GetFullPath((Join-Path $workspace $configuredCurrentPath))
    }
} else {
    Join-Path $workspace "media"
}
$currentMedia = [System.IO.Path]::GetFullPath($currentMedia)
if ($target.StartsWith($currentMedia.TrimEnd('\') + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "A nova pasta não pode ficar dentro da pasta de mídia atual."
}

$previousEnvironment = if (Test-Path -LiteralPath $environmentFile) {
    [System.IO.File]::ReadAllText($environmentFile)
} else {
    $null
}
docker compose --project-directory $workspace stop capture-service replay-worker
if ($LASTEXITCODE -ne 0) { throw "Não foi possível pausar os processos de vídeo." }
if ((Test-Path -LiteralPath $currentMedia) -and ((Resolve-Path $currentMedia).Path -ne $target)) {
    Get-ChildItem -LiteralPath $currentMedia -Force | Copy-Item -Destination $target -Recurse -Force
}

[System.IO.File]::WriteAllLines($environmentFile, $updated, [System.Text.UTF8Encoding]::new($false))
docker compose --project-directory $workspace up -d --force-recreate api capture-service replay-worker
if ($LASTEXITCODE -ne 0) {
    if ($null -eq $previousEnvironment) {
        Remove-Item -LiteralPath $environmentFile -ErrorAction SilentlyContinue
    } else {
        [System.IO.File]::WriteAllText($environmentFile, $previousEnvironment, [System.Text.UTF8Encoding]::new($false))
    }
    docker compose --project-directory $workspace up -d --force-recreate api capture-service replay-worker
    throw "Não foi possível usar o novo armazenamento. A configuração anterior foi restaurada."
}

Write-Output "Armazenamento configurado em $target"
