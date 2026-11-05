# CORTEX LOCKDOWN - STUDENT EXAMINATION GUIDE

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional Public
Audience: Candidate Students and Examinees

---

## 1. Overview of the Examination Environment

Cortex Lockdown provides a tamper-resistant, isolated testing environment designed to ensure equitable assessment. When launched, the application engages high-integrity Windows security controls:

* Fullscreen Exclusive Kiosk Display: Prevents window minimizing, background window access, or task switching.
* Keystroke Interception: Disables operating system navigation shortcuts including Alt+Tab, Windows Key, Ctrl+Esc, Alt+F4, and PrintScreen.
* Screen Capture Blocker: Utilizes Windows native `SetWindowDisplayAffinity(WDA_MONITOR)` to render the exam canvas completely black to local screen recording, capture tools, and remote sharing software.
* Local Resilient Storage: Protects typed answers in an encrypted local journal using AES-256-GCM so that unexpected network disruptions do not cause data loss.

---

## 2. Step-by-Step Examination Journey

### Step 1: Launch and Authentication

1. Launch `CortexLockdown-Hardened.exe`.
2. Authenticate using your institutional single sign-on (SSO) credentials or enter the exam launch grant code provided by your course instructor.
3. The platform verifies your student identity, binds your session token to the active hardware endpoint, and retrieves the exam configuration.

### Step 2: System Diagnostic and Hardware Readiness Check

Upon login, Cortex Lockdown executes an automatic diagnostic check:

* Processor and Memory verification: Confirms adequate CPU and RAM resources.
* Display verification: Validates that only a single physical monitor is connected.
* Peripheral verification: Tests camera and microphone input levels if proctoring is enabled.
* Network latency check: Verifies reachability to the institutional examination gateway.
* Resolution of conflicts: If a prohibited process (such as a screen recorder or communication app) is active, an alert will indicate the specific process name. Close the offending application to proceed.

### Step 3: Privacy and Proctoring Disclosure

Review the institutional proctoring agreement displayed on screen:

* Understand that webcam/audio analysis (if active) occurs locally to detect anomalies.
* No raw video or continuous audio streams are stored persistently on the client machine.
* Click "Acknowledge and Begin Examination" to lock the workstation and open the question paper.

### Step 4: Kiosk Mode and Question Interaction

* The exam paper enters full-screen lockdown.
* You may navigate between sections and questions using the sidebar or bottom pagination controls.
* For coding or written questions, answers are automatically saved locally every 5 seconds.
* A live countdown timer is displayed at the top right of the examination interface.

### Step 5: Handling Network Disruptions (Offline Tolerance)

If your local Wi-Fi or internet connection drops during the exam:

1. Do not panic or force-close the application.
2. A subtle indicator in the status bar will reflect "Working Offline (Local Journal Active)".
3. Continue answering questions normally. Your keystrokes and answers are encrypted locally using AES-256-GCM.
4. When connectivity is restored, Cortex Lockdown automatically re-establishes its cryptographic session handshake and synchronizes all answer deltas in the background.

### Step 6: Final Submission and Cryptographic Receipt

1. When you have completed all questions, review your answers on the summary screen.
2. Click "Submit Examination".
3. A confirmation dialog will summarize the total questions answered.
4. Click "Confirm Submission".
5. Upon successful server registration, a unique HMAC-signed cryptographic submission receipt will be rendered on screen (for example: `CORTEX-SUB-F111AB1B11ACD120`).
6. Note down or photograph this receipt code. It serves as irrefutable cryptographic proof of your submission timestamp and answer digest.
7. Click "Exit Secure Browser" to release workstation lockdown and return to your Windows desktop.

---

## 3. Candidate Code of Conduct and Prohibited Actions

During the examination, the following behaviors are strictly prohibited and audited:

* Attempting to connect secondary displays, capture cards, or wireless streaming mirrors.
* Attempting to terminate or inject code into `CortexLockdown.exe`.
* Initiating task manager or command line utilities via physical or virtual key injections.
* Leaving the field of view of the camera when automated proctoring is mandated.
* Collaborating with unauthorized individuals or consulting external electronic devices.

All detected policy violations generate tamper-evident audit records bound to your institutional student profile.
