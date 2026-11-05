# Cortex Lockdown - Alpha 15 Adversarial Examination Threat & Defense Report

**Document Identifier:** CORTEX-LOCKDOWN-ADV-A15-001  
**Classification:** Adversarial Threat Modeling & Security Boundary Evaluation  
**Target Release:** v1.0.0-rc3  
**Auditing Standard:** Rigorous OS Capability Classification (Prevention, Detection, Mitigation, Unsupported)  
**Date of Audit:** November 2026  

---

## 1. Adversarial Evaluation Methodology

To maintain absolute documentation honesty and avoid overstated security claims, all evaluated adversary evasion techniques are categorized by their real operating system capabilities:

1. **Prevention:** The attack vector is completely blocked from executing.
2. **Detection:** The action occurs, but triggers immediate tamper telemetry and proctor alerts.
3. **Mitigation:** The impact is constrained or reduced, requiring complementary operational controls.
4. **Unsupported:** The vector cannot be blocked in software and relies upon physical invigilation.

---

## 2. Comprehensive Adversarial Controls Matrix

| Attack Vector / Technique | Evaluated Mechanism | Control Classification | Technical Enforcement Reality & Boundaries |
| :--- | :--- | :---: | :--- |
| **1. Application Switching (`Alt + Tab`)** | `WH_KEYBOARD_LL` Win32 Hook | **Prevention** | Hook intercepts `VK_TAB` with `LLKHF_ALTDOWN`; returns non-zero code to discard keystroke. |
| **2. Windows Start Menu (`WinKey`)** | `WH_KEYBOARD_LL` Win32 Hook | **Prevention** | Intercepts `VK_LWIN` and `VK_RWIN`; Start Menu cannot open. |
| **3. Application Close (`Alt + F4`)** | `WH_KEYBOARD_LL` Win32 Hook | **Prevention** | Intercepts `VK_F4` with `LLKHF_ALTDOWN`; application close blocked. |
| **4. Task Manager (`Ctrl + Shift + Esc`)** | `WH_KEYBOARD_LL` + GPO | **Prevention (In-Session)** | Hook intercepts keystroke during session. Group policy `DisableTaskMgr` provides secondary defense. |
| **5. Screen Capture (`PrintScreen`)** | `WH_KEYBOARD_LL` + `Clipboard.Clear()` | **Prevention** | Keystroke blocked; system clipboard flushed immediately if triggered. |
| **6. Software Screen Recording** | `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` | **Prevention** | Windows DWM renders a solid black rectangle to OBS, Teams, Zoom, Discord, and Snipping Tool. |
| **7. Multi-Display Perimeter Expansion** | `SystemInformation.MonitorCount` | **Mitigation / Detection** | Client locks to PrimaryScreen; displays blackout warning if multiple monitors are detected. |
| **8. Remote Desktop / RDP Session** | `SystemInformation.TerminalServerSession` | **Detection / Mitigation** | Flags terminal server sessions; notifies proctor and requires local console logon. |
| **9. Prohibited Process Execution** | 1000ms Process Watchdog Thread | **Detection & Mitigation** | Scans process list; terminates blacklisted binaries and transmits `prohibited_process` alert. |
| **10. Process Renaming Evasion** | Window Title Inspection Heuristic | **Mitigation** | Inspects window titles in addition to image names. Renamed tools without UI require AppLocker GPO. |
| **11. Local Process Killing** | Heartbeat Expiration Monitor | **Detection** | Candidate killing `CortexLockdown.exe` triggers server heartbeat expiration within 60-120 seconds. |
| **12. Network Disconnect Tamper** | Server-Authoritative Expiration | **Mitigation** | Local timer continues; server locks exam at `expires_at` regardless of client connectivity state. |
| **13. Duplicate Answer Submission** | Atomic SQL Conditional Update | **Prevention** | Transition `status = 'in_progress'` -> `submitted`; duplicate requests return `changes: 0`. |
| **14. Expired Launch Grant Forgery** | HMAC-SHA256 JWT Verification | **Prevention** | Expired tokens rejected with `Token has expired`; invalid signatures rejected fail-closed. |
| **15. Recovery OTP Replay Attack** | Atomic Single-Winner SQL Lock | **Prevention** | SQL `WHERE used = 0`; second attempt receives `changes: 0` and is rejected as replay. |
| **16. Recovery OTP Brute-Force** | Failed Attempt Counter Auto-Burn | **Prevention** | Authorization auto-burned after 3 failed attempts (`failed_attempts >= max_attempts`). |
| **17. Device Trust Revocation** | `isEntityRevoked('device', id)` | **Prevention** | Revoked workstation hardware fingerprints rejected fail-closed during pilot authorization. |
| **18. The Secure Desktop (`Ctrl + Alt + Del`)** | Windows Kernel Driver Architecture | **Unsupported (OS Boundary)** | Windows kernel intercepts SAS at driver level. Cannot be blocked in software. Causes `window_blur` alert. |
| **19. Hardware HDMI Capture Cards** | Physical Cable Splitters | **Unsupported (Hardware Boundary)** | Physical video splitter feeds external monitor. Cannot be detected in software. Requires in-person proctors. |
| **20. Local Kernel-Mode Administrator** | Rootkit / Kernel Driver Evasion | **Unsupported (Privilege Boundary)** | Administrator with `SeDebugPrivilege` or ring-0 driver can bypass user hooks. Requires standard accounts. |

---

## 3. Deep-Dive: Critical Operating System & Privilege Boundaries

### 3.1 The Secure Desktop (`Ctrl + Alt + Del`)
The Windows kernel explicitly reserves `Ctrl + Alt + Del` for the Secure Attention Sequence (SAS). No user-mode application or hook can intercept or suppress this sequence without custom kernel-mode drivers.
- **Observed Behavior:** Pressing `Ctrl + Alt + Del` triggers the Windows Secure Desktop, causing `CortexLockdown.exe` to lose input focus (`WM_KILLFOCUS`).
- **Platform Response:** The client detects focus loss, records a `window_blur` integrity event, transmits an anomaly alert to the Proctor Dashboard, and immediately reasserts foreground window priority once the user returns to the desktop.
- **Institutional Mitigation:** Computer labs enforce `DisableTaskMgr = 1` via Group Policy so candidates cannot launch Task Manager from the SAS screen.

### 3.2 Local Administrator Privileges vs. User-Mode Hooks
User-mode hooks (`WH_KEYBOARD_LL`) operate inside the active desktop session. A user running with local administrator rights can:
- Attach debuggers (`WinDbg`, `x64dbg`).
- Suspend the watchdog thread using process management utilities.
- Inject DLLs into `CortexLockdown.exe`.
- **Institutional Requirement:** All institutional computer lab endpoints must execute under standard, non-administrative Active Directory user accounts.

### 3.3 Hardware HDMI Splitters & External Recording
Hardware-level video splitters (e.g., HDMI inline recorders, Elgato capture cards) operate downstream of the workstation graphics card. The operating system and DWM are unaware of secondary splitters.
- **Operational Reality:** Software cannot detect physical HDMI splitters or cameras pointed at the screen.
- **Institutional Requirement:** High-stakes examinations must be conducted in supervised computer labs under continuous human floor invigilation.
