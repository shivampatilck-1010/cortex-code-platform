# Cortex Lockdown: Security Model & Architectural Limitations
## Honest Technical Disclosure of Security Boundaries & Threat Modeling

### 1. Executive Summary
Cortex Lockdown is designed to make unauthorized collaboration, application switching, and examination tampering substantially more difficult. It does NOT promise impossible guarantees or zero-cheating claims.

This document clearly distinguishes what security controls are enforced at each deployment level.

---

### 2. Threat Modeling & Security Capabilities

| Threat Category | Mitigated in Demo / BYOD Mode? | Mitigated in Managed Lab Mode? | Technical Mechanism & Limitations |
| :--- | :--- | :--- | :--- |
| **Shortcut Application Switching** (`Alt+Tab`, `WinKey`, `Alt+F4`, `Task View`) | YES | YES | Low-level Windows hook (`WH_KEYBOARD_LL`) intercepts hotkeys before reaching Windows shell. |
| **Software Screen Recording & Screenshots** (Snipping Tool, OBS, Discord) | YES | YES | Native `SetWindowDisplayAffinity(hwnd, WDA_MONITOR)` renders window pitch-black to capture APIs. |
| **Prohibited Background Processes** (Wireshark, Process Hacker, Telegram) | YES | YES | Background watchdog polls active processes every 1,500ms; dispatches telemetry events to proctors. |
| **Local Answer Tampering on Disk** | YES | YES | AES-256-GCM ciphertext authenticated encryption with PBKDF2 (100k) key derivation and AAD binding. |
| **Replay & Out-of-Order Sync Attacks** | YES | YES | Monotonic sequence number enforcement; HTTP 409 conflict rejection on sequence regression. |
| **Secure Attention Sequence** (`Ctrl+Alt+Delete`) | **NO** | **YES** | Windows reserves `Ctrl+Alt+Delete` strictly for Winlogon at Ring 0. Interception requires Active Directory GPO. |
| **Hardware Video Capture** (HDMI Splitters, External Capture Cards) | **NO** | **NO** | Operates outside the Windows OS at the physical HDMI layer. Requires supervised human invigilation. |
| **External Smartphone / Second Device** | **NO** | **NO** | Physical hardware operated off-screen. Requires human room invigilators. |
| **Ring 0 / Kernel-Level Tampering** (Custom Drivers, Hypervisors) | **NO** | **YES** | Root/administrator users on personal BYOD PCs can modify kernel space. Requires locked institutional PCs with Secure Boot. |

---

### 3. Detailed Boundary Analysis

#### 3.1 Ring 0 Secure Attention Sequence (`Ctrl+Alt+Delete`)
- **Technical Reality**: In Windows, `Ctrl+Alt+Delete` is handled exclusively by the Winlogon system process at Ring 0. Microsoft deliberately prevents user-mode applications (including all commercial lockdown browsers) from suppressing this sequence.
- **BYOD Environment**: A candidate on an unmanaged personal computer can press `Ctrl+Alt+Delete` to open the lock screen or Task Manager. While Cortex Lockdown detects the resulting window blur and dispatches an integrity alert, it cannot physically prevent the keypress.
- **Institutional Managed Lab**: In university computer labs, `Ctrl+Alt+Delete` options (Task Manager, Lock Computer, Switch User) are disabled via Active Directory Group Policy (GPO).

#### 3.2 Physical Evasion & External Hardware
- **Technical Reality**: No software running on a computer can detect an external hardware HDMI splitter connected to the video output, or a smartphone camera propped beside the monitor.
- **Operational Requirement**: Software examination kiosks must be combined with supervised human invigilation or camera proctoring protocols during high-stakes examinations.

#### 3.3 Cryptographic Non-Repudiation vs Symmetric Authentication
- **Technical Reality**: Submission receipts (`CORTEX-SUB-[16-HEX]`) are generated using HMAC-SHA256 with a server-side pepper.
- **Semantic Precision**: HMAC provides symmetric origin authentication and data integrity between the client and the backend server. It does NOT provide legal non-repudiation against the server itself, as anyone with access to the server pepper could compute valid receipts. True non-repudiation would require asymmetric public-key cryptography (e.g., ECDSA with private keys stored in hardware HSMs).

#### 3.4 Solid-State Drive (SSD) Physical Sanitization
- **Technical Reality**: Overwriting an answer file with zeros before unlinking clears operating system file cache buffers, but Flash Translation Layers (FTL) on modern SSDs remap logical block addresses for wear leveling.
- **Cryptographic Erasure**: Genuine protection against NAND flash forensic recovery is achieved through **Crypto-Shredding**: the ephemeral session key and salt envelopes are zeroed and unlinked. Without the key, residual NAND blocks remain computationally undecryptable ciphertext.
