# Cortex Lockdown: Student Examination User Guide
## Candidate Examination Journey & Interface Reference

### 1. Overview
Cortex Lockdown is a secure examination environment designed to ensure fairness and integrity during university assessments. This guide describes what candidates will experience from pre-flight checks through final submission.

---

### 2. Operational Notice
- This guide applies to **controlled demonstration environments and authorized pilot evaluations**.
- Candidates in demonstration sessions use clearly labelled synthetic accounts (`usr_cand_synth_demo_patil`).
- Real academic assessments are conducted only after written departmental scheduling.

---

### 3. Step-by-Step Candidate Journey

#### Stage 1: Welcome & Examination Selection
1. Launch Cortex Lockdown from the Start Menu or via the web launch link.
2. The Welcome Dashboard displays your identity, enrolled device, and available scheduled assessments.
3. Review the examination metadata: title, course code, scheduled duration (e.g., 60 minutes), and passing threshold.
4. Click **Start Verification** to begin pre-flight checks.

#### Stage 2: Device Security & Kiosk Audit
1. The client verifies workstation compliance:
   - **Display Integrity**: Confirms a single primary display monitor is connected (secondary external monitors must be unplugged).
   - **Process Watchdog**: Confirms that communication tools (Discord, Teams, Slack), screen capture utilities (OBS, Snipping Tool), and debuggers are closed.
   - **Display Affinity**: Confirms window capture exclusion (`WDA_MONITOR`) is active.
   - **Virtualization & Remote Desktop**: Confirms execution on physical bare-metal hardware.
2. Click **Continue to Sensor Check** once all 4 checks indicate PASSED.

#### Stage 3: Hardware Readiness & Privacy Disclosure
1. **Camera Feed**: Live webcam stream initializes for on-device facial presence monitoring.
   - If webcam permissions are denied or hardware is unavailable, the client gracefully transitions to **Evaluation Simulation Mode**.
2. **Microphone Level**: Audio input level indicator reflects microphone responsiveness.
3. **Privacy Notice**:
   - Zero raw video or audio streams are uploaded to servers.
   - Zero biometric facial recognition models or voiceprints are stored.
   - Processing is performed strictly on-device to detect presence and anomalies.
4. Check the consent acknowledgment box and click **Proceed to Examination Rules**.

#### Stage 4: Examination Instructions & Honor Code
1. Read the examination-specific rules: allowed reference material, submission deadline, and calculator permissions.
2. Check the academic integrity pledge: *"I affirm on my honor that all answers submitted during this examination represent my own individual intellectual work."*
3. Click **Enter Secure Exam Kiosk**.

#### Stage 5: Examination Workspace
1. **Full-Screen Locked Workspace**:
   - Task switching shortcuts (`Alt+Tab`, `WinKey`, `Alt+F4`, `PrintScreen`) are suppressed.
   - The countdown timer is prominently visible in the top header.
2. **Question Navigation**:
   - Navigate freely between questions using the question grid or Previous / Next buttons.
   - Mark questions for review if you wish to revisit them later.
3. **Encrypted Autosave & Synchronization**:
   - Every selection and keystroke is saved immediately to local disk using AES-256-GCM authenticated encryption.
   - A live indicator confirms: `Saved & Synced` (green) or `Offline - Locally Buffered` (amber).
   - If network connectivity is lost, continue answering uninterrupted. Buffered answers synchronize automatically when connection is restored.
4. **Crash Recovery**:
   - If the application is closed or the computer crashes, relaunch the application. Your unsubmitted answers are decrypted and restored to the workspace.

#### Stage 6: Final Submission & Receipt
1. Click **Submit Examination** when you are ready to conclude.
2. Review the submission confirmation modal showing answered count and marked-for-review count.
3. Click **Confirm & Seal Examination**.
4. The server validates deadlines, computes an immutable SHA-256 answer digest, and returns an authoritative HMAC receipt:
   ```
   RECEIPT_ID: CORTEX-SUB-[16-HEX]
   STATUS: CONFIRMED & SEALED BY SERVER
   ```
5. Record your receipt code for your academic records.
6. Click **Return to Student Dashboard** to exit kiosk mode.
