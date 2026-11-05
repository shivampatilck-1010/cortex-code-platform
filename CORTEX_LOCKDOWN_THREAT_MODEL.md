# CORTEX LOCKDOWN
# THREAT MODEL & ADVERSARIAL RISK ASSESSMENT
## Native Windows & macOS Secure Examination Environment

**Document Version:** 1.0.0  
**Security Classification:** Highly Confidential / Threat Analysis  
**Framework Methodology:** STRIDE + DREAD Threat Modeling  
**Author:** Principal Security Architect & Lead Penetration Tester  
**Date:** October 31, 2026  

---

## 1. THREAT MODELING SCOPE & METHODOLOGY

This threat model identifies, categorizes, and provides concrete mitigations for threats against the Cortex Lockdown secure examination application and its supporting cloud platform.

The analysis is conducted using the **STRIDE** framework:
- **S**poofing identity
- **T**ampering with data or code
- **R**epudiation of actions
- **I**nformation disclosure
- **D**enial of service
- **E**levation of privilege

Risk scoring is performed using the **DREAD** model (Damage, Reproducibility, Exploitability, Affected Users, Discoverability) on a 1–10 scale:
$$\text{Risk Score} = \frac{\text{Damage} + \text{Reproducibility} + \text{Exploitability} + \text{Affected Users} + \text{Discoverability}}{5}$$

```
Risk Level Bands:
* Critical: 8.0 - 10.0
* High:     6.0 - 7.9
* Medium:   4.0 - 5.9
* Low:      1.0 - 3.9
```

---

## 2. ADVERSARIAL PERSONAS & CAPABILITIES

| Adversary Persona | Motivation | Technical Capability | Typical Tools & Methods |
| :--- | :--- | :--- | :--- |
| **Opportunistic Student** | Score inflation, passing cutoff | Low to Moderate | Alt+Tab, Second Monitor, Discord, Browser DevTools, Snipping Tool |
| **Collaborative Syndicate** | Organized cheating, exam sharing | Moderate | Screen streaming via HDMI capture card, Virtual Audio Cables, WhatsApp/Telegram |
| **Technically Sophisticated Student** | Evading detection, reverse engineering | High | Process injection, DLL sideloading, API hooking, VirtualBox/VMware, Wireshark, Memory editing (CheatEngine) |
| **External Malicious Threat** | Infrastructure disruption, credential harvesting | Advanced | Man-in-the-Middle (MitM) proxies, API brute force, replay attacks, DDoS |

---

## 3. STRIDE THREAT MATRIX & MITIGATION INVENTORY

### 3.1 Spoofing Identity

| Threat ID | Threat Description | DREAD | Risk Level | Native & Platform Mitigation | Detection Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TH-SPOOF-01** | Student uses another candidate's Cortex credentials to take exam remotely. | 7.2 | High | Pre-flight webcam verification, biometric face match, hardware fingerprint binding (`device_id`). | Facial comparison anomaly alerts, IP/location drift detection. |
| **TH-SPOOF-02** | Fraudulent client emulates Cortex Lockdown desktop headers to take exam in regular browser. | 8.4 | Critical | Server-signed launch grants, cryptographic device attestation token signed with machine-specific entropy, mutual HMAC challenge. | HTTP 403 on missing or invalid `X-Cortex-Lockdown-Signature`. |
| **TH-SPOOF-03** | Virtual webcam injection (OBS Virtual Camera, ManyCam) feeding pre-recorded video loops. | 7.0 | High | Hardware device enumeration filtering virtual camera driver GUIDs, challenge-response motion tests (e.g., look left/right on random prompt). | Static video stream detection, virtual device driver matching. |

---

### 3.2 Tampering with Data or Code

| Threat ID | Threat Description | DREAD | Risk Level | Native & Platform Mitigation | Detection Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TH-TAMP-01** | Candidate modifies local client memory to change exam timer or unlock clipboard. | 7.6 | High | Server-authoritative timer; client timer is display-only. Server rejects any submissions after $T_{\text{deadline}} + 30\text{s}$. | API HTTP 400 on expired timestamp. |
| **TH-TAMP-02** | Binary patching of `CortexLockdown.exe` to neutralize keyboard hooks or display affinity. | 8.0 | Critical | Launch-time executable SHA-256 integrity hash verification; server validates client hash against known trusted builds. | Attestation rejection if binary hash deviates from release manifest. |
| **TH-TAMP-03** | Injection of DLLs into the native process or Webview2 runtime (`mhook`, `EasyHook`). | 7.4 | High | Process mitigation policies (`PROCESS_CREATION_MITIGATION_POLICY_BLOCK_NON_MICROSOFT_BINARIES_ALWAYS_ON`), code signing verification. | Watchdog process crash monitoring and DLL load event interception. |
| **TH-TAMP-04** | Out-of-order autosave race injection or replay of earlier incorrect responses. | 6.8 | High | Monotonically increasing `clientSequenceNumber` on every autosave. Stale sequence numbers rejected ($S_{\text{req}} \le S_{\text{stored}}$). | Server logs sequence regression and returns HTTP 409 conflict. |

---

### 3.3 Repudiation of Actions

| Threat ID | Threat Description | DREAD | Risk Level | Native & Platform Mitigation | Detection Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TH-REPU-01** | Student claims exam answers were lost due to platform error or network crash. | 6.2 | Medium | Dual write-ahead buffering: IndexedDB client cache + real-time atomic D1 autosave log. Cryptographic submission receipt issued on finalize. | Complete event timeline from start to submission with millisecond timestamps. |
| **TH-REPU-02** | Candidate denies committing detected cheating behavior (e.g. switching windows). | 6.4 | Medium | High-resolution timestamped integrity events logged server-side with operating system context details (window title, process name, blur duration). | Tamper-evident incident log displayed in Teacher Live Proctor Dashboard. |

---

### 3.4 Information Disclosure

| Threat ID | Threat Description | DREAD | Risk Level | Native & Platform Mitigation | Detection Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TH-INFO-01** | Student inspects network responses or Webview DOM to extract correct answer keys. | 8.6 | Critical | Server-side question sanitization (`exam-sanitizer.ts`). Correct answers, grading criteria, and hidden test cases are strictly stripped before transmission. | Zero answer key presence in client payloads verified by automated assertions. |
| **TH-INFO-02** | Screen capture or streaming via Discord, OBS, Snagit, or Zoom to unauthorized peers. | 8.2 | Critical | Win32 `SetWindowDisplayAffinity(WDA_MONITOR)` renders the screen pure black to capture APIs; macOS sets `NSWindow.sharingType = .none`. Active process watchdog terminates unauthorized tools. | Blacklist process scanner flags active recorder PIDs within 1,500ms. |
| **TH-INFO-03** | Clipboard exfiltration: copying exam prompts to paste into ChatGPT or external editors. | 7.8 | High | Native keyboard hooks block `Ctrl+C`, `Cmd+C`, `Ctrl+X`. System clipboard is wiped upon window focus entry. Webview context menus and text selection disabled. | Clipboard modification interception logged as integrity event. |

---

### 3.5 Denial of Service

| Threat ID | Threat Description | DREAD | Risk Level | Native & Platform Mitigation | Detection Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TH-DOS-01** | Student intentionally disconnects Wi-Fi to gain extra time or manipulate deadline. | 6.6 | High | Offline write-ahead buffer maintains answers locally; strict 30-second post-deadline network grace applies ONLY to transmission, never extending answering clock. | Disconnect/reconnect events flagged in proctor timeline. |
| **TH-DOS-02** | Malicious script bombards autosave endpoint with high-frequency concurrent payloads. | 7.0 | High | Sliding-window distributed rate limiter enforces maximum 30 autosaves/min per student session. | HTTP 429 Too Many Requests response with exponential backoff header. |

---

### 3.6 Elevation of Privilege

| Threat ID | Threat Description | DREAD | Risk Level | Native & Platform Mitigation | Detection Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TH-ELEV-01** | Student attempts to access teacher grading endpoints or question bank through Lockdown client. | 8.4 | Critical | Strict RBAC route guards (`ClassroomAuth.verifyAccess(req, id, 'teacher')`) verified against database membership record. | HTTP 403 Forbidden on role mismatch. |
| **TH-ELEV-02** | Student launches nested process or shell via URL protocol handlers (`cmd://`, `powershell://`). | 7.8 | High | Navigation filter blocks all non-Cortex URLs; Webview web resource requests are restricted to approved origin (`https://...`). External link clicks suppressed. | Navigation cancellation logged and blocked immediately. |

---

## 4. ADVERSARIAL ATTACK TREES

### 4.1 Attack Tree: Exfiltrating Exam Questions & Prompts
```
Exfiltrate Exam Questions
├── 1. Clipboard Copying
│   ├── Win32 Hook Suppression (BLOCKED by LowLevelKeyboardHook)
│   ├── Context Menu "Copy" (BLOCKED by Webview ContextMenu disable)
│   └── JS Selection API (BLOCKED by user-select: none & preventDefault)
├── 2. Screen Capture & Recording
│   ├── OS Screenshot (PrintScreen, Win+Shift+S) (BLOCKED by LowLevelKeyboardHook)
│   ├── OBS / Discord Screen Share (BLOCKED by SetWindowDisplayAffinity / WDA_MONITOR)
│   └── External Physical Camera (DETECTED by Webcam Proctoring & Face Tracking)
└── 3. Network Traffic Sniffing
    ├── Inspect Browser DevTools (BLOCKED by disabling F12, Ctrl+Shift+I, Webview DevTools)
    └── MitM Proxy (Fiddler, Charles) (MITIGATED by TLS pinning & Cloudflare Edge Verification)
```

### 4.2 Attack Tree: Escaping Lockdown Kiosk
```
Escape Lockdown Kiosk
├── 1. Task Switching
│   ├── Alt + Tab / Win + Tab (SUPPRESSED by Win32 LowLevelKeyboardHook)
│   ├── Cmd + Tab (SUPPRESSED by macOS AppKit Presentation Options / AAC)
│   └── Multi-Monitor Secondary Desktop (BLOCKED by Multi-Monitor Detection & Blanking)
├── 2. System Interruption
│   ├── Windows Key / Start Menu (SUPPRESSED by LowLevelKeyboardHook)
│   ├── Ctrl + Alt + Delete (DETECTED by Focus Loss event; OS security desktop triggers blur alert)
│   └── Task Manager Launch (BLOCKED / TERMINATED by Process Watchdog)
└── 3. Virtualization & Sandbox
    ├── Running in VirtualBox / VMware (DETECTED by Hypervisor & Hardware Device Checks)
    └── Running in Sandboxie / RDP (DETECTED by Terminal Services session check: GetSystemMetrics(SM_REMOTESESSION))
```

---

## 5. THREAT MITIGATION ACCEPTANCE CRITERIA

Every identified threat has a corresponding verification test in the Cortex Lockdown test suite:
1. All Critical and High threats must be validated with automated tests or formal penetration drill reports.
2. Zero reliance on security through obscurity: all cryptographic operations use standard algorithms (`SHA-256`, `HMAC-SHA256`).
3. Software limitations are explicitly documented rather than masked.
