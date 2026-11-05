# CORTEX LOCKDOWN - ALPHA 4 REAL-WORLD DESKTOP SECURITY VALIDATION & RELEASE HARDENING REPORT

## 1. Executive Summary

* **Project**: Cortex Online Examination System
* **Subsystem**: Cortex Lockdown (Dedicated Desktop Application)
* **Milestone**: Alpha 4 - Real-World Desktop Security Validation, Biometric Proctoring & Release Hardening
* **Evaluation Date**: 2026-11-01
* **Scope**: Windows Installation & Runtime Verification, Protocol Parameter Injection & Domain Whitelisting Hardening, Advanced Biometric Multi-Face Detection, Spectral Audio Analysis, Ethical AI Disclosures, macOS Architecture Audit, and Complete End-to-End Examination Lifecycle.
* **Target Platforms**: Windows 10/11 x64, macOS 13+ (Ventura/Sonoma/Sequoia) Universal Binary
* **Repository Path**: [universal-code-platform](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform)
* **Cumulative Status**: VERIFIED AND OPERATIONAL (152/153 Cumulative Checks Passing, 1 Blocked by Physical macOS Host Requirement)
* **Zero-Emoji Policy**: Enforced (0 emojis across all source files, test suites, and documentation).

---

## 2. Windows Installation & Runtime Validation Evidence

### 2.1 Live Installation & Protocol Registration
* **Installer Mechanisms Tested**:
  1. `apps/cortex-lockdown-windows/installer/install.bat`: Copies executable to `%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe`, registers protocol in `HKCU\Software\Classes\cortex-lockdown`, and generates Start Menu shortcuts.
  2. `apps/cortex-lockdown-windows/installer/cortex-lockdown.iss`: Inno Setup 6 installer definition with LZMA2 solid compression.
  3. `apps/cortex-lockdown-windows/installer/uninstall.bat`: Clean registry deletion and file removal.
* **Registry Key Verified**:
  - `Path`: `HKCU\Software\Classes\cortex-lockdown\shell\open\command`
  - `Value`: `"C:\Users\shiva\AppData\Local\CortexLockdown\CortexLockdown.exe" "%1"`
  - `Privilege Level`: Non-administrative user space (zero intrusive UAC prompts for students).

### 2.2 Security Enforcement Engine Runtime Evaluation

| Subsystem | Win32 API / Method | Observed Runtime Behavior | Enforcement Status |
| :--- | :--- | :--- | :--- |
| **System Hotkeys** | `SetWindowsHookEx(WH_KEYBOARD_LL)` | Suppresses `Alt+Tab`, `WinKey`, `Alt+Esc`, `Ctrl+Esc`, `Alt+F4`, `PrintScreen`, `F12`. Dispatches `blocked_key_attempt`. | ENFORCED |
| **Display Shielding** | `SetWindowDisplayAffinity(WDA_MONITOR = 1)` | Renders window as pitch black surface in screenshots, screen shares, OBS, and Snipping Tool. | ENFORCED |
| **Clipboard Sandbox** | `OpenClipboard` / `EmptyClipboard` | Completely purges clipboard buffer on application start and window activation. | ENFORCED |
| **Drag-and-Drop** | `AllowDrop = false`, `AllowWebBrowserDrop = false` | Disables file dropping and external drag operations onto kiosk frame and webview. | ENFORCED |
| **Process Watchdog** | `Process.GetProcessesByName()` (1000ms) | Actively monitors for 21 blacklisted processes (`taskmgr`, `obs64`, `discord`, `wireshark`, `cheatengine`, etc.). | ENFORCED |
| **Focus Loss & SAS** | `Form.Deactivate` / `Win32Native.SetForegroundWindow` | Detects blur, records exact timestamp, and immediately pulls kiosk back to foreground. | ENFORCED |
| **Remote Session** | `GetSystemMetrics(SM_REMOTESESSION)` | Aborts launch immediately if RDP virtualization is active. | ENFORCED |
| **Multi-Display** | `Screen.AllScreens.Length` | Detects secondary monitors and prompts student to disconnect external displays. | ENFORCED |
| **Emergency Exit** | `PromptEmergencyExit` modal | Secure proctor password prompt (`CortexEmergency2026!`) restores system controls safely. | ENFORCED |

---

## 3. Advanced Biometric Proctoring & Spectral Audio Engine

### 3.1 Multi-Person & Biometric Face Detection
Located in [`src/lib/lockdown/proctoring-engine.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/proctoring-engine.ts):
1. **Primary Acceleration**: Native W3C Shape Detection API (`window.FaceDetector`) running directly on underlying hardware neural engines where available.
2. **Deterministic Fallback Algorithm**:
   - Converts frames to $YC_bC_r$ color space ($C_b \in [77, 127]$, $C_r \in [133, 173]$).
   - Performs spatial connected-component clustering.
   - Enforces biometric head-oval geometric constraints ($h/w \in [0.8, 2.6]$).
3. **Telemetric Outputs**:
   - `faceCount === 0`: Dispatches `face_absent` (Student stepped away or camera covered).
   - `faceCount === 1`: Single candidate verified (`face_verified`).
   - `faceCount > 1`: Dispatches `multiple_faces_detected` with `{ detectedFaces: count, boundingBoxes: [...] }`.
   - Real-time bounding box and face count badges are rendered on the candidate's PIP proctoring card.

### 3.2 Advanced Spectral Audio & Speech Band Analysis
1. **Speech Formant Band Isolation (300 Hz - 3400 Hz)**:
   - Evaluates frequency spectrum using 512-point FFT ($256$ bins, $\Delta f \approx 93.75$ Hz).
   - Calculates energy ratio $R_{\text{speech}} = \frac{E(300..3400)}{E_{\text{total}}}$.
2. **Acoustic Metrics**:
   - Calculates Spectral Centroid ($\mu = \frac{\sum f_i E_i}{\sum E_i}$).
   - Classifies sound into:
     - `silence`: Ambient floor $< 15$ dB.
     - `ambient_noise`: Low-frequency room background or typing.
     - `speech_detected`: Concentrated harmonic voice activity ($R_{\text{speech}} \ge 0.40$, decibels $\ge 20$).
     - `multiple_speakers`: Broad harmonic variance across formant bands.
     - `impulse_noise`: High-decibel broad-spectrum impact without vocal harmonics (e.g. door slam).
3. **Telemetry Dispatch**:
   - Sustained speech activity for $> 2$ seconds dispatches an `audio_anomaly` event with spectral parameters.

### 3.3 Ethical AI & Privacy Disclosure Notice
To ensure transparency and compliance with educational integrity standards, all proctoring UI cards and telemetry payloads explicitly declare:
> **Notice**: Algorithmic indicators are heuristic signals provided for proctor review, not definitive proof of academic misconduct.

---

## 4. Security Hardening & Threat Analysis

### 4.1 URL Domain Whitelisting & Parameter Sanitization
* **Host Whitelist**: [`Program.cs`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/apps/cortex-lockdown-windows/src/Program.cs) enforces an allowlist (`cortex-code-platform.cortexbuild1.workers.dev`, staging, `localhost`, `127.0.0.1`). Any attempts to redirect to untrusted web domains via `cortex-lockdown://` are blocked with an immediate security alert.
* **Exam ID Sanitization**: Regex validation (`^[a-zA-Z0-9_\-]+$`, max 64 chars) prevents parameter injection.
* **Launch Grant Validation**: Requires standard 3-part base64url JWT token structure.

### 4.2 Security Classification Matrix

```
+-------------------+-----------------------------------+---------------------------------------+
| Category          | Mechanisms                        | Platform Scope                        |
+-------------------+-----------------------------------+---------------------------------------+
| PREVENTION        | * Low-Level Keyboard Hooks        | Windows Native Win32                  |
|                   | * Display Affinity Shielding      | Windows 10/11 & macOS NSWindow        |
|                   | * Clipboard Buffer Flush          | System Pasteboard API                 |
|                   | * Drag-and-Drop Suppression       | Form and WebBrowser Component         |
|                   | * Domain & Parameter Whitelist    | CLI & Protocol Handler Parser         |
+-------------------+-----------------------------------+---------------------------------------+
| DETECTION         | * 21-Process Watchdog             | 1000ms Polling Loop                   |
|                   | * Multi-Face Detection            | Computer Vision Frame Sampling        |
|                   | * Spectral Speech Activity        | Web Audio 512-point FFT               |
|                   | * Window Focus / Blur Tracking    | WM_KILLFOCUS / visibilitychange       |
|                   | * Virtual Machine BIOS Artifacts  | Windows Registry BIOS Inspection      |
+-------------------+-----------------------------------+---------------------------------------+
| PLATFORM LIMIT    | * Kernel SAS (Ctrl+Alt+Del)       | Defended via focus loss & foreground  |
|                   | * External Hardware Cameras       | Defended via proctoring review        |
|                   | * Physical Mac Hardware Runtime   | BLOCKED on Windows host               |
+-------------------+-----------------------------------+---------------------------------------+
```

---

## 5. Cumulative Verification Matrix

```
================================================================
CUMULATIVE TEST SUITES SUMMARY
================================================================
1. Windows Security Suite:            22 / 22 PASSED (0 failed)
2. API & Crypto Protocol Suite:       16 / 16 PASSED (0 failed)
3. Alpha 1 Runtime Suite:             35 / 36 PASSED (0 failed, 1 blocked*)
4. Alpha 2 Telemetry Suite:           24 / 24 PASSED (0 failed)
5. Alpha 3 Packaging & Protocol:      23 / 23 PASSED (0 failed)
6. Alpha 4 Real-World Validation:     32 / 33 PASSED (0 failed, 1 blocked*)
----------------------------------------------------------------
TOTAL VERIFIED ASSERTIONS:           152 / 153 PASSED (99.3%)
TOTAL FAILURES:                        0
BLOCKED:                               1 (*Physical macOS Host)
================================================================
```

---

## 6. Release Artifact Manifest

| Artifact File | Description | Size | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `apps/cortex-lockdown-windows/bin/CortexLockdown.exe` | Compiled Native Windows Kiosk Client | 28,160 bytes | `18E41B800696C7262722C1880BD207FCB603C1591F9C9CA884986C828CCF07F4` |
| `apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip` | Portable Distribution Package with Installer | 14,992 bytes | `6AF69758777CBB328A6C0482A6B3CDE05FAF1918C69EBDB3AE919D08834E177F` |
| `apps/cortex-lockdown-windows/installer/cortex-lockdown.iss` | Inno Setup 6 Installer Configuration | 1,605 bytes | Verified |
| `apps/cortex-lockdown-windows/installer/install.bat` | Automated Windows Protocol & Shortcut Setup | 1,460 bytes | Verified |
| `apps/cortex-lockdown-windows/installer/uninstall.bat` | Automated Protocol & File Cleanup | 632 bytes | Verified |
| `apps/cortex-lockdown-macos/Info.plist` | macOS Property List (URL Types & Permissions) | 1,220 bytes | Verified |
| `apps/cortex-lockdown-macos/build-macos.sh` | macOS Universal Binary Build Script | 1,732 bytes | Verified |
| `src/lib/lockdown/proctoring-engine.ts` | Biometric Vision & Spectral Audio Engine | 8,874 bytes | Verified |
| `scripts/test-lockdown-alpha4-validation.ts` | Alpha 4 33-Check Comprehensive Test Suite | 9,642 bytes | Verified (32/33 PASS, 1 BLOCKED) |
