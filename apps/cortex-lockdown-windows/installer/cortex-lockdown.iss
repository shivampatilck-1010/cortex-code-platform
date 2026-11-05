; CORTEX LOCKDOWN INNO SETUP SCRIPT
; Builds CortexLockdown-Setup.exe for Windows 10/11 x64

[Setup]
AppId={{9F82C5D4-7381-4C5A-9E9C-A0F7E91D3C42}
AppName=Cortex Lockdown
AppVersion=1.0.0-alpha3
AppPublisher=Cortex Online Examination System
AppPublisherURL=https://cortex-code-platform.cortexbuild1.workers.dev
AppSupportURL=https://cortex-code-platform.cortexbuild1.workers.dev/lockdown/download
AppUpdatesURL=https://cortex-code-platform.cortexbuild1.workers.dev/lockdown/download
DefaultDirName={autopf}\CortexLockdown
DisableProgramGroupPage=yes
LicenseFiles=
OutputDir=..\dist
OutputBaseFilename=CortexLockdown-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\bin\CortexLockdown.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\Cortex Lockdown"; Filename: "{app}\CortexLockdown.exe"
Name: "{autodesktop}\Cortex Lockdown"; Filename: "{app}\CortexLockdown.exe"; Tasks: desktopicon

[Registry]
; Register custom protocol cortex-lockdown://
Root: HKCU; Subkey: "Software\Classes\cortex-lockdown"; ValueType: string; ValueName: ""; ValueData: "URL:Cortex Lockdown Secure Protocol"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\cortex-lockdown"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\cortex-lockdown\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\CortexLockdown.exe"",0"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\cortex-lockdown\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\CortexLockdown.exe"" ""%1"""; Flags: uninsdeletekey

[Run]
Filename: "{app}\CortexLockdown.exe"; Description: "{cm:LaunchProgram,Cortex Lockdown}"; Flags: nowait postinstall skipifsilent
