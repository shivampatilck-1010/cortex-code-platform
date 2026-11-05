# CORTEX LOCKDOWN RC1.2 - UNINSTALLATION & SANITIZATION GUIDE

Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10/11 x64  
Classification: Administrator Decommissioning & Cleanup Procedure  
Zero Emojis Enforced: Yes  

---

## 1. Portable Demonstration Teardown

If Cortex Lockdown was executed from the portable ZIP extraction directory:

1. Close the application normally via post-exam exit or the proctor emergency override.
2. Verify that the application process has terminated:
   ```powershell
   Get-Process -Name "CortexLockdown*", "CortexLockdown-Hardened*" -ErrorAction SilentlyContinue
   ```
3. Delete the extracted application folder:
   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Programs\CortexLockdown" -ErrorAction SilentlyContinue
   ```

---

## 2. Managed Lab Uninstallation

If the application was deployed using the administrative installer:

1. Open Windows PowerShell as Administrator.
2. Run the uninstaller batch script if present in the installation directory:
   ```powershell
   & "C:\Program Files\CortexLockdown\uninstall.bat"
   ```
3. Or manually remove the application directory and shortcuts:
   ```powershell
   Remove-Item -Recurse -Force "C:\Program Files\CortexLockdown" -ErrorAction SilentlyContinue
   Remove-Item -Force "$env:PUBLIC\Desktop\Cortex Lockdown.lnk" -ErrorAction SilentlyContinue
   Remove-Item -Force "$env:ALLUSERSPROFILE\Microsoft\Windows\Start Menu\Programs\Cortex Lockdown.lnk" -ErrorAction SilentlyContinue
   ```

---

## 3. Windows Registry Restoration Verification

During normal execution, Cortex Lockdown secures user-mode controls. Upon normal termination, all controls are automatically restored. In the event of an ungraceful crash, verify and restore system policy keys:

```powershell
# Verify Task Manager policy restoration
$policyPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System"
if (Test-Path $policyPath) {
    Remove-ItemProperty -Path $policyPath -Name "DisableTaskMgr" -ErrorAction SilentlyContinue
}

# Remove custom protocol handler registration if configured
$protocolPath = "HKCU:\Software\Classes\cortex-lockdown"
if (Test-Path $protocolPath) {
    Remove-Item -Recurse -Force $protocolPath -ErrorAction SilentlyContinue
}
```

---

## 4. Local Answer Cache & Session Sanitization

Cortex Lockdown stores temporary encrypted session states in:
`%LOCALAPPDATA%\CortexLockdown\secure-cache\`

To purge all local caches manually:
```powershell
$cachePath = "$env:LOCALAPPDATA\CortexLockdown"
if (Test-Path $cachePath) {
    Remove-Item -Recurse -Force $cachePath
    Write-Host "Local session cache successfully purged."
}
```

---

## 5. SSD / NAND Flash Wear-Leveling Deletion Disclosure (`DEF-RC1-007`)

- **Technical Context:** The built-in `clearEncryptedAnswers()` routine performs user-space byte zeroing followed by standard operating system file unlinking (`fs.unlinkSync()`).
- **Physical NAND Limitation:** On modern solid-state drives (NVMe, SSD, eMMC), the Flash Translation Layer (FTL) employs dynamic wear-leveling algorithms and out-of-place block writes. User-space file overwriting allocates a new physical NAND page and flags the prior page as stale. Bit-level physical destruction cannot be guaranteed by software alone until the drive controller executes background TRIM and garbage collection cycles.
- **Cryptographic Protection Assurance:** Candidate data confidentiality does NOT depend upon physical bit erasure. Answers stored on local disk are encrypted with **AES-256-GCM** using PBKDF2 key derivation (100,000 iterations) salted with unique exam and candidate session identifiers. Any residual stale NAND blocks remain cryptographically unrecoverable ciphertext.
