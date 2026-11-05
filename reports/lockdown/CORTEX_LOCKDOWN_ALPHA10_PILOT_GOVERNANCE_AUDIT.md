# CORTEX LOCKDOWN ALPHA 10 — PILOT GOVERNANCE & CAPACITY RECONCILIATION AUDIT

Document Version: 1.0.0-rc3-alpha10  
Classification: Institutional Operations & Governance Audit  
Target Audience: Academic Deans, Registrar's Office, Exam Coordinators, Compliance Auditors  
Strict Policy: Zero Emojis  

---

## 1. Executive Summary

Cortex Lockdown Alpha 10 establishes a reconciled governance and operational capacity framework for institutional deployments. This audit certifies that institutional enrollments require documented administrative evidence, that classroom quotas operate under a dual baseline/hard-ceiling architecture, and that concurrent student sessions are counted authoritatively from durable database records while filtering out ghost and abandoned connections.

The audit resolves historical ambiguity regarding classroom capacity limits (reconciling the 50-candidate baseline with classroom-specific hard maximums such as 60 for CSE 276) and enforces administrative accountability: no quota increase may occur without mandatory written justification and immutable audit logging.

---

## 2. Reconciled Classroom Quota Architecture

### 2.1 Baseline Quota vs Hard Maximum Ceilings

Classroom capacities in educational institutions rarely match a flat global limit. Physical lab workstation counts, proctor staffing ratios, and network subnet bandwidth vary between campuses and lecture halls.

Alpha 10 introduces a dual-parameter capacity model:
- **Baseline Quota (`baselineQuota`)**: The planned nominal cohort size for standard scheduled examination sessions (default: 50).
- **Hard Maximum Ceiling (`maxConcurrentSessions`)**: The absolute hard ceiling supported by the classroom infrastructure.

| Classroom Identifier | Institution | Nominal Baseline | Hard Ceiling | Hardware Lab Scope | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CSE276` | Cortex Institute of Technology (Demo) | 50 | 60 | 60 Physical Workstations | Active |
| `CS301` | Cortex Institute of Technology (Demo) | 50 | 60 | 60 Physical Workstations | Active |
| `CS402` | State Engineering University (Demo) | 30 | 40 | 40 Physical Workstations | Active |
| `MPU201` | Metropolitan Polytechnic University (Verified) | 50 | 50 | Lab Room 201 Terminals | Active |

### 2.2 Quota Adjustment Governance

To accommodate enrollment surges (e.g. late additions, accommodated testing, makeup examinations), administrative users may adjust classroom quotas via [updateClassroomQuota()](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts).

#### Governance Constraints:
1. **Mandatory Administrative Justification**: The `justification` parameter must be non-empty. Attempts to update quotas with blank or whitespace-only justifications are rejected fail-closed.
2. **Immutable Audit Logging**: Every quota modification triggers an auditable log entry via `recordPilotAudit('update_quota', ...)` capturing previous baseline, new baseline, previous hard ceiling, new hard ceiling, updating actor ID, and the justification string.

```typescript
const quotaUpdateRes = updateClassroomQuota({
  classroomId: 'CSE276',
  baselineQuota: 55,
  maxConcurrentSessions: 65,
  justification: 'Midterm enrollment surge approved by department chair',
  updatedBy: 'admin_registrar',
});
```

---

## 3. Authoritative Active Session Counting Engine

### 3.1 Ghost and Abandoned Session Filtering

A persistent challenge in distributed computer-based testing is "session ghosting":
- A candidate closes a laptop lid or loses Wi-Fi connection without cleanly submitting.
- A workstation crashes due to local hardware faults.
- A candidate session expires while lingering in an `in_progress` database status.

If concurrent usage was calculated via a simple `SELECT COUNT(*) WHERE status = 'in_progress'`, ghost sessions would permanently consume available classroom quota, leading to false-positive capacity rejections for legitimate arriving candidates.

Alpha 10 implements [getAuthoritativeActiveSessionCount()](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/classroom/db/index.ts) in the relational database layer.

```sql
SELECT COUNT(*) as activeCount
FROM exam_sessions
WHERE exam_id = ?
  AND status = 'in_progress'
  AND (expires_at > ? OR expires_at IS NULL)
  AND (
    (last_heartbeat_at IS NOT NULL AND last_heartbeat_at > ?) OR
    (last_heartbeat_at IS NULL AND started_at > ?)
  );
```

### 3.2 Heartbeat Window Analysis

| Session Category | Database State | Evaluation Logic | Counted Towards Quota? |
| :--- | :--- | :--- | :--- |
| **Active Live Candidate** | `status = 'in_progress'`, heartbeat within 120s | Valid heartbeat confirms client process active | **YES** |
| **Freshly Started Candidate** | `status = 'in_progress'`, `last_heartbeat_at IS NULL`, `started_at` within 120s | Initial launch grace window before first 30s heartbeat | **YES** |
| **Submitted Candidate** | `status = 'submitted'` | Terminal status excluded by query predicate | **NO** |
| **Expired Session** | `status = 'in_progress'`, `expires_at <= now` | Expired session excluded by query predicate | **NO** |
| **Abandoned Workstation** | `status = 'in_progress'`, heartbeat older than 120s | Client disconnected; quota safely reclaimed | **NO** |
| **Abandoned Ghost Start** | `status = 'in_progress'`, `last_heartbeat_at IS NULL`, `started_at` older than 120s | Failed initial handshake; quota safely reclaimed | **NO** |

---

## 4. Institutional Authorization Evidence & Legal Verification

### 4.1 Tiered Classification of Institutional Records

To prevent demonstration configurations from ever masquerading as legally binding institutional partnerships, Alpha 10 enforces three distinct operational tiers in [pilot-config.ts](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts):

1. **Demonstration Record (`demonstration`)**:
   - Internal demonstration or integration sandbox (e.g. `inst_cit_01`, `inst_state_eng`).
   - `recordType = 'demonstration'`.
   - `authorizationStatus = 'demonstration_only'`.
   - **Enforcement**: Strictly forbidden from authorizing examinations whenever `CORTEX_LOCKDOWN_MODE` is set to `institutional_pilot` or `production`.
2. **Pending Institutional Authorization (`pending_institutional_authorization`)**:
   - Institutional candidate undergoing technical evaluation or contract negotiation.
   - `recordType = 'institutional_pilot'`.
   - `authorizationStatus = 'pending_institutional_authorization'`.
   - **Enforcement**: Fail-closed rejection for all examination launches until fully audited.
3. **Verified Institutional Pilot (`verified_institutional_pilot`)**:
   - Authorized university partner with formal academic and legal agreements.
   - `recordType = 'institutional_pilot'`.
   - `authorizationStatus = 'verified_institutional_pilot'`.
   - **Enforcement Requirements**:
     - Signed agreement identifier (`pilotAgreementRef`, e.g. `AGR-2026-PILOT-MPU-01`).
     - Administrative evidence document reference (`administrativeEvidenceDoc`, e.g. `CORTEX-PILOT-AGREEMENT-MPU-SIGNED-OCT2026.pdf`).
     - Evidence verification epoch timestamp (`evidenceVerifiedAt`).
     - Authorized audit officer user ID (`evidenceVerifiedBy`).

### 4.2 Fail-Closed Authorization Verification Engine

When `verifyPilotAuthorization()` evaluates an examination launch in `institutional_pilot` mode, it executes the following cascading validation chain:

```
[Is Pilot Enabled?]
       | Yes
[Candidate Account Revoked?] -> Fail (Access Revoked)
       | No
[Device Workstation Revoked?] -> Fail (Hardware Revoked)
       | No
[Exam Revoked?] -> Fail (Exam Revoked)
       | No
[Classroom Enrolled?] -> Fail (Classroom Not In Pilot)
       | Yes
[Classroom Status Active?] -> Fail (Classroom Revoked)
       | Yes
[Institution Status Active?] -> Fail (Institution Revoked)
       | Yes
[Is Demonstration Record?] -> Fail (Demo Blocked in Institutional Mode)
       | No
[Authorization Status Verified?] -> Fail (Pending Authorization Blocked)
       | Yes
[Signed Agreement Reference Exists?] -> Fail (Missing Agreement Reference)
       | Yes
[Administrative Evidence Doc Exists?] -> Fail (Missing Administrative Evidence Doc)
       | Yes
[Evidence Audit Verification Metadata Complete?] -> Fail (Unaudited Evidence Blocked)
       | Yes
[Candidate Allowlist & Hardware Device Scoping Satisfied?] -> Fail (Out of Cohort)
       | Yes
[AUTHORIZE EXAMINATION LAUNCH]
```

---

## 5. Audit Results & Empirical Verification

The pilot governance test suite was executed via [test-lockdown-alpha10-assurance.ts](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/scripts/test-lockdown-alpha10-assurance.ts).

```
================================================================
CORTEX LOCKDOWN - ALPHA 10 PILOT GOVERNANCE AUDIT RESULTS
================================================================

--- Section 4: Institutional Pilot Evidence & Administrative Audit ---
[PASS] INST-01: Demonstration Institution Delineation - CIT demo baseline correctly typed as demonstration_only
[PASS] INST-02: Rejection of Institution Pending Institutional Authorization - Pending institutional record rejected: Institution 'Unverified Test Academy' is not verified for active institutional pilot (status: pending_institutional_authorization)
[PASS] INST-03: Rejection for Missing Administrative Evidence Document - Missing administrative document rejected fail-closed: Institution 'Polytechnic Without Agreement Document' lacks verified administrative authorization evidence
[PASS] INST-04: Rejection for Unaudited Administrative Evidence Metadata - Unaudited evidence record rejected fail-closed: Institution 'University With Unaudited Agreement Document' administrative evidence has not undergone verified administrative audit
[PASS] INST-05: Verified Institutional Pilot Authorization with Complete Audit Evidence - Verified institutional pilot authorized for Metropolitan Polytechnic University

--- Section 5: Classroom Quota Reconciliation & Active Sessions ---
[PASS] QUOTA-01: Classroom CSE276 Hard Maximum Limit Boundary (60) - CSE276: 60 concurrent within ceiling, 61 rejected; baseline 50
[PASS] QUOTA-02: Classroom MPU201 Hard Maximum Limit Boundary (50) - MPU201: 50 concurrent within ceiling, 51 rejected; baseline 50
[PASS] QUOTA-03: Administrative Quota Adjustment with Justification & Audit Log - CSE276 quota adjusted: Baseline 55, Hard Max 65 (Justification: Quota updated for classroom 'CSE276': Baseline 55, Hard Max 65)
[PASS] QUOTA-04: Administrative Quota Adjustment Rejection on Missing Justification - Blank justification rejected fail-closed: Administrative justification is required for quota modification
[PASS] QUOTA-05: Authoritative Active Session Counting with Abandoned Session Filtering - Out of 7 candidate sessions (active, submitted, expired, stale heartbeats, fresh starts), exactly 3 active sessions counted
```

All 10 institutional governance and quota reconciliation checks passed with zero errors.
