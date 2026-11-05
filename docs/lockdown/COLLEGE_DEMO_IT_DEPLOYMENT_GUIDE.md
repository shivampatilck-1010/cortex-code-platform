# Cortex Lockdown: College IT Deployment & Infrastructure Guide
## Institutional Lab Deployment, Group Policy & Managed Workstations

### 1. Scope & Technical Architecture
This guide provides university IT administrators and lab managers with the technical requirements to deploy and maintain Cortex Lockdown across institutional computer laboratories.

---

### 2. Deployment Architecture Tiers

| Architecture Tier | Security Boundary | Intended Use Case | Administrative Requirement |
| :--- | :--- | :--- | :--- |
| **Tier 1: Private Demonstration** | User-mode sandbox & low-level hooks (`WH_KEYBOARD_LL`, `WDA_MONITOR`) | Faculty presentations & interactive software evaluations | Local standard user account; portable extraction |
| **Tier 2: Managed Lab Evaluation** | Active Directory GPO, AppLocker XML allowlist, restricted student accounts | Controlled multi-student department trials | Domain administrator, Active Directory GPO distribution |
| **Tier 3: Institutional Adoption** | Commercial EV Authenticode signing, hardware TPM 2.0 attestation, dedicated backend | University-wide examinations & external accreditation | Commercial EV certificate, dedicated production servers |

---

### 3. Workstation Hardware & Software Prerequisites
- **Operating System**: Windows 10 Enterprise / Education (x64) version 20H2+ or Windows 11 Enterprise (x64).
- **CPU**: 64-bit Dual-Core 2.0 GHz or higher (x64 CPU architecture).
- **RAM**: Minimum 4 GB (8 GB recommended).
- **Disk Storage**: 150 MB free disk space for client binaries and local encrypted cache.
- **Runtimes**:
  - Microsoft .NET Framework 4.8.
  - Microsoft Edge WebView2 Evergreen Runtime.
- **Peripherals**: Single physical monitor (1280x720 minimum, 1920x1080 recommended), integrated or USB webcam, integrated microphone.

---

### 4. Active Directory Group Policy (GPO) Configuration
To achieve institutional lockdown on managed lab workstations, IT administrators should apply the following GPO settings:

#### 4.1 Secure Attention Sequence (`Ctrl+Alt+Delete`) Suppression
Windows reserves `Ctrl+Alt+Delete` strictly for Winlogon at Ring 0; user-mode software cannot intercept this combination. On lab PCs, disable the options presented by the SAS screen:
- **Disable Task Manager**: `User Configuration -> Administrative Templates -> System -> Ctrl+Alt+Delete Options -> Remove Task Manager` (Set to `Enabled`).
- **Disable Lock Workstation**: `User Configuration -> Administrative Templates -> System -> Ctrl+Alt+Delete Options -> Remove Lock Computer` (Set to `Enabled`).
- **Disable Switch User**: `Computer Configuration -> Administrative Templates -> System -> Logon -> Hide entry points for Fast User Switching` (Set to `Enabled`).

#### 4.2 AppLocker Policy Deployment
Deploy the validated AppLocker XML allowlist policy:
- **Policy File**: `docs/lockdown/master-release-closure/AppLocker-CortexLockdown.xml`
- **Enforcement Rules**:
  - Allowlist rule for `CortexLockdown.exe` (matching SHA-256 `82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895`).
  - Allowlist rule for `msedgewebview2.exe` (Edge WebView2 runtime path).
  - Explicit execution block for third-party utilities in candidate `%TEMP%` and `%LOCALAPPDATA%` folders.

---

### 5. Automated Silent Deployment via PowerShell
To deploy Cortex Lockdown silently across an entire lab:
```powershell
# Execute from administrative deployment share
$deployScript = "\\deploy-share\cortex\Deploy-CortexLockdown.ps1"
$zipSource    = "\\deploy-share\cortex\CortexLockdown-Windows-x64.zip"

powershell.exe -ExecutionPolicy Bypass -File $deployScript `
  -SourceZipPath $zipSource `
  -ExpectedZipHash "08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30" `
  -TargetDirectory "C:\Program Files\CortexLockdown" `
  -ExpectedExeHash "82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895"
```

The deployment script enforces:
1. ZipSlip archive path traversal defense.
2. Restrictive NTFS permissions (`SYSTEM` and `Administrators` have Full Control; standard `Users` have Read and Execute).
3. System-wide protocol handler registration in `HKLM:\SOFTWARE\Classes\cortex-lockdown`.
4. Transactional rollback if file copying fails.

---

### 6. Network Configuration & Firewall Whitelist
Ensure university perimeter firewalls permit outbound HTTPS (port 443) traffic to:
- Cortex Classroom Web API endpoints.
- Cloudflare D1 / database sync endpoints.
- WebSocket / SSE telemetry channels (`/api/v1/lockdown/telemetry`).
- No inbound ports are required. All connections are outbound candidate-to-server TLS 1.3 streams.
