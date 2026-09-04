#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-dev"
#endif

#define MyAppName "ARENAX"
#define MyAppPublisher "ARENAX"

[Setup]
AppId={{B5ECA6D9-7F1D-4EA4-B32E-B522DE180A41}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\ARENAX
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=output
OutputBaseFilename=ArenaX-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
Uninstallable=yes

[Files]
Source: "..\docker-compose.production.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\docker\mediamtx.yml"; DestDir: "{app}\docker"; Flags: ignoreversion
Source: "..\scripts\distribution\*.ps1"; DestDir: "{app}\scripts\distribution"; Flags: ignoreversion
Source: "..\scripts\configure-storage.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\services\local-agent\*.ps1"; DestDir: "{app}\services\local-agent"; Flags: ignoreversion

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\distribution\install.ps1"" -Version ""{#MyAppVersion}"""; StatusMsg: "Iniciando ARENAX..."; Flags: runhidden waituntilterminated
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\services\local-agent\install.ps1"""; StatusMsg: "Instalando Agente Local..."; Flags: runhidden waituntilterminated

[Icons]
Name: "{group}\ARENAX"; Filename: "http://localhost"; Flags: shellexec
Name: "{group}\Criar primeiro Proprietário"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\distribution\create-owner.ps1"""

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\distribution\uninstall.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopArenaX"
