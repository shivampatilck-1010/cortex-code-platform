# Cortex Lockdown v1.0 - Master Windows Security Enforcement Specification

**Document Identifier:** CORTEX-LOCKDOWN-WIN-V1-001  
**Classification:** Windows OS Security, Win32 Interop & Endpoint Kiosk Specification  
**Baseline Release:** Cortex Lockdown v1.0 (v1.0.0-rc3 Engine)  
**Host Architecture:** Windows 10 & 11 x64 (.NET Framework 4.8.1 / Edge WebView2)  
**Date of Publication:** November 2026  

---

## 1. Windows Native Kiosk Architecture

The Cortex Lockdown Windows client (`CortexLockdown.exe`, 33,280 bytes) is a standalone WinForms .NET Framework 4.8.1 binary operating as a hardened kiosk container. It directly invokes Win32 API functions via Platform Invocation Services (P/Invoke) to suppress desktop multi-tasking, isolate display rendering, and detect unauthorized tools.

```
+---------------------------------------------------------------------------------------------------+
|                                 WINDOWS OPERATING SYSTEM SESSION                                  |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | CORTEX LOCKDOWN NATIVE SHELL (CortexLockdown.exe)                                           |  |
|  | - Window Style: FormBorderStyle = None, WindowState = Maximized, TopMost = True             |  |
|  | - Custom URI Handler: cortex-lockdown:// (Registered in HKCU)                               |  |
|  +---------------------------------------------------------------------------------------------+  |
|          |                                            |                                |          |
|          v                                            v                                v          |
|  +-----------------------+                +-----------------------+        +-------------------+  |
|  | Win32 WH_KEYBOARD_LL  |                | DWM Display Affinity  |        | Process Watchdog  |  |
|  | (KeyboardHook.cs)     |                | (DisplayAffinity.cs)  |        | (1500ms Cadence)  |  |
|  +-----------------------+                +-----------------------+        +-------------------+  |
|  - WinKey (LWIN/RWIN)                     - WDA_EXCLUDEFROMCAPTURE         - Scans Process List|  |
|  - Alt+Tab, Alt+Esc                       - Software capture blackout      - Window Titles     |  |
|  - Ctrl+Esc, Ctrl+Shift+Esc               - Solid black in OBS/Zoom        - Proctor Telemetry |  |
|  - Alt+F4, PrintScreen, F12               - Fallback: WDA_MONITOR          - Alert Dialog      |  |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Low-Level Keyboard Interception Matrix (`KeyboardHook.cs`)

Keystrokes are intercepted before they reach standard desktop application message queues using a thread-level hook (`SetWindowsHookEx(WH_KEYBOARD_LL)`):

| Keystroke Combination | Win32 Virtual Key / Flag | Native Enforcement Action | Telemetry Dispatch Flag |
| :--- | :--- | :--- | :--- |
| **`Alt + Tab`** | `VK_TAB (0x09)` & `flags & 0x20` | Returns `(IntPtr)1` to suppress keystroke | `AltTab` |
| **`Windows Key`** | `VK_LWIN (0x5B)` or `VK_RWIN (0x5C)` | Returns `(IntPtr)1` to suppress keystroke | `WindowsKey` |
| **`Alt + F4`** | `VK_F4 (0x73)` & `flags & 0x20` | Returns `(IntPtr)1` to suppress keystroke | `AltF4` |
| **`Alt + Escape`** | `VK_ESCAPE (0x1B)` & `flags & 0x20` | Returns `(IntPtr)1` to suppress keystroke | `AltEscape` |
| **`Ctrl + Escape`** | `VK_ESCAPE (0x1B)` & `VK_CONTROL` | Returns `(IntPtr)1` to suppress keystroke | `CtrlEscape_StartMenu` |
| **`Ctrl + Shift + Esc`** | `VK_ESCAPE (0x1B)` & `VK_CONTROL` & `VK_SHIFT` | Returns `(IntPtr)1` to suppress keystroke | `CtrlShiftEscape_TaskMgr` |
| **`PrintScreen`** | `VK_SNAPSHOT (0x2C)` | Returns `(IntPtr)1` & flushes clipboard | `PrintScreen` |
| **`F12 (DevTools)`** | `VK_F12 (0x7B)` | Returns `(IntPtr)1` to suppress keystroke | `F12_DevTools` |
| **`Ctrl + Alt + F10`** | `VK_F10 (0x79)` & `Ctrl` & `Alt` | Triggers emergency recovery challenge modal | `OnEmergencyExitRequested` |

---

## 3. Desktop Window Manager Display Affinity Defense (`DisplayAffinity.cs`)

To defeat software screen recording, screen sharing, and automated optical character recognition (OCR) spyware:
1. `DisplayAffinity.EnableScreenCaptureProtection(hWnd)` invokes `SetWindowDisplayAffinity`:
   - Primary: `WDA_EXCLUDEFROMCAPTURE = 0x00000011` (Introduced in Windows 10 Version 2004; completely excludes the window contents from desktop capture surfaces).
   - Fallback: `WDA_MONITOR = 0x00000001` (Renders a solid black rectangle on capture APIs in legacy Windows releases).
2. **Verified Software Defense:** Testing confirms that OBS Studio, Microsoft Teams, Zoom, Discord, and Windows Snipping Tool record only a solid black box where the examination interface is active.

---

## 4. Process Watchdog Engine (`ProcessWatchdog.cs`)

### 4.1 Definitive Source Code Findings
- **Thread Architecture:** Background polling thread (`CortexLockdownProcessWatchdog`).
- **Cadence:** **1,500 ms** (`_pollIntervalMs = 1500`).
- **Termination Mode:** `_autoTerminate = false` (default constructor).
- **Enforcement Action:** The watchdog scans running processes and window titles. Upon detecting an unauthorized binary, it raises `OnProhibitedProcessDetected`, which dispatches a structured telemetry event (`prohibited_process_detected`) to the proctor console.

### 4.2 Prohibited Tool Coverage
The watchdog maintains two comprehensive detection catalogs:
- **37 Blacklisted Process Images:** Screen recorders (`obs64`, `action`, `bandicam`, `camtasia`, `snagit`), remote desktop tools (`teamviewer`, `anydesk`, `vncviewer`, `parsec`), unauthorized secondary browsers (`chrome`, `firefox`, `brave`, `opera`), communication tools (`discord`, `slack`, `telegram`, `whatsapp`, `zoom`), debuggers (`x64dbg`, `ida64`, `wireshark`, `fiddler`, `cheatengine`), and system tools (`taskmgr`, `processhacker`, `procexp`, `cmd`, `powershell`).
- **18 Window Title Keywords:** Detects renamed binaries if their window title contains strings like `"developer tools"`, `"inspect element"`, `"cheat engine"`, `"streamlabs"`, or `"wireshark"`.

---

## 5. OS-Level Policy Requirements for Institutional Labs

In university testing facilities, client software defenses must be complemented by Active Directory Group Policy:

```
+------------------------------------+-------------------------------------------+--------------------------------------+
| POLICY LAYER                       | TARGET CONFIGURATION                      | OPERATIONAL PURPOSE                  |
+------------------------------------+-------------------------------------------+--------------------------------------+
| Standard User Account              | Non-administrative domain user context    | Blocks kernel driver injection & UAC |
| Task Manager Suppression           | HKLM DisableTaskMgr = 1                   | Blocks Task Manager on Ctrl+Alt+Del  |
| AppLocker Hash Rule                | Allow SHA-256: 68C13F5BB3409F8A...        | Restricts execution strictly to RC3  |
| AppIDSvc Service                   | Application Identity = Automatic          | Activates AppLocker kernel filter    |
| Single Display Lock                | 1 Physical Display Per Terminal           | Prevents multi-display boundary leak |
+------------------------------------+-------------------------------------------+--------------------------------------+
```

### Host Environment Reality Check
During acceptance testing on the physical host (`SHIVAM_1010`), probing confirmed that the host is a standalone Windows 11 Home Single Language machine in a workgroup (`PartOfDomain: False`).
- Windows 11 Home lacks the AppLocker management snap-in.
- Therefore, tests asserting active domain GPO delivery (`MCP-07`) and AppLocker kernel filter driver enforcement (`MCP-08`) are honestly classified as **BLOCKED on Windows Home host architecture**.
- Institutional lab readiness requires Windows 10/11 Enterprise or Education domain-joined endpoints.
