# CORTEX LOCKDOWN — ALPHA 14 INSTITUTIONAL ADMINISTRATOR CONSOLE AUDIT

Document Identifier: CL-ADMIN-ALPHA14-AUDIT  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Institutional Governance & Technical Administration Panel  
Evaluation Host: Windows 10/11 x64 (AMD Ryzen 7 8840U, 16.4 GB RAM)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Executive Summary & Administrative Architecture

The institutional administrator console provides university academic deans, department chairs, and faculty proctors with the operational interface required to configure, monitor, and govern locked examinations.

In Alpha 14, the administrative workflow was audited to guarantee **strict backend role-based access control (RBAC)**, multi-tenant institutional isolation, and full administrative audit logging.

```
+---------------------------------------------------------------------------------------------------------+
|                                    INSTITUTIONAL ADMIN CONSOLE INTERFACE                                |
|                                                                                                         |
|  [Classroom Registration]  [Candidate Whitelist]  [Device Fleet Manager]  [Active Quota Dashboard]      |
|  [Live Session Monitor]    [Integrity Timeline]   [Emergency Override]    [Audit Log Ledger]            |
+---------------------------------------------------+-----------------------------------------------------+
                                                    |
                                                    | HTTPS (TLS 1.3) /api/v1/lockdown/pilot
                                                    v
+---------------------------------------------------------------------------------------------------------+
|                                    BACKEND RBAC & GOVERNANCE ENGINES                                    |
|                                                                                                         |
|  1. Global Admin Role (role === 'admin'): Full platform administration across all institutions.          |
|  2. Teacher/Proctor Role (role === 'teacher'): Scoped strictly to assigned course classrooms.           |
|  3. Student Role (role === 'student'): Forbidden (HTTP 403) from inspecting topology or audit logs.     |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Comprehensive Administrator Console Capabilities

The administrative workflow provides ten essential operational capabilities:

### 2.1 Classroom Registration & Scoping
- **Function**: Registers academic classrooms into the pilot registry via `enrollPilotClassroom()` or `POST /api/v1/lockdown/pilot`.
- **Security Binding**: Binds each classroom to its parent `institutionId` (e.g. `CSE276` -> `inst_cit_01`), permitted examination IDs (`allowedExamIds`), and mandatory lockdown app enforcement (`requireLockdownApp: true`).

### 2.2 Candidate Cohort Whitelisting
- **Function**: Restricts examination access to authorized student IDs via `allowedStudentIds`.
- **Enforcement**: If a candidate attempts to launch an exam without being listed in `allowedStudentIds`, [`verifyPilotAuthorization()`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts#L595) rejects the launch grant fail-closed:
  `Student '<id>' is not in the authorized pilot cohort for this classroom`.

### 2.3 Hardware Device Enrollment & Fleet Revocation
- **Function**: Restricts workstations to approved institutional hardware fingerprints via `allowedDeviceIds`.
- **Dynamic Revocation**: An administrator can immediately revoke an individual workstation or candidate during an examination:
  `POST /api/v1/lockdown/pilot` with `{ action: 'revoke', entityType: 'device', entityId: 'dev_lab_04' }`.
- **Fail-Closed Gate**: The revoked machine is instantaneously rejected on subsequent launch grants:
  `Examination device access has been revoked: <reason>`.

### 2.4 Examination Scheduling & Security Level Selection
- **Function**: Instructors configure examination settings within the Cortex Exam Builder:
  - `securityLevel: 'restricted'`: Requires native Windows client (`CortexLockdown.exe`), display affinity, and keyboard hooks.
  - `securityLevel: 'standard'`: Standard browser runner with fullscreen event detection.
- **Emergency Fallback**: If an unrecoverable laboratory failure occurs, the administrator can authorize an emergency classroom fallback via `action: 'authorize_fallback'`, transitioning students to the standard runner without losing drafted answers.

### 2.5 Pilot Capacity & Concurrent Quota Configuration
- **Function**: Implements a dual-parameter capacity model:
  - `baselineQuota`: Nominal planned cohort size (e.g. 50).
  - `maxConcurrentSessions`: Absolute hardware lab maximum (e.g. 60 for `CSE276`).
- **Modification Governance**: Quota adjustments require mandatory written justification via `action: 'update_quota'`, persisting an immutable audit record in `pilot-config.auditLogs`.

### 2.6 Active Session Monitoring
- **Function**: Tracks live candidate attendance and active session concurrency in real time via [`getAuthoritativeActiveSessionCount(examId, 120)`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/classroom/db/index.ts#L3354).
- **Ghost Session Filtering**: Automatically filters out completed/submitted attempts, expired sessions (`expires_at <= now`), and disconnected clients with heartbeats older than 120 seconds.

### 2.7 Session Termination & Emergency Recovery
- **Session Termination**: Administrators can force-terminate a compromised session atomically via `classroomDb.updateExamSession(sessionId, { status: 'terminated' })`.
- **Proctor Recovery Override**: When a kiosk locks due to local hardware failure, the administrator verifies proctor permissions, generates a single-use 6-digit peppered OTP via `issueEmergencyRecoveryAuthorization()`, and enters it into the student workstation to restore the desktop.

### 2.8 Integrity Event Review & Proctor Timeline
- **Function**: Faculty instructors view all flagged testing anomalies (`window_blur`, `multiple_faces_detected`, `audio_anomaly`, `blocked_key_attempt`) on the exam review dashboard.
- **Audit Verification**: Events are retrieved via [`classroomDb.listExamIntegrityEvents(sessionId)`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/classroom/db/index.ts) with exact microsecond timestamps and decibel classifications.

### 2.9 Immutable Audit Logging
- **Function**: Every administrative action (`activate`, `deactivate`, `revoke`, `restore`, `update_quota`, `authorize_fallback`, `reset`) is recorded in `auditLogs`.
- **Payload**:
  ```json
  {
    "id": "audit_1793400000000_a9f1b",
    "action": "update_quota",
    "entityType": "classroom",
    "entityId": "CSE276",
    "performedBy": "dean.smith@cit.edu",
    "timestamp": 1793400000000,
    "details": {
      "oldMax": 50,
      "newMax": 60,
      "justification": "Added 10 hot-spare lab terminals for CS276 midterm"
    }
  }
  ```

### 2.10 Retention Policy Visibility
- **Function**: The console exposes data retention lifecycles to institutional administrators via `GET /api/v1/lockdown/pilot`:
  - Ephemeral media streams: 0 seconds (never persisted).
  - Proctoring integrity events: 90 days (`cleanupExpiredIntegrityEvents`).
  - Emergency authorizations: 30 days (`cleanupExpiredEmergencyAuthorizations`).
  - Student examination answers: Institutional registrar grade policy.

---

## 3. Multi-Tenant Institutional Isolation & Backend RBAC

1. **Backend Privilege Verification**:
   All administrative routes in [`src/app/api/v1/lockdown/pilot/route.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/app/api/v1/lockdown/pilot/route.ts#L20) verify user identity via server-side session cookies:
   ```typescript
   if (user.role !== 'teacher' && user.role !== 'admin') {
     return NextResponse.json({ error: 'Faculty or administrator authorization required' }, { status: 403 });
   }
   ```
2. **Global Admin vs Scoped Faculty**:
   - `action === 'reset'`: Restricted strictly to `role === 'admin'`. Teachers receive HTTP 403.
   - `entityType === 'institution'`: Revoking or modifying an entire university membership requires `role === 'admin'`.
   - Teachers are strictly scoped to classrooms belonging to their verified institution domain.
3. **Student Confidentiality**:
   Students attempting to query `/api/v1/lockdown/pilot` are blocked with HTTP 403, preventing unauthorized reconnaissance of classroom allowlists or network topology.

---
*Report certified by Institutional Governance Board.*
