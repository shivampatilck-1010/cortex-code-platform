# CORTEX LOCKDOWN RC1 - SECURITY LIMITATIONS & THREAT BOUNDARIES

Package Version: 1.0.0-rc1  
Classification: Security Disclosure & Boundary Definition  
Zero Emojis Enforced: Yes  
Code Signing Status: Unsigned Evaluation Release Candidate (INR 0 budget)  

---

## 1. Defended In-Scope Threats

Cortex Lockdown provides robust, user-mode technical containment against the following threat vectors:
- **Application & Task Switching:** Suppression of `Alt + Tab`, `Windows Key`, `Ctrl + Esc`, and common multi-tasking key combinations via a low-level keyboard hook (`WH_KEYBOARD_LL`).
- **Software Screen Recording & Capture:** Window content blacked out against desktop scrapers, screen recorders, and virtual displays via `SetWindowDisplayAffinity(WDA_MONITOR)`.
- **Clipboard Exfiltration & Injection:** System clipboard cleared upon exam entry; copy/paste shortcuts intercepted and blocked.
- **Protocol Replay Attacks:** Single-use replay protection for SAML assertion IDs and LTI launch nonces across process restarts.
- **State Transition Race Conditions:** Atomic Compare-And-Swap (CAS) state updates in SQLite prevent concurrent duplicate submissions.
- **Server-Side Request Forgery (SSRF) on JWKS Retrieval:** Strict HTTPS enforcement, private RFC 1918 IPv4/IPv6 blocking, link-local blocking, loopback blocking, cloud metadata blocking, WHATWG IP normalization, and multi-record DNS rebinding detection.
- **Audit Tampering:** Hash-chained audit logs with HMAC checkpoint signatures.

---

## 2. Explicit Non-Goals & Unmitigated Hardware/System Vectors

### 2.1 Unsigned Binary & Windows Defender SmartScreen
- **Limitation:** The executable is not digitally signed with a commercial Authenticode Extended Validation (EV) certificate (INR 0 budget constraint).
- **Impact:** Unmanaged Windows PCs will display a Windows SmartScreen warning.
- **Boundary:** Bypassing SmartScreen via "Run Anyway" is strictly prohibited. Staging and evaluation must take place on dedicated test workstations authorized by campus IT.

### 2.2 Socket-Level Destination Pinning & Secondary DNS TOCTOU
- **Limitation:** Node.js `fetch` executes an internal secondary DNS lookup at TCP/TLS socket connection time, independent of preflight address validation.
- **Impact:** In environments without an institutional egress forward proxy, a sub-second TTL DNS rebinding window (Time-of-Check to Time-of-Use) exists.
- **Boundary:** Preflight DNS resolution screening mitigates standard SSRF, but does not provide absolute socket-level IP binding. High-security deployments must route traffic through a dedicated forward proxy.

### 2.3 SAML 2.0 W3C XML Canonicalization Blocker
- **Limitation:** The custom internal XML canonicalization implementation is a restricted subset that does not implement full W3C Exclusive XML Canonicalization (C14N). It lacks ancestor namespace inheritance, `InclusiveNamespaces PrefixList` handling, and `xml:lang` inheritance.
- **Impact:** Complex multi-institution SAML federations (e.g. InCommon, eduGAIN) may fail signature verification.
- **Boundary:** Production SAML federation is designated **BLOCKED**. Institutions must utilize LTI 1.3 Advantage or standalone signed launch grants.

### 2.4 SSD / NAND Flash Physical Media Deletion Limitation
- **Limitation:** User-space zeroing and file deletion (`clearEncryptedAnswers`) cannot guarantee physical bit-level destruction on SSD/NVMe/NAND flash media due to Flash Translation Layer (FTL) wear-leveling and out-of-place block reallocation.
- **Boundary:** Protection against post-exam forensic recovery relies on the **AES-256-GCM authenticated encryption barrier** rather than physical flash media sanitization.

### 2.5 External Hardware Video Splitters & Capture Cards
- **Limitation:** Passive HDMI splitters, video distribution amplifiers, and external capture cards (e.g., Elgato Cam Link) capture digital signals directly from the GPU display output cable.
- **Boundary:** User-mode software running on the operating system cannot detect passive downstream hardware taps. Physical in-room proctoring is mandatory.

### 2.6 Virtual Machine Hypervisors & Kernel Drivers (Ring 0)
- **Limitation:** When executed inside an unmanaged guest virtual machine (VMware, VirtualBox, Hyper-V), the host hypervisor can intercept video frames and inject keystrokes. Similarly, malicious kernel drivers with Ring 0 privileges can bypass user-mode hooks.
- **Boundary:** High-stakes examinations must be conducted on physical hardware managed with institutional Windows Defender Application Control (WDAC) or AppLocker policies.

### 2.7 Secondary Out-of-Frame Peripherals
- **Limitation:** Smartwatches, secondary mobile phones, or earphones held outside the webcam's physical field of view cannot be detected by computer vision heuristics.
- **Boundary:** Software proctoring is strictly advisory. Comprehensive academic integrity requires physical proctoring oversight.
