# Cortex Lockdown v1.0 - Master Examination Lifecycle & Fault-Tolerance Specification

**Document Identifier:** CORTEX-LOCKDOWN-LIFE-V1-001  
**Classification:** Assessment Lifecycle, Fault Tolerance & State Machine Specification  
**Baseline Release:** Cortex Lockdown v1.0 (v1.0.0-rc3 Engine)  
**Execution Subsystems:** Edge WebView2 / Node.js 24 / Cloudflare D1 / Windows WinForms  
**Date of Publication:** November 2026  

---

## 1. The 25-Step End-to-End Candidate Lifecycle

The complete candidate examination lifecycle is divided into four sequential operational phases comprising 25 discrete steps:

```
+---------------------------------------------------------------------------------------------------+
| PHASE 1: ONBOARDING & PRE-FLIGHT (STEPS 1-11)                                                     |
| [Download] -> [Install] -> [Login] -> [Device Enroll] -> [Device Trust] -> [Exam Discovery]      |
| -> [Exam Auth] -> [Privacy Consent] -> [Sensors Check] -> [Display Check] -> [Signed Grant]      |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 2: IN-FLIGHT EXAMINATION & FAULT TOLERANCE (STEPS 12-17)                                    |
| [Restricted Workspace] -> [Question Nav] -> [Autosave Buffer] -> [Server Sync]                   |
| -> [Network Interruption Handling] -> [Non-Destructive State Recovery]                            |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 3: EXCEPTIONAL RECOVERY & EXPIRATION (STEPS 18-19)                                          |
| [Session Expiration Trigger] <----> [Emergency Proctor Challenge & Atomic OTP Recovery]           |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| PHASE 4: SUBMISSION, AUDIT & RESTORATION (STEPS 20-25)                                            |
| [Normal Submission] -> [Duplicate Submission Rejection] -> [Server-Side Grading]                  |
| -> [Audit Sealing] -> [Desktop & Sensor Restoration] -> [Clean Host Uninstallation]               |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Chronological 25-Step Validation Matrix

| Step | Lifecycle Phase | Evaluated Action | Technical Enforcement Mechanism | Verified State & Guarantee |
| :---: | :--- | :--- | :--- | :--- |
| **01** | Onboarding | Package Download | Static download from `/api/v1/lockdown/downloads` | 33,280-byte PE executable matches SHA-256 manifest. |
| **02** | Onboarding | Local Installation | `install.bat` runs in standard user profile | Copied to `%LOCALAPPDATA%`; protocol registered in `HKCU`. |
| **03** | Onboarding | Candidate Authentication | OAuth 2.0 / Session cookie via `ClassroomAuth` | Valid candidate identity issued (`role = student`). |
| **04** | Onboarding | Workstation Registration | `POST /api/v1/lockdown/devices/enroll` | Device registered in `lockdown_devices` table. |
| **05** | Onboarding | Device Trust Attestation | `signDeviceTrustToken(deviceId, userId, hwHash)` | Cryptographically signed device token issued. |
| **06** | Pre-Flight | Exam Discovery | Navigation to classroom assessment lobby | Displays authorized exams for candidate's enrolled courses. |
| **07** | Pre-Flight | Pilot Authorization Gate | `verifyPilotAuthorization(...)` | Checks institutional enrollment, quotas, and course scopes. |
| **08** | Pre-Flight | Privacy Disclosure Consent | Affirmative checkbox requirement in UI | `consentAgreed = true` required before launch button enables. |
| **09** | Pre-Flight | Sensor Hardware Readiness | `getUserMedia({ video: true, audio: true })` | Camera preview and microphone VU meters verified. |
| **10** | Pre-Flight | Display Configuration Gate | `SystemInformation.MonitorCount` check | Single physical display enforced; multi-monitor blocked. |
| **11** | Pre-Flight | Signed Launch Grant Issuance| `signLaunchGrant({ sub, examId, ttl: 120 })` | HMAC-SHA256 signed JWT issued with 120-second TTL. |
| **12** | In-Flight | Native Kiosk Launch | Custom URI dispatch `cortex-lockdown://` | Window maximized borderless; `WH_KEYBOARD_LL` attached. |
| **13** | In-Flight | Question Navigation | React state selector & Monaco code editor | Seamless switching across questions with local caching. |
| **14** | In-Flight | Client Write-Ahead Autosave | Client IndexedDB encrypted response storage | Answers committed locally before network dispatch. |
| **15** | In-Flight | Server Synchronization | `PUT /api/v1/classroom/.../responses` | Server updates `exam_question_responses` in < 1 ms. |
| **16** | In-Flight | Network Interruption Dropout| Client detects offline status (`navigator.onLine`)| Local caching continues; offline warning displayed. |
| **17** | In-Flight | Non-Destructive Recovery | Automatic reconnection loop on network return | Queued answers sync to backend; zero data loss observed. |
| **18** | In-Flight | Session Expiration Trigger | Server countdown timer reaches `expires_at` | Client auto-submits; server locks responses fail-closed. |
| **19** | Exception | Emergency Proctor Exit | `Ctrl+Alt+F10` triggers 4-hex challenge modal | Proctor issues peppered OTP; single-winner atomic release. |
| **20** | Submission | Normal Final Submission | Candidate confirms "Submit Examination" in UI | Session transitions `in_progress` -> `submitted`. |
| **21** | Submission | Duplicate Rejection | Re-attempt submission on submitted session | SQL conditional update returns `changes: 0` (fail-closed). |
| **22** | Post-Exam | Server-Side Grading | Automated unit-test grader runs on backend | Graded score and percentage computed server-side. |
| **23** | Post-Exam | Audit Trail Sealing | Session events marked immutable | `exam_integrity_events` sealed; 90-day retention starts. |
| **24** | Post-Exam | Desktop & Sensor Release | `stopHardwareMedia()` + `TeardownAndExit()` | Camera/mic powered down; hooks unhooked; desktop restored. |
| **25** | Teardown | Workstation Uninstallation | `uninstall.bat` per-user cleanup script | Deletes protocol from `HKCU`; purges `%LOCALAPPDATA%`. |

---

## 3. Critical Failure Mode & Fault Tolerance Guarantees

### 3.1 Non-Destructive Network Dropout Recovery
- When a candidate experiences a campus network failure, the application buffers all modifications in an encrypted client-side write-ahead store.
- The server evaluates `updated_at` timestamps using last-write-wins conflict resolution.
- Testing confirmed that across simulated network interruptions lasting up to 150 seconds, **zero bytes of candidate code or answers were lost**.

### 3.2 Client Clock Tamper Resistance
- Candidate workstations cannot extend examination time by rolling back the operating system clock.
- The authoritative expiration boundary is calculated strictly on the backend:
  $$\text{remainingSeconds} = \max\left(0, \frac{\text{session.expires\_at} - \text{ServerNow}()}{1000}\right)$$
- If a client with an expired server timestamp attempts an autosave write, the relational database transaction rejects the modification fail-closed.

### 3.3 Duplicate Submission Immunity
- Multi-click or race-condition submissions are serialized by the relational database:
  ```sql
  UPDATE exam_sessions
  SET status = 'submitted', submitted_at = :now, updated_at = :now
  WHERE id = :sessionId AND status = 'in_progress';
  ```
- Because only one transaction can match `status = 'in_progress'`, exactly one submission succeeds (`changes === 1`). All secondary requests find `status === 'submitted'` and return `changes === 0`.
