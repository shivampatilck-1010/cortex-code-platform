# CORTEX LOCKDOWN - FACULTY DEMONSTRATION GUIDE

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Faculty / Institutional Academic Staff
Target Audience: Department Heads, Examination Deans, Course Instructors, and Demonstration Proctors

---

## 1. Executive Demonstration Purpose

This guide outlines the protocol for demonstrating Cortex Lockdown to academic committees, accreditation inspectors, and university leadership. It details how to showcase real-time proctoring telemetry, tamper-evident audit logging, atomic submission state transitions, and client-side lockdown enforcement.

---

## 2. Demonstration Environment Setup

Ensure the demonstration workstation meets the following baseline:

1. Host PC: Standard Windows 11 / Windows 10 workstation with single monitor.
2. Binary: `CortexLockdown-Hardened.exe` located at `apps\cortex-lockdown-windows\bin\CortexLockdown-Hardened.exe`.
3. Faculty Dashboard: Web browser opened to `http://localhost:3000/classroom` (or institutional staging URL) authenticated as Instructor or Faculty Lead.
4. Test Account: Pre-configured student account (`usr_cand_synth_eval_patil` or dedicated demo candidate).

---

## 3. Recommended Live Demonstration Script (15 Minutes)

### Stage 1: Binary Verification and Clean Launch (2 Minutes)

* Objective: Demonstrate software provenance and zero third-party dependencies.
* Action: Open PowerShell, run `Get-FileHash -Algorithm SHA256 .\CortexLockdown-Hardened.exe`, and compare against the release register (`82518B2D...`).
* Narration: "The application is packaged as a standalone, self-contained Windows binary with zero paid cloud dependencies and verifiable SHA-256 provenance."

### Stage 2: Kiosk Mode and Input Suppression (3 Minutes)

* Objective: Demonstrate endpoint isolation.
* Action: Launch `CortexLockdown-Hardened.exe`, log in as student, and enter exam mode.
* Demonstration:
  - Attempt `Alt+Tab`: Windows task switcher is suppressed.
  - Press Windows Key: Start Menu does not appear.
  - Attempt `Ctrl+Alt+Del`: Show that Task Manager access can be disabled or auditable via group policy / secure desktop.
  - Attempt Screen Capture (`Win+Shift+S` or Snipping Tool): Observe that `SetWindowDisplayAffinity(WDA_MONITOR)` causes the window to appear black in capture buffers.

### Stage 3: Live Proctor Telemetry and Incident Logging (3 Minutes)

* Objective: Demonstrate real-time proctoring integration.
* Action: From the proctor machine or second view, display the active exam session monitoring panel.
* Demonstration:
  - Disconnect webcam briefly or cover camera lens: Show the proctor dashboard flag "Camera stream obscured".
  - Simulate background audio disturbance: Show acoustic threshold warning recorded in telemetry log.
  - Emphasize that zero biometric audio/video is stored; only discrete numerical metrics and hash signatures are retained.

### Stage 4: Network Disconnection Resilience (3 Minutes)

* Objective: Prove offline survivability.
* Action: Disconnect the ethernet cable or disable Wi-Fi on the student test machine.
* Demonstration:
  - Show the student answering Q3 while offline.
  - Explain local AES-256-GCM encrypted persistence in `%LOCALAPPDATA%\CortexLockdown\SecureCache`.
  - Reconnect network adapter.
  - Observe automatic background reconnection and delta synchronization without candidate disruption.

### Stage 5: Final Submission and Cryptographic Verification (4 Minutes)

* Objective: Showcase atomic Compare-And-Swap (CAS) submission and tamper-evident audit logging.
* Action:
  1. Submit the examination from the student client.
  2. Display the cryptographic submission receipt: `CORTEX-SUB-[HMAC_HASH]`.
  3. Attempt duplicate submission: Show that the database returns CAS conflict (`LOCKED_STATE`), completely preventing replay attacks.
  4. On the faculty dashboard, verify the candidate submission status, timestamp, canonical answer digest, and audit log hash chain (`verifyAuditLogCheckpoints()`).
  5. Show the HMAC server signature checkpoint validating that no intermediate audit log records were dropped or rewritten.

---

## 4. Key Talking Points for Institutional Review

1. Standards Alignment: Fully compatible with IMS Global LTI 1.3 Advantage for seamless Canvas, Blackboard, and Moodle gradebook synchronization.
2. Security Truthfulness: Honest, verified security boundaries. We openly disclose that SAML 2.0 production federation is BLOCKED until W3C Exc-C14N canonicalization is deployed, ensuring compliance integrity.
3. Cost and Licensing: ₹0 additional software licensing; open standards and native Windows OS capabilities.
4. Privacy Governance: Aligns with GDPR, FERPA, and institutional privacy charters by eliminating persistent video streaming and raw biometrics storage.
