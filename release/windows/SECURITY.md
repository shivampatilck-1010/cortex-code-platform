# CORTEX LOCKDOWN — SECURITY BOUNDARIES & THREAT MODEL

**Document Version:** 1.0.0-rc1.2  
**Strictly Zero Emojis Enforced:** Yes  

---

## 1. Verified In-Scope Defenses

| Threat Vector | Subsystem Defense | Implementation Details |
| :--- | :--- | :--- |
| **Application Switching** | Low-Level Keyboard Hook | Global `WH_KEYBOARD_LL = 13` hook suppresses Alt+Tab, WinKey, Alt+F4, Alt+Esc, Ctrl+Esc, Function keys. |
| **Remote Screen Sniffing** | Win32 Display Affinity | `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE = 0x11)` renders black canvas to Discord, OBS, Teams. |
| **Cheating Utilities** | Process Watchdog | Background inspection targeting 21 prohibited tools (Wireshark, Fiddler, OBS, Cheat Engine) and title keywords. |
| **Data Tampering** | AES-256-GCM Encryption | Local answer store uses AES-256-GCM with 100,000 PBKDF2 rounds salted with session and student IDs. |
| **Audit Log Tampering** | Cryptographic Hash Chain | Append-only SHA-256 hash chain with periodic HMAC-SHA256 signed checkpoints detecting sequence deletion. |
| **Replay Attacks** | Persistent Replay Cache | SQLite-backed nonce and assertion cache (`lockdown_replay_cache`) enforcing unique constraints. |
| **Candidate Impersonation** | Server Authorization | Route validation rejects submissions where authenticated identity does not match candidate launch grant. |

---

## 2. Hard Security Boundaries & Non-Goals

1. **Secure Attention Sequence (`Ctrl + Alt + Del`):**
   - The SAS keystroke is hardcoded in the Windows kernel and processed by `winlogon.exe`.
   - User-mode applications cannot intercept or disable `Ctrl+Alt+Del`.
   - Documented non-goal requiring physical in-room proctoring.
2. **Hardware HDMI Splitters & External Video Capture Cards:**
   - External hardware taps split the physical TMDS / DisplayPort signal downstream of the GPU transmitter.
   - Undetectable via software APIs. Requires physical proctors to inspect cabling.
3. **User-Mode Process Termination:**
   - Cortex Lockdown executes in standard user mode without a kernel-mode driver (`.sys`).
   - A local Windows Administrator can terminate user-mode processes via taskkill or third-party tools.
   - Deployment must use standard unprivileged student accounts via campus Group Policy.
4. **Outbound SSRF Secondary DNS Lookup (TOCTOU Window):**
   - Preflight DNS resolution screens remote hostnames. However, Node.js `fetch` executes an internal secondary DNS lookup upon TCP socket connection.
   - In zero-trust environments, outbound traffic must route through an enterprise forward proxy with destination socket pinning.
5. **SAML 2.0 Multi-Institution Federation Blocker:**
   - The custom XML canonicalizer lacks ancestor namespace inheritance and prefix lists. Production multi-institution federation remains BLOCKED.
