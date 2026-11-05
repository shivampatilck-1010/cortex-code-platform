# CORTEX LOCKDOWN — ALPHA 14 STUDENT ONBOARDING WORKFLOW & RECOVERY GUIDE

Document Identifier: CL-ONBOARDING-ALPHA14-GUIDE  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: User Experience, Student Dignity & Technical Operations Panel  
Evaluation Host: Windows 10/11 x64 (AMD Ryzen 7 8840U, 16.4 GB RAM)  
Governance Policy: Strictly Zero Emojis  

---

## 1. The 10-Step Student Onboarding Sequence

The Cortex Lockdown student onboarding journey is designed to be frictionless, transparent, and dignified, guiding students through hardware readiness and consent without technical confusion or intrusive demands.

```
[1. Download] --> [2. Install] --> [3. Protocol Register] --> [4. Authenticate] --> [5. Device Enroll]
                                                                                            |
[10. Exam Lobby] <-- [9. Pre-Flight Test] <-- [8. Display Check] <-- [7. Sensor Check] <-- [6. Privacy Consent]
```

### Detailed Step-by-Step Instructions

1. **Step 1: Download Application**:
   - The candidate navigates to the authorized examination lobby on the Cortex platform.
   - The portal provides a direct download link to `CortexLockdown-Windows-x64.zip` (16,994 bytes) or the standalone binary `CortexLockdown.exe` (33,280 bytes).
2. **Step 2: Installation**:
   - In managed university labs, the application is pre-installed at `%LOCALAPPDATA%\CortexLockdown\`.
   - On student laptops, running `install.bat` automatically creates the application directory, places the executable, and creates a Start Menu shortcut under `Cortex Lockdown`.
3. **Step 3: Custom Protocol Registration**:
   - `install.bat` registers the `cortex-lockdown://` scheme in `HKCU\Software\Classes\cortex-lockdown`.
   - This allows the web examination lobby to launch the desktop kiosk with a single click.
4. **Step 4: Cortex Account Authentication**:
   - The candidate signs into their Cortex account (`student` role) using university SSO or registered credentials.
   - The backend issues a cryptographically signed session cookie.
5. **Step 5: Device Enrollment & Hardware Trust Attestation**:
   - The client platform evaluates hardware parameters (machine name, processor architecture, OS build) via `Win32Native`.
   - The backend issues a signed Device Trust Token binding the student to the physical terminal.
6. **Step 6: Privacy Disclosure & Affirmative Consent**:
   - The student reviews the mandatory **Sensor Verification & Proctoring Consent** modal ([`src/components/lockdown/CortexLockdownApp.tsx`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/components/lockdown/CortexLockdownApp.tsx)).
   - Explains that camera and microphone feeds remain ephemeral in local memory, that zero video recordings are stored, and that all anomaly flags require human proctor review. The student checks the affirmative consent box.
7. **Step 7: Camera & Microphone Permission Verification**:
   - The browser invokes `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`.
   - A live self-preview appears on screen, allowing the student to verify webcam framing and microphone input levels.
8. **Step 8: Display Configuration Verification**:
   - The pre-flight checker inspects `Screen.allScreens` and `Win32Native.SM_CMONITORS`.
   - If auxiliary displays or HDMI cables are detected, the system instructs the student to unplug the secondary display before proceeding.
9. **Step 9: Pre-Exam Readiness Diagnostic Test**:
   - The system executes an automated 3-second self-test verifying network latency (<150 ms), server heartbeat connectivity, and keyboard hook readiness.
10. **Step 10: Enter Authorized Examination Lobby**:
    - The browser launches `cortex-lockdown://launch?token=<jwt>&examId=<id>&candidateId=<id>`.
    - The desktop window transitions to full-screen locked kiosk mode, engaging low-level keyboard hooks and display capture protection.

---

## 2. Understandable Recovery Messages & Troubleshooting Guide

To eliminate student anxiety during high-stakes testing, clear, non-technical recovery instructions are provided for every potential failure point:

```
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| ERROR CONDITION           | STUDENT-FACING RECOVERY MESSAGE                       | UNDERLYING TECHNICAL REMEDIATION                      |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| 1. Windows SmartScreen    | "Windows protected your PC: Click 'More info', then   | Executable is currently in internal pilot testing and |
|    Warning on Download    | click 'Run anyway'. Do NOT disable your antivirus."   | unsigned; commercial EV certificate is pending GA.    |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| 2. Custom Protocol        | "Cortex Lockdown launcher could not be opened. Please | Run `install.bat` inside the downloaded folder to     |
|    Not Found              | extract the downloaded ZIP folder and run install.bat"| re-register `HKCU\Software\Classes\cortex-lockdown`.  |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| 3. Login / Session        | "Your login session has expired. Please refresh the   | Candidate JWT token expired; re-authenticate via SSO  |
|    Expired                | browser page and sign in again to resume your exam."  | to issue a fresh 2-hour session cookie.               |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| 4. Device Enrollment      | "This device is not authorized for this examination.  | The device fingerprint is not in `allowedDeviceIds`;  |
|    Rejected               | Please inform your proctor to enroll this workstation"| proctor adds machine ID via Admin Console.            |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| 5. Multiple Monitors      | "Multiple monitors detected. Please unplug external   | `SM_CMONITORS > 1`. Candidate must disconnect HDMI/DP |
|    Connected              | display cables or turn off secondary screens to start"| cable so only the primary display is active.          |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| 6. Camera / Microphone    | "Camera or microphone access denied. Click the camera | Browser permissions blocked; click address bar icon   |
|    Permission Denied      | icon in your address bar and select 'Allow'."         | and set Camera and Microphone to "Always Allow".      |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
| 7. Expired Launch Grant   | "Launch authorization grant expired. Click 'Relaunch' | Launch grant TTL is 120 seconds. Clicking relaunch    |
|    Token                  | in your exam lobby to request a fresh launch grant."  | generates a fresh signed launch grant token.          |
+---------------------------+-------------------------------------------------------+-------------------------------------------------------+
```

---

## 3. Zero Antivirus Disabling Guarantee

- **Safety Principle**:
  Cortex Lockdown **never** instructs students to disable Windows Defender, turn off real-time antivirus protection, or lower firewall security.
- **Why Antivirus Stays Active**:
  The application is built on standard, documented Win32 user-mode APIs (`SetWindowsHookEx`, `SetWindowDisplayAffinity`). It does not inject DLLs into third-party processes, modify the Windows kernel, or execute rootkit techniques. Antivirus remains fully active to protect student computers from genuine threats during examinations.

---
*Report certified by User Experience & Technical Operations Panel.*
