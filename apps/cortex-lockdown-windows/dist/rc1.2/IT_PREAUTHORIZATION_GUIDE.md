# CORTEX LOCKDOWN RC1.2 - CAMPUS IT PRE-AUTHORIZATION & DEPLOYMENT GUIDE

Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10 (21H2+) / Windows 11 (Build 22000+)  
Classification: Enterprise / Campus IT Administrator Guide  
Zero Emojis Enforced: Yes  
Code Signing Status: Unsigned Evaluation Release (No commercial code signing certificate claimed; INR 0 budget)  

---

## 1. Executive Summary & Security Compliance

Cortex Lockdown RC1.2 is an evaluation release developed under a strict INR 0 external expenditure constraint. As a result, the release binaries are not signed with a commercial Authenticode Extended Validation (EV) certificate.

On standard, unmanaged Windows installations, Windows Defender SmartScreen will present an "Unrecognized app" dialogue due to the absence of commercial certificate reputation.

**Institutional Policy Principle:**
Campus IT policies strictly prohibit instructing students or faculty to click "Run Anyway" or bypass SmartScreen warnings. To conduct safe demonstrations, pilot evaluations, or lab tests, campus IT administrators must pre-authorize the application executable on designated test hardware using standard Windows enterprise control mechanisms.

---

## 2. Cryptographic Binary Hash Baseline

Authoritative SHA-256 Hashes for Pre-Authorization Rules:

- **Primary Hardened Binary:**
  Path: `apps/cortex-lockdown-windows/bin/CortexLockdown-Hardened.exe`
  SHA-256: `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`

- **Portable Archive:**
  Path: `apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip`
  SHA-256: `08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30`

- **Baseline Demonstration Binary:**
  Path: `apps/cortex-lockdown-windows/bin/CortexLockdown.exe`
  SHA-256: `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`

---

## 3. Pre-Authorization Deployment Methods

### Method 1: AppLocker Hash Rule (Group Policy / Local Security Policy)

AppLocker is the standard Windows mechanism for controlling executable execution in managed campus labs.

1. Open **Local Security Policy** (`secpol.msc`) or your domain Group Policy Object (GPO).
2. Navigate to:
   `Application Control Policies` -> `AppLocker` -> `Executable Rules`.
3. Right-click and select **Create New Rule**.
4. Set Action to **Allow** for the designated evaluator user group (e.g., `Domain Users` or `LabEvaluators`).
5. Choose **File Hash** as the condition.
6. Browse to `CortexLockdown-Hardened.exe` or enter the authoritative SHA-256 hash:
   `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`
7. Name the rule `Cortex Lockdown RC1.2 Authorized Hash Rule` and click **Create**.
8. Run `gpupdate /force` on the target workstations.

### Method 2: Windows Defender Application Control (WDAC) Policy

For organizations utilizing WDAC code integrity policies:

1. Generate a supplemental WDAC policy from the binary hash:
```powershell
# Open PowerShell as Administrator
$binaryPath = "C:\LabSoftware\CortexLockdown-Hardened.exe"
$rule = New-CIPolicyRule -DriverFilePath $binaryPath -Level Hash
New-CIPolicy -FilePath "C:\WDAC\CortexLockdownPolicy.xml" -Rules $rule -UserPEs
ConvertFrom-CIPolicy -XmlFilePath "C:\WDAC\CortexLockdownPolicy.xml" -BinaryFilePath "C:\Windows\System32\CodeIntegrity\CiPolicies\Active\CortexLockdown.cip"
```
2. Reboot the workstation or refresh code integrity policies. The unsigned binary will execute without SmartScreen or AppLocker interference.

### Method 3: Dedicated Standalone Test Workstation (PowerShell Unblock)

For one-off isolated evaluations on a standalone physical laptop in an IT test lab:

1. Download or transfer `CortexLockdown-Windows-x64.zip` to `C:\Testbed\`.
2. Verify the hash matches:
```powershell
Get-FileHash -Algorithm SHA256 "C:\Testbed\CortexLockdown-Windows-x64.zip"
```
3. Remove the NTFS zone identifier mark-of-the-web attribute from the archive:
```powershell
Unblock-File -Path "C:\Testbed\CortexLockdown-Windows-x64.zip"
```
4. Extract the archive:
```powershell
Expand-Archive -Path "C:\Testbed\CortexLockdown-Windows-x64.zip" -DestinationPath "C:\Testbed\Extracted\" -Force
```
5. Remove zone identifiers from all extracted binaries:
```powershell
Get-ChildItem -Path "C:\Testbed\Extracted" -Recurse | Unblock-File
```
6. The application can now be launched directly on the testbed workstation without SmartScreen interruption, while keeping Windows Defender real-time protection fully active.

### Method 4: Microsoft Intune / MECM (SCCM) Lab Deployment

1. Package `CortexLockdown-Windows-x64.zip` using Microsoft Win32 Content Prep Tool (`IntuneWinAppUtil.exe`).
2. Set install command:
   `powershell.exe -ExecutionPolicy Bypass -File .\install.ps1`
3. Configure Detection Rule:
   - Type: File
   - Path: `C:\Program Files\CortexLockdown`
   - File: `CortexLockdown-Hardened.exe`
   - Detection Method: SHA-256 Hash check matching `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`.
4. Target the deployment to designated Computer Lab groups.

---

## 4. Institutional Pilot & Production Roadmap

- **Supervised Institutional Pilot:** Permitted ONLY after completing one of the above IT pre-authorization procedures on institutional hardware.
- **Production Enterprise Rollout:** Prior to expanding beyond controlled pilot labs to open student BYOD (Bring-Your-Own-Device), the institution must procure a commercial Authenticode EV certificate or integrate an internal Enterprise Root CA signing pipeline into the automated build process.
