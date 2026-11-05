# Cortex Lockdown: Troubleshooting & Diagnostics Guide
## Technical Issue Resolution for Demonstrations & Lab Evaluations

### 1. Overview
This guide provides direct resolution steps for technical conditions that may arise during demonstrations or managed lab evaluations.

---

### 2. Common Issues & Resolution Procedures

#### Issue 1: Windows SmartScreen or Antivirus Prompt on First Launch
- **Symptom**: Windows displays *"Windows protected your PC"* or antivirus flags `CortexLockdown.exe`.
- **Cause**: The application is an academic development build signed with a self-signed / test certificate rather than an expensive commercial EV Authenticode certificate.
- **Resolution**:
  - Click **More info** -> **Run anyway** on SmartScreen.
  - Verify executable SHA-256 against `SHA256SUMS.txt` (`82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`).
  - In institutional labs, add `C:\Program Files\CortexLockdown\CortexLockdown.exe` to the antivirus exclusion list or deploy via AppLocker hash rule.

#### Issue 2: Web Portal Does Not Launch Desktop Client (`cortex-lockdown://`)
- **Symptom**: Clicking "Launch Exam" in the browser does not open the desktop kiosk.
- **Cause**: The custom URI scheme is not registered in the Windows registry.
- **Resolution**:
  1. Re-run `install.bat` from the extracted release directory.
  2. Verify registry registration in PowerShell:
     ```powershell
     Get-ItemProperty -Path "HKCU:\Software\Classes\cortex-lockdown\shell\open\command"
     ```
  3. Ensure the browser popup blocker is not suppressing external protocol confirmation dialogs.

#### Issue 3: Webcam or Microphone Denied / Unavailable
- **Symptom**: Red warning banner on Hardware Readiness screen indicating camera permission error.
- **Cause**: Camera is in use by another application (Zoom, Teams) or Windows Privacy Settings block desktop app camera access.
- **Resolution**:
  1. Close any running video conferencing applications.
  2. Open Windows Settings -> **Privacy & security** -> **Camera** -> Ensure *"Let desktop apps access your camera"* is enabled.
  3. Click **Retry Hardware Access** in the Cortex Lockdown window.
  4. If running in a virtual machine or hardware without a camera, the application will automatically activate **Evaluation Simulation Mode**, allowing demonstration testing to proceed.

#### Issue 4: Secondary Monitor Warning Blocks Exam Launch
- **Symptom**: Device Security check fails with *"Secondary external display detected"*.
- **Cause**: Laptop is connected to an external monitor, projector, or docking station.
- **Resolution**:
  1. Unplug the HDMI / DisplayPort / USB-C monitor cable.
  2. Press `Win + P` and select **PC screen only**.
  3. Click **Re-check Device Security**.

#### Issue 5: Network Drop During Submission
- **Symptom**: Submitting answers displays *"Server Confirmation Required: Network delivery interruption"*.
- **Cause**: Wi-Fi connection disconnected or temporary backend timeout.
- **Resolution**:
  1. Do NOT close the application. All student answers are safely preserved in encrypted local storage (`AES-256-GCM`).
  2. Restore network connectivity (reconnect Wi-Fi or plug in Ethernet cable).
  3. Click **Retry Server Submission**.
  4. The server receives the submission idempotently and returns the confirmed receipt `CORTEX-SUB-[16-HEX]`.

#### Issue 6: Application Closed Unexpectedly During Examination
- **Symptom**: Power outage or accidental application termination during an active exam.
- **Cause**: Process interruption.
- **Resolution**:
  1. Relaunch Cortex Lockdown from the Start Menu.
  2. The application detects the unsubmitted session and prompts for recovery.
  3. Enter your student credentials. The application reads the encrypted envelope from disk, verifies the authentication tag, and restores 100% of previous answers to the workspace.
