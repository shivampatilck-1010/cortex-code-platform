# CORTEX LOCKDOWN — RELEASE NOTES (VERSION 1.0.0-RC1.2)

**Release Date:** November 3, 2026  
**Milestone:** Production Readiness & Windows Public Download Release Gate  
**Target Platform:** Microsoft Windows 10/11 x64 Institutional Baseline  
**Budget Expenditure:** INR 0  
**Strictly Zero Emojis Enforced:** Yes  

---

## 1. Executive Release Overview

Cortex Lockdown v1.0.0-rc1.2 represents the authoritative release candidate for institutional evaluation, faculty demonstration, and supervised campus staging pilots. The platform provides a hardened desktop examination environment seamlessly integrated with the Cortex examination management backend.

This release consolidates 390 cumulative regression checks, 90 RC1.2 comprehensive qualification checks, and physical execution baselines on Windows 11 AMD Ryzen 7 hardware.

---

## 2. Key Capabilities & Architectural Highlights

1. **Win32 Kiosk & Hardware Shielding:**
   - Global low-level keyboard hook (`WH_KEYBOARD_LL = 13`) suppressing `Alt+Tab`, `Alt+F4`, `Windows Key`, `Alt+Esc`, `Ctrl+Esc`, and `F1`-`F12`.
   - Hardware-assisted display capture shielding (`SetWindowDisplayAffinity / WDA_EXCLUDEFROMCAPTURE = 0x11`) with automatic fallback to `WDA_MONITOR = 0x01`.
   - Process watchdog inspecting running tasks against a 21-tool blacklist and scanning window titles for renamed executables.
2. **Encrypted Local Persistence & Offline Resilience:**
   - Candidate responses are encrypted on local disk using AES-256-GCM authenticated encryption.
   - Encryption keys derived via PBKDF2 (100,000 SHA-256 rounds) salted with session, candidate, and exam IDs.
   - Offline queue automatically buffers answers during network disconnects and synchronizes upon reconnection.
3. **Privacy-First In-RAM Proctoring:**
   - Facial orientation (MediaPipe Face Mesh) and acoustic volume (RMS) operate strictly within volatile RAM.
   - Zero raw video frames or continuous audio feeds are stored to disk or transmitted across the wire.
4. **LTI 1.3 Advantage Integration:**
   - IMS Global LTI 1.3 Advantage Core Launch via OIDC and RS256 JWT validation.
   - Dynamic JWKS resolution with rate-limiting, local caching, and SSRF URL/IP validation.
5. **Database Concurrency & Provenance:**
   - SQLite 3 with Write-Ahead Logging (WAL) and 5,000 ms busy timeout.
   - Cryptographic append-only audit hash chain and HMAC-SHA256 checkpoints with multi-key keyring rotation.
   - Atomic CAS state transitions (`in_progress` -> `submitted`).

---

## 3. Verified Cryptographic Release Artifacts

| Artifact | Filename | Size (Bytes) | SHA-256 Checksum | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Portable Distribution ZIP** | `CortexLockdown-Windows-x64.zip` | 18,700 | `08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30` | **MATCHED (Bit-for-Bit)** |
| **Hardened Windows Binary** | `CortexLockdown-Hardened.exe` | 35,840 | `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895` | **MATCHED (Bit-for-Bit)** |

---

## 4. Multi-Domain Operational Release Decisions

| Domain | Status | Operational Decision & Summary |
| :--- | :---: | :--- |
| **Controlled Demonstration** | **GO** | Approved for faculty demonstration in proctored environments on IT-authorized Windows test workstations. |
| **Faculty Evaluation Lab** | **GO** | Approved for institutional review by faculty and IT departments on designated lab devices. |
| **Managed Staging Pilot** | **GO (Conditional)** | Approved conditional upon written institutional authorization and campus IT pre-authorization. |
| **Public Windows Download** | **NOT RECOMMENDED** | Not recommended due to unsigned binary SmartScreen warnings and user-mode boundaries on personal PCs. |
| **High-Stakes Examination** | **REJECTED** | Rejected due to user-mode boundaries, lack of kernel driver, and passive HDMI splitters. |
| **Public BYOD** | **REJECTED** | Rejected due to untrusted student host OS environments, virtualization, and lack of managed policies. |
| **SAML Federation** | **BLOCKED** | Blocked due to restricted XML canonicalization engine (DEF-RC1-001). |
| **macOS Platform** | **BLOCKED** | Blocked. Win32-specific APIs; non-goal for v1.0. |

---

## 5. Active Known Defect Register

- `DEF-RC1-001`: Non-W3C Exclusive C14N XML canonicalization blocks multi-institution SAML federation.
- `DEF-RC1-002`: Cloudflare D1 high-concurrency lockdown workloads remain untested live.
- `DEF-RC1-003`: Node.js fetch secondary DNS lookup introduces theoretical sub-second TOCTOU window.
- `DEF-RC1-004`: Hardware HDMI splitters operate downstream of GPU and cannot be detected via software.
- `DEF-RC1-005`: User-mode process can be terminated by local Administrator without a kernel driver.
- `DEF-RC1-006`: Unsigned binary triggers Defender SmartScreen on unmanaged PCs; requires IT pre-authorization.
- `DEF-RC1-007`: Solid-state drive FTL wear leveling prevents physical bit erasure guarantees.
