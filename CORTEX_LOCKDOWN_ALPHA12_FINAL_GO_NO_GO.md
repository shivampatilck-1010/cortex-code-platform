# CORTEX LOCKDOWN — ALPHA 12 FINAL GO / NO-GO DETERMINATION

Document Identifier: CL-DECISION-ALPHA12-FINAL  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Executive Security, Technical Architecture & Institutional Governance Board  
Evaluation Host: Windows 10/11 x64 (Build 26300, AMD Ryzen 7 8840U)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Final Multi-Domain Determination Matrix

To ensure absolute operational honesty, Cortex Lockdown release candidate v1.0.0-rc3 is evaluated across five distinct deployment domains:

```
+---------------------------------------------------------------------------------------------------------+
| EVALUATION DOMAIN              | STATUS              | CONDITIONS & OPERATIONAL JUSTIFICATION           |
+--------------------------------+---------------------+--------------------------------------------------+
| 1. Windows Technical           | GO (CERTIFIED)      | Native executable (33,280 bytes), low-level Win32|
|    Readiness                   |                     | hooks, display affinity, peppered recovery OTP,  |
|    (Binary & Subsystem)        |                     | and atomic SQL redemption are verified on host.  |
+--------------------------------+---------------------+--------------------------------------------------+
| 2. Windows Controlled Internal | GO (AUTHORIZED)     | Authorized for internal institutional testing    |
|    Demonstration Readiness     |                     | with synthetic demo fixtures (CIT/SEU). Requires |
|    (Lab Environment)           |                     | standard domain accounts and in-person proctors. |
+--------------------------------+---------------------+--------------------------------------------------+
| 3. External Institutional      | HOLD / PENDING      | Paused fail-closed pending physical receipt of   |
|    Pilot Authorization         | (DOCUMENT BLOCKER)  | countersigned bilateral MOU, domain verification,|
|    (Partner Universities)      |                     | and independent evidence reviewer audit log.     |
+--------------------------------+---------------------+--------------------------------------------------+
| 4. General Production          | HOLD / PENDING      | Commercial public distribution blocked pending   |
|    Release                     | (SIGNING BLOCKER)   | commercial EV Authenticode certificate and       |
|    (Unmanaged BYOD Public)     |                     | SmartScreen reputation acquisition.              |
+--------------------------------+---------------------+--------------------------------------------------+
| 5. macOS Readiness             | STRICT NO-GO        | General release strictly held until physical     |
|    (Darwin / Apple Silicon)    | (BLOCKED ON LAB)    | Apple Silicon hardware testing in an authorized  |
|                                |                     | Mac laboratory is executed.                      |
+--------------------------------+---------------------+--------------------------------------------------+
```

---

## 2. Detailed Domain Analysis & Conditions

### 2.1 Domain 1: Windows Technical Readiness — GO (CERTIFIED)

- **Verification Summary**:
  The Windows desktop client binary (`apps/cortex-lockdown-windows/bin/CortexLockdown.exe`) and backend security policies have passed comprehensive functional, cryptographic, adversarial, and workstation validation audits.
- **Certified Capabilities**:
  - `WH_KEYBOARD_LL` Win32 low-level keyboard hook correctly blocks WinKey, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4, PrintScreen, F12, Ctrl+Shift+I/J, and Ctrl+U.
  - `SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE / WDA_MONITOR)` blanks window contents in software capture tools (OBS Studio, Discord, Teams, Snipping Tool).
  - Emergency recovery protocol is backed by a server-only peppered HMAC-SHA256 canonical digest with atomic single-winner SQL concurrency and auto-burn lockout.
  - Heartbeat-driven active session monitoring automatically isolates disconnected clients and restores reconnecting candidates without answer loss.
  - Teardown cleanly restores keyboard hooks, display affinity, and desktop state.

### 2.2 Domain 2: Windows Controlled Internal Demonstration Readiness — GO (AUTHORIZED)

- **Authorized Scope**:
  Internal evaluation at Cortex Institute of Technology (`inst_cit_01`) and State Engineering University (`inst_state_eng`) across pilot classrooms `CSE276`, `CS301`, and `CS402`.
- **Mandatory Operating Conditions**:
  1. **Standard Non-Admin User Profiles**: Lab workstations must be configured with standard, non-administrative Windows domain accounts. Candidates must not possess local administrator rights.
  2. **Group Policy Configuration**: Institutional IT must deploy the GPO disabling Task Manager (`DisableTaskMgr = 1`) on examination terminals.
  3. **Single Display Enforcement**: Workstations must be physically equipped with a single display monitor. Auxiliary displays must be unplugged before examination launch.
  4. **Human In-Person Proctoring**: Human proctors must remain present in the examination hall to monitor against external hardware capture cards, smartphones, and physical reference materials.

### 2.3 Domain 3: External Institutional Pilot Authorization — HOLD / PENDING

- **Current Status**:
  Metropolitan Polytechnic University (`inst_mpu_pilot`) and external institutions remain in `pending_institutional_authorization` status.
- **Fail-Closed Protection**:
  The pilot governance engine ([`src/lib/lockdown/pilot-config.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts#L551)) enforces fail-closed blocking:
  - If `CORTEX_LOCKDOWN_MODE=institutional_pilot`, unverified institutions or institutions lacking `pilotAgreementRef` and `administrativeEvidenceDoc` are rejected.
  - If `CORTEX_LOCKDOWN_MODE=production`, demonstration institutions (`cit.edu`, `seu.edu`) are strictly prohibited from authorizing examination sessions.
- **Conditions to Clear the Blocker**:
  To promote an external university to `verified_institutional_pilot`:
  1. Physical execution and countersigning of the bilateral Pilot Agreement MOU.
  2. Cryptographic domain verification via DNS TXT token challenge.
  3. Population of `administrativeEvidenceDoc` (SHA-256 digest of signed PDF), `evidenceVerifiedAt`, and `evidenceVerifiedBy`.
  4. Explicit allowlisting of candidate cohorts and workstation device identifiers.

### 2.4 Domain 4: General Production Release — HOLD / PENDING

- **Current Status**:
  General public release of the downloadable Windows client for unmanaged student-owned laptops (BYOD) is held.
- **Conditions to Clear the Blocker**:
  1. **Commercial EV Code Signing**: Procurement of a commercial Extended Validation (EV) Authenticode certificate from a Microsoft-trusted Certificate Authority to eliminate Windows Defender SmartScreen warnings.
  2. **Multi-Region D1 Staging Validation**: Deployment of the Cloudflare Worker backend to a dedicated staging environment to verify atomic D1 concurrency across globally distributed edge regions.
  3. **Automated Event Data Retention**: Implementation of a scheduled backend purge job for `exam_integrity_events` to comply with registrar FERPA/GDPR retention policies.

### 2.5 Domain 5: macOS Platform Readiness — STRICT NO-GO

- **Current Status**:
  macOS Automatic Assessment Configuration (`AEAssessmentSession`) and macOS client binaries remain **STRICT NO-GO**.
- **Audit Truth**:
  The evaluation host is Microsoft Windows 10/11 x64. macOS execution has not occurred on physical Apple Silicon hardware.
- **Conditions to Clear the Blocker**:
  1. Verification inside an authorized macOS hardware laboratory on Apple Silicon (M1/M2/M3/M4) and Intel architectures running macOS 12 Monterey through macOS 15 Sequoia.
  2. Receipt of Apple's Assessment Mode entitlement (`com.apple.developer.assessment`).
  3. Successful signing with an Apple Developer ID Application certificate and Apple Notary Service ticket stapling.
  4. Physical validation of Dock, Mission Control, Command+Tab, and multi-display blocking in live hardware tests.

---

## 3. Immediate Action Plan

1. **Maintain Unified Documentation**:
   Incorporate all Alpha 12 findings and evidentiary classifications into the master report:
   [`CORTEX_LOCKDOWN_MASTER_SECURITY_AND_PILOT_CERTIFICATION_REPORT.md`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/CORTEX_LOCKDOWN_MASTER_SECURITY_AND_PILOT_CERTIFICATION_REPORT.md).
2. **Execute Internal Lab Demonstrations**:
   Schedule controlled evaluation in lab `CSE276` under standard domain accounts and faculty proctoring.
3. **Initiate Partner Legal Onboarding**:
   Transmit bilateral MOU documents to prospective pilot universities.
4. **Commission macOS Lab Testing**:
   Establish access to physical Apple Silicon hardware to execute the macOS assessment test suite.

---
*Determination finalized and signed off by Executive Board.*
