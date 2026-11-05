# CORTEX LOCKDOWN RC1 - INSTALLATION GUIDE

Package Version: 1.0.0-rc1  
Target Operating System: Microsoft Windows 10 (21H2+) / Windows 11 64-bit (Build 22000+)  
Architecture: x86_64 (AMD64)  
Zero Emojis Enforced: Yes  
Code Signing Status: Unsigned Evaluation Release (No commercial code signing certificate claimed; INR 0 budget)  

---

## 1. Checksum & Provenance Verification

Before staging or executing any binary, verify the SHA-256 digest using Windows PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\CortexLockdown-Hardened.exe
```

Expected Digest:
`82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`

Confirm that the output matches this exact string before proceeding.

---

## 2. Institutional Staging & Deployment Options

### Option A: Portable Demonstration on IT-Authorized Testbed (Recommended for Faculty Review)
1. Extract `CortexLockdown-Windows-x64.zip` to a clean local directory:
   `C:\Program Files\CortexLockdown` or `%LOCALAPPDATA%\Programs\CortexLockdown`.
2. Ensure the demonstration machine is an **institution-approved test workstation** where campus IT has authorized the binary path or hash.
3. Launch `CortexLockdown-Hardened.exe` directly.

### Option B: Administrative Managed Lab Installation
1. Open Windows PowerShell as Administrator on the designated lab machine.
2. Run `install.bat` from the unpacked archive `installer/` directory.
3. The script verifies prerequisites, registers the local execution path, and creates the desktop shortcut.

---

## 3. Windows SmartScreen & Code Signing Policy

- **Unsigned Binary Notice:** Cortex Lockdown RC1 is an unsigned release candidate developed under an INR 0 expenditure constraint. No commercial Authenticode certificate has been purchased.
- **SmartScreen Behavior:** On unmanaged Windows workstations, Windows Defender SmartScreen will present an "Unrecognized app" dialogue due to the absence of commercial certificate reputation.
- **Institutional Policy:** Evaluators and faculty must **never** be instructed to bypass SmartScreen or click "Run Anyway" on untrusted or personal machines. Staging and evaluation must take place on dedicated test machines pre-authorized by institutional IT via local policy or hash allowlisting.
- **Production Rollout Prerequisite:** Production campus-wide deployment requires procurement of an Extended Validation (EV) Code Signing Certificate or distribution via Microsoft Intune / SCCM trusted corporate roots.

---

## 4. Hardware & Software Prerequisites
- Physical x64 hardware with at least 4 CPU cores and 4 GB RAM.
- Microsoft Edge WebView2 Evergreen Runtime (pre-installed natively on modern Windows 10/11).
- Single physical monitor connected directly to the primary GPU. Secondary displays, video splitters, and external capture hardware are not supported.
- Standard USB or integrated webcam and microphone for proctoring checks.
