param([int]$Port = 8765)

$ErrorActionPreference = "Stop"
$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Execute a instalação da ARENAX como Administrador."
}

$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$environmentFile = Join-Path $workspace ".env"
$lines = if (Test-Path -LiteralPath $environmentFile) { @(Get-Content -LiteralPath $environmentFile) } else { @() }
$secretLine = $lines | Where-Object { $_ -match '^ARENAX_HOST_AGENT_SECRET=' } | Select-Object -First 1
$secret = if ($secretLine) { $secretLine.Substring($secretLine.IndexOf('=') + 1) } else { "" }
if ([string]::IsNullOrWhiteSpace($secret)) {
    $random = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($random)
    $secret = [Convert]::ToBase64String($random)
    $setting = "ARENAX_HOST_AGENT_SECRET=$secret"
    $replaced = $false
    $updated = @(foreach ($line in $lines) {
        if ($line -match '^ARENAX_HOST_AGENT_SECRET=') { $replaced = $true; $setting } else { $line }
    })
    if (-not $replaced) { $updated += $setting }
    [IO.File]::WriteAllLines($environmentFile, $updated, [Text.UTF8Encoding]::new($false))
}

$prefix = "http://*:$Port/"
& netsh http delete urlacl url=$prefix 2>$null | Out-Null
& netsh http add urlacl url=$prefix user="$env:USERDOMAIN\$env:USERNAME" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Não foi possível autorizar a comunicação com o Agente Local." }

$ruleName = "ARENAX Local Agent"
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -Profile Private | Out-Null

$agentScript = Join-Path $PSScriptRoot "arenax-local-agent.ps1"
$taskArguments = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$agentScript`" -Workspace `"$workspace`" -Secret `"$secret`" -Port $Port"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $taskArguments
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "ARENAX Local Agent" -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "ARENAX Local Agent"

docker compose --project-directory $workspace up -d --force-recreate api
if ($LASTEXITCODE -ne 0) { throw "O agente foi instalado, mas a API não pôde ser atualizada." }
Write-Output "Agente Local da ARENAX instalado e iniciado."
