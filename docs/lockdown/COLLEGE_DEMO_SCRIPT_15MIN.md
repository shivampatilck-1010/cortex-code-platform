# CORTEX LOCKDOWN - 15-MINUTE FACULTY DEMONSTRATION SCRIPT

Classification: Presenter / Demonstration Delivery Guide  
Package Version: 1.0.0-rc1.2  
Target Audience: Academic Deans, Department Chairs, Exam Controllers, Campus IT  
Zero Emojis Enforced: Yes  
Additional Budget Expended: INR 0  

---

## 1. Demonstration Setup & Pre-Flight (T minus 5 Minutes)

### Environment Prerequisites:
- Workstation: Dedicated physical Windows 10/11 x64 laptop or lab PC.
- Network: Standard campus Wi-Fi or Ethernet connection.
- Peripherals: Integrated or standard USB webcam and microphone; single monitor directly connected to GPU.
- Server: Local development/staging server running (`npm run dev`) with classroom dashboard open at `http://localhost:3000/classroom`.
- Authorization: Workstation pre-authorized via AppLocker hash rule or PowerShell unblock (see `IT_PREAUTHORIZATION_GUIDE.md`).

---

## 2. Turn-by-Turn Script (Minutes 0 to 15)

### Phase 1: Cryptographic Provenance & Boundary Transparency (Minutes 00:00 - 03:00)

**Spoken Talking Points:**
"Good morning, colleagues. Today we are demonstrating Cortex Lockdown RC1.2, a dedicated Windows examination security application designed to provide reliable academic integrity without compromising student device stability or personal privacy.

Before launching, let us inspect the cryptographic authenticity of the release. Cortex Lockdown was developed under a strict INR 0 external budget constraint. To demonstrate that nothing has been altered or tampered with, we verify the SHA-256 hash directly in PowerShell."

**Action:**
1. Open Windows PowerShell on the demonstration machine.
2. Run:
   ```powershell
   Get-FileHash -Algorithm SHA256 .\CortexLockdown-Hardened.exe
   ```
3. Display the resulting hash:
   `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`
4. Confirm this matches the published release manifest.

**Spoken Boundary Disclosure:**
"Because this build was developed with zero external expenditure, it does not carry an expensive commercial Extended Validation code-signing certificate. In accordance with proper campus IT governance, we never instruct users to click 'Run Anyway'. This machine has been pre-authorized via our campus IT hash allowlist. Furthermore, Cortex Lockdown operates strictly in user mode without kernel drivers, ensuring zero risk of system crashes or Blue Screens."

---

### Phase 2: Kiosk Lockdown & Screen Capture Defense (Minutes 03:00 - 06:00)

**Action:**
1. Double-click `CortexLockdown-Hardened.exe`.
2. The application opens into the pre-flight readiness screen, performs camera/mic detection, and prompts for launch authorization.
3. Select **"Secure Evaluation / Demo Examination"** and enter the examination workspace.
4. The window maximizes into exclusive fullscreen kiosk mode.

**Spoken Talking Points:**
"The student is now in the locked examination environment. Let us test standard operating system escape attempts."

**Action:**
1. Press `Alt + Tab` repeatedly: nothing happens.
2. Press the `Windows Key`: the Start menu does not appear.
3. Press `Ctrl + Esc` and `Alt + Esc`: all navigation is intercepted.
4. Explain: "These inputs are intercepted at the hardware message level using a Win32 low-level keyboard hook (`WH_KEYBOARD_LL`)."
5. Open OBS Studio or the Windows Snipping Tool in the background or on a projection capture:
   Explain: "Notice that screen recording software captures only an opaque black rectangle. This is enforced via Windows Desktop Window Manager `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)`."

---

### Phase 3: Privacy & Real-Time In-RAM Telemetry (Minutes 06:00 - 09:00)

**Spoken Talking Points:**
"Now let us examine our privacy architecture. Many commercial proctoring tools record hours of student video and upload it to third-party cloud servers. Cortex Lockdown fundamentally rejects that intrusive model."

**Action:**
1. Point to the local camera and microphone indicators.
2. Explain:
   "Webcam frames and acoustic audio signals are ingested into volatile RAM buffers, evaluated instantaneously for anomalous conditions, and immediately discarded. No video recordings, audio tracks, or screenshots are written to disk. (Note: while our application source code enforces this strictly, live physical wire-level packet capture is classified as not independently verified)."
3. Have a colleague briefly step into view of the camera or generate a sharp acoustic sound.
4. Switch to the Faculty Proctor Dashboard on the second projector/monitor:
   Show that an advisory flag (`multiple_faces` or `acoustic_spike`) appears in the proctor timeline.
5. Emphasize:
   "Notice that the candidate is not automatically disqualified or ejected. Cortex Lockdown preserves human-in-the-loop decision-making; all alerts are purely advisory flags for faculty review."

---

### Phase 4: Network Disconnection & Encrypted Offline Autosave (Minutes 09:00 - 12:00)

**Spoken Talking Points:**
"A common failure in online exams is campus network instability. Watch what happens when connection is lost."

**Action:**
1. Unplug the Ethernet cable or toggle Wi-Fi Off on the demonstration machine.
2. An amber notification banner appears: *"Network connection lost. Continuing in encrypted offline journal mode."*
3. Continue typing answers and code in the editor.
4. Explain:
   "The student is never locked out or interrupted. The local answer store saves answers every 5 seconds to disk, encrypted with AES-256-GCM using a session key derived via 100,000 PBKDF2 iterations."
5. Reconnect the Ethernet cable / toggle Wi-Fi back On.
6. The banner turns green: *"Network restored. In-progress answers successfully resynchronized."*

---

### Phase 5: Authoritative Submission, Cryptographic Receipt & Exit (Minutes 12:00 - 15:00)

**Action:**
1. Click **"Review & Submit"** and review the candidate summary.
2. Click **"Confirm Final Submission"**.
3. Point to the proctor dashboard:
   "The server processes the submission via an atomic Compare-And-Swap (CAS) transaction, ensuring exactly one authoritative final submission."
4. On the student screen, display the official cryptographic submission receipt:
   Format: `CORTEX-SUB-[HMAC]`
5. Click **"Exit Examination"**.
6. Observe that the application releases all keyboard hooks, clears the local encrypted answer cache, and restores the Windows desktop.
7. Disclose SSD wear-leveling:
   "When local cache files are deleted, user space zeroing occurs. While solid-state flash wear-leveling prevents software from guaranteeing physical bit erasure on modern SSDs, candidate data remains fully protected because stale NAND blocks contain only AES-256-GCM ciphertext."

---

## 3. Contingency: Demonstrating Emergency Proctor Override

If an evaluator asks how a student can exit if a medical or building emergency occurs:
1. Press the emergency hotkey sequence: **`Ctrl + Alt + F10`**.
2. A proctor override dialogue appears displaying a session challenge code.
3. The proctor enters the 6-digit one-time override code issued by the classroom server.
4. The server validates the code via `/api/v1/lockdown/emergency-exit`.
5. The application immediately unlocks the desktop and terminates cleanly.
