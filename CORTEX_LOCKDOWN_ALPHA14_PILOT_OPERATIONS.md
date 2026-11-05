# Cortex Lockdown - Alpha 14 Pilot Operations and Monitoring Runbook

**Document Identifier:** CORTEX-LOCKDOWN-OPS-A14-001  
**Classification:** Operational Security & Administration Runbook  
**Target Release:** v1.0.0-rc3  
**Audience:** Chief Proctors, Floor Invigilators, Lab Technicians, Institutional Administrators  
**Date of Issuance:** November 2026  

---

## 1. Executive Operational Protocol

The Cortex Lockdown Alpha 14 Pilot Operations Runbook governs all supervised operational examinations conducted under the controlled institutional pilot. This protocol defines the chronological lifecycle of an examination session, role-based operational responsibilities, real-time telemetry monitoring, anomalous event handling, and post-examination audit reconciliation.

### Operational Roles and Authorities

| Operational Role | Primary Responsibility | Authorization Scope |
| :--- | :--- | :--- |
| **Institutional Admin** | Pre-flight classroom and quota configuration | Organization-level enrollment, quota override, course binding |
| **Chief Proctor** | Exam lifecycle control and escalation authority | Session initiation, global emergency halt, incident sign-off |
| **Floor Invigilator** | Physical candidate verification and local recovery | Identity checks, candidate challenge relay, station reboot |
| **Lab IT Technician** | Infrastructure, network, and endpoint readiness | GPO enforcement, WDAC maintenance, connectivity monitoring |

---

## 2. Pre-Flight Preparation Checklist (T-60 to T-15 Minutes)

Before candidates enter the examination facility, the Chief Proctor and Lab IT Technician must execute and verify the following sequence:

### Step 1: Infrastructure and Network Readiness Verification (T-60)
1. Verify endpoint local area network connectivity to the authoritative Cortex platform backend.
2. Confirm DNS resolution for the institutional domain and verify TLS 1.3 certificate validity.
3. Verify that institutional firewall allows outbound HTTPS (TCP 443) traffic without deep-packet SSL interception that breaks pinned TLS certificates.
4. Ensure all lab workstations are booted into standard (non-administrative) domain student accounts.

### Step 2: Policy and Quota Pre-Flight Check (T-45)
1. The Institutional Admin logs into the Cortex Admin Console (`/admin/lockdown/pilot`).
2. Verify that the target classroom status is set to `ACTIVE`.
3. Confirm that the enrolled course ID matches the scheduled examination (for example, `CS276_OPERATING_SYSTEMS`).
4. Inspect the `maxConcurrentSessions` quota. Ensure the baseline quota accommodates the scheduled candidate roster with a minimum 10% buffer for re-connections.
5. Verify that the emergency recovery server pepper (`SERVER_PEPPER`) environment variable is healthy and responsive via `/api/v1/lockdown/pilot` health status.

### Step 3: Proctor Dashboard Initialization (T-30)
1. Proctors navigate to the Cortex Proctor Real-Time Dashboard.
2. Establish authenticated WebSocket/SSE telemetry connection to monitor candidate heartbeats.
3. Validate that the candidate roster pre-populates in `PENDING_LAUNCH` status.
4. Test emergency exit relay channel using a staging workstation to ensure proctor challenge generation operates correctly.

### Step 4: Candidate Lab Entry and Physical Inspection (T-15)
1. Invigilators verify student physical institutional identification card against the official exam roster.
2. Direct student to their pre-assigned workstation terminal.
3. Ensure no unauthorized secondary electronics, smartwatches, smartphones, or secondary USB drives are present.
4. Verify that workstations have only a single physical display connected and active.

---

## 3. Examination Launch Protocol (T-0 to T+15 Minutes)

```
[Candidate Browser]
        |
        v  (Step 1: Authenticate via SSO / Session)
[Cortex Web Portal]
        |
        v  (Step 2: POST /api/v1/lockdown/launch-grant)
[Authoritative Backend]
   - Checks Institutional Pilot Enrollment
   - Verifies Candidate Classroom Membership
   - Evaluates Real-Time Active Quota (SQL)
   - Issues 120s HMAC-SHA256 Signed JWT
        |
        v  (Step 3: Protocol URI: cortex-lockdown://launch?token=...)
[Windows Native Shell (CortexLockdown.exe)]
   - Cryptographically verifies Launch Grant Token
   - Validates Hardware Fingerprint & Integrity Policy
   - Enforces DisplayAffinity (WDA_EXCLUDEFROMCAPTURE)
   - Installs Low-Level Keyboard Hook (WH_KEYBOARD_LL)
   - Enters Fullscreen Kiosk Mode (TopMost)
   - Spawns Isolated Edge WebView2 Browser Core
        |
        v  (Step 4: Load Secure Exam UI)
[Candidate Exam Session Active]
```

### Launch Sequence Execution
1. Candidates log into the Cortex web portal using their institutional credentials.
2. Candidate clicks **"Launch Examination in Cortex Lockdown"**.
3. The platform generates an ephemeral, cryptographically signed launch grant (TTL: 120 seconds).
4. Browser triggers the native custom URI protocol handler `cortex-lockdown://launch?token=...`.
5. `CortexLockdown.exe` initializes:
   - Validates token HMAC-SHA256 signature against backend public key/secret.
   - Enforces `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` preventing screen capture.
   - Activates `WH_KEYBOARD_LL` low-level keyboard hook intercepting Windows, Alt+Tab, Ctrl+Esc, Task Manager shortcuts.
   - Pins native window to primary screen in fullscreen borderless kiosk mode.
   - Launches isolated WebView2 runtime loading the secure exam session.
6. The candidate workstation status on the Proctor Dashboard transitions from `PENDING_LAUNCH` to `ACTIVE_LOCKED`.

---

## 4. Real-Time In-Flight Proctor Monitoring

During active testing, invigilators maintain continuous visual and digital monitoring.

### Telemetry Signals and Heartbeat Windows
- **Active Heartbeat Window:** Workstations transmit cryptographic heartbeats every 30 seconds.
- **Grace Period Threshold:** A workstation missing heartbeats for > 120 seconds is flagged as `DISCONNECTED_SUSPENDED`.
- **Active Quota Maintenance:** The backend periodically updates active session counts to prevent zombie session reservation leaks.

### Proctor Event Alert Matrix

| Event Signal | Severity | Automated Action | Proctor Operational Action |
| :--- | :--- | :--- | :--- |
| **Heartbeat Missed (60s)** | Notice | Retry network connection | Monitor candidate workstation screen physically |
| **Heartbeat Expired (120s)** | Warning | Session flagged inactive | Approach workstation; inspect network cable/WiFi |
| **Forbidden Process Detected** | Critical | Watchdog immediately kills process | Native app displays violation dialog; proctor investigates process origin |
| **Multi-Display Attached** | Critical | Screen blackout enforced | Physical disconnection of secondary monitor required |
| **Display Affinity Bypass Attempt** | Critical | Violation logged to backend | Candidate flagged for review; proctor warning issued |
| **Emergency Recovery Requested** | High | Workstation displays 4-digit challenge | Proctor must verify reason before entering recovery OTP |

---

## 5. Anomaly Handling and Incident Recovery Protocols

### Scenario A: Transient Network Dropout (< 5 Minutes)
1. **Application State:**
   - Candidate continues answering questions without disruption.
   - WebView2 buffers question response state in local encrypted `IndexedDB` storage.
   - Top status banner displays subtle offline indicator: *"Network disconnected. Local auto-save active. Do not close application."*
2. **Reconnection:**
   - Upon network restoration, client transmits queued responses with sequential modification timestamps.
   - Backend evaluates `updated_at` timestamps using last-write-wins resolution.
   - Proctor Dashboard restores candidate status to `ACTIVE_LOCKED`.

### Scenario B: Hard Station Crash / Power Outage
1. **Candidate Triage:**
   - Immediately escort candidate to a pre-configured spare lab workstation.
2. **Session Resumption Authorization:**
   - Candidate logs in on the spare terminal.
   - Platform detects pre-existing active session for the candidate.
   - Platform verifies session has not reached `SUBMITTED` or `TERMINATED` state.
   - Candidate requests session resumption.
   - Chief Proctor receives `SESSION_TAKEOVER_REQUEST` on dashboard and verifies candidate identity before approving.
   - Backend issues new launch grant for the spare workstation hardware ID.
   - Candidate resumes exam with previously saved responses fully restored.
   - Chief Proctor logs incident details in the digital exam ledger.

### Scenario C: Authorized Early Emergency Exit
When a candidate experiences medical distress or verified hardware failure:
1. Candidate or Invigilator presses `Ctrl + Alt + F10` on the candidate workstation.
2. Native window renders Emergency Exit Modal displaying:
   - Candidate Name and ID
   - Timestamp and Exam ID
   - Cryptographically random 4-character recovery challenge (for example, `7B9D`)
3. Floor Invigilator visually inspects the workstation and relays the challenge to the Chief Proctor.
4. Chief Proctor enters the candidate ID and challenge code into the Proctor Console:
   - System validates proctor RBAC permissions.
   - System calls `/api/v1/lockdown/emergency-exit` to issue a short-lived 6-digit OTP (TTL: 180 seconds).
   - System records the authorization in `lockdown_emergency_authorizations` with proctor ID and stated reason.
5. Invigilator types the 6-digit OTP into the candidate workstation emergency modal.
6. Native client submits redemption payload to `/api/v1/lockdown/emergency-exit`.
7. Backend executes atomic single-winner conditional redemption.
8. Upon successful validation:
   - Native application unhooks keyboard intercepts (`UnhookWindowsHookEx`).
   - Restores OS display affinity settings.
   - Gracefully terminates WebView2 runtime and closes `CortexLockdown.exe`.
   - Workstation returns to standard Windows desktop environment.

---

## 6. Post-Examination Reconciliation Protocol (T+Final)

### Step 1: Candidate Normal Submission
1. Candidate clicks **"Submit Examination"** within the secure WebView2 interface.
2. Interface displays submission summary (answered questions, unanswered questions).
3. Candidate confirms final submission.
4. Client posts final state to `/api/v1/classroom/exams/[examId]/submit`.
5. Backend marks session status as `SUBMITTED`, locks all response records against further modification, and records final submission timestamp.
6. WebView2 displays official submission confirmation receipt with digital verification hash.
7. Candidate clicks **"Exit Cortex Lockdown"**.
8. Native client restores Windows desktop environment and terminates cleanly.

### Step 2: Roster and Attendance Reconciliation
1. Chief Proctor reviews the Final Submission Ledger on the Proctor Console.
2. System categorizes candidates into:
   - `SUBMITTED_NORMAL`: Completed and submitted by candidate.
   - `AUTO_SUBMITTED_EXPIRED`: Time expired; system automatically locked and graded responses.
   - `EMERGENCY_TERMINATED`: Session closed via authorized emergency recovery protocol.
   - `ABSENT_UNSTARTED`: Candidate never initiated launch grant.
3. Every non-standard status requires recorded proctor justification.

### Step 3: Audit Trail Packaging and Digital Sign-Off
1. Chief Proctor reviews all logged `exam_integrity_events` for the classroom.
2. Confirm that no unresolved hardware or software tampering flags remain unexamined.
3. Chief Proctor signs the digital examination ledger using institutional MFA credentials.
4. Complete audit package (session logs, integrity events, recovery authorizations, submission receipts) is sealed.

### Step 4: Data Retention and Purge Scheduling
1. System marks the session audit records for retention in accordance with institutional policy.
2. Scheduled background maintenance task (`cleanupExpiredIntegrityEvents`) will automatically purge transient integrity telemetry and emergency OTP records after the 90-day academic dispute window expires.
3. Academic grade records and official submission answers remain archived in permanent relational storage.

---

## 7. Escalation Directory and Support Matrix

| Escalation Level | Contact Responsibility | Trigger Event | Response Time Target |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Lab Invigilator)** | Physical assistance, challenge relay | Input lock, screen positioning, student question | Immediate (< 1 minute) |
| **Tier 2 (Lab IT Technician)** | Workstation hardware, LAN drop | Terminal power loss, OS crash, network failure | < 3 minutes |
| **Tier 3 (Chief Proctor)** | Policy override, emergency OTP issuance | Candidate medical event, dispute, session resumption | < 2 minutes |
| **Tier 4 (Cortex Platform On-Call)** | Backend API outage, quota deadlock | Distributed database error, authentication outage | < 5 minutes |
