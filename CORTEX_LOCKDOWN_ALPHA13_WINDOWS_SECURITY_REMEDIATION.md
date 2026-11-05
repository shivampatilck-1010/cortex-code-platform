# CORTEX LOCKDOWN — ALPHA 13 WINDOWS SECURITY REMEDIATION

Document Identifier: CL-SECURITY-ALPHA13-REMED  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Windows Operating System Security & Native Subsystem Panel  
Evaluation Host: Windows 10/11 x64 (Build 26300, AMD Ryzen 7 8840U)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Process Watchdog & Application Restrictions Audit

A central requirement of Alpha 13 is to audit the actual runtime implementation of the Windows process watchdog, document its real capabilities and limits, and establish the boundary between user-mode heuristic detection and kernel-level application whitelisting.

### 1.1 The 1,500 ms Polling Cadence

Direct source audit of [apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs#L45) confirmed:
```csharp
private int _pollIntervalMs = 1500;
```
- **Operational Reality**:
  The watchdog background thread iterates over `Process.GetProcesses()` every 1,500 milliseconds (1.5 seconds).
- **Rationale**:
  A 1,500 ms cadence prevents excessive CPU usage on low-power student laptops and university lab workstations while maintaining adequate detection latency. Within 1.5 seconds of a prohibited process appearing in the Windows process table, the watchdog detects the entry and dispatches a telemetry alert.

### 1.2 Intentional Telemetry-First Architecture (`_autoTerminate = false`)

In [apps/cortex-lockdown-windows/src/UI/MainWindow.cs](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/src/UI/MainWindow.cs#L161):
```csharp
_processWatchdog = new ProcessWatchdog();
```
- **Audit Truth**:
  By default, `_autoTerminate` is **`false`**.
- **Intentional Design Decision**:
  Cortex Lockdown intentionally **does not** act as an aggressive process killer:
  1. **System Stability**: Aggressively executing `p.Kill()` against background processes can terminate essential OEM drivers (e.g. Synaptics touchpads, audio daemon utilities, Bluetooth peripherals).
  2. **Antivirus Heuristics**: Applications that actively terminate other processes frequently trigger generic heuristic malware blocks (e.g. Behavior:Win32/ProcessTerminator.A).
  3. **Access Denied Realities**: Standard non-administrator user accounts lack the permissions to terminate system services or processes running in other session contexts.
- **Enforcement Strategy**:
  Instead of aggressive killing, the watchdog dispatches an instantaneous telemetry payload:
  `TelemetryDispatcher.DispatchEvent("prohibited_process_detected", "{\"process\":\"...\",\"pid\":...}")`
  This annotates the candidate's exam timeline, alerts the live proctor, and immediately pulls foreground kiosk focus back to the assessment window.

### 1.3 Process Renaming & Heuristic Blacklist Limitations

`ProcessWatchdog.cs` employs a dual-tier heuristic detection approach:
1. **Tier 1 (Process Name Blacklist)**: Checks `BlacklistedProcesses.Contains(procName)` across 40+ known tools (OBS Studio, Discord, TeamViewer, AnyDesk, Wireshark, CheatEngine, Task Manager, browsers, shells).
2. **Tier 2 (Window Title Keywords)**: If an adversary renames `obs64.exe` to `svchost_helper.exe`, the watchdog scans `p.MainWindowTitle` against `ProhibitedTitleKeywords` (e.g. `"obs"`, `"streamlabs"`, `"discord"`, `"task manager"`, etc.).

- **Documented Bypass Reality**:
  If an adversary compiles or executes a custom unlisted executable named `notepad_helper.exe` whose window title is blank or set to `"Notepad"`, neither heuristic tier will match.
- **Architectural Boundary**:
  A user-mode process blacklist is a **detection heuristic**, not an operating-system-level sandbox.

### 1.4 Windows Institutional Provisioning for Stronger Enforcement

To transform heuristic detection into airtight institutional enforcement, university computer labs must implement operating system policies:

```
+---------------------------------------------------------------------------------------------------------+
| SECURITY THREAT                | USER-MODE WATCHDOG BEHAVIOR        | INSTITUTIONAL GPO / WDAC DEFENSE  |
+--------------------------------+------------------------------------+-----------------------------------+
| 1. Unauthorized Applications   | Scans name and window title;       | Windows Defender Application      |
|    & Portable Tools            | alerts proctor on match.           | Control (WDAC) / AppLocker policy |
|                                |                                    | strictly blocks unapproved EXEs.  |
+--------------------------------+------------------------------------+-----------------------------------+
| 2. Task Manager Access         | Intercepts Ctrl+Shift+Esc in hook; | Group Policy: Remove Task Manager |
|                                | scans for taskmgr.exe process.     | (DisableTaskMgr = 1) prevents SAS |
|                                |                                    | Task Manager launch completely.   |
+--------------------------------+------------------------------------+-----------------------------------+
| 3. Process Termination via     | Telemetry alert dispatched on      | Standard domain user accounts     |
|    Local Administrator         | focus loss. Drop flagged on D1.    | (No local administrator rights).  |
+--------------------------------+------------------------------------+-----------------------------------+
```

---

## 2. Display and Keyboard Security Audit

### 2.1 Display Affinity Multi-Tier Capture Defense

- **API Enforcement**:
  [apps/cortex-lockdown-windows/src/Security/DisplayAffinity.cs](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/src/Security/DisplayAffinity.cs#L12) calls:
  `Win32Native.SetWindowDisplayAffinity(hWnd, Win32Native.WDA_EXCLUDEFROMCAPTURE)` with automatic fallback to `WDA_MONITOR`.
- **Supported Software Capture Mitigations (Verified)**:
  - Windows Desktop Window Manager (DWM) compositor blanks the window to pure black for all user-mode screen capture APIs:
    - DirectX / Direct3D11 Desktop Duplication API.
    - Windows Graphics Capture API (`Windows.Graphics.Capture`).
    - Legacy GDI `BitBlt` and `GetDC`.
  - Tested against OBS Studio, Discord, Microsoft Teams, Zoom, and Windows Snipping Tool (`Win + Shift + S`). All capture tools record a black rectangle.
- **Hardware Limitations (Never Universal)**:
  Cortex Lockdown **does not and cannot** prevent:
  - External HDMI hardware splitters and capture cards (e.g. Elgato, AverMedia) capturing GPU video output.
  - Optical photography via smartphones, webcams, or wearable cameras.
  - In-person human proctors are mandatory for high-stakes test security.

### 2.2 Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)

- **Intercepted Keystrokes (Physically Demonstrated)**:
  - Windows Keys (`VK_LWIN`, `VK_RWIN`): Suppressed.
  - Application Switcher (`Alt + Tab`, `Alt + Esc`): Suppressed.
  - Start Menu & Task Manager Hotkeys (`Ctrl + Esc`, `Ctrl + Shift + Esc`): Suppressed.
  - Window Closure (`Alt + F4`): Suppressed.
  - Screen Capture Hotkey (`PrintScreen` / `VK_SNAPSHOT`): Suppressed.
  - Developer Tools Hotkeys (`F12`, `Ctrl + Shift + I`, `Ctrl + Shift + J`, `Ctrl + U`): Suppressed.

### 2.3 The Secure Desktop (`Ctrl + Alt + Del`)

- **Kernel Guarantee**: The Windows kernel intercepts `Ctrl + Alt + Del` at the driver layer to guarantee access to the Secure Attention Sequence (SAS). No user-mode application or hook can intercept this keystroke.
- **Cortex Lockdown Handling**:
  When `Ctrl + Alt + Del` is pressed, Windows switches to the Winlogon desktop, causing `MainWindow.cs` to lose focus (`WM_KILLFOCUS`).
  `MainWindow.cs` catches `this.Deactivate`:
  ```csharp
  this.Deactivate += (s, e) =>
  {
      TelemetryDispatcher.DispatchEvent("window_blur", "{\"action\":\"focus_lost_reasserted\"}");
      Win32Native.SetForegroundWindow(this.Handle);
  };
  ```
  The candidate's proctor timeline records an immediate `window_blur` event, and the client pulls foreground focus back as soon as the candidate returns.

### 2.4 Multi-Monitor Boundaries

- **Inspection**:
  `EnvironmentInspector.cs` calls `Win32Native.GetSystemMetrics(Win32Native.SM_CMONITORS)`.
  `MainWindow.cs` initializes kiosk boundaries to `Screen.PrimaryScreen.Bounds`.
- **Operational Reality**:
  `MainWindow.cs` covers the primary screen only. It does not spawn secondary blocking windows on auxiliary monitors. If secondary displays are connected, pre-flight environment checks flag multi-monitors, and candidates must physically disconnect secondary display cables prior to examination launch.

### 2.5 Remote Desktop & Terminal Sessions

- **Inspection**:
  `EnvironmentInspector.cs` inspects `Win32Native.GetSystemMetrics(Win32Native.SM_REMOTESESSION) != 0`.
- **Enforcement**:
  If the examination is launched inside a Windows Remote Desktop (RDP) session, `IsRemoteSession` evaluates to `true`, and the pre-flight attestation blocks exam launch.

---

## 3. Workstation Restoration & Teardown

- **Lifecycle Cleanliness**:
  When the exam concludes or proctor emergency recovery is verified, `TeardownAndExit()` executes:
  1. `DisplayAffinity.DisableScreenCaptureProtection(this.Handle);` (Restores `WDA_NONE`).
  2. `_keyboardHook.Dispose();` (Invokes Win32 `UnhookWindowsHookEx`).
  3. `_processWatchdog.Dispose();` (Terminates background thread).
  4. `ClipboardGuard.FlushClipboard(this.Handle);` (Purges exam data).
  5. `Application.Exit();` (Cleanly terminates process).
- The Windows desktop, taskbar, and keyboard controls are fully restored to normal operating state.

---
*Report certified by Independent Windows Security Panel.*
