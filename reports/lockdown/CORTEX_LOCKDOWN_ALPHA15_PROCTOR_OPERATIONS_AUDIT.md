# Cortex Lockdown - Alpha 15 Proctor Operations, RBAC & Scoping Audit

**Document Identifier:** CORTEX-LOCKDOWN-OPS-A15-001  
**Classification:** Operational Security, Role-Based Access Control & Telemetry Scoping  
**Target Release:** v1.0.0-rc3  
**Auditing Standard:** Strict Role-Based Isolation & Classroom Scoping Verification  
**Date of Audit:** November 2026  

---

## 1. Operational Security Scope & Objectives

The Alpha 15 Proctor Operations Audit validates the security boundaries, role-based access controls (RBAC), and classroom scoping mechanisms governing proctor consoles, candidate monitoring, and administrative overrides.

The core objective is to ensure that:
1. Faculty proctors can only view candidates, attendance, and telemetry belonging to their explicitly assigned classroom.
2. Students and unauthorized users cannot invoke administrative or emergency recovery APIs.
3. Telemetry events remain strictly metadata-bound without exposing candidate personal identifiable information (PII).

---

## 2. Role-Based Access Control (RBAC) Verification Matrix

All operational endpoints were audited against four distinct security roles:

| API Endpoint | HTTP Method | Student Role | Proctor Role | Faculty / Teacher | System Administrator |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`/api/v1/lockdown/pilot`** (Config & Quota) | `GET` | **403 FORBIDDEN** | **200 OK** (Scoper) | **200 OK** (Scoper) | **200 OK** (Global) |
| **`/api/v1/lockdown/pilot`** (`action: update_quota`) | `POST` | **403 FORBIDDEN** | **403 FORBIDDEN** | **403 FORBIDDEN** | **200 OK** (Admin Only) |
| **`/api/v1/lockdown/emergency-exit`** (Issue OTP) | `POST` | **403 FORBIDDEN** | **200 OK** (Classroom) | **200 OK** (Classroom) | **200 OK** (Global) |
| **`/api/v1/lockdown/emergency-exit`** (Redeem OTP)| `POST` | **200 OK** (Candidate) | **400 BAD REQUEST** | **400 BAD REQUEST** | **400 BAD REQUEST** |
| **`/api/v1/lockdown/telemetry`** (Log Event) | `POST` | **200 OK** (Own Session) | **403 FORBIDDEN** | **403 FORBIDDEN** | **403 FORBIDDEN** |
| **`/api/v1/classroom/[roomId]/events`** (View) | `GET` | **403 FORBIDDEN** | **200 OK** (Assigned) | **200 OK** (Assigned) | **200 OK** (Global) |

---

## 3. Classroom Scoping & Multi-Tenant Data Isolation

### 3.1 Cross-Classroom Leak Prevention
To prevent proctors in one examination room from viewing candidate rosters or telemetry events from an adjacent room:
- Every query to `exam_integrity_events` joins on `exam_sessions` and `classrooms` to enforce `WHERE classrooms.id = :assignedRoomId`.
- **Audited Scenario:** A proctor authenticated to `CSE276` attempted to query telemetry records for candidates in `MPU201`.
- **Enforcement Result:** **PASS (FAIL-CLOSED)**. The API returned `403 FORBIDDEN: User does not have proctoring permissions for the requested classroom`.

### 3.2 Student Privilege Escalation Defense
- A student possessing an active session cookie attempted to issue an emergency exit OTP via `POST /api/v1/lockdown/emergency-exit` with `{ action: 'issue' }`.
- **Enforcement Result:** **PASS**. The backend evaluated `user.role === 'student'` and rejected the request immediately with `403 FORBIDDEN: Only authorized proctors or administrators may issue emergency recovery authorizations`.

### 3.3 Candidate Anonymization in Telemetry Logs
- Telemetry events (`exam_integrity_events`) store only opaque session IDs (`sessionId`), event type enums (`eventType`), and structured numeric metadata (`details_json`).
- Student real names, institutional email addresses, and national identification numbers are never logged in the integrity telemetry stream, ensuring compliance with FERPA and GDPR data minimization requirements.

---

## 4. Proctor In-Flight Operations Workflow

The live operational workflow of a proctor during an active pilot examination:

```
[Candidate Terminal: Ctrl+Alt+F10]
              |
              | Displays 4-Hex Challenge "A15E"
              v
[Floor Invigilator Inspects Terminal]
              |
              | Relays Candidate ID & Challenge to Chief Proctor
              v
[Chief Proctor Dashboard]
              |
              | 1. Verifies Candidate Physical Identity & Room Assignment
              | 2. Enters Challenge "A15E" & Written Justification
              | 3. POST /api/v1/lockdown/emergency-exit (issue)
              v
[Backend Recovery Engine]
              |
              | 1. Validates Proctor RBAC
              | 2. Generates 256-bit Random Salt & Computes Peppered HMAC-SHA256
              | 3. Stores Hash in DB (Single-Use, 180s TTL)
              | 4. Returns 6-Digit OTP (e.g., "382017")
              v
[Invigilator Types OTP on Candidate Terminal]
              |
              | POST /api/v1/lockdown/emergency-exit (redeem)
              v
[Atomic Single-Winner SQL Redemption]
              |
              +---> SUCCESS: Unhooks WH_KEYBOARD_LL, restores desktop, exits
              +---> FAILURE: Auto-burns challenge after 3 attempts
```

---

## 5. Post-Examination Reconciliation & Audit Trail Closure

Upon examination completion:
1. **Roster Closure:** The Chief Proctor verifies that all seated candidates have reached either `submitted` or `emergency_terminated` status. Zero sessions remain orphaned in `in_progress`.
2. **Attendance Reconciliation:** Candidate biometric attendance logs are sealed with the proctor's digital signature.
3. **Audit Trail Sealing:** All recorded `exam_integrity_events` are locked against retrospective modification or deletion.
4. **Retention Window Activation:** The 90-day automated purge timer begins, ensuring transient integrity records are automatically deleted after the academic dispute window closes.
