param(
    [int]$HttpPort = 80,
    [switch]$SkipPortCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail-Preflight {
    param([string]$Message)
    Write-Error $Message
    exit 1
}

if (-not [Environment]::Is64BitOperatingSystem) {
    Fail-Preflight "ARENAX requer Windows 64 bits."
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Fail-Preflight "WSL2 nao encontrado. Instale o WSL2 antes de executar o instalador."
}

& wsl.exe --status *> $null
if ($LASTEXITCODE -ne 0) {
    Fail-Preflight "WSL2 nao esta pronto. Abra o WSL uma vez e conclua a configuracao."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail-Preflight "Docker Desktop nao encontrado. Instale o Docker Desktop com suporte a WSL2."
}

& docker version *> $null
if ($LASTEXITCODE -ne 0) {
    Fail-Preflight "Docker nao esta em execucao. Abra o Docker Desktop e aguarde o daemon iniciar."
}

& docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
    Fail-Preflight "Docker Compose nao esta disponivel. Atualize ou reinstale o Docker Desktop."
}

if (-not $SkipPortCheck) {
    $portInUse = Get-NetTCPConnection -LocalPort $HttpPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($portInUse) {
        Fail-Preflight "A porta HTTP $HttpPort ja esta em uso. Libere a porta ou use outra configuracao."
    }
}

Write-Output "Pre-requisitos ARENAX validados."
