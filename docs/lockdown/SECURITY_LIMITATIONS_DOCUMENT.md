# CORTEX LOCKDOWN - SECURITY LIMITATIONS AND THREAT BOUNDARIES

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional Public Security Disclosure
Target Audience: Security Auditors, Chief Information Security Officers (CISOs), and Academic Integrity Reviewers

---

## 1. Executive Security Disclosure Philosophy

The Cortex Lockdown engineering team adheres to a strict principle of cryptographic and architectural truthfulness. Security controls must be verified against actual code execution and physical operating system behaviors. We deliberately document known security limitations, threat boundaries, and non-goals to provide institutional decision-makers with a defensible, risk-managed assessment.

---

## 2. Threat Model and Protection Boundaries

Cortex Lockdown is designed to defend against common, unassisted, and moderate-skill candidate cheating attempts on standard Windows workstations.

### In-Scope Threats (Defended)

1. Window Switching and Multitasking: Prevented via fullscreen exclusive kiosk mode and system key suppression (Alt+Tab, WinKey, Ctrl+Esc).
2. Screen Recording and Remote Desktop Scraping: Defended via Windows native `SetWindowDisplayAffinity(WDA_MONITOR)`, rendering the application canvas black to standard GDI, DirectX, and Windows Media capture pipelines.
3. Clipboard Exfiltration and Injection: Defended via automatic clipboard purging and shortcut interception (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+Ins, Shift+Ins).
4. Process Tampering and Injection: Protected by basic integrity monitoring and parent-child process supervision.
5. Replay Attacks on Examination Launch and Submission: Prevented via single-use launch grants, cryptographic nonces, and database Compare-And-Swap (CAS) state transitions.
6. Server-Side Request Forgery (SSRF): Fully mitigated on dynamic JWKS fetching using comprehensive IP/DNS screening (RFC 1918, CGNAT, loopback, IPv4-mapped IPv6, cloud metadata, multi-record DNS rebinding defense).
7. Audit Record Tampering: Prevented via SHA-256 hash chaining and HMAC-signed server checkpoints.

---

## 3. Explicit Security Limitations and Non-Goals

The following attack vectors represent structural limitations of user-mode software operating on unmanaged physical consumer hardware:

### 3.1 External Hardware and Physical Interception (Non-Goal)

* Physical HDMI Splitters and Hardware Capture Cards: External HDMI pass-through devices (such as Elgato Cam Link or hardware splitters) capture video signals after they leave the GPU display controller. No user-mode software can detect or block passive HDMI taps without specialized HDCP-enforced DRM hardware pipelines.
* Secondary Physical Devices: Mobile phones, tablets, smart glasses, or smartwatches positioned outside the webcam field of view cannot be detected through software endpoint controls.
* External Hardware KVM Switches: Physical keyboard/mouse sharing switches allow input injection without leaving operating system traces.

### 3.2 Kernel-Level and Virtual Machine Attacks (Partial / Managed-Device Boundary)

* Ring 0 Kernel Drivers: Malicious software operating with kernel privileges (`SYSTEM` or signed kernel drivers) can hook low-level input subsystems, manipulate page tables, or bypass user-mode keyboard hooks (`WH_KEYBOARD_LL`).
* Type-1 / Type-2 Hypervisors (Virtual Machines): When run inside an unmanaged guest VM (VMware, VirtualBox, QEMU/KVM), the host operating system can view the guest screen and inject keystrokes undetected.
* Mitigation Strategy: In high-stakes institutional settings, examinations must be conducted on institutionally managed endpoints with Windows Defender Application Control (WDAC), AppLocker, and BIOS virtualization controls enabled.

### 3.3 SAML 2.0 Identity Federation (Explicit Limitation)

* Canonicalization Engine: The current SAML XMLDSig verifier implements a deterministic, restricted canonicalization engine. It is not fully conformant with the complete W3C Exclusive XML Canonicalization standard.
* Status: Production federation across multi-institutional federations (InCommon / EduGAIN) is BLOCKED. Institutions must utilize LTI 1.3 Advantage or standalone launch grant tokens until full W3C C14N certification is achieved.

### 3.4 Operating System Crash / Power Loss Boundary

* If the host computer suffers catastrophic hardware power loss (unplugged battery, kernel panic `BSOD`), in-memory keystrokes typed within the 5-second disk flush window may be lost.
* Mitigation: Periodic AES-256-GCM journal commits to local disk ensure that data loss is bounded to at most the preceding 5 seconds of work.

---

## 4. Threat Matrix and Residual Risk Summary

| Attack Vector | User-Mode Mitigation | Residual Risk Level | Institutional Compensating Control |
|---|---|---|---|
| Alt+Tab / WinKey switching | `WH_KEYBOARD_LL` Hook | Low | None required |
| Local screen recorders | `SetWindowDisplayAffinity` | Low | None required |
| Clipboard leakage | Continuous buffer scrub | Low | None required |
| Network disruption | Local AES-256 journal | Very Low | None required |
| Submission replay | Atomic CAS & nonce cache | Zero | None required |
| In-browser developer tools | WebView2 debugging disabled | Zero | None required |
| HDMI hardware capture card | None (hardware physical tap) | Medium | In-person proctoring / room scan |
| Secondary mobile phone | Webcam angle / proctor alerts | Medium | Physical room proctoring |
| Kernel driver injection | User-mode process checks | Medium | Institutional WDAC / AppLocker policy |
| Virtual machine guest | Basic hypervisor checks | Medium | Enforce physical machine policy |
| Multi-IdP SAML Federation | Strict parser (BLOCKED) | High (if unblocked) | Enforce LTI 1.3 Advantage instead |
