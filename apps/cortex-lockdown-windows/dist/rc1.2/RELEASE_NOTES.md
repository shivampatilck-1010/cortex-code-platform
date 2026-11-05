# CORTEX LOCKDOWN RC1.2 - RELEASE NOTES

Release Milestone: Release Candidate 1.2 (RC1.2)  
Build Version: 1.0.0-rc1.2  
Release Date: November 3, 2026  
Target Operating System: Microsoft Windows 10 (21H2+) / Windows 11 (Build 22000+)  
Architecture: x86_64 (AMD64)  
Zero Emojis Enforced: Yes  
Additional Budget Expended: INR 0  

---

## 1. Overview & Milestone Purpose

Cortex Lockdown RC1.2 represents the authoritative release candidate package prepared for academic faculty evaluation and controlled collegiate institutional demonstrations. Building upon the RC1 and RC1.1 qualifications, RC1.2 delivers a complete, self-contained operational documentation suite in `dist/rc1.2/`, introduces the dedicated `IT_PREAUTHORIZATION_GUIDE.md` for managed lab deployments, corrects operational runbooks to reflect actual server-authoritative emergency exit hotkeys (`Ctrl + Alt + F10`), and enforces transparent disclosure of all technical boundaries.

---

## 2. Key Architecture & Operational Enhancements

1. **Dedicated IT Pre-Authorization Guide (`IT_PREAUTHORIZATION_GUIDE.md`):**
   - Provides concrete enterprise deployment recipes for AppLocker (file hash rules), Windows Defender Application Control (WDAC), PowerShell NTFS zone removal, and Microsoft Intune / SCCM lab packaging.
   - Eliminates all instructions recommending faculty or students bypass Windows Defender SmartScreen via "Run Anyway".

2. **Emergency Exit Alignment:**
   - Corrected documentation in operational runbooks to reflect the actual native C# Win32 implementation: hotkey `Ctrl + Alt + F10` triggering server-authoritative single-use code redemption against `/api/v1/lockdown/emergency-exit`.

3. **Bit-for-Bit Binary Integrity Preserved:**
   - All three authoritative demonstration artifacts remain 100% bit-for-bit preserved with verified cryptographic SHA-256 digests:
     - `CortexLockdown-Hardened.exe` (`82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`)
     - `CortexLockdown-Windows-x64.zip` (`08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30`)
     - `CortexLockdown.exe` (`68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`)

4. **Transparent Data Retention & SSD Wear-Leveling Disclosures:**
   - Detailed technical explanation of user-space zeroing versus Flash Translation Layer (FTL) wear-leveling (`DEF-RC1-007`). Confidentiality is guaranteed by the AES-256-GCM authenticated ciphertext barrier.
   - Classification of wire-level network packet capture as verified at the application source code layer, but not verified via live physical wire capture.

5. **Exhaustive Defect & Limitation Registry:**
   - Complete tracking of `DEF-RC1-001` through `DEF-RC1-007` covering SAML federation blocker, Cloudflare D1 concurrency, SSRF socket-pinning TOCTOU window, HDMI splitters, virtual displays, SmartScreen unsigned status, and SSD wear-leveling.

---

## 3. Operational Domain Release Decisions

| Domain | Decision | Summary Rationale |
| :--- | :---: | :--- |
| **Standalone College Faculty Demonstration** | **GO** | Approved for faculty evaluation on IT-authorized testbeds. All lockdown, privacy, and recovery mechanisms verified. |
| **Isolated Institutional Pilot** | **GO (Conditional)** | Approved **conditional upon written institutional authorization and campus IT approval**. Campus IT must pre-authorize hashes via AppLocker/WDAC. |
| **Open Campus BYOD** | **NOT RECOMMENDED** | Unsigned binary triggers SmartScreen; personal machines cannot enforce bare-metal anti-tamper controls. |
| **High-Stakes Certification** | **REJECTED** | User-mode boundaries, lack of kernel driver, and passive HDMI splitters require physical proctoring. |
| **Multi-Institution SAML Federation** | **BLOCKED** | Non-W3C Exclusive C14N XML canonicalizer blocks multi-vendor identity federation. |
| **Cloudflare D1 Production Deployment** | **NOT TESTED** | SQLite WAL mode qualified for single-server; live D1 edge concurrency remains untested. |
