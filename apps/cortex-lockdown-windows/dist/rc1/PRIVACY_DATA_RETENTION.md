# CORTEX LOCKDOWN RC1 - PRIVACY & DATA RETENTION SPECIFICATION

Package Version: 1.0.0-rc1  
Classification: Privacy Policy & Compliance Specification  
Target Standards: FERPA (34 CFR Part 99), GDPR (EU 2016/679)  
Zero Emojis Enforced: Yes  

---

## 1. Core Privacy Commitments & Technical Scope

### 1.1 In-RAM Ephemeral Media Processing
- **Webcam Video Stream:** Video frames acquired via `navigator.mediaDevices.getUserMedia` are rendered to client-side HTML `<video>` elements in volatile memory (RAM). Computer vision heuristics (face detection, gaze tracking) execute frame-by-frame in RAM. No raw video files, image snapshots, or video streams are written to local disk.
- **Microphone Audio Stream:** Ambient audio is evaluated via Web Audio `AnalyserNode` in volatile RAM for Root-Mean-Square (RMS) decibel levels and speech frequency bands. Raw audio samples are discarded immediately after analysis; no raw audio recordings are persisted.

### 1.2 Media Transmission & Network Verification Boundary
- **Source Code Verification (VERIFIED):** Exhaustive static analysis of client source code (`CortexLockdownApp.tsx`), backend API routes (`/api/v1/lockdown/*`), and network utilities confirms that no WebRTC media peer connections, `MediaRecorder` uploads, multipart audio/video endpoints, or continuous streaming sockets exist. The client only transmits discrete JSON metadata telemetry (`/api/v1/lockdown/telemetry`).
- **Network-Level Packet Capture (NOT VERIFIED):** Formal network wire-level inspection (e.g., packet capture via Wireshark or raw Npcap network interface sniffer) has not been performed in this automated testing environment. In strict adherence to release engineering integrity, the claim of zero media transmission at the physical network layer is classified as **NOT VERIFIED at the wire packet layer** pending formal institutional network auditing.

### 1.3 Local Offline Storage & Encryption
- Offline examination responses are stored in `%LOCALAPPDATA%\CortexLockdown\SecureCache`.
- All response data is encrypted prior to writing using AES-256-GCM authenticated encryption. Encryption keys are derived using Web Crypto PBKDF2 with 100,000 iterations, bound to the student ID, exam ID, and session-specific salt.
- Plaintext student answers are never written to disk.

---

## 2. Data Deletion & Physical Media Retention Boundaries

### 2.1 Software Cache Scrubbing
Upon verified submission receipt from the central examination gateway, `clearEncryptedAnswers()` is triggered. The application overwrites the local cache file with zero bytes (`Buffer.alloc(len, 0)`) and unlinks the file path (`fs.unlinkSync()`).

### 2.2 SSD / NAND Flash Wear-Leveling Limitation
- **Physical Flash Eradication Non-Goal:** Modern solid-state drives (NVMe, SSD, eMMC) utilize a Flash Translation Layer (FTL) with dynamic wear-leveling, bad-block remapping, and out-of-place writes. When user-space software overwrites a file with zeros, the SSD controller writes zeros to a newly allocated NAND flash page and marks the original page as stale for future garbage collection and TRIM cycles.
- **Forensic Boundary:** User-space zeroing and file deletion cannot guarantee physical bit-level destruction on SSD/NAND media. Residual ciphertext blocks may persist in physical flash cells until garbage collection occurs.
- **Confidentiality Assurance:** Protection against post-exam forensic recovery on student hardware relies primarily upon the **AES-256-GCM cryptographic ciphertext barrier** rather than physical flash sanitization guarantees.

---

## 3. Proctoring Telemetry & Ethical Governance

- **Advisory Status:** All automated proctoring signals (e.g., gaze deviation, multi-face presence, acoustic anomaly) are classified as strictly advisory telemetry for human instructor review.
- **Zero Algorithmic Disqualification:** Cortex Lockdown contains no logic that automatically cancels an exam, terminates a session, or docks marks based on AI signals. All disciplinary and academic integrity actions require human faculty evaluation.
- **Candidate Consent:** Students receive an explicit, un-obscured privacy disclosure prior to entering the secure lockdown environment, confirming that video/audio is processed ephemerally in RAM and that only discrete metadata flags are recorded.

---

## 4. Retention Schedule Summary

| Data Category | Storage Location | Retention Duration | Disposal Method |
| :--- | :--- | :--- | :--- |
| **Raw Video Frames** | Ephemeral RAM only | 0 seconds (discarded per frame) | Instant volatile RAM overwrite |
| **Raw Audio Streams** | Ephemeral RAM only | 0 seconds (discarded per window) | Instant volatile RAM overwrite |
| **Encrypted Answer Cache** | Local Disk (%LOCALAPPDATA%) | Duration of active examination | User-space zeroing and unlink on submit |
| **Integrity Telemetry Flags** | Gateway Database | 90 days following grade publication | Automated database purge |
| **Final Submissions & Receipts** | Institutional Database | Per institutional registrar policy (1-5 yrs) | Institutional archive policy |
