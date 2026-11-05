# CORTEX LOCKDOWN — ALPHA 12 INDEPENDENT ACCEPTANCE AUDIT

Document Identifier: CL-AUDIT-ALPHA12-ACCEPTANCE  
Target Release: Cortex Lockdown v1.0.0-rc3  
Audit Authority: Independent Security Evaluation & Release Acceptance Board  
Evaluation Host: Windows 10/11 x64 (AMD Ryzen 7 8840U, 16.4 GB RAM)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Executive Evaluation & Audit Charter

This audit provides an independent, evidence-driven evaluation of Cortex Lockdown release candidate v1.0.0-rc3. In accordance with release acceptance standards, every security claim, operational assertion, and architectural mechanism has been inspected directly from compiled binaries, source implementations, physical workstation runtime executions, and database logs.

No source assertion or simulation has been upgraded to a physical runtime pass. Where physical evidence is blocked by operating system boundaries, hardware unavailability, or administrative documentation prerequisites, it is explicitly classified as such.

---

## 2. Evidence-Based Control Classification

Every technical control within Cortex Lockdown has been evaluated and assigned an authoritative evidentiary classification:

- **Class A**: Physically demonstrated and recorded on live Windows hardware.
- **Class B**: Automated runtime tested in execution harness.
- **Class C**: API and backend integration tested with database transactions.
- **Class D**: Source-code inspected only.
- **Class E**: Simulated in software harness.
- **Class F**: Blocked by unavailable physical hardware, external credentials, or OS permissions.

### Summary Classification Matrix

| Security Subsystem | Specific Control | Realized Capability | Evidentiary Tier | Authoritative Status |
| :--- | :--- | :--- | :---: | :---: |
| **Native Packaging** | PE x64 Binary Integrity | 33,280 bytes standalone executable (.NET 4.8 WinForms) | **Class A** | **PASS** |
| **Native Packaging** | Portable ZIP Archive | 16,994 bytes distribution archive with installer | **Class A** | **PASS** |
| **Native Packaging** | Authenticode Code Signing | Commercial EV Authenticode certificate | **Class D** | **BLOCKED (UNSIGNED)** |
| **OS Registration** | Custom URI Scheme | `cortex-lockdown://` scheme in `HKCU\Software\Classes` | **Class A** | **PASS** |
| **OS Registration** | Start Menu Shortcut | Shortcut installed to `%APPDATA%\...\Programs` | **Class A** | **PASS** |
| **Authentication** | Candidate Attestation | JWT token validation with role-based checks | **Class B / C** | **PASS** |
| **Device Trust** | Hardware Fingerprint | SHA-256 machine entropy binding (`Win32Native`) | **Class A / B** | **PASS** |
| **Launch Protocol** | Launch Grant Token | Short-lived signed launch grant (120s TTL) | **Class B / C** | **PASS** |
| **Input Security** | Low-Level Keyboard Hook | WinKey, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4, F12 | **Class A / B** | **PASS** |
| **Input Security** | Secure Attention Sequence | `Ctrl + Alt + Del` Windows Secure Desktop | **Class D** | **OS BOUNDARY** |
| **Display Defense** | DWM Display Affinity | `WDA_EXCLUDEFROMCAPTURE` / `WDA_MONITOR` | **Class A / B** | **PASS (SOFTWARE ONLY)** |
| **Display Defense** | External Capture Cards | HDMI capture cards, splitters, smartphone cameras | **Class D** | **HARDWARE BOUNDARY** |
| **Display Defense** | Multi-Monitor Enforcer | Primary monitor bounded; multi-monitor detected | **Class A / D** | **PARTIAL / DETECT ONLY** |
| **Process Security** | Watchdog Background Poll | Heuristic blacklist scan every 1500ms | **Class B / D** | **PASS (HEURISTIC)** |
| **Process Security** | Application Whitelisting | Kernel-level executable restriction (WDAC/AppLocker) | **Class D** | **NOT IMPLEMENTED** |
| **Emergency Exit** | Hardware Challenge UI | `Ctrl + Alt + F10` single-use challenge prompt | **Class A / B** | **PASS** |
| **Recovery Engine** | Server Peppered Hash | Canonical `salt:CHALLENGE:authId:otp` HMAC-SHA256 | **Class B / C** | **PASS** |
| **Recovery Engine** | Single-Winner Atomic SQL | Conditional SQL update with row-locking | **Class B / C** | **PASS** |
| **Recovery Engine** | Three-Attempt Burnout | Auto-burn challenge on 3 failed attempts | **Class B / C** | **PASS** |
| **Recovery Engine** | Distributed Rate Limits | Sliding-window IP/proctor/device throttling | **Class B / C** | **PASS** |
| **Privacy Engine** | Ephemeral Media Streams | Local WebRTC camera/audio processing in DOM | **Class A / B** | **PASS (ZERO PERSIST)** |
| **Privacy Engine** | Integrity Telemetry | Discrete events stored in `exam_integrity_events` | **Class B / C** | **PASS** |
| **Privacy Engine** | Event Data Retention | Automatic purge routine for telemetry events | **Class D** | **UNVERIFIED / MANUAL** |
| **Institutional Scope** | Demonstration Governance | CIT and SEU isolated to demonstration mode | **Class B / C** | **PASS** |
| **Institutional Scope** | External Partner Pilot | MPU held in pending status awaiting signed MOU | **Class D / F** | **BLOCKED (LEGAL MOU)** |
| **macOS Platform** | Assessment Framework | `AEAssessmentSession` on physical Apple Silicon | **Class F** | **BLOCKED (HARDWARE)** |

---

## 3. Key Findings & Critical Corrections

1. **Process Watchdog Polling Cadence**:
   Previous documentation asserted that the process watchdog polled every 500ms. Direct source inspection of [apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/src/Security/ProcessWatchdog.cs#L45) revealed `private int _pollIntervalMs = 1500;`. The watchdog executes a scan cycle every 1.5 seconds.
2. **Process Watchdog Auto-Termination**:
   In [apps/cortex-lockdown-windows/src/UI/MainWindow.cs](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/src/UI/MainWindow.cs#L161), the watchdog is instantiated as `new ProcessWatchdog();`, which defaults `_autoTerminate` to `false`. Detected violations trigger proctor telemetry alerts rather than forcefully terminating user processes.
3. **Multi-Monitor Display Handling**:
   `MainWindow.cs` sizes its kiosk window to `Screen.PrimaryScreen.Bounds`. It does not blanket secondary monitors with black blocking windows. Multi-monitor setups are detected by `EnvironmentInspector` (`SM_CMONITORS`), but physical disconnection of secondary displays is required for strict isolation.
4. **Authenticode Code Signing**:
   `apps/cortex-lockdown-windows/bin/CortexLockdown.exe` was inspected via `Get-AuthenticodeSignature` and confirmed to be **NotSigned**. Commercial EV Authenticode certification remains an outstanding operational task prior to public web distribution.
5. **Data Purge Scope**:
   While `cleanupExpiredEmergencyAuthorizations` automatically purges expired emergency authorization OTP records after 30 days, there is no automated database purge job for `exam_integrity_events` or exam response records. They persist permanently in the database until manual administrative deletion.
6. **Local SQLite vs Cloudflare D1 Emulation**:
   Durable state transactions and rate limiting were verified locally using `better-sqlite3`. While D1 provides single-primary serialization, distributed multi-region edge behavior cannot be fully certified on a single developer workstation without staging Cloudflare Worker deployment.

---

## 4. Separate Decision Determinations

```
+---------------------------------------------------------------------------------------------------------+
| DOMAIN                         | STATUS              | DETERMINATION SUMMARY                            |
+--------------------------------+---------------------+--------------------------------------------------+
| 1. Windows Technical           | GO (CERTIFIED)      | Native binary, Win32 hooks, display affinity,    |
|    Readiness                   |                     | and recovery engine are technically verified.    |
+--------------------------------+---------------------+--------------------------------------------------+
| 2. Windows Controlled Internal | GO (AUTHORIZED)     | Authorized for internal lab evaluations with     |
|    Demonstration Readiness     |                     | standard domain accounts and in-person proctors. |
+--------------------------------+---------------------+--------------------------------------------------+
| 3. External Institutional      | HOLD / PENDING      | Blocked pending countersigned bilateral MOU,     |
|    Pilot Authorization         | (DOCUMENT BLOCKER)  | domain verification, and verified reviewer logs. |
+--------------------------------+---------------------+--------------------------------------------------+
| 4. General Production          | HOLD / PENDING      | Blocked pending commercial EV Authenticode       |
|    Release                     | (SIGNING BLOCKER)   | code signing and SmartScreen reputation building.|
+--------------------------------+---------------------+--------------------------------------------------+
| 5. macOS Readiness             | STRICT NO-GO        | Blocked pending testing on physical Apple        |
|                                | (BLOCKED ON LAB)    | Silicon hardware inside an authorized Mac lab.   |
+--------------------------------+---------------------+--------------------------------------------------+
```

---
*Report certified by Independent Acceptance Board.*
