# CORTEX LOCKDOWN RC1 - STUDENT QUICKSTART GUIDE

Package Version: 1.0.0-rc1
Classification: Candidate Examinee Reference

## 1. Before Launching
- Disconnect secondary displays, HDMI capture cards, and projectors.
- Close communication and recording software (Discord, Zoom, Teams, OBS Studio).
- Ensure your laptop is plugged into AC power.

## 2. Taking the Exam
1. Launch `CortexLockdown-Hardened.exe`.
2. Authenticate using your student credentials or enter the exam launch grant token provided by your proctor.
3. Review the system readiness check (CPU, RAM, camera, mic, display count).
4. Review the privacy agreement: no raw continuous video or audio is stored on disk or server.
5. Click "Begin Examination" to engage fullscreen kiosk mode.
6. If network connectivity drops: continue answering questions. Answers are automatically encrypted locally every 5 seconds using AES-256-GCM.
7. Upon completing the examination, click "Submit Examination" and confirm.
8. Record your cryptographic submission receipt code (e.g. `CORTEX-SUB-[HMAC]`). This is your verifiable submission proof.
9. Click "Exit Secure Browser" to return to Windows desktop.
