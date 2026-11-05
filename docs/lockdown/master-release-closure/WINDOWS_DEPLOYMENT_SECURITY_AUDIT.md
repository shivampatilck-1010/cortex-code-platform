# CORTEX LOCKDOWN — WINDOWS DEPLOYMENT SECURITY AUDIT

Document Identifier: CL-MRE-DEP-01
Programme: Cortex Lockdown v1.0
Baseline: Release Candidate v1.0.0-rc3 (Master Programme Complete)
Target Environment: Managed Institutional Computer Labs, Windows 10 & 11 Enterprise / Education (x64)
Classification: Systems Engineering, Operating System Hardening & Security Audit

---

## 1. EXECUTIVE SUMMARY & THREAT METHODOLOGY

In an institutional environment, the software deployment mechanism is a primary attack surface. If an automated installation script allows path traversal (Zip Slip), insecure file permissions, untrusted binary execution, or unhandled installation rollbacks, student workstations can be compromised, allowing arbitrary code execution or local privilege escalation.

This audit evaluates the hardened enterprise deployment script ([`Deploy-CortexLockdown.ps1`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/scripts/deployment/Deploy-CortexLockdown.ps1)) and the scoped uninstallation script ([`Uninstall-CortexLockdown.ps1`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/scripts/deployment/Uninstall-CortexLockdown.ps1)).

---

## 2. DEPLOYMENT PIPELINE THREAT & CONTROL MATRIX

```
+-------------------------------------------------------------------------------------------------------+
|                                    DEPLOYMENT SECURITY CONTROL MATRIX                                 |
+-------------------------------------------------------------------------------------------------------+
| Threat Vector                  | Insecure Failure Mode          | Hardened Engineering Control        |
+--------------------------------+--------------------------------+-------------------------------------+
| 1. Tampered Distribution ZIP   | Malicious DLL/EXE executed     | Dual SHA-256 hash validation        |
| 2. Archive Path Traversal      | Overwriting Windows binaries   | Zip Slip canonical path check       |
| 3. Unsafe Temp Workspace       | Race condition / symlink hijack| Unique GUID temp directory          |
| 4. Insecure File Permissions   | Student replaces executable    | Strict NTFS ACLs (Users: RX only)   |
| 5. Malicious Protocol Args     | Arbitrary shell execution      | Quoted path & explicit URI parameter|
| 6. Interrupted Installation    | Broken system state            | Automated transactional rollback    |
| 7. Destructive Uninstallation  | Deleting student databases     | Preserves LocalAppData by default   |
+-------------------------------------------------------------------------------------------------------+
```

---

## 3. AUDIT OF HARDENED DEPLOYMENT CONTROLS (`Deploy-CortexLockdown.ps1`)

### 3.1. Dual Cryptographic Verification
The deployment script enforces two independent cryptographic checkpoints prior to copying any file to the production destination:
1. **Source Package Verification**: Computes the SHA-256 digest of `CortexLockdown-Windows-x64.zip` and asserts equality against `24E47B83D02EB3D2F9E1DE4BA84F8CD5B7A8EF363F1C29E22F80BE93480FA995`.
2. **Payload Executable Verification**: Computes the SHA-256 digest of extracted `CortexLockdown.exe` and asserts equality against `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`.
If either check fails, the script halts immediately with Exit Code 1.

### 3.2. Archive Path Traversal (Zip Slip) Defense
Malicious zip archives can contain entries with relative path components (e.g., `../../../../Windows/System32/evil.dll`).
The script implements a canonical path prefix test for every entry:
```powershell
$canonicalTemp = [System.IO.Path]::GetFullPath($tempDir)
if (-not $destinationPath.StartsWith($canonicalTemp, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Security Exception: Archive entry '${entry.FullName}' attempts directory traversal outside target!"
}
```
Any entry resolving outside the isolated temporary directory raises a fatal terminating security exception.

### 3.3. Restrictive NTFS Access Control List (ACL) Hardening
Standard users in institutional computer labs must not possess write or modify permissions over the executable or its directory:
```powershell
& icacls "$TargetDirectory" /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" "Users:(OI)(CI)RX"
```
- Inheritance is completely stripped (`/inheritance:r`).
- `SYSTEM` and `Administrators` are granted Full Control (`F`).
- Standard `Users` are granted strictly Read & Execute (`RX`) permissions on the folder, subfolders (`OI`), and files (`CI`).
- Result: Standard non-administrator students cannot rename, delete, replace, or inject DLLs into `C:\Program Files\CortexLockdown\`.

### 3.4. Transactional Rollback Architecture
If target directory `C:\Program Files\CortexLockdown` already exists:
1. The script backs up the existing installation to a temporary rollback directory (`cortex_rollback_<GUID>`).
2. If file copy or permission setting fails, the script automatically restores the original installation and cleans up before exiting with Exit Code 4.
3. Upon successful installation, the rollback directory is purged.

---

## 4. AUDIT OF SCOPED UNINSTALLATION (`Uninstall-CortexLockdown.ps1`)

Insecure uninstallers frequently execute broad recursive deletions (e.g., `Remove-Item "C:\Program Files\*"` or wildcards in user profiles).
`Uninstall-CortexLockdown.ps1` implements strict safety scoping:
1. **Directory Name Assertion**: Verifies that the target directory leaf is strictly named `CortexLockdown` before invoking removal.
2. **Clean Registry Deregistration**: Deletes only `HKLM:\SOFTWARE\Classes\cortex-lockdown`.
3. **Student Answer Preservation**: Offline SQLite answer databases stored in `%LOCALAPPDATA%\CortexLockdown\` are **preserved by default**. Removal requires an explicit `-PurgeUserData` administrative switch.

---

## 5. EXIT CODE TAXONOMY

Both scripts adhere to standard enterprise exit codes for integration into MECM/SCCM, Microsoft Intune, and PDQ Deploy:

| Exit Code | Semantic Meaning | Action Required |
|---|---|---|
| **0** | Success | Deployment/Uninstallation completed and verified. |
| **1** | Cryptographic Integrity Failure | Source ZIP or extracted EXE hash mismatch; investigate tampering. |
| **2** | File Not Found | Specified source ZIP package could not be resolved. |
| **3** | Insufficient Privileges | Script was not executed in an elevated Administrator session. |
| **4** | Deployment Error (Rolled Back) | Copy failure; original state restored via transactional rollback. |
| **5** | Path Safety Violation | Uninstaller target path does not match `CortexLockdown`. |

---

## 6. AUDIT CONCLUSION & CERTIFICATION

The hardened deployment and uninstallation scripts satisfy all institutional requirements for automated, secure, and resilient enterprise rollouts.
