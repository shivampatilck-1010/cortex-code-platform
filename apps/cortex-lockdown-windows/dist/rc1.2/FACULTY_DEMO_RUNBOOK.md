# CORTEX LOCKDOWN RC1.2 - FACULTY DEMONSTRATION RUNBOOK

Package Version: 1.0.0-rc1.2  
Target Operating System: Microsoft Windows 10/11 x64  
Classification: Faculty / Academic Evaluator Reference Runbook  
Zero Emojis Enforced: Yes  
Code Signing Status: Unsigned Release Candidate (No commercial code signing certificate claimed; INR 0 budget)  

---

## 1. Safety Notice & Windows SmartScreen Policy

Cortex Lockdown RC1.2 is an unsigned evaluation release candidate. In strict accordance with institutional IT security standards:

- **DO NOT** instruct faculty, students, or evaluators to click "Run Anyway" or bypass Windows Defender SmartScreen warnings on unmanaged personal machines.
- **DO NOT** disable Windows Defender, antivirus agents, or security monitoring tools.
- **Safe Demonstration Requirement:** Demonstrations and faculty evaluation sessions must be conducted exclusively on an **institution-approved test workstation** or dedicated lab machine.
- **IT Pre-Authorization:** Before demonstration, campus IT or the lab administrator must authorize the executable by adding its cryptographic SHA-256 hash or executable path to the local Windows Defender Application Control (WDAC) or AppLocker staging allowlist. See `IT_PREAUTHORIZATION_GUIDE.md` for exact PowerShell and Group Policy procedures.

---

## 2. Pre-Demonstration Verification (10 Minutes Prior)

1. **Verify Target Environment:**
   - Dedicated physical Windows 10 (21H2+) or Windows 11 x64 workstation.
   - Single display connected directly to GPU (disconnect secondary displays or external capture devices).
   - Operational webcam and microphone.
2. **Cryptographic Provenance Verification:**
   Execute in Windows PowerShell on the demonstration machine:
   ```powershell
   Get-FileHash -Algorithm SHA256 .\CortexLockdown-Hardened.exe
   ```
   Authoritative Digest:
   `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`
   Confirm exact match before proceeding.
3. **Faculty Gateway Setup:**
   Ensure the institutional staging gateway or local classroom dashboard is accessible at `http://localhost:3000/classroom` logged in as Faculty Lead.

---

## 3. 15-Minute Structured Demonstration Script

### Segment 1 (Minutes 0-3): Provenance & Cryptographic Integrity
- Present the SHA-256 cryptographic hash match against the official release manifest.
- Highlight the INR 0 additional expenditure constraint and bit-for-bit release preservation.
- Review the security boundary disclosures: unsigned binary status, LTI 1.3 Advantage pilot qualification, and SAML 2.0 federation blocker (`DEF-RC1-001`).

### Segment 2 (Minutes 3-6): Kiosk Lockdown & Display Protection
- Launch `CortexLockdown-Hardened.exe` on the IT-authorized test machine.
- Select **"Secure Evaluation / Demo Examination"**.
- Demonstrate exclusive fullscreen kiosk mode:
  - Attempt `Alt + Tab`: suppressed via low-level keyboard hook (`WH_KEYBOARD_LL`).
  - Attempt `Windows Key` and `Ctrl + Esc`: suppressed.
  - Attempt screen recording or remote capture (OBS, Snipping Tool): window renders completely black via `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` / `WDA_MONITOR`.

### Segment 3 (Minutes 6-9): Privacy & Real-Time Advisory Telemetry
- Demonstrate in-RAM computer vision and audio acoustic analysis:
  - Point out that camera and microphone signals are evaluated strictly in volatile RAM.
  - Highlight the privacy boundary: zero raw video or audio files are recorded or persisted to disk. Note that wire-level packet capture verification is classified as NOT VERIFIED.
  - Generate an acoustic spike or multi-face presence: observe that the faculty dashboard receives advisory metadata flags only, without automated student disqualification.

### Segment 4 (Minutes 9-12): Network Disconnection & Encrypted Journal Recovery
- Disconnect the network cable or disable the Wi-Fi adapter.
- Continue typing examination responses: demonstrate that autosave persists every 5 seconds to local disk encrypted with **AES-256-GCM** (PBKDF2 100,000 iterations).
- Reconnect the network adapter: observe seamless background reconciliation with the classroom server.

### Segment 5 (Minutes 12-15): Authoritative Submission & Audit Proof
- Click **"Submit Examination"** and confirm submission.
- Verify the single-winner atomic CAS transition on the server database.
- Inspect the generated cryptographic submission receipt (`CORTEX-SUB-[HMAC]`).
- Verify exit behavior: application unhooks keyboard, unlocks the desktop, and removes the local encrypted answer cache. Explain the SSD/NAND flash wear-leveling limitation (`DEF-RC1-007` - security rests on AES-256 ciphertext).

---

## 4. Emergency Exit Procedure

If an abnormal condition occurs during the demonstration or examination session:
- Press the emergency administrative escape sequence: `Ctrl + Alt + F10`.
- The proctor prompt dialog will appear displaying a single-use session challenge string.
- Enter the single-use 6-digit proctor override code issued by the server.
- The desktop application redeems the code against the server endpoint `/api/v1/lockdown/emergency-exit`.
- Upon cryptographic server verification, the application immediately releases all display and keyboard hooks and returns control to the Windows desktop.
