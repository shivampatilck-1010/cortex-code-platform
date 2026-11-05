# Cortex Lockdown: Windows Installation & Setup Guide
## Institutional Demonstration and Controlled Lab Evaluation Baseline

### 1. Scope and Target Environments
This guide specifies the installation process for the Cortex Lockdown Windows desktop client (v1.0.0-hardened).

Operational boundaries must be clearly observed:
- **Private Academic Demonstration**: Local installation on demonstration workstations running standard user accounts.
- **College-Controlled Managed-Lab Evaluation**: Centralized silent deployment to domain-joined lab workstations.
- **Official Institutional Adoption**: Requires institutional Active Directory Group Policy (GPO), AppLocker XML enforcement, and university EV Authenticode code signing.

---

### 2. Distribution Package Information
The authoritative release package is distributed as a verified ZIP archive:
- **Archive Path**: `apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip`
- **Archive Size**: 18,700 bytes
- **Archive SHA-256**: `08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30`
- **Packaged Executable**: `CortexLockdown.exe` (Authoritative hardened build)
- **Executable Size**: 35,840 bytes
- **Executable SHA-256**: `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`

---

### 3. Prerequisites
- Windows 10 (version 20H2 or later) or Windows 11 x64.
- Microsoft .NET Framework 4.8 or later.
- Microsoft Edge WebView2 Evergreen Runtime.
- Standard user privileges (administrative elevation is not required for per-user installation).

---

### 4. Step-by-Step Installation

#### Method A: Interactive Demonstration Setup (Standard User)
1. Extract `CortexLockdown-Windows-x64.zip` to a local folder (e.g., `C:\Temp\CortexSetup`).
2. Double-click `install.bat`.
3. The installer executes the following sequence:
   - Verifies target directory `%LOCALAPPDATA%\CortexLockdown`.
   - Checks if an existing installation is newer (prevents silent downgrade/overwrite).
   - Copies `CortexLockdown.exe` into `%LOCALAPPDATA%\CortexLockdown`.
   - Registers the custom URI protocol handler `cortex-lockdown://` in `HKCU\Software\Classes\cortex-lockdown`.
   - Creates a Start Menu shortcut at `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Cortex Lockdown.lnk`.
4. Verify registration by entering `cortex-lockdown://launch` in Windows Run dialog (`Win + R`).

#### Method B: Institutional Silent Enterprise Deployment (Administrator)
For computer lab management systems (SCCM / Intune / GPO), execute the audited PowerShell script:
```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/deployment/Deploy-CortexLockdown.ps1" `
  -SourceZipPath "apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip" `
  -ExpectedZipHash "08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30" `
  -TargetDirectory "C:\Program Files\CortexLockdown" `
  -ExpectedExeHash "82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895"
```

---

### 5. Verification of Installation
Execute the following verification commands in PowerShell:
```powershell
# 1. Verify executable SHA-256
$exePath = "$env:LOCALAPPDATA\CortexLockdown\CortexLockdown.exe"
(Get-FileHash -Path $exePath -Algorithm SHA256).Hash
# Expected: 82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895

# 2. Verify Protocol Registration
Get-ItemProperty -Path "HKCU:\Software\Classes\cortex-lockdown\shell\open\command"
```

---

### 6. Uninstallation & Student Data Preservation
Run `uninstall.bat` from the extracted directory or `%LOCALAPPDATA%\CortexLockdown`:
1. Terminates any running `CortexLockdown` processes.
2. Removes custom protocol handlers from `HKCU\Software\Classes\cortex-lockdown`.
3. Removes the Start Menu shortcut.
4. Removes the application binary.
5. **Data Preservation Guarantee**: By default, `uninstall.bat` preserves all student examination files in `%LOCALAPPDATA%\CortexLockdown\SecureStorage` and `%LOCALAPPDATA%\CortexLockdown\SecureCache`. Candidate answer recovery files are never wiped during client uninstallation.
