# CORTEX LOCKDOWN - TROUBLESHOOTING AND DIAGNOSTIC GUIDE

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional IT / Helpdesk Reference
Target Audience: Campus Helpdesk Technicians, Exam Proctors, and System Engineers

---

## 1. Quick Diagnostic Decision Tree

When a candidate or proctor experiences an issue, consult this table for rapid resolution:

| Symptom | Primary Cause | Immediate Remediation |
|---|---|---|
| Application fails to start | Missing WebView2 Runtime or corrupt VC++ redistributable | Download and install Evergreen WebView2 Runtime from Microsoft; run `install.bat` as administrator. |
| "Multiple displays detected" error | Secondary monitor, TV, or virtual display driver active | Physically unplug HDMI/DisplayPort cable; disable Miracast/AirPlay display mirrors; disable virtual display adapters (Spacedesk, Duet). |
| "Prohibited process running" banner | Background communication, streaming, or cheat software active | Terminate Discord, Teams, Zoom, OBS Studio, Cheat Engine, or AutoHotkey via Task Manager prior to launching exam. |
| Camera or microphone not detected | Windows privacy settings blocking desktop apps | Open Windows Settings -> Privacy & Security -> Camera (and Microphone) -> Enable "Let desktop apps access your camera". |
| "LTI_SSRF_LOOPBACK_BLOCKED" / "PRIVATE_NETWORK" | LMS endpoint configured with private IP or loopback address | Correct the LMS platform registration to use a publicly resolvable FQDN with valid HTTPS. |
| "TOKEN_EXPIRED" on launch | Student workstation clock skewed significantly | Synchronize Windows system clock via `w32tm /resync` or Windows Settings -> Date & Time -> Sync now. |
| White or blank screen on startup | GPU hardware acceleration incompatibility with WebView2 | Launch with flag: `CortexLockdown-Hardened.exe --disable-gpu` or update Intel/AMD/NVIDIA graphics drivers. |
| Network disconnect banner during exam | Local Wi-Fi or router disruption | Do not close window; continue answering questions normally. Local AES-256 journal preserves data until reconnect. |

---

## 2. Common Error Codes and Resolutions

### Institutional Integration and Gateway Error Codes

#### `LTI_ISSUER_MISMATCH`
* Description: The `iss` claim in the incoming LTI launch token does not match the registered LMS platform issuer URL.
* Resolution: Ensure that the platform registration in `lti-platforms.json` exactly matches the URL configured in the LMS developer keys (including trailing slashes or subdomains).

#### `LTI_AUDIENCE_MISMATCH`
* Description: The token's `aud` claim does not contain the tool's registered Client ID.
* Resolution: Verify that the Client ID issued by Canvas/Blackboard matches the `clientId` field in the server configuration.

#### `LTI_NONCE_REPLAY_DETECTED`
* Description: A launch token containing a previously redeemed nonce was presented.
* Resolution: Replay defense prevented reuse of an old launch URL. The student must initiate a fresh launch from their course assignment page.

#### `LTI_JWKS_REFRESH_RATE_LIMITED`
* Description: The server received requests specifying an unknown Key ID (`kid`) at a rate exceeding once per 60 seconds.
* Resolution: Anti-DoS defense engaged. Wait 60 seconds before retrying, or verify that the LMS platform JWKS endpoint is serving the expected key ID.

#### `SAML_SIGNATURE_WRAPPING_ATTACK_DETECTED`
* Description: The SAML response contained multiple `<saml:Assertion>` elements, triggering XSW protection.
* Resolution: Ensure the IdP is configured to issue a single assertion per response.

#### `SAML_DUPLICATE_ID_DETECTED`
* Description: An assertion or response contained duplicate XML ID attributes.
* Resolution: Check IdP configuration to ensure distinct ID generation across all elements.

---

## 3. Client-Side Runtime Diagnostics

### Extracting Client Diagnostic Logs

Cortex Lockdown writes diagnostic execution logs to the following local directory:

`%LOCALAPPDATA%\CortexLockdown\Logs\`

Logs are rotated daily with a 7-day retention limit. Key log files include:

* `runtime.log`: Initialization steps, display adapter detection, and window lifecycle events.
* `security.log`: System key suppression events, prohibited process detections, and display affinity activations.
* `sync.log`: Network connectivity transitions, heartbeat responses, and delta sync events.

### Recovery from Interrupted Examinations

If a student's workstation suffers an unrecoverable operating system crash or hardware freeze:

1. Reboot the workstation.
2. Ensure network connectivity is operational.
3. Launch `CortexLockdown-Hardened.exe`.
4. Re-authenticate using the student's credentials.
5. The application detects the existing unsubmitted session in the database (`status: in_progress`).
6. The client decrypts the local `%LOCALAPPDATA%\CortexLockdown\SecureCache` journal using session entropy.
7. All previously typed answers are restored to the examination interface, allowing the candidate to continue seamlessly.

---

## 4. Emergency Administrative Session Unlocking

If an examinee is locked out or an emergency requires terminating the exam environment immediately:

* Proctor Emergency Override Key: Press `Ctrl + Shift + Alt + F12` followed by the 8-digit daily proctor pin provided in the Faculty Dashboard.
* Force Kill Procedure (Helpdesk):
  1. Switch to a second administrative workstation or open an elevated command prompt if accessible via remote management.
  2. Execute:
     `taskkill /F /IM CortexLockdown-Hardened.exe`
  3. The database retains the session in `in_progress` status. The student can resume on a replacement workstation.
