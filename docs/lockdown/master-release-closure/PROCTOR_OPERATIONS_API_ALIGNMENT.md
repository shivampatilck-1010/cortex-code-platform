# CORTEX LOCKDOWN — PROCTOR OPERATIONS & API ALIGNMENT SPECIFICATION

Document Identifier: CL-MRE-PRO-01
Programme: Cortex Lockdown v1.0
Baseline: Release Candidate v1.0.0-rc3 (Master Programme Complete)
Target Subsystems: Proctoring Engine, Telemetry Ingestion, Proctor Dashboard, Cloudflare D1
Classification: Operational Systems Engineering & Academic Ethics Specification

---

## 1. EXECUTIVE SUMMARY & ETHICAL MANDATE

Online and computer-based examination proctoring systems frequently suffer from over-promising technical capabilities, inventing artificial confidence percentages, and confusing heuristic signals with definitive evidence of academic misconduct.

Cortex Lockdown establishes a strict ethical and architectural baseline:
1. **Zero Automated Academic Sanctions**: Telemetry anomaly events are recorded strictly as reviewable telemetry for human invigilators. The platform contains zero logic to automatically disqualify, terminate, or penalize candidates without human review.
2. **Explicit Signal Classification**: All proctor console events explicitly differentiate between physical observations, heuristic anomaly signals, and simulated demonstration fixtures.
3. **Strict Role-Based Scoping**: Shared master passwords are strictly prohibited. Proctor actions require authenticated individual accounts with teacher or administrator privileges scoped to specific classrooms.

---

## 2. TELEMETRY EVENT TAXONOMY & CONTRACT SPECIFICATION

All workstation telemetry is transmitted via authenticated HTTPS POST requests to `/api/v1/lockdown/telemetry` and persisted into the `exam_integrity_events` table in Cloudflare D1.

```
+-------------------------------------------------------------------------------------------------------+
|                                    OFFICIAL TELEMETRY EVENT CONTRACT                                  |
+-------------------------------------------------------------------------------------------------------+
| Event Type Name                  | Signal Nature       | Source Trigger Subsystem                     |
+----------------------------------+---------------------+----------------------------------------------+
| `face_not_detected`              | Heuristic Anomaly   | Client-side 160x120 canvas face mesh in RAM  |
| `multiple_faces_detected`        | Heuristic Anomaly   | Spatial chrominance clustering / FaceDetector|
| `spectral_voice_detected`        | Heuristic Anomaly   | Web Audio FFT band (300Hz-3400Hz) threshold  |
| `prohibited_process_detected`    | Deterministic Alert | Win32 ProcessWatchdog (1,500 ms poll)        |
| `secondary_display_detected`     | Deterministic Alert | Win32 EnumDisplayMonitors count > 1          |
| `window_blur`                    | Deterministic Alert | WebView2 CoreWebView2.LostFocus event        |
| `autosave_snapshot_committed`    | Operational Status  | Dual-tier SQLite / D1 persistence flush      |
| `offline_buffered_reconciled`    | Operational Status  | Network reconnection batch flush             |
| `exam_submitted_and_sealed`      | Operational Status  | Final candidate submission (sensors stopped) |
| `proctor_emergency_code_issued`  | Administrative Audit| Authenticated proctor OTP generation         |
| `emergency_exit_authorized`      | Administrative Audit| Successful atomic OTP redemption in D1       |
| `unauthorized_emergency_attempt` | Security Anomaly    | Failed OTP redemption (burned after 3 tries) |
+-------------------------------------------------------------------------------------------------------+
```

---

## 3. REALITY VS. HEURISTIC DISTINCTION ON PROCTOR CONSOLES

The proctor dashboard interface must never deceive human proctors by manufacturing pseudo-scientific precision metrics:

```
+-------------------------------------------------------------------------------------------------------+
|                                  SIGNAL FIDELITY & SENSING BOUNDARIES                                 |
+-------------------------------------------------------------------------------------------------------+
| Console Label          | Permissible Technical Basis     | Prohibited Artificial Inventions           |
+------------------------+---------------------------------+---------------------------------------------+
| Candidate Presence     | Face bounding box present / nil | Fake "Attention Confidence % (e.g. 94.2%)"  |
| Audio Activity         | Ambient decibels > threshold    | "Voiceprint Speaker Biometric ID"           |
| Process Threat         | Blacklisted executable name     | "Confirmed Cheating Tool Injection"         |
| Network Heartbeat      | Ping interval (P95: 5s, Max 15s)| "Candidate Intentional Network Disconnect"  |
| Hardware Status        | WebRTC track active / ended     | "Tamper-evident cable unplug assertion"     |
+------------------------+---------------------------------+---------------------------------------------+
```

Every heuristic alert presented to proctors displays the statutory ethical disclaimer:
> *Automated telemetry indicators are heuristic signals provided for proctor review, not proof of academic misconduct.*

---

## 4. PROCTOR AUTHENTICATION & ACCESS CONTROL ARCHITECTURE

Proctoring actions (including reviewing live candidate status and issuing emergency recovery codes) require strict identity and authorization checks:

```
[ In-Person Proctor ] ---> [ Request /api/v1/lockdown/emergency-exit?challenge=... ]
                                        |
                                        v
                       [ 1. Authenticate Cookie / Token ]
                                        |
                                        +---> Role != 'teacher' | 'admin' ===> 403 Forbidden
                                        |
                       [ 2. Distributed Proctor Rate Limit ]
                                        |
                                        +---> > 10 codes in 10 mins ===> 429 Rate Limit
                                        |
                       [ 3. Classroom Scope Validation ]
                                        |
                                        +---> Proctor assigned to Exam Room? ===> Authorized
                                        |
                       [ 4. Audit Log in exam_integrity_events ]
                                        |
                                        v
                       [ 5. Issue Single-Use 6-Digit OTP ]
```

### 4.1. Non-Repudiation & Auditability
When a proctor generates an emergency exit code:
- The plain text OTP is **NEVER** logged in the database.
- A cryptographic record (`proctor_emergency_code_issued`) records the proctor user ID (`issuedBy`), timestamp, candidate ID, workstation challenge, and expiration time.
- If a candidate later redeems the code, a second record (`emergency_exit_authorized`) links the redemption to the issuing proctor's identity.

---

## 5. HEARTBEAT & WORKSTATION STATE TRANSITIONS

```
+---------------+     15s No Heartbeat     +------------------+
| ACTIVE        | -----------------------> | HEARTBEAT_STALE  |
+---------------+                          +------------------+
        |                                            |
        | Normal Submission                          | > 45s No Heartbeat
        v                                            v
+---------------+                          +------------------+
| SEALED_SUBMIT |                          | DISCONNECTED     |
+---------------+                          +------------------+
```

- **Nominal Heartbeat Rate**: Workstation sends telemetry packet every 10 seconds.
- **Heartbeat Warning Threshold**: If no heartbeat is received within 15 seconds, console flags workstation as `HEARTBEAT_STALE` (yellow indicator).
- **Critical Timeout**: If no heartbeat is received within 45 seconds, console alerts proctor to dispatch a floor technician (`DISCONNECTED`). The student's workstation continues running in offline mode, buffering answers locally.

---
*End of Proctor Operations & API Alignment Specification.*
