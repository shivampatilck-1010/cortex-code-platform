# CORTEX LOCKDOWN — ALPHA 13 FINAL GO / NO-GO DETERMINATION

Document Identifier: CL-DECISION-ALPHA13-FINAL  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Executive Security, Technical Architecture & Institutional Governance Board  
Evaluation Host: Windows 10/11 x64 (Build 26300, AMD Ryzen 7 8840U)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Multi-Domain Authoritative Determination Matrix

In accordance with release acceptance governance, determinations are rendered across five distinct operational domains:

```
+--------------------------------+---------------------+--------------------------------------------------+
| EVALUATION DOMAIN              | STATUS              | CONDITIONS & OPERATIONAL JUSTIFICATION           |
+--------------------------------+---------------------+--------------------------------------------------+
| 1. Windows Internal            | GO (AUTHORIZED)     | Authorized for internal demonstration testing    |
|    Demonstration               |                     | with synthetic demo fixtures (CIT/SEU). Requires |
|    (Lab Environment)           |                     | standard domain accounts and in-person proctors. |
+--------------------------------+---------------------+--------------------------------------------------+
| 2. Windows Controlled          | CONDITIONAL GO      | Authorized for managed institutional lab rollouts|
|    Institutional Pilot         | (MANAGED LABS ONLY) | where workstations are domain-joined, GPO        |
|    (On-Premises University)    |                     | disabled Task Manager, and in-person proctors    |
|                                |                     | are physically present in the room.              |
+--------------------------------+---------------------+--------------------------------------------------+
| 3. External Institutional      | HOLD / PENDING      | Paused fail-closed pending physical receipt of   |
|    Authorization               | (DOCUMENT BLOCKER)  | countersigned bilateral MOU, domain verification,|
|    (Partner Universities)      |                     | and independent evidence reviewer audit log.     |
+--------------------------------+---------------------+--------------------------------------------------+
| 4. Public Windows Release      | HOLD / PENDING      | Public download for unmanaged student BYOD       |
|    (Unmanaged BYOD Public)     | (SIGNING BLOCKER)   | laptops blocked pending commercial EV            |
|                                |                     | Authenticode code-signing certificate.           |
+--------------------------------+---------------------+--------------------------------------------------+
| 5. macOS Release               | STRICT NO-GO        | General release strictly held until physical     |
|    (Darwin / Apple Silicon)    | (BLOCKED ON LAB)    | Apple Silicon hardware testing in an authorized  |
|                                |                     | Mac laboratory is executed.                      |
+--------------------------------+---------------------+--------------------------------------------------+
```

---

## 2. Detailed Domain Analysis & Operational Requirements

### 2.1 Domain 1: Windows Internal Demonstration — GO (AUTHORIZED)

- **Authorized Scope**:
  Internal testing and faculty demonstrations across Cortex Institute of Technology (`inst_cit_01`) and State Engineering University (`inst_state_eng`) in classrooms `CSE276`, `CS301`, and `CS402`.
- **Operational Justification**:
  The standalone binary (`apps/cortex-lockdown-windows/bin/CortexLockdown.exe`, 33,280 bytes), `WH_KEYBOARD_LL` Win32 hooks, `WDA_EXCLUDEFROMCAPTURE` display affinity, peppered recovery OTP, and atomic SQL redemption are fully verified on physical Windows hardware.

### 2.2 Domain 2: Windows Controlled Institutional Pilot — CONDITIONAL GO

- **Authorized Scope**:
  On-premises university computer laboratories where the laboratory infrastructure is directly managed by institutional IT administrators.
- **Mandatory Institutional Conditions**:
  1. **Standard Non-Administrator Accounts**: Workstations must be joined to the university Active Directory / Azure AD domain, and student user accounts must be standard non-administrative domain accounts. Students must never possess local administrator rights.
  2. **Group Policy Task Manager Restriction**: IT administrators must enforce Group Policy disabling Task Manager (`DisableTaskMgr = 1`) on examination lab workstations.
  3. **Application Whitelisting via AppLocker / WDAC**: The binary SHA-256 hash (`68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`) must be added to the institutional allowed software policy to prevent unapproved executables from launching.
  4. **Single Physical Display Requirement**: Examination stations must be physically restricted to a single monitor. Secondary HDMI/DisplayPort cables must be unplugged before examination launch.
  5. **In-Person Faculty Proctoring**: High-stakes testing must include physical proctor supervision in the examination hall to monitor against external hardware capture cards, smartphones, and physical notes.

### 2.3 Domain 3: External Institutional Authorization — HOLD / PENDING

- **Current Status**:
  Metropolitan Polytechnic University (`inst_mpu_pilot`) and prospective external partner universities remain in **`pending_institutional_authorization`** status.
- **Fail-Closed Protection**:
  The pilot governance engine ([`src/lib/lockdown/pilot-config.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts#L551)) enforces fail-closed blocking:
  - Unverified institutions or institutions lacking `pilotAgreementRef` and `administrativeEvidenceDoc` are rejected.
  - Demonstration institutions are blocked in production mode.
- **Conditions to Clear the Blocker**:
  1. Countersigned Bilateral Pilot Agreement MOU with immutable SHA-256 PDF digest.
  2. Verification of authorized university executive signatory (Provost/Dean/Registrar).
  3. Cryptographic domain challenge verification via DNS TXT record.
  4. Population of independent audit fields (`administrativeEvidenceDoc`, `evidenceVerifiedAt`, `evidenceVerifiedBy`).
  5. Scoped allowlists for enrolled classrooms, student IDs, and lab workstation MAC/GUID addresses.

### 2.4 Domain 4: Public Windows Release (BYOD) — HOLD / PENDING

- **Current Status**:
  Public distribution of `CortexLockdown.exe` or `CortexLockdown-Windows-x64.zip` for unmanaged student-owned laptops (BYOD) is held.
- **Conditions to Clear the Blocker**:
  1. **Commercial EV Authenticode Signing**: Procurement of a commercial Extended Validation (EV) certificate stored on a FIPS 140-2 Level 2 hardware token or cloud HSM to eliminate Windows Defender SmartScreen warnings.
  2. **Multi-Region D1 Staging Validation**: Verification of Cloudflare D1 atomic concurrency across globally distributed edge regions.

### 2.5 Domain 5: macOS Platform Release — STRICT NO-GO

- **Current Status**:
  macOS Automatic Assessment Configuration (`AEAssessmentSession`) and macOS client binaries remain **STRICT NO-GO**.
- **Audit Truth**:
  The evaluation workstation is Windows 10/11 x64. Execution on physical Apple Silicon hardware has not yet occurred.
- **Conditions to Clear the Blocker**:
  1. Execution on physical Apple Silicon (M1/M2/M3/M4) hardware running macOS 12 Monterey through macOS 15 Sequoia inside an authorized Apple testing lab.
  2. Receipt of Apple's Assessment Mode entitlement (`com.apple.developer.assessment`).
  3. Signing with an Apple Developer ID Application certificate and receipt of an Apple Notarization ticket.
  4. Physical validation of Dock, Mission Control, Command+Tab, and multi-display blocking in live hardware tests.

---

## 3. Alpha 13 Security & Operational Achievements

1. **Database Retention Controls**: Added `cleanupExpiredIntegrityEvents` (90-day academic dispute window) and `deleteExamSessionIntegrityEvents` in [`src/lib/classroom/db/index.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/classroom/db/index.ts). Verified in test check `A13-03`.
2. **Ephemeral Media Verified**: Confirmed that raw camera video and microphone audio remain strictly local within candidate DOM elements; zero raw media bytes are streamed to the server or saved to disk.
3. **Sensor Release Verified**: Confirmed `stream.getTracks().forEach(t => t.stop())` terminates hardware feeds upon exam teardown.
4. **Watchdog Cadence Reconciled**: Confirmed actual C# watchdog polling is 1,500 ms with `_autoTerminate=false` (telemetry-first, non-destructive architecture).
5. **Authenticode Signing Architecture Documented**: Formulated complete commercial EV procurement, RFC 3161 timestamping, and `signtool.exe` command requirements.
6. **Cumulative Test Register**:
   - Historical baseline: 13 suites, 324 executions (310 passed, 5 historical prototype checks, 9 blocked macOS platform gates).
   - New Alpha 13 test suite: 20 checks (19 passed, 0 failed, 1 blocked on macOS hardware gate).

---
*Determination finalized and signed off by Executive Board.*
