# Cortex Lockdown v1.0 - Master System Architecture Specification

**Document Identifier:** CORTEX-LOCKDOWN-ARCH-V1-001  
**Classification:** Enterprise System Architecture & Component Specification  
**Baseline Release:** Cortex Lockdown v1.0 (v1.0.0-rc3 Engine)  
**Target Environments:** Windows 10 & 11 x64 / macOS 12+ (Apple Silicon & Intel) / Cloudflare Edge (Workers & D1)  
**Date of Publication:** November 2026  

---

## 1. System Identity and Architectural Scope

Cortex Lockdown is an independent, downloadable native desktop examination security application engineered to deliver secure, cheat-resistant assessment sessions. It interfaces with the institutional Cortex examination cloud backend via cryptographically signed launch grants and high-integrity telemetry pipelines.

### Critical Boundary Separations
- **Independent Desktop Client:** Cortex Lockdown is a dedicated kiosk shell executing outside standard browser tabs to enforce low-level operating system controls.
- **Distinction from Cortex AI Desktop:** Cortex Lockdown is strictly an examination integrity and proctoring container. It does NOT contain AI coding assistants, code generation agents, or Copilot extensions.
- **Unified Backend Integration:** Uses existing Cortex platform authentication, user profiles, and examination schemas, avoiding duplicate user identity or grading databases.

---

## 2. End-to-End System Topology

```
+---------------------------------------------------------------------------------------------------+
|                                     CORTEX CLOUD BACKEND                                          |
|                                                                                                   |
|   +--------------------------+  +--------------------------+  +-------------------------------+   |
|   |  Institutional Pilot     |  |  Cryptographic Attestation|  |  Authoritative Quota Store   |   |
|   |  Registry & Scoping      |  |  (HMAC Launch Grants)    |  |  & Heartbeat Engine (D1/SQL)  |   |
|   +--------------------------+  +--------------------------+  +-------------------------------+   |
|   +--------------------------+  +--------------------------+  +-------------------------------+   |
|   |  Exam Session Engine     |  |  Peppered Emergency OTP  |  |  Data Retention & 90-Day      |   |
|   |  (Autosave & Grading)    |  |  Engine (Burn-on-Use)    |  |  Dispute Purge Task           |   |
|   +--------------------------+  +--------------------------+  +-------------------------------+   |
+---------------------------------------------------------------------------------------------------+
                                   |                                      ^
         Launch Grant (120s JWT)   |                                      | Real-Time Event Stream
         URI: cortex-lockdown://   v                                      | (JSON Telemetry Only)
+-------------------------------------------------------------------------+-------------------------+
|                                    NATIVE CLIENT SUBSYSTEMS                                       |
|                                                                                                   |
|  [WINDOWS NATIVE SHELL] (CortexLockdown.exe - 32.5 KB)                                            |
|  - Win32 Low-Level Keyboard Hook (WH_KEYBOARD_LL: WinKey, Alt+Tab, Alt+F4, Ctrl+Esc, PrtScn)      |
|  - Desktop Window Manager Screen Capture Shield (SetWindowDisplayAffinity: WDA_EXCLUDEFROMCAPTURE)|
|  - Process Watchdog Scanner (1500ms cadence, non-destructive telemetry detection)                 |
|  - Embedded Edge WebView2 Evergreen Container (DevTools disabled, Drag-and-drop suppressed)       |
|                                                                                                   |
|  [macOS NATIVE SHELL] (CortexLockdown.app - Swift 5.9 / AppKit)                                  |
|  - Apple Assessment Configuration Framework (AutomaticAssessmentConfiguration / AEAssessment)   |
|  - Hardened WKWebView Container (Context menu suppressed, spellcheck & shortcuts disabled)        |
|  - Window Level Shielding (.screenSaver layer) & Pasteboard Flushing                              |
+---------------------------------------------------------------------------------------------------+
                                   |
                                   v
+---------------------------------------------------------------------------------------------------+
|                             EPHEMERAL EDGE PROCESSING (BROWSER DOM)                               |
|                                                                                                   |
|  - Local Video Analysis: HTMLCanvasElement (160x120) samples face presence in local volatile RAM   |
|  - Spectral Audio Analysis: Web Audio API FFT computes vocal band decibels in browser memory      |
|  - STRICT PRIVACY GUARANTEE: Zero raw audio or video frames ever leave client memory             |
|  - SENSOR RELEASE: stopHardwareMedia() terminates all hardware tracks on submit, exit, or timeout |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Subsystem Architecture & Component Breakdown

### 3.1 Windows Native Client Subsystem (`apps/cortex-lockdown-windows`)
- **Core Runtime:** Compiled C# .NET Framework 4.8.1 WinForms executable (`CortexLockdown.exe`, 33,280 bytes).
- **Execution Model:** Self-contained single executable operating entirely in user-space (`%LOCALAPPDATA%\CortexLockdown`).
- **Operating System Interop:**
  - `SetWindowsHookEx(WH_KEYBOARD_LL)`: Intercepts keyboard input at the desktop message loop layer.
  - `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`: Instructs Windows DWM to omit the window from software capture pipelines (OBS, Zoom, Discord, Snipping Tool).
  - `SystemInformation.TerminalServerSession`: Detects active Remote Desktop Protocol (RDP) sessions.
  - `ProcessWatchdog`: Background daemon scanning running processes every 1,500 ms against blacklisted capture, communication, and debugging tools.
- **Browser Engine:** Microsoft Edge WebView2 Evergreen Runtime. Loads the secure exam interface with developer tools (`F12`), context menus, and script debugging disabled.

### 3.2 macOS Native Client Subsystem (`apps/cortex-lockdown-macos`)
- **Core Runtime:** Native Swift 5.9 application using AppKit and WebKit.
- **Apple Assessment Configuration (AAC):** Utilizes `AutomaticAssessmentConfiguration.framework` via `AEAssessmentSession`. When active, macOS natively locks out notifications, Siri, screen recording, predictive text, and multitasking shortcuts at the kernel window server level.
- **Window Shielding:** Enforces borderless full-screen layout pinned to `.screenSaver` window level (`WindowProtector.swift`).
- **Entitlements:** Configured in `CortexLockdown.entitlements` with `com.apple.developer.assessment` and `com.apple.developer.assessment-mode`.

### 3.3 Backend Cloud Architecture (Cloudflare Workers & D1 / Node.js)
- **Edge Routing & Middleware:** Fast, multi-region Cloudflare Worker isolates handling routing, JWT launch grant issuance, and JSON telemetry ingestion.
- **Relational Persistence Layer:** Cloudflare D1 (distributed SQLite engine) housing:
  - `exam_sessions`: Authoritative lifecycle state, countdown timers, and heartbeat timestamps.
  - `exam_question_responses`: Auto-saved candidate answers with server-side versioning.
  - `exam_integrity_events`: Opaque anomaly telemetry logs.
  - `lockdown_emergency_authorizations`: Single-use, peppered HMAC recovery tokens.
- **Data Retention Subsystem:** Scheduled cleanup jobs enforcing 90-day academic dispute purge for integrity telemetry and 30-day purge for expired recovery tokens.

---

## 4. Protocol and Integration Interfaces

### 4.1 Custom URI Protocol Handler (`cortex-lockdown://`)
Registered in `HKCU\Software\Classes\cortex-lockdown\shell\open\command` for frictionless browser-to-desktop dispatch:
```
cortex-lockdown://launch?token=<SignedLaunchGrantJWT>&examId=<ExamID>&candidateId=<CandidateID>
```

### 4.2 Ephemeral Launch Grant Structure (HMAC-SHA256 JWT)
The backend generates a cryptographically signed JWT with a 120-second lifespan:
```json
{
  "sub": "stu_2026_alice",
  "examId": "exam_cs276_midterm",
  "classroomId": "CSE276",
  "deviceId": "dev_lab_node_42",
  "hardwareFingerprint": "62b1de16187b413d",
  "policyHash": "a9f1b2c3d4e5f6",
  "iat": 1793400000,
  "exp": 1793400120,
  "iss": "cortex-lockdown-authority"
}
```

### 4.3 Server-Peppered Emergency Recovery Challenge-Response Protocol
```
Candidate Terminal: Ctrl+Alt+F10 ---> Displays 4-Hex Challenge "7B9D"
                                            |
Floor Invigilator Relays Challenge to Chief Proctor Console
                                            |
Proctor Dashboard invokes POST /api/v1/lockdown/emergency-exit (issue)
Backend Computes: HMAC-SHA256(SERVER_PEPPER, salt : "7B9D" : authId : otp)
Backend Stores Salt & Hash in DB (Single-Use, 180s TTL); Returns 6-Digit OTP
                                            |
Invigilator types OTP on Candidate Workstation Modal
Client submits POST /api/v1/lockdown/emergency-exit (redeem)
Backend executes Atomic Single-Winner SQL: UPDATE ... SET used = 1 WHERE used = 0
                                            |
Workstation Teardown: Unhooks WH_KEYBOARD_LL, releases display affinity, restores desktop
```

---

## 5. Architectural Quality Attributes

| Quality Attribute | Architectural Implementation Strategy | Verified Characteristic |
| :--- | :--- | :--- |
| **Integrity & Anti-Tamper** | Win32 low-level hooks, display affinity, token binding, and watchdog scanning. | Standard student account cannot manipulate examination state or bypass kiosk. |
| **Fault Tolerance** | Local IndexedDB response write-ahead buffer; non-destructive network re-attachment. | Zero answer loss during transient LAN drops or student workstation reboot. |
| **Privacy Preservation** | Ephemeral edge processing of video/audio in browser DOM; zero media streaming. | Full compliance with FERPA and GDPR data minimization requirements. |
| **Resource Efficiency** | Compact 32.5 KB binary; sub-50 MB working set; sub-4% host CPU consumption. | Seamless operation on entry-level institutional computer lab workstations. |
| **Operational Control** | Authoritative active quota calculation; classroom-scoped RBAC; proctor dashboard. | Real-time seat allocation with zero phantom session deadlocks. |
