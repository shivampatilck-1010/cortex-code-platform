# CORTEX LOCKDOWN RC1.2 - STUDENT QUICKSTART & CANDIDATE GUIDE

Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10/11 x64  
Classification: Candidate Examination Manual  
Zero Emojis Enforced: Yes  

---

## 1. Candidate Pre-Exam Preparation Checklist

Before the examination begins, ensure your workstation meets the following criteria:

- [ ] Single Display Only: Disconnect all secondary monitors, TV screens, and external capture devices.
- [ ] Close Background Applications: Close Discord, Slack, Zoom, Teams, WhatsApp, screen recorders, and virtual machines.
- [ ] Connect Hardware: Ensure your webcam and microphone are connected and operational.
- [ ] Stable Power: Ensure laptops are plugged into AC power.
- [ ] Institutional Authorization: Ensure you are using an institution-approved testing workstation.

---

## 2. Step-by-Step Examination Lifecycle

### Step 1: Launch Application
Locate and launch **Cortex Lockdown** from the desktop shortcut or application menu on your designated testing machine.

### Step 2: System & Hardware Readiness Check
The application will automatically perform a non-invasive pre-flight inspection:
- Confirms single active display adapter.
- Checks webcam and microphone device access.
- Scans for prohibited background processes (screen recorders, virtual machine monitors).

### Step 3: Enter Launch Authorization
When prompted, enter your **Examination Launch Grant** or scan the QR code provided on your candidate desk slip. Alternatively, if your institution uses LTI 1.3, select your institution's portal login.

### Step 4: Review Privacy & Monitoring Notice
Cortex Lockdown operates under strict privacy-preserving principles:
- **In-RAM Processing:** Webcam and microphone inputs are analyzed strictly in volatile memory.
- **Zero Media Retention:** No raw video recordings or audio recordings are saved to local disk or transmitted across the network.
- **Advisory Signals Only:** Behavioral events (such as multiple faces or ambient sound bursts) are sent as advisory signals to the human faculty proctor. The software never automatically disqualifies or terminates a candidate.

### Step 5: Examination Workspace
Once locked into the examination environment:
- The window expands to full screen.
- Task-switching shortcuts (`Alt + Tab`, `Windows Key`, `Ctrl + Esc`) are suppressed.
- Screen capture software and background recorders are blocked from viewing exam content.

### Step 6: Answering Questions & Offline Autosave
- Enter your answers in the code and text editors provided.
- Your progress is automatically saved to the local secure answer journal every 5 seconds.
- Local journal entries are encrypted using **AES-256-GCM** with a session-specific cryptographic key.
- **Network Drop Protection:** If the campus Wi-Fi or local network disconnects, you will receive an amber notification banner, but you may continue answering questions without interruption. The application will automatically reconcile with the classroom server once connectivity is restored.

### Step 7: Submitting Your Examination
1. When you have completed all sections, click the **"Review & Submit"** button.
2. Review the summary of answered and flagged questions.
3. Click **"Confirm Final Submission"**.
4. The server executes an atomic single-winner verification check and generates your official **Cryptographic Submission Receipt** (format: `CORTEX-SUB-[HMAC]`).
5. Write down or save your submission receipt identifier.

### Step 8: Safe Application Exit
Upon confirmed submission:
- The secure answer cache on local disk is cleared.
- Keyboard hooks are released and your Windows desktop is fully unlocked.
- The application safely exits to the desktop.

---

## 3. Emergency & In-Exam Technical Support

If you encounter a medical or technical emergency during the examination:
- Immediately raise your hand to alert the human faculty proctor.
- Do not attempt to force-reboot the machine or unplug system cables.
- The proctor will initiate an emergency exit sequence (`Ctrl + Alt + F10`) and enter a one-time authorization code if evacuation or technical reassignment is required.
