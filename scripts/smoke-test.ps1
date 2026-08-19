[CmdletBinding()]
param(
    [string]$BaseUrl = "http://localhost:8000/api/v1",
    [int]$ReplayTimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"

function Resolve-DockerCommand {
    $command = Get-Command docker -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $localDocker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
    if (Test-Path -LiteralPath $localDocker) {
        return $localDocker
    }

    throw "Docker CLI not found. Start Docker Desktop and reopen the terminal."
}

function Invoke-ArenaxApi {
    param(
        [Parameter(Mandatory)] [ValidateSet("Get", "Post")] [string]$Method,
        [Parameter(Mandatory)] [string]$Path,
        [hashtable]$Body,
        [hashtable]$Headers = @{}
    )

    $parameters = @{
        Method      = $Method
        Uri         = "$BaseUrl$Path"
        Headers     = $Headers
        ContentType = "application/json"
    }
    if ($Body) {
        $parameters.Body = $Body | ConvertTo-Json -Depth 6
    }
    if ($script:webSession) {
        $parameters.WebSession = $script:webSession
    }

    Invoke-RestMethod @parameters
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$docker = Resolve-DockerCommand
$runId = [guid]::NewGuid().ToString("N")
$sourceName = "smoke-source-$runId.mp4"
$sourcePath = Join-Path $repositoryRoot "media\$sourceName"
$replayPath = $null
$bufferDirectory = $null
$healthPath = $null
$person = $null
$space = $null
$camera = $null
$session = $null
$event = $null
$idempotencyKey = $null
$userEmail = "smoke-user-$runId@arenax.local"
$smokePassword = "Smoke-$runId-Aa1!"
$script:webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Push-Location $repositoryRoot
try {
    Write-Host "Starting ARENAX stack..."
    & $docker compose up --build -d
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed to start." }

    $healthDeadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
    do {
        try {
            $health = Invoke-ArenaxApi -Method Get -Path "/health"
        }
        catch {
            $health = $null
        }
        if (-not $health -or $health.status -ne "ok") { Start-Sleep -Seconds 1 }
    } until (($health -and $health.status -eq "ok") -or [DateTimeOffset]::UtcNow -ge $healthDeadline)
    if (-not $health -or $health.status -ne "ok") { throw "API did not become healthy." }

    $env:ARENAX_INITIAL_USER_PASSWORD = $smokePassword
    & $docker compose run --rm -e ARENAX_INITIAL_USER_PASSWORD api python `
        -m arenax.cli.create_user --nome "Smoke Test User" --email $userEmail --papel proprietario
    Remove-Item Env:ARENAX_INITIAL_USER_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw "Smoke User creation failed." }
    $authenticated = Invoke-ArenaxApi -Method Post -Path "/auth/login" -Body @{
        email = $userEmail
        password = $smokePassword
        remember = $false
    }
    if ($authenticated.user.email -ne $userEmail) { throw "Authentication failed." }

    Write-Host "Running API tests inside Docker..."
    & $docker compose run --rm api pytest -q
    if ($LASTEXITCODE -ne 0) { throw "API tests failed." }
    & $docker compose run --rm capture-service pytest -q
    if ($LASTEXITCODE -ne 0) { throw "Capture Service tests failed." }
    & $docker compose run --rm replay-worker pytest -q
    if ($LASTEXITCODE -ne 0) { throw "Replay Worker tests failed." }

    Write-Host "Generating synthetic camera source..."
    $ffmpegCommand = "ffmpeg -y -f lavfi -i testsrc=size=320x240:rate=10 -t 3 -c:v mpeg4 -g 10 /media/$sourceName >/dev/null 2>&1"
    & $docker compose exec -T replay-worker sh -c $ffmpegCommand
    if ($LASTEXITCODE -ne 0) { throw "Synthetic video generation failed." }

    $person = Invoke-ArenaxApi -Method Post -Path "/people" -Body @{
        name = "Smoke Test Person $runId"
    }
    $space = Invoke-ArenaxApi -Method Post -Path "/spaces" -Body @{
        name = "Smoke Test Space $runId"
    }

    $camera = Invoke-ArenaxApi -Method Post -Path "/equipments" -Body @{
        space_id     = $space.id
        kind         = "camera"
        external_id  = "smoke-camera-$runId"
        configuration = @{ capture_url = "/media/$sourceName"; loop = $true }
    }
    $healthPath = Join-Path $repositoryRoot "media\capture-health\$($camera.id).json"

    $deviceExternalId = "smoke-ax-$runId"
    Invoke-ArenaxApi -Method Post -Path "/equipments" -Body @{
        space_id      = $space.id
        kind          = "ax_device"
        external_id   = $deviceExternalId
        configuration = @{}
    } | Out-Null

    $now = [DateTimeOffset]::UtcNow
    $session = Invoke-ArenaxApi -Method Post -Path "/sessions" -Body @{
        responsible_person_id = $person.id
        space_ids             = @($space.id)
        scheduled_start       = $now.AddMinutes(-5).ToString("o")
        scheduled_end         = $now.AddMinutes(55).ToString("o")
    }
    $started = Invoke-ArenaxApi -Method Post -Path "/sessions/$($session.id)/actions/start"
    if ($started.status -ne "in_progress") { throw "Session did not start." }

    $bufferDeadline = [DateTimeOffset]::UtcNow.AddSeconds(20)
    $bufferDirectory = Join-Path $repositoryRoot "media\buffers\$($camera.id)"
    do {
        Start-Sleep -Seconds 1
        $bufferSegments = @(Get-ChildItem -LiteralPath $bufferDirectory -Filter "*.mp4" -ErrorAction SilentlyContinue)
    } until ($bufferSegments.Count -gt 0 -or [DateTimeOffset]::UtcNow -ge $bufferDeadline)
    if ($bufferSegments.Count -eq 0) { throw "Capture Service did not produce buffered segments." }

    $idempotencyKey = "smoke-$runId"
    $eventBody = @{
        device_id = $deviceExternalId
        timestamp = [DateTimeOffset]::UtcNow.ToString("o")
    }
    $event = Invoke-ArenaxApi -Method Post -Path "/events/button-pressed" `
        -Headers @{ "Idempotency-Key" = $idempotencyKey } -Body $eventBody
    if (-not $event.accepted -or $event.reason -ne "moment_requested") {
        throw "Physical event was not accepted: $($event.reason)"
    }

    $repeatedEvent = Invoke-ArenaxApi -Method Post -Path "/events/button-pressed" `
        -Headers @{ "Idempotency-Key" = $idempotencyKey } -Body $eventBody
    if ($repeatedEvent.reason -ne "already_processed" -or $repeatedEvent.moment_id -ne $event.moment_id) {
        throw "Idempotency validation failed."
    }

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($ReplayTimeoutSeconds)
    do {
        Start-Sleep -Seconds 1
        $dossier = Invoke-ArenaxApi -Method Get -Path "/sessions/$($session.id)"
        $timelineKinds = @($dossier.timeline | ForEach-Object { $_.kind })
        if ($timelineKinds -contains "ReplayGenerationFailed") {
            throw "Replay Worker reported ReplayGenerationFailed."
        }
    } until (($timelineKinds -contains "ReplayGenerated") -or [DateTimeOffset]::UtcNow -ge $deadline)

    if ($timelineKinds -notcontains "ReplayGenerated") {
        throw "Replay was not generated within $ReplayTimeoutSeconds seconds."
    }
    if (@($dossier.moments).Count -ne 1) { throw "Expected exactly one Moment." }

    $replayPath = Join-Path $repositoryRoot "media\replays\$($event.moment_id).mp4"
    if (-not (Test-Path -LiteralPath $replayPath)) { throw "Replay file was not created." }
    if ((Get-Item -LiteralPath $replayPath).Length -eq 0) { throw "Replay file is empty." }

    Write-Host "Smoke test passed."
    [pscustomobject]@{
        session_id    = $session.id
        moment_id     = $event.moment_id
        replay_status = "generated"
        idempotency   = "verified"
    } | Format-List
}
finally {
    Remove-Item Env:ARENAX_INITIAL_USER_PASSWORD -ErrorAction SilentlyContinue
    if ($session -and $event -and $space -and $person) {
        $cleanupSql = @"
DELETE FROM caixa_de_saida WHERE agregado_id = '$($event.moment_id)';
DELETE FROM linha_do_tempo WHERE sessao_id = '$($session.id)';
DELETE FROM eventos_fisicos WHERE chave_idempotencia = '$idempotencyKey';
DELETE FROM momentos WHERE sessao_id = '$($session.id)';
DELETE FROM sessao_espacos WHERE sessao_id = '$($session.id)';
DELETE FROM sessoes WHERE id = '$($session.id)';
DELETE FROM equipamentos WHERE espaco_id = '$($space.id)';
DELETE FROM espacos WHERE id = '$($space.id)';
DELETE FROM pessoas WHERE id = '$($person.id)';
"@
        & $docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U arenax -d arenax -c $cleanupSql | Out-Null
        Start-Sleep -Seconds 6
    }
    $userCleanupSql = @"
DELETE FROM acessos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email = '$userEmail');
DELETE FROM usuarios WHERE email = '$userEmail';
"@
    & $docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U arenax -d arenax -c $userCleanupSql | Out-Null
    if (Test-Path -LiteralPath $sourcePath) {
        Remove-Item -LiteralPath $sourcePath -Force
    }
    if ($replayPath -and (Test-Path -LiteralPath $replayPath)) {
        Remove-Item -LiteralPath $replayPath -Force
    }
    if ($bufferDirectory -and (Test-Path -LiteralPath $bufferDirectory)) {
        foreach ($file in Get-ChildItem -LiteralPath $bufferDirectory -File) {
            Remove-Item -LiteralPath $file.FullName -Force
        }
        Remove-Item -LiteralPath $bufferDirectory -Force
    }
    if ($healthPath -and (Test-Path -LiteralPath $healthPath)) {
        Remove-Item -LiteralPath $healthPath -Force
    }
    Pop-Location
}
