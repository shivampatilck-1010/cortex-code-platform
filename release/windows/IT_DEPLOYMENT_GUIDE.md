# CORTEX LOCKDOWN — CAMPUS IT PRE-AUTHORIZATION & DEPLOYMENT GUIDE

**Target Environment:** Windows 10/11 x64 Institutional Computer Labs  
**Strictly Zero Emojis Enforced:** Yes  
**Additional Budget Expended:** INR 0  

---

## 1. Executive Summary for Campus IT Leadership

Cortex Lockdown is a specialized examination security desktop client designed for collegiate assessment testing. Under the project's **INR 0 budget constraint**, application binaries are compiled without a paid Authenticode code signing certificate.

As a result, executing the application on unmanaged Windows workstations will trigger **Microsoft Defender SmartScreen** unrecognized publisher warnings.

### Institutional Policy Mandate
- **Campus IT policies strictly prohibit instructing students or faculty to click "Run Anyway" or bypass SmartScreen.**
- Campus IT departments must pre-authorize the verified binary SHA-256 hash in institutional endpoint management systems (Microsoft Intune, SCCM, AppLocker, or WDAC) prior to student testing.

---

## 2. Cryptographic Binary Hash Register

| Artifact | Filename | SHA-256 Hash |
| :--- | :--- | :--- |
| **Portable ZIP** | `CortexLockdown-Windows-x64.zip` | `08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30` |
| **Hardened Binary** | `CortexLockdown-Hardened.exe` | `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895` |
| **Baseline Binary** | `CortexLockdown.exe` | `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466` |

---

## 3. Automated Pre-Authorization Commands

### 3.1 AppLocker Hash Rule (PowerShell Administrative Console)
```powershell
New-AppLockerPolicy -RuleType Hash -User Everyone `
  -FileInformation (Get-AppLockerFileInformation -Path "C:\CortexLockdown\CortexLockdown-Hardened.exe") `
  -RuleName "Allow Cortex Lockdown Hardened Demonstration Binary" `
  -Xml | Set-AppLockerPolicy -Merge
```

### 3.2 Windows Defender Application Control (WDAC) Code Integrity Rule
```powershell
New-CIPolicyRule -Level FilePublisher -DriverFilePath "C:\CortexLockdown\CortexLockdown-Hardened.exe" `
  -Fallback Hash -UserPEs
```

### 3.3 PowerShell NTFS Zone Identifier Removal
If downloading via a web browser, remove the Mark-of-the-Web to prevent SmartScreen triggers on managed devices:
```powershell
Unblock-File -Path "C:\CortexLockdown\CortexLockdown-Hardened.exe"
```

### 3.4 Microsoft Intune Detection Rule
- **Rule Type:** File.
- **Path:** `%ProgramFiles%\CortexLockdown` or `%LOCALAPPDATA%\CortexLockdown`.
- **File or Folder:** `CortexLockdown-Hardened.exe`.
- **Detection Method:** File exists and SHA-256 hash equals `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`.
