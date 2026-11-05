# CORTEX LOCKDOWN - FACULTY EVALUATION HANDOUT

Document Classification: Academic Faculty & Departmental Evaluator Briefing  
Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10/11 x64  
Zero Emojis Enforced: Yes  
Additional Project Budget: INR 0  

---

## 1. What Cortex Lockdown Is & What It Does

Cortex Lockdown is a specialized, lightweight Windows desktop application engineered to provide defensible, non-invasive examination integrity for university and collegiate computer laboratories. It integrates natively with the institutional Cortex examination platform.

### Core Capabilities:
- **Exclusive Kiosk Environment:** Locks the candidate into the examination interface using standard Win32 desktop window management (`WS_EX_TOPMOST`).
- **Keyboard Shortcut Suppression:** Intercepts and suppresses navigation and task-switching keystrokes via low-level Windows keyboard hooks (`WH_KEYBOARD_LL`), including `Alt + Tab`, `Windows Key`, `Alt + Esc`, `Ctrl + Esc`, and `Ctrl + Shift + Esc`.
- **Screen Capture Protection:** Utilizes the Windows Desktop Window Manager API (`SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` with fallback to `WDA_MONITOR`) to render the window completely black across screen recorders, remote desktop clients, and capture utilities (OBS, Zoom, Microsoft Teams, Snipping Tool).
- **Privacy-First In-RAM Analysis:** Webcam and microphone streams are evaluated exclusively in volatile memory buffers to detect multi-face presence or abnormal ambient noise. Zero raw video, audio, or screenshot files are written to disk or uploaded to cloud storage.
- **Human-in-the-Loop Proctoring:** Algorithmic sensor events are transmitted as sparse advisory telemetry flags to the proctor dashboard. The software never automatically terminates, disqualifies, or penalizes a student.
- **Fault-Tolerant Encrypted Autosave:** If laboratory Wi-Fi or campus networks disconnect, student responses continue saving locally every 5 seconds encrypted with AES-256-GCM (PBKDF2 100,000 iterations). Responses seamlessly resynchronize when network connectivity returns.
- **Authoritative Submission & Cryptographic Receipt:** Submissions are validated via atomic Compare-And-Swap (CAS) database state transitions. Upon confirmation, the student receives a cryptographically signed submission receipt (`CORTEX-SUB-[HMAC]`).

---

## 2. What Cortex Lockdown Does NOT Do (Security Non-Goals & Boundaries)

To ensure academic and administrative transparency, faculty evaluators must understand what is out of scope for user-mode software:

- **No Kernel-Mode Drivers or Rootkits:** The application runs exclusively in Windows User Mode (Ring 3). It does not install kernel filter drivers (`.sys`), kernel hooks, or custom hypervisors. This design choice guarantees operating system stability (zero risk of Blue Screen of Death / BSOD) and protects personal device integrity.
- **Cannot Suppress `Ctrl + Alt + Del`:** In Microsoft Windows, the Secure Attention Sequence (`Ctrl + Alt + Del`) is hardcoded into the kernel and handled exclusively by `winlogon.exe`. No user-mode application can intercept this key sequence. Cortex Lockdown detects focus loss and disables Task Manager via user policy.
- **Cannot Detect Passive Hardware HDMI Splitters:** Physical video splitters or external USB capture cards tap signals downstream of the GPU display controller. User-mode software cannot detect these devices without specialized HDCP-enforced DRM hardware. Physical room proctoring remains essential.
- **Wire-Level Media Absence Status:** Client and server source code audits verify zero media streaming pipelines; however, physical network wire-level packet sniffing (TAP capture) has not been verified in CI testing.
- **SSD Flash Wear-Leveling Boundary:** On solid-state drives (NVMe, SSD), Flash Translation Layer (FTL) wear-leveling prevents software from guaranteeing physical bit-level erasure. Post-exam candidate confidentiality relies entirely upon the AES-256-GCM authenticated encryption barrier.

---

## 3. Windows SmartScreen & Campus IT Pre-Authorization

- **Unsigned Binary Status:** Cortex Lockdown RC1.2 was developed under a strict INR 0 external expenditure constraint. No commercial Authenticode Extended Validation (EV) certificate has been purchased.
- **No "Run Anyway" Bypasses:** In strict accordance with institutional IT security policies, faculty and students must **NEVER** be instructed to click "Run Anyway" or bypass Windows Defender SmartScreen dialogues on unmanaged personal machines.
- **Institutional Deployment:** For evaluation and demonstrations, the application must be staged on dedicated laboratory or departmental test workstations pre-authorized by campus IT via AppLocker or Windows Defender Application Control (WDAC) hash allowlists. (See `IT_PREAUTHORIZATION_GUIDE.md`).

---

## 4. Emergency Exit & Proctor Override

If an emergency occurs during an examination session:
1. The student alerts the proctor.
2. The proctor initiates the emergency sequence by pressing **`Ctrl + Alt + F10`**.
3. A challenge dialogue appears displaying a session challenge identifier.
4. The proctor enters a single-use 6-digit override code issued by the examination server.
5. The application verifies the code against `/api/v1/lockdown/emergency-exit`, unhooks display and keyboard controls, and immediately restores the Windows desktop.
