# CORTEX LOCKDOWN — INSTALLATION & DEPLOYMENT GUIDE

**Target Environment:** Windows 10 Version 1809 (Build 17763)+ / Windows 11 (64-bit x64)  
**Strictly Zero Emojis Enforced:** Yes  
**Additional Budget Expended:** INR 0  

---

## 1. Important SmartScreen & Code Signing Notice

Cortex Lockdown application binaries are compiled under an explicit **INR 0 project budget constraint** and are not signed with a commercial Authenticode Extended Validation (EV) certificate. 

When downloaded and executed on unmanaged personal Windows computers, **Microsoft Defender SmartScreen will display an unrecognized application warning**.

### Mandatory Policy
- **DO NOT** instruct candidates, faculty, or evaluators to click "Run Anyway" or bypass SmartScreen prompts.
- All institutional demonstrations, evaluations, and student pilots must occur on **campus IT pre-authorized workstations** where administrative policies (AppLocker or WDAC) pre-authorize the verified binary SHA-256 hash.

---

## 2. Standard Installation Workflow (Single User)

1. **Download Archive:**
   Download `CortexLockdown-Windows-x64.zip` from the campus assessment portal.
2. **Verify SHA-256 Digest:**
   In PowerShell:
   ```powershell
   Get-FileHash CortexLockdown-Windows-x64.zip -Algorithm SHA256
   ```
   Confirm the output matches exactly:
   `08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30`
3. **Extract Archive:**
   Extract contents to `%LOCALAPPDATA%\CortexLockdown` or a local destination folder.
4. **Execute Installer:**
   Run `install.bat`. The script performs:
   - Verification of .NET Framework 4.8+ and Microsoft Edge WebView2 runtime.
   - Version comparison to prevent downgrades.
   - Registration of the `cortex-lockdown://` custom URI scheme in HKCU.
   - Creation of the Start Menu shortcut.
   - Generation of `%LOCALAPPDATA%\CortexLockdown\install.log`.
5. **Launch Assessment:**
   Navigate to the Cortex web portal and click "Launch Assessment in Cortex Lockdown". The browser triggers `cortex-lockdown://launch` and opens the native kiosk window.

---

## 3. Campus IT Managed Deployment (AppLocker & WDAC)

For computer labs and multi-seat classrooms, administrators should deploy Cortex Lockdown via Group Policy or Microsoft Intune:

### 3.1 AppLocker Hash Rule (PowerShell)
```powershell
New-AppLockerPolicy -RuleType Hash -User Everyone `
  -FileInformation (Get-AppLockerFileInformation -Path "C:\CortexLockdown\CortexLockdown.exe") `
  -RuleName "Allow Cortex Lockdown Hardened Demonstration Binary" `
  -Xml | Set-AppLockerPolicy -Merge
```

### 3.2 Remove Mark-of-the-Web (NTFS Alternate Data Stream)
```powershell
Unblock-File -Path "C:\CortexLockdown\CortexLockdown.exe"
```
