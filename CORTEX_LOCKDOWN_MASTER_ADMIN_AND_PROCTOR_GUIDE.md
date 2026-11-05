# Cortex Lockdown v1.0 - Master Administrator & Proctor Operations Guide

**Document Identifier:** CORTEX-LOCKDOWN-ADM-V1-001  
**Classification:** Operational Security, Administration & Invigilator Operations Handbook  
**Baseline Release:** Cortex Lockdown v1.0 (v1.0.0-rc3 Engine)  
**Target Audience:** University IT Directors, Institutional Administrators, Chief Proctors, Floor Invigilators  
**Date of Publication:** November 2026  

---

## 1. Operational Persona & Authorization Matrix

Cortex Lockdown establishes a clear tripartite operational model with strict backend-enforced role separation:

```
+---------------------------------------------------------------------------------------------------+
| INSTITUTIONAL ADMINISTRATOR                                                                       |
| Scope: University Organization Level                                                               |
| Powers: Register classrooms, configure baseline quotas, revoke devices, inspect audit logs        |
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| CHIEF PROCTOR & FLOOR INVIGILATOR                                                                 |
| Scope: Assigned Examination Classroom Only                                                         |
| Powers: Monitor candidate heartbeats, review anomaly alerts, issue emergency exit OTPs, sign ledger|
+---------------------------------------------------------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
| ENROLLED STUDENT CANDIDATE                                                                        |
| Scope: Own Examination Session Only                                                               |
| Powers: Enroll device, complete pre-flight checks, solve questions, autosave answers, submit exam  |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Institutional Administrator Guide

### 2.1 Accessing the Administrator Console
1. Navigate to `/admin/lockdown/pilot` via an authenticated university administrator account.
2. Confirm that institutional status is marked `ACTIVE` and operational mode reflects `institutional_pilot` or `demonstration`.

### 2.2 Classroom Onboarding & Quota Configuration
1. Select **"Classroom Management"** to view enrolled examination rooms (e.g. `CSE276`, `MPU201`).
2. To modify concurrent capacity:
   - Submit `action: 'update_quota'`.
   - Provide `classroomId`, `baselineQuota` (e.g. 50), and `maxConcurrentSessions` (e.g. 60).
   - Enter a mandatory written **Administrative Justification** (e.g. *"Adding 10 overflow stations for CS276 Section B midterm"*).
   - The platform commits the change to `pilot_config` and records an immutable log entry in `pilot_audit_logs`.

### 2.3 Device & Candidate Revocation
If a workstation terminal is identified as compromised:
1. Navigate to **"Device Registry"** in the Admin Console.
2. Select the target hardware fingerprint and click **"Revoke Device"**.
3. The platform adds the device to the `revocations` registry.
4. Any subsequent launch grant request from that hardware fingerprint will fail closed with `403 FORBIDDEN: Device access has been revoked`.

---

## 3. Chief Proctor & Floor Invigilator Guide

### 3.1 Pre-Flight Facility Checklist (T-30 Minutes)
1. Log into the Cortex Proctor Real-Time Dashboard.
2. Verify that the candidate roster pre-populates in `PENDING_LAUNCH` status.
3. Confirm that the emergency recovery server pepper is active and the challenge-response API is responsive.
4. Verify physically that all student terminals are booted into standard user domain accounts with a single physical display connected.

### 3.2 Real-Time In-Flight Candidate Monitoring
The Proctor Dashboard provides continuous telemetry feeds updated via authenticated WebSocket/SSE connections:

| Status Indicator | Real-World System State | Proctor Operational Action |
| :--- | :--- | :--- |
| **`ACTIVE_LOCKED` (Green)** | Workstation healthy; heartbeat < 30s; hooks active | Normal observation; no action required. |
| **`HEARTBEAT_DELAY` (Yellow)** | Heartbeat missed for 30s - 60s; potential LAN drop | Monitor terminal screen physically; wait for automatic reconnect. |
| **`SUSPENDED_OFFLINE` (Red)** | Heartbeat expired (> 120s); terminal offline | Approach workstation; inspect network connection. |
| **`ANOMALY_ALERT` (Amber)** | Telemetry event logged (`face_absent`, `audio_anomaly`)| Review timestamped flag; visually inspect candidate station. |
| **`PROCESS_VIOLATION` (Red)** | Blacklisted binary detected by watchdog | Approach candidate; inspect running background software. |

### 3.3 The Emergency Recovery Release Workflow
When a candidate experiences a verified terminal freeze, medical event, or hardware failure:

```
[Candidate Terminal: Ctrl+Alt+F10]
              |
Displays 4-Hex Challenge Code: "7A9F"
              |
Floor Invigilator verifies station and radios Chief Proctor:
"Station 14, Candidate Alice, Challenge 7A9F, Reason: Terminal freeze"
              |
Chief Proctor enters Candidate ID & Challenge into Proctor Dashboard
Dashboard calls POST /api/v1/lockdown/emergency-exit (issue)
System returns 6-Digit Single-Use OTP: "654321" (Valid for 180 seconds)
              |
Invigilator enters "654321" into Candidate Workstation Modal
Client submits POST /api/v1/lockdown/emergency-exit (redeem)
Atomic single-winner database lock verifies hash; authorizes kiosk exit
Workstation unhooks keyboard, clears display affinity, restores Windows desktop
```

---

## 4. Post-Examination Reconciliation & Digital Sign-Off

1. **Roster Closure:** The Chief Proctor verifies that every candidate on the roster has reached `submitted` or `emergency_terminated` status. Zero attempts remain orphaned in `in_progress`.
2. **Dispute Preservation:** If an academic irregularity occurred, the proctor adds an **Incident Note** linking the candidate session to the logged `exam_integrity_events`.
3. **Digital Sign-Off:** The Chief Proctor counter-signs the digital examination ledger using institutional MFA credentials, permanently locking the examination cohort records.
4. **Automated Purge Activation:** The platform schedules the automated 90-day retention countdown, after which transient integrity events and recovery logs are permanently destroyed.
