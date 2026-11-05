# CORTEX LOCKDOWN — UNINSTALLATION & SANITIZATION GUIDE

**Target Environment:** Windows 10 & 11 (x64) Institutional Baseline  
**Strictly Zero Emojis Enforced:** Yes  

---

## 1. Automated Uninstallation Procedure

To remove Cortex Lockdown from a student or lab workstation:

1. Close all active examination windows.
2. Navigate to the installation directory (`%LOCALAPPDATA%\CortexLockdown`).
3. Run `uninstall.bat`.

The uninstaller script performs:
- Deletion of custom URI protocol `HKCU\Software\Classes\cortex-lockdown`.
- Removal of the Start Menu shortcut (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Cortex Lockdown.lnk`).
- Removal of the Desktop shortcut if present.
- Removal of application binaries (`CortexLockdown.exe`, `sha256.txt`).

---

## 2. Examination Data Preservation & Sanitization Policy

### Data Preservation Default
`uninstall.bat` explicitly checks for the existence of `%LOCALAPPDATA%\CortexLockdown\SecureStorage`.
- If local offline encrypted student journals exist, the uninstaller **preserves** the `SecureStorage` directory to safeguard student responses during active academic integrity review or appeal windows.
- Once academic verification is complete, administrators may manually purge the directory:
  ```powershell
  Remove-Item -Recurse -Force "$env:LOCALAPPDATA\CortexLockdown\SecureStorage"
  ```

---

## 3. Physical Solid-State Media Erasure Disclosure (DEF-RC1-007)

Modern solid-state drives (NVMe, SATA SSD, eMMC) utilize a Flash Translation Layer (FTL) that implements wear leveling and non-in-place block allocation. 

Deleting or zeroing files in user-space cannot guarantee physical bit-level destruction on flash NAND cells. Residual ciphertext blocks may persist until TRIM commands and hardware garbage collection cycles execute.

Post-examination confidentiality relies upon the **AES-256-GCM authenticated encryption barrier** rather than physical storage zeroing guarantees.
