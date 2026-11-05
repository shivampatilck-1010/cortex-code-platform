# CORTEX LOCKDOWN RC1.2 - SECURITY LIMITATIONS & ARCHITECTURAL BOUNDARIES

Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10/11 x64  
Classification: Security Architecture & Risk Disclosure Specification  
Zero Emojis Enforced: Yes  

---

## 1. Architectural Scope & Operating Context

Cortex Lockdown is designed as a lightweight, user-mode Windows desktop application engineered under a strict INR 0 development budget. It provides defensible, non-invasive examination integrity for university and collegiate computer laboratories without deploying risky third-party kernel drivers or invasive rootkits.

Institutions must review the following technical boundaries when assessing operational suitability.

---

## 2. In-Scope Security Capabilities

| Subsystem | Mechanism | Operational Effectiveness |
| :--- | :--- | :--- |
| **Kiosk Fullscreen Lock** | Win32 Topmost Window (`WS_EX_TOPMOST`) | Prevents student navigation away from the active examination window. |
| **Keyboard Suppression** | Low-Level Keyboard Hook (`WH_KEYBOARD_LL`) | Successfully intercepts and suppresses `Alt + Tab`, `VK_LWIN`, `VK_RWIN`, `Alt + Esc`, `Ctrl + Esc`, and `Ctrl + Shift + Esc`. |
| **Screen Capture Defense** | `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` with fallback to `WDA_MONITOR` | Blackens the window across software capture tools, screen recorders (OBS, Camtasia), and video sharing (Zoom, Teams). |
| **Process Watchdog** | Toolhelp32 Snapshot Monitor (1000ms loop) | Detects, flags, and optionally terminates known disassemblers, sniffers, and communication tools. |
| **Answer Journaling** | AES-256-GCM authenticated encryption | Protects local in-progress answers against power failure or network disconnection. |
| **Server CAS Submission** | Compare-And-Swap database state transition | Guarantees exactly-one authoritative final submission per candidate session. |
| **Proctor Emergency Exit** | Hotkey `Ctrl + Alt + F10` with single-use challenge | Server-authoritative proctor authorization required to dismiss the kiosk mode. |

---

## 3. Explicit Non-Goals & Architectural Boundaries

### 3.1 User-Mode Execution & Lack of Kernel Drivers
- **Boundary:** Cortex Lockdown operates entirely in Windows User Mode (Ring 3). It does not deploy kernel-mode filter drivers (`.sys`), kernel hooks, or custom hypervisors.
- **Rationale:** Kernel drivers introduce substantial stability risks (potential Blue Screen of Death / BSOD), require expensive EV driver signing certificates and Microsoft WHQL certification (incompatible with INR 0 budget), and violate student device integrity principles.

### 3.2 Inability to Intercept `Ctrl + Alt + Del`
- **Boundary:** User-mode applications **CANNOT** intercept or suppress the `Ctrl + Alt + Del` key sequence.
- **Technical Reality:** The Windows Secure Attention Sequence (SAS) is processed directly by the kernel and `winlogon.exe`. User-mode keyboard hooks (`WH_KEYBOARD_LL`) are explicitly bypassed by the Windows input subsystem for `Ctrl + Alt + Del`.
- **Mitigation:** Cortex Lockdown disables Task Manager via user registry policy (`DisableTaskMgr = 1`) and monitors foreground focus. If a candidate invokes the Windows security screen, the application detects loss of focus (`WM_KILLFOCUS`) and generates an immediate proctor alert.

### 3.3 Hardware HDMI Splitters & External Video Capture Cards (`DEF-RC1-004`)
- **Boundary:** Passive external HDMI splitters and physical video capture cards tap signals downstream of the GPU display output and cannot be detected via software APIs.
- **Operational Requirement:** Mitigation relies upon physical proctor room inspection, workstation cable audits, and dedicated laboratory environments.

### 3.4 Virtual Machine & Hypervisor Execution
- **Boundary:** Running inside virtual machine guests (VMware, VirtualBox, QEMU, Hyper-V) allows host-level cheating that guest-level software cannot fully prevent.
- **Operational Requirement:** High-stakes examinations must be conducted on bare-metal physical hardware. Virtualized execution is restricted to testing and staging.

### 3.5 Outbound Connection-Level Socket Pinning TOCTOU Window (`DEF-RC1-003`)
- **Boundary:** Node.js `fetch` executes an internal secondary DNS lookup at socket connection time independent of the preflight validation in `isSsrfSafeUrlAsync`. A sub-second TTL DNS rebinding race condition is theoretically possible.
- **Mitigation:** In high-security production deployments, outbound federation traffic must be routed through an institutional forward proxy that enforces destination IP address pinning.

### 3.6 Multi-Institution SAML 2.0 Federation Blocked (`DEF-RC1-001`)
- **Boundary:** The custom XML canonicalizer does not implement full W3C Exclusive XML Canonicalization (C14N).
- **Status:** SAML 2.0 multi-institution federation is formally designated **BLOCKED**. Institutions should utilize LTI 1.3 Advantage or standalone launch grants.

### 3.7 Physical Flash Wear-Leveling Erasure Boundary (`DEF-RC1-007`)
- **Boundary:** User-space zeroing and file unlinking cannot guarantee physical destruction of flash blocks on SSD/NVMe media due to Flash Translation Layer (FTL) wear leveling.
- **Assurance:** Confidentiality relies upon AES-256-GCM encryption with 100,000 PBKDF2 iterations; stale physical flash blocks contain only unrecoverable ciphertext.
