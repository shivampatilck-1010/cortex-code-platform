# CORTEX LOCKDOWN RC1 - UNINSTALLATION GUIDE

Package Version: 1.0.0-rc1

## 1. Clean Removal Procedure

1. Terminate all active instances of `CortexLockdown-Hardened.exe` or `CortexLockdown.exe`.
2. If installed via administrative batch script, run `uninstall.bat` as Administrator from the installation directory.
3. Delete the application binaries and folders from `C:\Program Files\CortexLockdown` or `%LOCALAPPDATA%\Programs\CortexLockdown`.

## 2. Local Encrypted Cache Sanitization

Cortex Lockdown maintains an authenticated AES-256-GCM local journal for offline examination resilience. This cache is automatically scrubbed upon successful exam submission. To manually sanitize any residual data:

```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\CortexLockdown\SecureCache"
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\CortexLockdown\Logs"
```

## 3. Registry & Startup State

Cortex Lockdown does not register persistent autorun registry keys, background services, or device drivers. Zero persistent background hooks remain active after application termination.
