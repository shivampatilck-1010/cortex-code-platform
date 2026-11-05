# Cortex Lockdown: Faculty & Proctor Operations Guide
## Live Examination Monitoring, Integrity Review & Candidate Oversight

### 1. Overview
The Cortex Lockdown Faculty & Proctor Console provides real-time visibility into active candidate sessions, synchronization health, and automated integrity review signals.

---

### 2. Core Ethical Principle & Fairness Policy
- **Heuristic Nature of Algorithmic Signals**: On-device computer vision and audio heuristics are **review indicators**, never conclusive proof of academic misconduct.
- **Strict Prohibition on Automated Penalties**: The system will never automatically penalize, terminate, or grade down a candidate based on algorithmic signals.
- **Human Proctor Authority**: All disciplinary decisions require explicit human invigilator review and corroborating physical evidence.
- **Student Privacy Standard**: The system adheres to FERPA and GDPR standards. No continuous raw audio or video streams are stored or accessible to unauthorized personnel.

---

### 3. Faculty Dashboard Capabilities

#### 3.1 Session Overview & Candidate Grid
- **Real-Time Polling**: Automatic polling updates active candidates every 8 seconds.
- **Status Filters**: Filter candidates by `All`, `In Progress`, `Submitted`, `Expired`, or `Attention Needed`.
- **Search**: Search candidates by name, email, or synthetic student ID.
- **Heartbeat & Connection Tracking**:
  - `Active` (green): Heartbeat received within last 30 seconds.
  - `Stale` (amber): Heartbeat delayed between 30 and 90 seconds (indicates potential network instability).
  - `Disconnected` (gray): No heartbeat for over 90 seconds (client transitions to offline buffer).

#### 3.2 Live Synchronization Status
- Monitors candidate answer sequence numbers monotonically.
- Out-of-order sequence regressions are rejected by the server (HTTP 409) and flagged in the dashboard.
- Duplicate retries caused by network packet drops are handled idempotently without error.

#### 3.3 Candidate Audit Trail & Response Drawer
Click any candidate card to open their detailed audit panel:
- **Verified Submission Receipt**: Displays `CORTEX-SUB-[16-HEX]` once finalized.
- **Recorded Integrity Events**: Displays chronological event timeline:
  - `window_blur`: Kiosk lost operating system window focus.
  - `fullscreen_exit`: Fullscreen mode was interrupted.
  - `prohibited_process_detected`: Prohibited background process was launched.
  - `display_capture_attempt`: External recording tool attempt detected.
  - `audio_anomaly`: Sustained vocal speech detected in candidate room.
- **Saved Responses**: View autosaved answers, points earned, and grading breakdowns.

#### 3.4 Authorized Proctor Actions
- **Time Extension**: Grant an individual candidate extra time (5 to 60 minutes) in case of documented technical difficulties.
- **Force Submit / Terminate**: In case of severe, verified misconduct or candidate emergency, proctors can manually conclude a session with a mandatory justification reason.
- **Revocation Gate**: Flag an account or hardware device in the pilot configuration to block further answer sync or submissions.

#### 3.5 Exporting Audit Reports
- Click **Export Audit** in the top action bar to generate a structured JSON report (`cortex-exam-audit-[examId]-[timestamp].json`).
- The report includes candidate metadata, submission receipts, timestamps, integrity event counts, and proctor action logs for institutional archiving.
