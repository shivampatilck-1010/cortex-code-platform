# CORTEX LOCKDOWN — ALPHA 8: OFFICIAL RELEASE MANIFEST

**Release Identifier**: `v1.0.0-rc3`  
**Distribution Channel**: Controlled Institutional Pilot (Staging)  
**Publication Date**: November 1, 2026  
**Target Platform**: Microsoft Windows 10/11 x64  
**Runtime Requirement**: Microsoft .NET Framework 4.8 or later  

---

## 1. Release Artifact Identity & Cryptographic Hashes

All distributed binary artifacts are immutably identified by their SHA-256 cryptographic digests:

| Artifact | Relative Path | File Size | Cryptographic SHA-256 Digest |
|---|---|---|---|
| **Standalone Executable** | [`apps/cortex-lockdown-windows/bin/CortexLockdown.exe`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/bin/CortexLockdown.exe) | 33,280 bytes | `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466` |
| **Distribution Archive** | [`apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip) | 16,994 bytes | `24E47B83D02EB3D2F9E1DE4BA84F8CD5B7A8EF363F1C29E22F80BE93480FA995` |

---

## 2. Distribution Archive Contents

The ZIP archive `CortexLockdown-Windows-x64.zip` contains all components required for standard user installation and institutional deployment:

```text
CortexLockdown-Windows-x64.zip
│
├── CortexLockdown.exe            [33,280 bytes] Hardened native WPF executable (Zero Secrets)
├── install.bat                   [ 1,420 bytes] One-click automated installer & protocol registrar
├── uninstall.bat                 [   980 bytes] Clean uninstaller & registry protocol purger
└── README.txt                    [ 1,840 bytes] Installation instructions & system requirements
```

---

## 3. Installation & Lifecycle Scripts

### 3.1 Installer Behavior (`install.bat`)
- Deploys executable to `%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe`.
- Registers custom URL protocol `cortex-lockdown://` under `HKEY_CURRENT_USER\Software\Classes\cortex-lockdown`.
- Associates default protocol icon and command line handler:
  `"%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe" "%1"`
- Does not require administrative elevation (runs within user-profile context).

### 3.2 Uninstaller Behavior (`uninstall.bat`)
- Terminates any active instances of `CortexLockdown.exe`.
- Removes registry key `HKEY_CURRENT_USER\Software\Classes\cortex-lockdown` and all subkeys.
- Purges `%LOCALAPPDATA%\CortexLockdown` directory and removes desktop shortcut.
- Restores clean host state without residual artifacts.

---

## 4. Native Windows Technical Capabilities

The compiled executable `CortexLockdown.exe` embeds native Windows API security enforcement routines:

1. **User-Mode Low-Level Keyboard Interception (`WH_KEYBOARD_LL`)**:
   - Blocks Windows Key (`VK_LWIN`, `VK_RWIN`).
   - Blocks Task Switching (`Alt + Tab`, `Alt + Shift + Tab`, `Alt + Esc`).
   - Blocks System Control (`Ctrl + Esc`).
   - Blocks Task Manager launch combinations (`Ctrl + Shift + Esc`).
   - Blocks Alt+F4 application closure.
2. **Anti-Screen Capture Enforcement**:
   - Calls `SetWindowDisplayAffinity(hWnd, WDA_EXCLUDEFROMCAPTURE)` (Value: `0x00000011`).
   - Renders application window completely black to software screen recording tools (OBS Studio, Discord screen share, Microsoft Teams, Zoom, Xbox Game Bar, Snipping Tool).
3. **Prohibited Process Watchdog**:
   - Scans active process list every 2,000 milliseconds.
   - Detects over 25 unauthorized applications, including remote desktop clients (AnyDesk, TeamViewer, RustDesk, UltraViewer), browsers (Chrome, Edge, Firefox, Brave), communications software (Discord, Slack, Teams), and developer utilities (Wireshark, Fiddler, ProcessHacker, CheatEngine).
   - Enforces automatic process termination or proctor integrity incident logging.
4. **Server-Authoritative Emergency Exit Recovery**:
   - Activated via `Ctrl + Alt + F10` or on-screen Emergency Exit button.
   - Generates random 16-character hexadecimal challenge.
   - Delegates verification to edge backend (`/api/v1/lockdown/emergency-exit`).
   - Zero secrets stored in client memory or binary.
5. **Heartbeat & Telemetry Streaming**:
   - Dispatches continuous workstation integrity heartbeats every 10 seconds.
   - Reports window focus state, process anomalies, and tamper alerts directly to proctor dashboard.

---

## 5. Security & Antivirus Compatibility Assessment

### 5.1 Static PE Binary Characteristics
- **Compiler**: Microsoft (R) Visual C# Compiler version 4.8.9232.0 (`csc.exe`).
- **Target Framework**: .NET Framework 4.8 (x64 AnyCPU).
- **Subsystem**: Windows Graphical (`/target:winexe`).
- **Optimization**: Enabled (`/optimize+`).
- **Obfuscation / Packing**: None. Unpacked managed IL executable.
- **Embedded Secrets**: Zero. Confirmed by automated PE string scanner.

### 5.2 Antivirus & SmartScreen Analysis
- **Code Signature**: Unsigned in staging pilot release. Windows SmartScreen may present an "Unknown Publisher" warning on first launch in non-institutional environments.
- **Antivirus Detection Heuristics**:
  - The use of `SetWindowsHookEx` (`WH_KEYBOARD_LL`) can trigger heuristic flags in aggressive AV products if behavioral monitoring flags keyboard monitoring.
  - For the controlled pilot, participating institutional workstations should configure an execution exclusion for `%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe` via Group Policy (GPO) or Intune endpoint management.

---

## 6. Operating System & Minimum Hardware Requirements

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| **Operating System** | Windows 10 64-bit (Version 2004, Build 19041+) | Windows 11 64-bit (Version 22H2+) |
| **Processor** | Dual-core 1.6 GHz Intel / AMD x64 | Quad-core 2.4 GHz Intel / AMD x64 |
| **System Memory** | 4 GB RAM | 8 GB RAM or higher |
| **Disk Space** | 50 MB free disk space | 200 MB free disk space |
| **Display Resolution**| 1280 x 720 (720p) | 1920 x 1080 (1080p Full HD) |
| **Peripherals** | Physical Keyboard & Mouse | Keyboard, Mouse, HD Webcam, Microphone |
| **Network** | 1.5 Mbps stable Internet connection | 5.0 Mbps low-latency connection |

---

## 7. Operational Authorization & Sign-Off

This release manifest represents the certified Windows distribution artifact for the Cortex Lockdown controlled pilot.

- **Build Engineer**: Cortex Release Engineering
- **Release Version**: `1.0.0-rc3`
- **Release Status**: Staging Pilot Certified
- **Distribution URL**: `https://cortex.edu/api/v1/lockdown/downloads?platform=windows`
