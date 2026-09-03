param(
    [Parameter(Mandatory = $true)]
    [string]$Workspace,
    [Parameter(Mandatory = $true)]
    [string]$Secret,
    [int]$Port = 8765
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
$resolvedWorkspace = (Resolve-Path -LiteralPath $Workspace).Path
$configureScript = Join-Path $resolvedWorkspace "scripts\configure-storage.ps1"
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://*:$Port/")

function Send-Json {
    param($Response, [int]$StatusCode, $Payload)
    $json = $Payload | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "application/json; charset=utf-8"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.Close()
}

function Test-Authorization {
    param($Request)
    $header = $Request.Headers["Authorization"]
    return $header -ceq "Bearer $Secret"
}

function Test-StoragePath {
    param([string]$Path)
    if (-not [System.IO.Path]::IsPathRooted($Path)) {
        throw "Escolha uma pasta local com caminho completo."
    }
    $target = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetPathRoot($target)
    if ($target -eq $root -or $target -eq $resolvedWorkspace) {
        throw "Escolha uma pasta dedicada aos Replays da ARENAX."
    }
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    $probe = Join-Path $target ".arenax-write-test"
    [System.IO.File]::WriteAllText($probe, "ok")
    Remove-Item -LiteralPath $probe
    return $target
}

$listener.Start()
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            if (-not (Test-Authorization $context.Request)) {
                Send-Json $context.Response 401 @{ message = "Acesso não autorizado." }
                continue
            }

            $route = $context.Request.Url.AbsolutePath.TrimEnd("/")
            if ($context.Request.HttpMethod -eq "GET" -and $route -eq "/status") {
                Send-Json $context.Response 200 @{ status = "ready"; version = "1" }
                continue
            }

            if ($context.Request.HttpMethod -eq "GET" -and $route -eq "/network-interfaces") {
                $interfaces = @(Get-NetIPConfiguration | Where-Object {
                    $_.NetAdapter.Status -eq "Up" -and $_.IPv4Address
                } | ForEach-Object {
                    $configuration = $_
                    $configuration.IPv4Address | Where-Object {
                        $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*"
                    } | ForEach-Object {
                        @{
                            id = [string]$configuration.InterfaceIndex
                            name = [string]$configuration.InterfaceAlias
                            address = [string]$_.IPAddress
                        }
                    }
                } | Sort-Object name, address)
                Send-Json $context.Response 200 @{ interfaces = $interfaces }
                continue
            }

            if ($context.Request.HttpMethod -eq "POST" -and $route -eq "/select-folder") {
                $dialog = [System.Windows.Forms.FolderBrowserDialog]::new()
                $dialog.Description = "Escolha onde os Replays da ARENAX serão armazenados"
                $dialog.ShowNewFolderButton = $true
                $result = $dialog.ShowDialog()
                if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
                    Send-Json $context.Response 200 @{ path = $null; cancelled = $true }
                } else {
                    $target = Test-StoragePath $dialog.SelectedPath
                    Send-Json $context.Response 200 @{ path = $target; cancelled = $false }
                }
                $dialog.Dispose()
                continue
            }

            if ($context.Request.HttpMethod -eq "POST" -and $route -eq "/apply-storage") {
                $reader = [System.IO.StreamReader]::new($context.Request.InputStream, $context.Request.ContentEncoding)
                $payload = $reader.ReadToEnd() | ConvertFrom-Json
                $reader.Dispose()
                $target = Test-StoragePath ([string]$payload.path)
                Send-Json $context.Response 202 @{ accepted = $true; path = $target }
                $arguments = @(
                    "-NoProfile", "-ExecutionPolicy", "Bypass",
                    "-File", ('"' + $configureScript + '"'),
                    "-Path", ('"' + $target + '"')
                )
                Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WindowStyle Hidden
                continue
            }

            Send-Json $context.Response 404 @{ message = "Operação não encontrada." }
        } catch {
            if ($context.Response.OutputStream.CanWrite) {
                Send-Json $context.Response 422 @{ message = $_.Exception.Message }
            }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
