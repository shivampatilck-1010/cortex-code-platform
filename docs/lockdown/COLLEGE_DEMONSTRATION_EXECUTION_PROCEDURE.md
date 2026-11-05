# CORTEX LOCKDOWN - COLLEGE DEMONSTRATION EXECUTION PROCEDURE

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional Demonstration Operational Procedure
Target Audience: Demonstration Lead, Proctoring Officers, and Technical Demonstrators

---

## 1. Executive Demonstration Objectives

The College Demonstration Execution Procedure provides an exact, minute-by-minute protocol for conducting a successful, zero-failure demonstration before college deans, department chairs, and evaluation committees.

Core Demonstration Objectives:
1. Demonstrate bit-for-bit software authenticity and zero additional external spend.
2. Validate complete student examination lifecycle (20 operational steps).
3. Showcase physical endpoint lockdown, display affinity capture blackout, and system keystroke suppression.
4. Prove network fault resilience via offline answering and automatic delta re-synchronization.
5. Demonstrate cryptographic submission receipt verification and tamper-evident audit log checkpoints.

---

## 2. Hardware and Environment Readiness (T-Minus 30 Minutes)

1. Examination Workstation (Student Machine):
   - Windows 11 Build 22000+ or Windows 10 21H2+.
   - Single physical monitor connected directly to display adapter.
   - Disconnect external capture cards, USB display adapters, and mirror screens.
   - Verify network connectivity to the demonstration gateway.
2. Proctor / Evaluator Workstation:
   - Modern browser (Edge, Chrome, or Firefox) opened to faculty proctoring dashboard.
   - Administrative login established.
3. Demonstration Directory Verification:
   - Navigate to `apps\cortex-lockdown-windows\bin`.
   - Confirm presence of `CortexLockdown-Hardened.exe`.
   - Run PowerShell checksum test:
     `Get-FileHash -Algorithm SHA256 .\CortexLockdown-Hardened.exe`
     Confirm hash equals `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`.

---

## 3. Minute-by-Minute Execution Script (20 Minutes Total)

### Minute 00 - 03: Executive Welcome & Cryptographic Provenance
* Demonstrator Action: Display the repository root and project constraints.
* Speech: "Cortex Lockdown has been developed under a strict ₹0 additional budget constraint, preserving existing demonstration binaries bit-for-bit with complete cryptographic transparency."
* Technical Verification: Run the SHA-256 verification command on the live projection screen.

### Minute 03 - 06: Student Launch & Pre-Flight Diagnostics
* Demonstrator Action: Launch `CortexLockdown-Hardened.exe`. Log in with candidate credentials.
* Screen Observation:
  - System checks CPU, memory, display count, and peripheral permissions.
  - Institutional examination policy is retrieved and verified against its cryptographic hash.
  - The privacy disclosure screen appears, stating that zero raw audio or video streams are retained on disk.
* Speech: "Notice the privacy-by-design posture: all facial and acoustic analysis is performed locally in volatile memory; zero raw biometrics are stored or uploaded."

### Minute 06 - 10: Endpoint Lockdown & Tamper Resistance
* Demonstrator Action: Click "Begin Examination". Application transitions into fullscreen exclusive kiosk mode.
* Technical Demonstrations:
  1. Keystroke Suppression: Press `Alt+Tab`, `Windows Key`, and `Ctrl+Esc`. The operating system ignores the inputs; the exam window remains exclusive.
  2. Display Capture Blackout: Attempt screen capture using `Win+Shift+S` or third-party recording software. Point out that the exam window renders as pure black in capture buffers due to `SetWindowDisplayAffinity(WDA_MONITOR)`.
  3. Clipboard Purge: Attempt to paste pre-copied text into answer areas; show that clipboard buffers are sanitized.

### Minute 10 - 14: Network Disconnection Resilience & Offline Journaling
* Demonstrator Action: Unplug the Ethernet cable or disconnect Wi-Fi on the student machine.
* Screen Observation:
  - Top status bar displays "Offline Mode - Local Journal Active".
  - Student types extensive answer to Question 3.
* Speech: "An unexpected Wi-Fi drop does not disrupt the candidate. Answers are committed immediately to local disk using authenticated AES-256-GCM encryption."
* Demonstrator Action: Reconnect the network cable.
* Screen Observation: Within seconds, the client re-establishes its cryptographic session handshake and syncs all answer deltas in the background with zero modal popups or test interruptions.

### Minute 14 - 17: Authoritative Submission & Single-Winner CAS Guarantee
* Demonstrator Action: Candidate clicks "Submit Examination" and confirms.
* Screen Observation:
  - Server transitions session state using atomic Compare-And-Swap (CAS) logic.
  - Unique cryptographic submission receipt is rendered: `CORTEX-SUB-[HMAC_HEX]`.
  - Application cleanly clears the local encrypted journal (`SecureCache`) and releases kiosk mode.
* Replay Attack Demonstration: Attempt to trigger a second submission for the same session. Show that the server returns a CAS lock error, preventing submission replay.

### Minute 17 - 20: Faculty Dashboard & Tamper-Evident Audit Verification
* Demonstrator Action: Switch to the Proctor / Faculty workstation.
* Technical Verification:
  1. Verify the student submission record, timestamp, and canonical SHA-256 answer digest.
  2. Execute audit log integrity verification (`verifyAuditLogCheckpoints`).
  3. Show the unbroken SHA-256 hash chain and HMAC-signed server checkpoints.
* Conclusion Speech: "This concludes the demonstration of Cortex Lockdown: complete student journey integrity, resilient offline recovery, robust endpoint containment, and standards-compliant LTI 1.3 Advantage interoperability."

---

## 4. Emergency Contingency Plan

* In the event of a physical power cord disconnect: Power on machine, launch `CortexLockdown-Hardened.exe`, log in as the student. The application immediately restores all answers from the encrypted local journal and resumes the exam seamlessly.
* In the event of an inadvertent dual monitor trigger: Unplug the secondary video cable and click "Re-check Environment" to clear the warning banner.
