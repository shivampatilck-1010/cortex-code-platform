# CORTEX LOCKDOWN RC1.2 - INSTALLATION GUIDE

Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10 (21H2+) / Windows 11 64-bit (Build 22000+)  
Architecture: x86_64 (AMD64)  
Zero Emojis Enforced: Yes  
Code Signing Status: Unsigned Evaluation Release (No commercial code signing certificate claimed; INR 0 budget)  

---

## 1. Cryptographic Checksum & Provenance Verification

Before staging or executing any binary on an evaluation workstation, verify the SHA-256 digest using Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\CortexLockdown-Hardened.exe
```

Authoritative SHA-256 Digests:
- Production Hardened Release Binary:
  `CortexLockdown-Hardened.exe`
  `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`
- Portable Distribution Archive:
  `CortexLockdown-Windows-x64.zip`
  `08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30`
- Baseline Demonstration Binary:
  `CortexLockdown.exe`
  `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`

Confirm that the output matches this exact string before proceeding.

---

## 2. Institutional Staging & Deployment Options

### Option A: Portable Demonstration on IT-Authorized Testbed (Recommended for Faculty Review)
1. Extract `CortexLockdown-Windows-x64.zip` to a dedicated local directory:
   `C:\Program Files\CortexLockdown` or `%LOCALAPPDATA%\Programs\CortexLockdown`.
2. Ensure the demonstration machine is an **institution-approved test workstation** where campus IT has authorized the binary hash or path via WDAC or AppLocker.
3. Launch `CortexLockdown-Hardened.exe` directly.

### Option B: Administrative Managed Lab Installation
1. Open Windows PowerShell as Administrator on the designated lab machine.
2. Execute the administrative installer script:
   ```powershell
   powershell.exe -ExecutionPolicy Bypass -File .\installer\build-installer.ps1
   ```
3. The script verifies prerequisites, registers the local execution path, and creates the desktop shortcut.

---

## 3. Windows SmartScreen & Institutional Security Policy

- **Unsigned Binary Notice:** Cortex Lockdown RC1.2 is an unsigned release candidate developed under an INR 0 expenditure constraint. No commercial Authenticode Extended Validation (EV) certificate has been purchased.
- **SmartScreen Behavior:** On unmanaged Windows workstations, Windows Defender SmartScreen will present an "Unrecognized app" dialogue due to the absence of commercial certificate reputation.
- **Mandatory Institutional Policy:** Evaluators, faculty, and students must **NEVER** be instructed to bypass SmartScreen or click "Run Anyway" on unmanaged personal machines. Staging and evaluation must take place exclusively on dedicated test machines pre-authorized by institutional IT via local policy or hash allowlisting.
- **Campus IT Guidance:** See `IT_PREAUTHORIZATION_GUIDE.md` for complete technical procedures to allowlist the binary hash in AppLocker, Windows Defender Application Control (WDAC), or Group Policy.
- **Production Rollout Prerequisite:** Production campus-wide deployment requires procurement of an EV Code Signing Certificate or distribution via Microsoft Intune / SCCM trusted corporate roots.

---

## 4. Hardware & Software Prerequisites
- Physical x64 hardware with at least 4 CPU cores and 4 GB RAM.
- Microsoft Edge WebView2 Evergreen Runtime (pre-installed natively on modern Windows 10/11).
- Single physical monitor connected directly to the primary GPU. Secondary displays, video splitters, and external capture hardware are not supported and will be flagged.
- Standard integrated or USB webcam and microphone for proctoring checks.
