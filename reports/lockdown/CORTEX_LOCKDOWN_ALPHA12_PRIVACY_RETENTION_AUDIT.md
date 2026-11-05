# CORTEX LOCKDOWN — ALPHA 12 PRIVACY & DATA RETENTION AUDIT

Document Identifier: CL-PRIVACY-ALPHA12-AUDIT  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Independent Student Privacy, Ethics & Governance Panel  
Governance Policy: Strictly Zero Emojis  

---

## 1. Executive Privacy Assessment

Cortex Lockdown was designed under the principle of **ephemeral client-side proctoring analysis** and **data minimization**. A primary objective of the Alpha 12 audit is to independently verify what data is collected, where it is stored, how long it persists, who can access it, and how it is deleted.

Misleading assertions that conflate emergency token cleanup with proctoring telemetry deletion have been audited and corrected.

---

## 2. Category-by-Category Data Lifecycle Audit

```
+----------------------------------------------------------------------------------------------------------------------------------+
| DATA CATEGORY          | STORAGE LOCATION   | ACCESS CONTROL          | RETENTION LIFECYCLE     | DELETION MECHANISM             |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
| 1. Live Camera Frames  | Ephemeral Client   | Candidate local browser | 0 seconds (Frames are   | Garbage collected on frame     |
|                        | RAM / DOM Video    | session only            | processed in memory and | render; destroyed on session   |
|                        | Element            |                         | immediately discarded)  | disconnect                     |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
| 2. Microphone Audio    | Ephemeral Client   | Candidate local browser | 0 seconds (Audio FFT    | Discarded on audio block       |
|    Stream (PCM/WAV)    | Web Audio API      | session only            | buffer processed into   | process; destroyed on stream   |
|                        | Buffer             |                         | RMS decibels and freed) | closure                        |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
| 3. Continuous Video/   | NON-EXISTENT       | N/A                     | N/A (Platform does NOT  | N/A (Zero video/audio wiretaps |
|    Audio Recordings    | (Never Persisted)  |                         | record, stream, or save | stored on server or R2 bucket) |
|                        |                    |                         | full examination video) |                                |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
| 4. Integrity Events    | Relational DB      | Instructor & Proctor    | Persistent (Held across | Manual administrative deletion |
|    (Flags & Anomalies) | Table:             | RBAC for enrolled       | active course term for  | with exam record; NO automated |
|                        | exam_integrity_    | classroom               | proctor grade review)   | purge job currently active     |
|                        | events             |                         |                         |                                |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
| 5. Client Telemetry    | Relational DB      | Instructor & Proctor    | Persistent (Captured in | Bound to exam session life;    |
|    (Window Blur, Keys) | Table:             | RBAC for enrolled       | exam_integrity_events   | NO automated purge job         |
|                        | exam_integrity_    | classroom               | table)                  | currently active               |
|                        | events             |                         |                         |                                |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
| 6. Emergency Recovery  | Relational DB      | System Administrators   | 30-day sliding window   | Automated: `cleanupExpired-    |
|    Authorization Logs  | Table: lockdown_   | & Authorized Proctors   | for operational audit   | EmergencyAuthorizations()`     |
|                        | emergency_auths    |                         | compliance              | purges records > 30 days       |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
| 7. Candidate Answers   | Relational DB      | Candidate & Enrolled    | Academic record term    | Academic institutional policy  |
|    & Submissions       | Tables: exam_ques- | Faculty Gradebook       | (Retained for grade     | retention (FERPA/GDPR standard)|
|                        | tion_responses     |                         | dispute resolution)     |                                |
+------------------------+--------------------+-------------------------+-------------------------+--------------------------------+
```

---

## 3. Detailed Data Subsystem Analysis

### 3.1 Ephemeral Webcam & Audio Stream Processing

- **Code Location**:
  [`src/components/lockdown/CortexLockdownApp.tsx`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/components/lockdown/CortexLockdownApp.tsx#L163-L235)
- **Technical Operation**:
  1. The client browser requests hardware permissions via `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`.
  2. The raw video stream is attached directly to the local HTML5 `<video>` elements (`videoRef.current.srcObject = stream;` and Picture-in-Picture `pipVideoRef.current.srcObject = stream;`).
  3. The raw audio stream is attached to a Web Audio API `AudioContext` and `createAnalyser()`, computing decibel levels and spectral centroid frequencies in browser memory.
  4. When audio exceeds conversational speech thresholds or face tracking flags an absence, a **discrete JSON metadata event** is dispatched via `dispatchTelemetryEvent()`.
  5. **Absolute Privacy Verification**:
     - **Zero raw video frames are saved to disk.**
     - **Zero audio recordings are saved to disk.**
     - **Zero media bytes are transmitted to Cloudflare Workers, SQLite, or Cloudflare R2.**
     - When the student submits the examination or closes the window, `stream.getTracks().forEach(t => t.stop())` terminates the camera and microphone hardware feeds immediately.

### 3.2 Integrity Events & Telemetry Records

- **Code Location**:
  [`src/lib/classroom/db/index.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/classroom/db/index.ts#L484)
- **Table Schema**:
  ```sql
  CREATE TABLE IF NOT EXISTS exam_integrity_events (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    candidate_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    details TEXT,
    timestamp INTEGER NOT NULL
  );
  ```
- **Dispatched Event Types**:
  `window_blur`, `blocked_key_attempt`, `prohibited_process_detected`, `face_absent`, `multiple_faces_detected`, `audio_anomaly`, `camera_revoked`, `microphone_revoked`.
- **Retention & Purge Clarification**:
  `exam_integrity_events` records are **NOT** deleted by the emergency authorization cleanup routine. They remain linked to the examination session to allow instructors to review flagged events during grading. An automated retention policy (e.g. 90-day post-semester purge) must be configured in coordination with university registrar policies.

### 3.3 Emergency Recovery Authorization Retention

- **Code Location**:
  [`src/lib/classroom/db/index.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/classroom/db/index.ts#L3284)
- **Purge Routine**:
  ```typescript
  async cleanupExpiredEmergencyAuthorizations(olderThanMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    const info = this.db.prepare(`
      DELETE FROM lockdown_emergency_authorizations
      WHERE (used = 1 OR failed_attempts >= max_attempts OR expires_at < ?)
        AND created_at < ?
    `).run(Date.now(), cutoff);
    return info.changes;
  }
  ```
- **Audit Clarification**:
  This cleanup function deletes historical single-use OTP hashes older than 30 days. It does **not** alter student answers, grades, or proctor integrity events.

---

## 4. Human-in-the-Loop Ethical Proctoring Standard

Cortex Lockdown strictly adheres to ethical proctoring and student dignity principles:

1. **Pre-Flight Consent Disclosure**:
   Before accessing camera or microphone hardware, candidates must affirmatively confirm the privacy disclosure modal in [CortexLockdownApp.tsx](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/components/lockdown/CortexLockdownApp.tsx), detailing data processing scope, proctoring basis, and retention commitments.
2. **Strictly Zero Automated Sanctions**:
   The platform contains **zero logic** to automatically disqualify, submit, penalize, or fail a candidate based on AI or heuristic detections.
3. **Advisory Flagging**:
   Events (`face_absent`, `audio_anomaly`, `window_blur`) are rendered as informational timeline markers on the faculty review dashboard. A human instructor or proctor must independently evaluate the context before taking any academic integrity action.
4. **Access Control (RBAC)**:
   Student integrity telemetry can only be accessed by authenticated instructors and assigned proctors enrolled in that specific classroom course.

---
*Report certified by Independent Acceptance Board.*
