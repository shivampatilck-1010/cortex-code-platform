# CORTEX LOCKDOWN — DISTRIBUTION, UPDATE & ROLLBACK GUIDE

**Document Version:** 1.0.0-rc1.2  
**Strictly Zero Emojis Enforced:** Yes  

---

## 1. Distribution & Update Architecture

Under the current INR 0 budget constraint, Cortex Lockdown does not implement an automated background self-updater. Automated self-updaters in Windows environments require cryptographically signed binary packages with verified code signing certificates to prevent arbitrary code execution vulnerabilities.

### Safe Update Protocol
All updates are distributed as versioned, immutable packages verified against published SHA-256 digests.

---

## 2. Standard Upgrade Workflow

To upgrade an existing Cortex Lockdown installation on a student or lab workstation:

1. **Verify Running State:** Ensure Cortex Lockdown is closed and no examination sessions are active.
2. **Download Target Package:** Download the new release archive (`CortexLockdown-Windows-x64.zip`) from the authoritative campus distribution endpoint.
3. **Validate SHA-256 Digest:** Confirm the downloaded archive matches the published hash:
   ```powershell
   Get-FileHash CortexLockdown-Windows-x64.zip -Algorithm SHA256
   ```
4. **Execute Upgrader:**
   Run `install.bat` from the new package.
   - The installer checks the existing binary version in `%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe`.
   - If the new package has a higher file version, it safely replaces the binary while preserving the student offline journal store (`%LOCALAPPDATA%\CortexLockdown\SecureStorage`).
   - If the installed version is newer, the installer preserves the installed version and logs the event to `install.log`.

---

## 3. Rollback Procedure

If a release demonstrates unforeseen hardware incompatibilities in a specific computer laboratory:

1. Terminate all active client sessions.
2. Run `uninstall.bat` to clear the protocol registry and shortcut mappings.
3. Extract the previously certified release archive (e.g., RC1.2 baseline).
4. Run `install.bat` from the prior release package to restore the previous known-good binary.
5. Offline student journals in `SecureStorage` remain untouched throughout the rollback.
