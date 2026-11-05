# CORTEX LOCKDOWN - PRIVACY AND DATA HANDLING DOCUMENT

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional Public Privacy Charter
Compliance Targets: FERPA (34 CFR Part 99), GDPR (EU 2016/679), California Consumer Privacy Act (CCPA)

---

## 1. Privacy-By-Design Architecture

Cortex Lockdown was designed under the strict principle of data minimization. The software minimizes biometric and surveillance data capture, prioritizing student privacy while providing defensible academic integrity guarantees.

Key architectural pillars:

1. Zero Persistent Video Retention: No raw continuous video streams from candidate webcams are saved to disk, uploaded to central servers, or archived in persistent cloud buckets.
2. Zero Continuous Audio Archiving: Audio input is evaluated for ambient decibel thresholds on the local device. No raw audio recordings or voice transcripts are transmitted or stored.
3. Client-Side Edge Analysis: Face presence and multi-display detection are executed as ephemeral mathematical evaluations in volatile memory on the local workstation.
4. Cryptographic Storage of Answers: Local disk journals are encrypted using authenticated AES-256-GCM. Plaintext candidate responses are never stored on persistent workstation media in cleartext.
5. Explicit Student Consent: Before entering lockdown mode, students are presented with an un-obscured disclosure outlining exactly what telemetry is analyzed.

---

## 2. Categorization of Data Collected

The following data categories are processed during an examination session:

### Category A: Identity and Academic Metadata (Stored on Server)

* Student Identifier: Institutional alphanumeric user ID (e.g. `usr_cand_synth_eval_patil`).
* Examination Identifier: Institutional course and exam ID.
* Session Lifecycle Timestamps: Session start time, last heartbeat, submission time, total duration.
* Examination Submission Content: Submitted question answers, canonical answer hash digest (`SHA-256`), and final grading scores.
* Purpose: Required to evaluate student performance, issue grades, and fulfill academic course requirements.
* Retention Period: Governed by institutional registrar policies (typically 1 to 5 years).

### Category B: Proctoring Telemetry Metrics (Discrete Event Records)

* Integrity Event Flags: Discrete boolean signals (e.g. `DISPLAY_COUNT_CHANGED`, `WINDOW_BLUR_ATTEMPTED`, `CAMERA_FEED_LOST`, `AUDIO_LEVEL_EXCEEDED`).
* Incident Timestamps: Exact epoch milliseconds when the policy deviation occurred.
* Incident Context: Numerical values only (e.g. `audio_rms_level: 0.82`, `display_count: 2`).
* Purpose: Allows proctors and academic integrity boards to review anomalous events during the exam.
* Retention Period: Retained alongside the exam audit record for 90 days following course grade publication, then purged.

### Category C: Ephemeral Sensor Data (Discarded Immediately)

* Raw Webcam Frames: Captured into volatile memory buffers, processed for face bounding boxes, and overwritten immediately on the next frame (approximately 30 times per second).
* Raw Audio Samples: Analyzed in short sliding windows (100ms) for RMS amplitude calculations, then immediately discarded from volatile RAM.
* Storage Location: Volatile system memory (RAM) only. Never flushed to disk or transmitted over the network.

---

## 3. Workstation Storage and File Sanitization

### Local Encrypted Cache (`SecureCache`)

* Location: `%LOCALAPPDATA%\CortexLockdown\SecureCache\[SanitizedStudentID]\[ExamID].answers.enc`
* Security Scheme: AES-256-GCM authenticated encryption.
* Derivation: Keys derived via Web Crypto PBKDF2 (100,000 iterations) using hardware entropy and session salts.
* Lifecycle and Sanitization:
  - Created during the examination as an offline-resilience journal.
  - Automatically scrubbed and deleted upon successful submission confirmation (`clearEncryptedAnswers()`).
  - If the application crashes before submission, the file remains encrypted on disk and can only be decrypted when re-authenticated by the same student using their active session credentials.

---

## 4. Student Rights and Institutional Compliance

### FERPA Compliance (United States)

All student examination responses, telemetry flags, and integrity logs are classified as "Education Records" under FERPA (34 CFR Part 99). Access is strictly restricted to designated school officials (instructors, proctors, academic deans) with legitimate educational interests.

### GDPR Compliance (European Union)

* Legal Basis for Processing: Article 6(1)(e) - Performance of a task carried out in the public interest / official authority vested in the university to conduct valid academic assessments.
* Right to Rectification / Access: Students may request access to their examination audit logs and cryptographic submission receipts.
* Data Protection Impact Assessment (DPIA): The elimination of persistent biometric video streaming reduces high-risk processing under GDPR Article 35.

---

## 5. Security of Data in Transit

All communications between the Cortex Lockdown client and campus servers utilize TLS 1.3 encryption with strict server certificate validation. The client rejects connections utilizing insecure protocols (`http:`, `ws:`, `ftp:`) or unverified TLS certificates.
