# CORTEX LOCKDOWN
# STUDENT PRIVACY NOTICE & PROCTORING GOVERNANCE POLICY
## Transparency, Data Protection & Regulatory Compliance

**Document Version:** 1.0.0  
**Compliance Standards:** Family Educational Rights and Privacy Act (FERPA), General Data Protection Regulation (GDPR Art. 13 & 14), COPPA  
**Applicability:** All candidates taking examinations via Cortex Lockdown  
**Author:** Data Protection Officer & Senior Privacy Counsel  
**Date:** October 31, 2026  

---

## 1. PURPOSE & TRANSPARENCY COMMITMENT

The Cortex Online Examination System and Cortex Lockdown application are committed to protecting the privacy, dignity, and digital rights of all students. 

Remote and secure computer-based proctoring involves the processing of biometric indicators, audio, video, and device telemetry. This policy explains explicitly:
1. What data is collected during an examination session.
2. The legal and educational basis for data collection.
3. How long recordings and proctoring logs are retained.
4. Who has access to your examination recordings.
5. How your data is protected and permanently deleted.

Cortex operates under a strict principle: **No Covert Surveillance, No Automated Academic Sanctions, and Minimal Data Collection.**

---

## 2. DATA COLLECTION INVENTORY

During an authorized Cortex Lockdown examination session, the following categories of data may be processed based on the specific security policy configured by your course instructor:

| Data Category | Specific Telemetry Collected | Purpose | Transmission & Storage |
| :--- | :--- | :--- | :--- |
| **Authentication & Device Trust** | Cortex User ID, institutional email address, public IP address, operating system version, CPU and motherboard hardware hash. | To ensure account authenticity and verify that the exam is completed on an authorized, single-user desktop environment. | Encrypted in transit via TLS 1.3. Device hash stored in Cloudflare D1. Plaintext passwords are never collected or stored. |
| **Video Proctoring (Webcam)** | Continuous or periodic webcam video frames (standard resolution: 640x480 or 1280x720 at 5–15 FPS). | To verify the candidate's physical presence and detect unauthorized external collaboration. | Encrypted via WebRTC (SRTP/DTLS) in transit; encrypted at rest using AES-256 in institutional Cloudflare R2 object storage. |
| **Audio Proctoring (Microphone)** | Ambient room audio and sound amplitude (decibel levels). | To identify spoken examination answers, voice communication, or external assistance. | Encrypted in transit (Opus codec over SRTP); encrypted at rest with AES-256. |
| **Screen Activity & Kiosk Telemetry** | Window focus loss timestamps, duration of blur, attempted hotkey presses (e.g. Alt+Tab), secondary monitor connection events, detected background process names from the prohibited signature list. | To ensure that the candidate remains inside the secure examination workspace without consulting unauthorized digital materials. | Structured JSON log stored in Cloudflare D1. Keystroke content is never logged—only functional shortcut attempts are recorded. |
| **Academic Performance Data** | Candidate question responses, code editor keystrokes (within Code Studio), numerical inputs, autosave timestamps, and submission receipts. | To record, evaluate, and grade the academic assessment. | Stored in Cloudflare D1 with monotonic sequence validation. |

---

## 3. STRICT PRIVACY SAFEGUARDS

### 3.1 No Covert Sensor Activation
- The webcam and microphone are **never** activated without prior notice and explicit user consent.
- When sensors are active, a prominent, persistent recording indicator (green icon and active video preview) is displayed in the examination interface.
- Sensor access terminates immediately upon examination submission or exit.

### 3.2 Human-in-the-Loop Review (No Automated Penalties)
- Automated detection mechanisms (such as missing face or audio noise alerts) serve solely as **advisory flags** for authorized human proctors and instructors.
- **No student can be failed, disqualified, or penalized based solely on an automated algorithm.** A certified course instructor or institutional exam board must conduct a manual human review before any academic integrity action is taken.

### 3.3 Zero Biometric Template Creation
- Facial detection is performed locally or within secure server isolates using geometric landmark boundary bounding boxes.
- Cortex **does not** extract, store, or sell permanent facial recognition biometric templates, iris scans, or voiceprints. Visual frames are processed solely to confirm physical presence during the session.

---

## 4. ACCESS CONTROL & ROLE-BASED GOVERNANCE

Access to candidate video recordings, audio logs, and proctoring telemetry is strictly restricted:
1. **Course Instructors:** Authorized teachers assigned to the specific course can review proctoring recordings for their enrolled students.
2. **Authorized Institutional Proctors:** Designees appointed by the university examination office with temporary review permissions.
3. **Audit Trail Logging:** Every access to an examination recording or proctoring incident log is recorded in an immutable audit ledger containing the viewer's ID, timestamp, and justification.
4. **No Third-Party Monetization:** Cortex never shares, sells, or licenses student recordings or academic data to advertising networks, data brokers, or external AI model trainers.

---

## 5. RECORDING RETENTION & AUTOMATED DELETION

To prevent unbounded data accumulation, Cortex enforces strict retention time limits:
- **Default Retention Period:** 30 calendar days from the date of examination submission.
- **Grade Finalization:** Once official course grades are posted and the academic appeal window closes, video and audio media files are automatically purged from storage buckets.
- **Academic Integrity Holds:** In the event of an active, formal academic integrity inquiry, an instructor may place an administrative hold extending retention until the dispute is resolved.
- **Right to Erasure (GDPR Art. 17):** Students or institutions may submit formal deletion requests through their university registrar or data protection officer upon completion of degree requirements.

---

## 6. ACCESSIBILITY & ACCOMMODATIONS

Cortex Lockdown is designed to support students with diverse learning needs and approved academic accommodations:
1. **Screen Magnification & High-DPI:** The application natively supports display scaling up to 250% on Windows and high-resolution Retina rendering on macOS without UI truncation.
2. **High-Contrast Dark Mode:** Default design provides WCAG 2.1 AAA contrast ratios (minimum 7:1) with dark charcoal backgrounds and accessible typography.
3. **Approved Assistive Technologies:** Where institutional policy permits, approved screen readers (JAWS, NVDA, Apple VoiceOver) can be whitelisted by the instructor in the examination's security profile.
4. **Extended Time Limits:** Server-authoritative time accommodations (1.5x, 2.0x, custom minutes) configured by the instructor are seamlessly honored by the Lockdown runtime.
