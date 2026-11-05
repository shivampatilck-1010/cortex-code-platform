# CORTEX LOCKDOWN - STUDENT INSTALLATION GUIDE

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional Public
Applicable Platforms: Windows 10 (64-bit), Windows 11 (64-bit) Build 22000+

---

## 1. System Requirements

Before downloading or installing Cortex Lockdown, ensure that the target examination workstation satisfies the following minimum technical specifications:

* Operating System: Microsoft Windows 10 64-bit (Version 21H2 or later) or Windows 11 64-bit.
* Architecture: x86_64 (AMD64). ARM64 devices running x64 emulation are not certified for proctored examinations.
* Processor: Minimum 2 physical CPU cores (4 logical threads recommended). Evaluated and certified on AMD Ryzen and Intel Core architectures.
* Memory (RAM): Minimum 4.0 GB physical RAM (8.0 GB or higher recommended).
* Disk Space: Minimum 500 MB free storage on the system volume (C:).
* Display: Single physical display with minimum resolution 1280x720. Dual or multi-monitor configurations must be disconnected prior to exam launch.
* Network Connectivity: Stable broadband connection (minimum 1.0 Mbps upstream and downstream). The application incorporates local offline journal resilience for transient drops up to 10 minutes.
* Peripherals: Functional web camera and microphone if required by institutional examination policy.
* Required Runtime: Microsoft Edge WebView2 Evergreen Runtime (pre-installed on Windows 10/11; auto-installed if missing).

---

## 2. Package Acquisition and Integrity Verification

Download the official examination package provided by your institutional examination portal:

* Archive File: `CortexLockdown-Windows-x64.zip`
* Dedicated Binary: `CortexLockdown-Hardened.exe`

### Cryptographic Checksum Verification (Mandatory)

To prevent tampering, malware injection, or incomplete downloads, verify the SHA-256 hash of the downloaded artifact before execution.

Open Windows PowerShell and execute the following command:

```powershell
Get-FileHash -Algorithm SHA256 .\CortexLockdown-Hardened.exe
```

Expected Authoritative SHA-256 Hashes:

* `CortexLockdown-Hardened.exe`:
  `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`
* `CortexLockdown-Windows-x64.zip`:
  `08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30`
* `CortexLockdown.exe`:
  `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`

If the calculated hash does not exactly match the authoritative digest above, do not run the executable. Re-download the package from the official institutional portal or notify exam administration.

---

## 3. Installation Procedure

### Standard Installation (ZIP Archive)

1. Extract the downloaded `CortexLockdown-Windows-x64.zip` to a dedicated local directory (for example, `C:\Program Files\CortexLockdown` or `%LOCALAPPDATA%\Programs\CortexLockdown`).
2. Right-click `install.bat` and select "Run as administrator" if institutional endpoint lockdown requires local service registration.
3. If running in user mode without administrative rights, execute `CortexLockdown-Hardened.exe` directly from the extracted directory.

### SmartScreen and Windows Defender Handling

Because the release candidate is distributed under institutional internal deployment signing:

* If Windows Defender SmartScreen displays "Windows protected your PC":
  1. Click "More info".
  2. Verify that the publisher or filename corresponds to `CortexLockdown-Hardened.exe`.
  3. Click "Run anyway".
* Do not disable Windows Defender Real-Time Protection or add broad folder exclusions. Cortex Lockdown operates cleanly within standard Windows Defender heuristics without triggering genuine behavioral alerts.

---

## 4. Pre-Exam Environment Preparation

Before launching Cortex Lockdown:

1. Close all non-essential applications (Discord, Slack, Microsoft Teams, Zoom, Spotify, Steam, cheat utilities).
2. Disconnect secondary displays, HDMI capture devices, USB splitters, and external projection equipment.
3. Ensure no remote desktop or virtualization software is running (AnyDesk, TeamViewer, VMware, VirtualBox).
4. Connect the laptop to AC power to avoid unexpected sleep or low-power CPU throttling during testing.

---

## 5. Uninstallation

To remove Cortex Lockdown following the examination cycle:

1. Navigate to the installation directory.
2. If installed via batch script, run `uninstall.bat` as administrator.
3. Delete the application folder.
4. Clean local encrypted session cache if desired:
   `Remove-Item -Recurse -Force "$env:LOCALAPPDATA\CortexLockdown\SecureCache"`
