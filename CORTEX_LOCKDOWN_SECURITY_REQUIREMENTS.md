# CORTEX LOCKDOWN
# SECURITY REQUIREMENTS SPECIFICATION (SRS)
## High-Assurance Secure Examination Architecture

**Document Version:** 1.0.0  
**Security Classification:** Highly Confidential / Engineering Specification  
**Standard Compliance:** NIST SP 800-53, ISO/IEC 27001, OWASP ASVS v4.0  
**Author:** Principal Security Architect & Senior Desktop Systems Engineer  
**Date:** October 31, 2026  

---

## 1. FUNCTIONAL SECURITY REQUIREMENTS

### 1.1 Operating System Kiosk & Confinement (SEC-REQ-KIOSK)
- **SEC-REQ-KIOSK-01 (Exclusive Desktop):** The application must execute in exclusive fullscreen mode covering 100% of the active display resolution. Window borders, title bars, minimize/maximize buttons, and system taskbars must be completely hidden.
- **SEC-REQ-KIOSK-02 (Multi-Monitor Handling):** The application must detect all attached physical and virtual monitors via native OS APIs (`EnumDisplayMonitors` on Windows, `NSScreen.screens` on macOS). If more than one display is detected and institutional policy prohibits dual displays, secondary displays must be blanked out with an opaque lock overlay or the student must be instructed to disconnect external monitors before starting.
- **SEC-REQ-KIOSK-03 (Top-Most Persistence):** The examination window must maintain `HWND_TOPMOST` status on Windows and `NSWindow.Level.floating` / `.mainMenu` on macOS. Any attempt by background processes to steal focus must trigger immediate window re-activation and an integrity log event.
- **SEC-REQ-KIOSK-04 (Process Isolation):** The application must prevent the launching of new unauthorized child processes and monitor running processes every 1,500ms against a blacklist of forbidden executables (screen recorders, communication tools, decompilers, terminal emulators).

### 1.2 Keyboard & System Shortcut Interception (SEC-REQ-KEYB)
- **SEC-REQ-KEYB-01 (Windows Low-Level Hook):** On Windows, the application must install a low-level keyboard hook (`WH_KEYBOARD_LL`) via `SetWindowsHookEx` that unconditionally intercepts and consumes (`return 1`):
  - `VK_LWIN` / `VK_RWIN` (Windows Start Key)
  - `VK_TAB` with `LLKHF_ALTDOWN` (Alt + Tab task switcher)
  - `VK_ESCAPE` with `LLKHF_ALTDOWN` (Alt + Esc)
  - `VK_ESCAPE` with `Ctrl` (Ctrl + Esc Start menu)
  - `VK_F4` with `LLKHF_ALTDOWN` (Alt + F4 window close)
  - `VK_SNAPSHOT` (PrintScreen key)
  - `VK_F12`, `Ctrl + Shift + I`, `Ctrl + Shift + J`, `Ctrl + U` (Developer tools & view source)
- **SEC-REQ-KEYB-02 (macOS System Hotkey Suppression):** On macOS, the application must engage Apple Automatic Assessment Configuration (`AEAssessmentSession`) or configure `NSApplicationPresentationOptions`:
  - Disable Process Switching (`Cmd + Tab`)
  - Disable Force Quit (`Cmd + Option + Esc`)
  - Disable Mission Control, Exposé, and Spaces (`F3`, gestures)
  - Disable Screenshots (`Cmd + Shift + 3`, `Cmd + Shift + 4`, `Cmd + Shift + 5`)

### 1.3 Display & Screen Capture Shielding (SEC-REQ-DISP)
- **SEC-REQ-DISP-01 (Windows Display Affinity):** The application must execute `SetWindowDisplayAffinity(hWnd, WDA_MONITOR)` (or `WDA_EXCLUDEFROMCAPTURE` on Windows 10 Version 2004+), ensuring that any screen recording software (OBS, Zoom, Discord, Camtasia) captures only a solid black surface instead of exam questions.
- **SEC-REQ-DISP-02 (macOS Window Sharing):** The application must set `NSWindow.sharingType = .none`, preventing the window buffer from being accessed by screen capture daemons, QuickTime screen recording, or unauthorized screenshot utilities.

### 1.4 Clipboard & Data Transfer Containment (SEC-REQ-CLIP)
- **SEC-REQ-CLIP-01 (Clipboard Clearing):** The application must empty the system clipboard upon window focus entry and upon exam start using native APIs (`EmptyClipboard()` on Windows, `NSPasteboard.general.clearContents()` on macOS).
- **SEC-REQ-CLIP-02 (Paste Sanitization):** Pasting from external applications into the exam workspace is strictly blocked. If internal copy/paste is enabled within a coding problem editor (Code Studio), it must operate exclusively within an in-memory application-local clipboard.
- **SEC-REQ-CLIP-03 (Drag-and-Drop Suppression):** External drag-and-drop into or out of the web view must be completely disabled at both native window and DOM levels.

### 1.5 Virtualization & Remote Desktop Detection (SEC-REQ-ENV)
- **SEC-REQ-ENV-01 (Remote Session Detection):** The application must inspect `GetSystemMetrics(SM_REMOTESESSION)` and terminal services session metrics on Windows. Running over Remote Desktop Protocol (RDP), VNC, TeamViewer, AnyDesk, or Citrix must be detected and blocked.
- **SEC-REQ-ENV-02 (Hypervisor & VM Detection):** The application must detect if it is running inside an unsupported virtual machine (VirtualBox, VMware, QEMU, Parallels, Hyper-V) by inspecting CPUID hypervisor flags (`CPUID.1:ECX[31]`) and known virtual hardware vendor strings. If VM execution is prohibited by institutional policy, exam launch must be refused.

---

## 2. CRYPTOGRAPHIC & PROTOCOL REQUIREMENTS

### 2.1 Mutual Attestation & Launch Authorization (SEC-REQ-AUTH)
- **SEC-REQ-AUTH-01 (Signed Launch Grant):** The client must acquire an ephemeral Launch Grant from the Cortex backend (`POST /api/v1/lockdown/authorize-launch`). The token must be an HMAC-SHA256 or Ed25519 signed JWT containing:
  - `sub`: Candidate User ID
  - `exam_id`: Examination UUID
  - `classroom_id`: Classroom UUID
  - `device_fingerprint`: Cryptographic hash of hardware components (CPU ID + Motherboard UUID + MAC address)
  - `policy_hash`: SHA-256 hash of the professor's configured exam security policy
  - `exp`: Short-lived expiration (120 seconds maximum from generation)
  - `nonce`: High-entropy random UUID preventing replay attacks
- **SEC-REQ-AUTH-02 (Binary Integrity Self-Check):** Before launching, the desktop application must compute its own executable SHA-256 hash and transmit it in the launch authorization request. The Cortex server verifies this hash against an authoritative release manifest.

### 2.2 Server-Authoritative Integrity & Sequencing (SEC-REQ-DATA)
- **SEC-REQ-DATA-01 (Monotonic Sequencing):** All student autosave responses must carry a strictly increasing integer sequence number `clientSequenceNumber`. The server rejects any update where $S_{\text{new}} \le S_{\text{existing}}$.
- **SEC-REQ-DATA-02 (Zero Answer Key Leakage):** Exam question payloads returned to the Lockdown client must have correct answers, hidden test case inputs/outputs, and grading rubrics scrubbed before transmission.
- **SEC-REQ-DATA-03 (Grace Period Integrity):** The platform's 30-second post-deadline grace period permits only the network delivery of answers cached prior to the deadline timestamp. The client UI locks answer inputs immediately when the countdown reaches 00:00:00.

---

## 3. PROCTORING & SENSOR SECURITY REQUIREMENTS

### 3.1 Hardware Readiness & Explicit Consent (SEC-REQ-PROC)
- **SEC-REQ-PROC-01 (Pre-Flight Verification):** The application must verify camera, microphone, and audio speaker functionality prior to exam entry. A visual loopback and audio volume meter must be displayed to the student.
- **SEC-REQ-PROC-02 (Informed Consent):** The student must receive a plain-language disclosure stating what is being recorded (audio, video, screen events), who will review the data, and the defined retention period. Explicit consent is required before proceeding.
- **SEC-REQ-PROC-03 (No Covert Monitoring):** A persistent, non-distracting hardware indicator (such as a green recording pill and camera preview) must remain visible throughout the examination session whenever recording is active.

### 3.2 Automated Anomaly Detection (SEC-REQ-ANOM)
- **SEC-REQ-ANOM-01 (Face Presence):** The client-side vision pipeline must sample webcam frames every 3,000ms. If zero faces or multiple faces are detected continuously for more than 10 seconds, a tamper-evident integrity event (`face_missing` or `multiple_faces`) is dispatched to the server.
- **SEC-REQ-ANOM-02 (Audio Threshold Anomaly):** Ambient audio input is monitored. Sustained noise above a normalized voice threshold during an individual exam generates an `audio_anomaly` event with audio decibel metrics.
- **SEC-REQ-ANOM-03 (Advisory-Only Enforcement):** Automated proctoring detections must never automatically cancel or fail an exam attempt. All flagged events are stored as advisory telemetry for teacher/proctor review and human decision-making.

---

## 4. COMPLIANCE & PRIVACY ASSURANCE

Every requirement in this specification is designed to adhere to applicable student data privacy regulations (FERPA, GDPR). Data collected is strictly limited to the duration of the scheduled examination and encrypted using TLS 1.3 in transit and AES-256 at rest.
