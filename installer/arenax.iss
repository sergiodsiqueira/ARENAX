#ifndef MyAppVersion
  #define MyAppVersion "0.0.0-dev"
#endif

#define MyAppName "ARENAX"
#define MyAppPublisher "ARENAX"
#define MyAppId "B5ECA6D9-7F1D-4EA4-B32E-B522DE180A41"

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
Source: "images\*.tar"; DestDir: "{app}\images"; Flags: ignoreversion skipifsourcedoesntexist
Source: "assets\arenax-ti-install-guide.html"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\scripts\distribution\preflight.ps1"; Flags: dontcopy

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\distribution\install.ps1"" -Version ""{#MyAppVersion}"" -OwnerFile ""{code:GetOwnerFile}"" -SkipPreflight"; StatusMsg: "Instalando ARENAX... acompanhe os detalhes na janela do PowerShell."; Flags: waituntilterminated; Check: ShouldInstallFresh
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\distribution\update.ps1"" -Version ""{#MyAppVersion}"" -SkipPreflight"; StatusMsg: "Atualizando ARENAX... acompanhe os detalhes na janela do PowerShell."; Flags: waituntilterminated; Check: ShouldUpdateExisting
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\services\local-agent\install.ps1"""; StatusMsg: "Instalando Agente Local... acompanhe os detalhes na janela do PowerShell."; Flags: waituntilterminated

[Icons]
Name: "{group}\ARENAX"; Filename: "http://localhost"
Name: "{group}\Guia de Instalacao para TI"; Filename: "{app}\docs\arenax-ti-install-guide.html"; Check: GuideExists
Name: "{group}\Criar Proprietario"; Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\distribution\create-owner.ps1"""

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\distribution\uninstall.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopArenaX"

[Code]
var
  OwnerPage: TInputQueryWizardPage;
  ExistingInstall: Boolean;
  OwnerFilePath: String;

function JsonEscape(Value: String): String;
begin
  StringChangeEx(Value, '\', '\\', True);
  StringChangeEx(Value, '"', '\"', True);
  StringChangeEx(Value, #13, '', True);
  StringChangeEx(Value, #10, '\n', True);
  Result := Value;
end;

function PreviousInstallDir(var Directory: String): Boolean;
var
  Subkey: String;
begin
  Subkey := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{' + '{#MyAppId}' + '}_is1';
  Result := RegQueryStringValue(HKLM, Subkey, 'InstallLocation', Directory);
  if not Result then
    Result := RegQueryStringValue(HKCU, Subkey, 'InstallLocation', Directory);
end;

function DetectExistingInstall(): Boolean;
var
  Directory: String;
begin
  Result := False;
  if PreviousInstallDir(Directory) then
    Result := FileExists(AddBackslash(Directory) + '.env');
end;

function RunPreflight(): Boolean;
var
  ResultCode: Integer;
  Parameters: String;
begin
  ExtractTemporaryFile('preflight.ps1');
  Parameters := '-NoProfile -ExecutionPolicy Bypass -File "' +
    ExpandConstant('{tmp}\preflight.ps1') + '"';
  if ExistingInstall then
    Parameters := Parameters + ' -SkipPortCheck';

  Result := Exec('powershell.exe', Parameters, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if (not Result) or (ResultCode <> 0) then begin
    MsgBox(
      'A instalacao da ARENAX requer WSL2 e Docker Desktop instalados, configurados com WSL2 e em execucao.' + #13#10#13#10 +
      'Abra o Docker Desktop, aguarde a inicializacao completa e execute este instalador novamente.',
      mbCriticalError,
      MB_OK
    );
    Result := False;
  end;
end;

function InitializeSetup(): Boolean;
begin
  ExistingInstall := DetectExistingInstall();
  Result := RunPreflight();
end;

procedure InitializeWizard();
begin
  ExistingInstall := DetectExistingInstall();
  if ExistingInstall then begin
    MsgBox(
      'Uma instalacao existente da ARENAX foi encontrada. Este instalador fara uma atualizacao, preservando banco de dados, configuracoes e Replays.',
      mbInformation,
      MB_OK
    );
  end else begin
    OwnerPage := CreateInputQueryPage(
      wpSelectDir,
      'Primeiro acesso',
      'Informe o Proprietario inicial da ARENAX',
      'Este usuario sera criado apos o banco de dados inicial ser preparado.'
    );
    OwnerPage.Add('Nome do Proprietario:', False);
    OwnerPage.Add('E-mail:', False);
    OwnerPage.Add('Senha:', True);
    OwnerPage.Add('Confirmar senha:', True);
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (not ExistingInstall) and (OwnerPage <> nil) and (CurPageID = OwnerPage.ID) then begin
    if Trim(OwnerPage.Values[0]) = '' then begin
      MsgBox('Informe o nome do Proprietario.', mbError, MB_OK);
      Result := False;
    end else if Pos('@', OwnerPage.Values[1]) = 0 then begin
      MsgBox('Informe um e-mail valido para o Proprietario.', mbError, MB_OK);
      Result := False;
    end else if Length(OwnerPage.Values[2]) < 12 then begin
      MsgBox('A senha do Proprietario deve ter pelo menos 12 caracteres.', mbError, MB_OK);
      Result := False;
    end else if OwnerPage.Values[2] <> OwnerPage.Values[3] then begin
      MsgBox('A confirmacao da senha nao confere.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function GetOwnerFile(Param: String): String;
var
  Json: String;
begin
  if OwnerFilePath = '' then begin
    OwnerFilePath := ExpandConstant('{tmp}\arenax-owner.json');
    Json := '{' +
      '"name":"' + JsonEscape(OwnerPage.Values[0]) + '",' +
      '"email":"' + JsonEscape(OwnerPage.Values[1]) + '",' +
      '"password":"' + JsonEscape(OwnerPage.Values[2]) + '"' +
      '}';
    SaveStringToFile(OwnerFilePath, Json, False);
  end;
  Result := OwnerFilePath;
end;

function ShouldInstallFresh(): Boolean;
begin
  Result := not ExistingInstall;
end;

function ShouldUpdateExisting(): Boolean;
begin
  Result := ExistingInstall;
end;

function GuideExists(): Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\docs\arenax-ti-install-guide.html'));
end;
