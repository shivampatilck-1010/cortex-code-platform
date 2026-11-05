# CORTEX LOCKDOWN — MASTER INSTITUTIONAL DEPLOYMENT SPECIFICATION

Document Identifier: CL-MASTER-DEPLOY-01
Classification: Institutional Operations and System Administration Specification
Programme: Cortex Lockdown v1.0
Baseline: v1.0.0-rc3 (Post-Alpha 15)
Target Environment: Managed Institutional Computer Labs, Windows 10/11 Enterprise / Education (x64)

---

## 1. EXECUTIVE SUMMARY & INSTITUTIONAL MANDATE

Cortex Lockdown is designed for deployment across managed institutional computer workstations in high-stakes testing environments (computer labs, university testing centres, and departmental clusters). 

In institutional deployments, technical controls cannot rely on individual student device goodwill. The deployment architecture couples native Windows kiosk containment with host operating system group policies and application whitelisting.

This document defines the 5-Pillar Institutional Documentary Standard, Group Policy Object (GPO) specifications, Microsoft Endpoint Configuration Manager (MECM/SCCM) and Intune deployment scripts, network proxy configurations, and account privilege partitioning required for accredited pilot examinations.

---

## 2. THE 5-PILLAR INSTITUTIONAL DOCUMENTARY STANDARD

Before an institution authorizes high-stakes examinations on Cortex Lockdown, institutional governance requires five foundational documents to be lodged with the University CIO, Chief Information Security Officer (CISO), and Registrar:

```
+-------------------------------------------------------------------------------------------------------+
|                                5-PILLAR INSTITUTIONAL DOCUMENTARY STANDARD                            |
+-------------------------------------------------------------------------------------------------------+
| Pillar 1: Architecture & Data Flow | Complete technical specification of client-server contracts      |
| Pillar 2: Threat Model & Controls  | STRIDE analysis, attack surface audit, containment boundaries    |
| Pillar 3: Privacy & Data Protection| FERPA, GDPR, zero-raw-media proofs, data retention schedules      |
| Pillar 4: IT Deployment Runbook    | GPO, AppLocker, silent installation, network topology            |
| Pillar 5: Proctor Operations       | Emergency recovery, incident escalation, post-exam audit chains  |
+-------------------------------------------------------------------------------------------------------+
```

1. **Pillar 1: System Architecture and Data Flow**:
   - Outlines binary architecture (WPF .NET 8 x64 + WebView2), protocol handlers (`cortex-lockdown://`), and cloud endpoints (`/api/v1/lockdown/*`).
   - Lodged under `CORTEX_LOCKDOWN_MASTER_ARCHITECTURE.md`.
2. **Pillar 2: Threat Model and Security Controls**:
   - Documents cryptographic verification of launch grants, HMAC peppered recovery challenge-response, low-level keyboard interception, display affinity capture exclusion, and process watchdog monitoring.
   - Lodged under `CORTEX_LOCKDOWN_MASTER_SECURITY_AUDIT.md`.
3. **Pillar 3: Data Privacy and Protection**:
   - Formal evidence demonstrating zero raw audio/video transmission, ephemeral client-side processing, automated hardware sensor termination, and 90-day retention policies.
   - Lodged under `CORTEX_LOCKDOWN_MASTER_PRIVACY_AND_DATA_PROTECTION.md`.
4. **Pillar 4: IT Deployment and Administration Runbook**:
   - Defined fully within this document (`CORTEX_LOCKDOWN_MASTER_INSTITUTIONAL_DEPLOYMENT.md`).
5. **Pillar 5: Proctor Operations and Emergency Recovery**:
   - Operational runbook covering proctor verification, emergency exit codes, workstation isolation, and audit trail generation.
   - Lodged under `CORTEX_LOCKDOWN_MASTER_PILOT_OPERATIONS.md`.

---

## 3. WORKSTATION HARDWARE & SOFTWARE PREREQUISITES

| Component | Minimum Specification | Recommended Specification |
|---|---|---|
| Operating System | Windows 10/11 Enterprise or Education (64-bit) | Windows 11 Enterprise 23H2+ |
| Processor | Dual-Core 2.0 GHz x64 | Quad-Core 2.8 GHz+ x64 (e.g., Intel Core i5 / AMD Ryzen 5) |
| Physical Memory | 4.0 GB RAM | 8.0 GB RAM or greater |
| Available Storage | 500 MB free on OS system drive | 2.0 GB SSD storage |
| Display Resolution | 1024 x 768 at 60 Hz | 1920 x 1080 at 60 Hz |
| Display Topology | Single Physical Display (Dual monitors disallowed) | Single Integrated or External Display |
| Video Capture | Integrated or USB UVC Webcam (720p 30fps) | 1080p 30fps UVC compliant |
| Audio Capture | Integrated microphone or analog headset | USB Headset or integrated microphone array |
| Runtime Dependencies | Microsoft Edge WebView2 Runtime (Evergreen) | WebView2 Evergreen (Pre-installed on Win 10/11) |
| Network Interface | 100 Mbps Ethernet or 802.11ac Wi-Fi | 1 Gbps Managed Ethernet |

---

## 4. APPLOCKER AND WINDOWS DEFENDER APPLICATION CONTROL (WDAC)

To guarantee that only the certified executable executes in the student testing environment, institutions must configure AppLocker or WDAC executable rules.

### 4.1. AppLocker XML Configuration

The following XML snippet defines an AppLocker rule based on file hash and publisher for `CortexLockdown.exe`:

```xml
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="Enabled">
    <!-- Default rule: Allow local Administrators all files -->
    <FilePathRule Id="921cc481-6e17-4653-8f75-050b80abca0a" Name="(Default Rule) All files in Program Files" Description="Allows members of the local Administrators group to run all applications." UserOrGroupSid="S-1-5-32-544" Action="Allow">
      <Conditions>
        <FilePathCondition Path="*" />
      </Conditions>
    </FilePathRule>

    <!-- Specific rule: Allow Cortex Lockdown by SHA-256 Hash -->
    <FileHashRule Id="a4f91b72-2d93-41c8-886d-09b626e3c0f4" Name="Allow Cortex Lockdown Native Client" Description="Enforces execution of official certified Cortex Lockdown binary." UserOrGroupSid="S-1-1-0" Action="Allow">
      <Conditions>
        <FileHashCondition>
          <FileHash Type="SHA256" Data="0x68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466" SourceFileName="CortexLockdown.exe" SourceFileLength="33280" />
        </FileHashCondition>
      </Conditions>
    </FileHashRule>

    <!-- Fallback path rule: Allow execution only from protected Program Files folder -->
    <FilePathRule Id="b8d27a11-0a44-482d-bc48-77c8e9b01234" Name="Allow Cortex Lockdown from Program Files" Description="Restricts student execution strictly to protected Program Files directory." UserOrGroupSid="S-1-5-32-545" Action="Allow">
      <Conditions>
        <FilePathCondition Path="%PROGRAMFILES%\CortexLockdown\*" />
      </Conditions>
    </FilePathRule>
  </RuleCollection>
</AppLockerPolicy>
```

---

## 5. ACTIVE DIRECTORY GROUP POLICY OBJECT (GPO) BASELINE

When deploying Cortex Lockdown in managed computer labs, the following Group Policy settings should be linked to the Lab Workstation Organizational Unit (OU):

### 5.1. Computer Configuration

1. **Computer Configuration > Administrative Templates > System > Device Installation**:
   - Prevent installation of unauthorized USB mass storage devices during testing hours.
2. **Computer Configuration > Windows Settings > Security Settings > Application Control Policies > AppLocker**:
   - Set **Executable Rules** to **Enforce Rules**.
   - Import the AppLocker Policy defined in Section 4.1.
3. **Computer Configuration > Administrative Templates > Windows Components > Windows Remote Desktop Services**:
   - Disallow remote connections to active examination consoles:
     `Do not allow Remote Desktop Connection: Enabled`.

### 5.2. User Configuration (Standard Student Profile)

1. **User Configuration > Administrative Templates > System > Ctrl+Alt+Del Options**:
   - Remove Task Manager: `Enabled` (Disables `taskmgr.exe` via Ctrl+Alt+Del menu).
   - Remove Lock Computer: `Enabled` (Prevents desktop locking mid-exam).
   - Remove Change Password: `Enabled`.
2. **User Configuration > Administrative Templates > Windows Components > File Explorer**:
   - Hide specified drives in My Computer: `Enabled` (Prevents browsing local filesystem).
   - Prevent access to drives from My Computer: `Enabled`.
3. **User Configuration > Administrative Templates > System > Accessibility**:
   - Turn off Sticky Keys, Filter Keys, and Toggle Keys hotkeys to prevent OS dialog hijacking.

---

## 6. AUTOMATED SILENT INSTALLATION & DEPLOYMENT SCRIPT

The following PowerShell deployment script is packaged for execution via MECM/SCCM, Microsoft Intune, or Group Policy Startup Scripts. It installs `CortexLockdown.exe`, provisions NTFS permissions, registers the custom URI handler, and validates installation integrity.

```powershell
# ==============================================================================
# Script: Deploy-CortexLockdown.ps1
# Description: Automated Silent Enterprise Deployment for Cortex Lockdown v1.0
# Author: Cortex Institutional Systems Engineering
# Requirement: Run with Elevated Administrator Privileges
# ==============================================================================

[CmdletBinding()]
param (
    [string]$SourceZipPath = "\\institutional-share\deploy\CortexLockdown-Windows-x64.zip",
    [string]$TargetDirectory = "C:\Program Files\CortexLockdown",
    [string]$ExpectedHash = "68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466"
)

$ErrorActionPreference = "Stop"

Write-Output "[DEPLOY] Starting Cortex Lockdown Silent Deployment..."

# 1. Create Target Directory if not exists
if (!(Test-Path -Path $TargetDirectory)) {
    Write-Output "[DEPLOY] Creating directory: $TargetDirectory"
    New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
}

# 2. Extract Artifacts
$TempExtract = Join-Path -Path $env:TEMP -ChildPath "CortexLockdown_Extract"
if (Test-Path -Path $TempExtract) { Remove-Item -Path $TempExtract -Recurse -Force }
New-Item -ItemType Directory -Path $TempExtract -Force | Out-Null

Write-Output "[DEPLOY] Extracting payload from $SourceZipPath..."
Expand-Archive -Path $SourceZipPath -DestinationPath $TempExtract -Force

$ExecutablePath = Join-Path -Path $TargetDirectory -ChildPath "CortexLockdown.exe"
Copy-Item -Path (Join-Path $TempExtract -ChildPath "CortexLockdown.exe") -Destination $ExecutablePath -Force

# Copy accompanying dependencies
Get-ChildItem -Path $TempExtract | Where-Object { $_.Name -ne "CortexLockdown.exe" } | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $TargetDirectory -Recurse -Force
}

# 3. Cryptographic Verification
$ActualHash = (Get-FileHash -Path $ExecutablePath -Algorithm SHA256).Hash
if ($ActualHash -ne $ExpectedHash) {
    Write-Error "[SECURITY] SHA-256 hash mismatch! Expected: $ExpectedHash, Got: $ActualHash"
    Exit 1
}
Write-Output "[DEPLOY] SHA-256 Verification Succeeded: $ActualHash"

# 4. Enforce Strict NTFS ACLs (Read and Execute for Standard Users)
Write-Output "[DEPLOY] Enforcing strict NTFS ACLs on $TargetDirectory..."
& icacls "$TargetDirectory" /inheritance:r /grant "SYSTEM:(OI)(CI)F" /grant "Administrators:(OI)(CI)F" /grant "Users:(OI)(CI)RX" | Out-Null

# 5. Register Custom URI Protocol: cortex-lockdown://
Write-Output "[DEPLOY] Registering custom protocol cortex-lockdown:// in HKLM..."
$RegKey = "HKLM:\SOFTWARE\Classes\cortex-lockdown"
New-Item -Path $RegKey -Force | Out-Null
Set-ItemProperty -Path $RegKey -Name "(Default)" -Value "URL:Cortex Lockdown Examination Protocol"
Set-ItemProperty -Path $RegKey -Name "URL Protocol" -Value ""

$CmdKey = "$RegKey\shell\open\command"
New-Item -Path $CmdKey -Force | Out-Null
$CmdValue = "`"$ExecutablePath`" `"%1`""
Set-ItemProperty -Path $CmdKey -Name "(Default)" -Value $CmdValue

# 6. Clean Temporary Extract
Remove-Item -Path $TempExtract -Recurse -Force

Write-Output "[DEPLOY] Cortex Lockdown successfully deployed and verified."
Exit 0
```

---

## 7. NETWORK TOPOLOGY, PROXY, AND FIREWALL REQUIREMENTS

Cortex Lockdown communicates strictly over outbound TLS 1.3 / HTTPS.

### 7.1. Firewall Allowlist

| Target Hostname | Port | Protocol | Purpose |
|---|---|---|---|
| `platform.cortex.edu` | 443 | HTTPS/TLS 1.3 | Exam runner, REST API, authentication |
| `api.cortex.edu` | 443 | HTTPS/TLS 1.3 | Launch grant validation, emergency exit OTP |
| `telemetry.cortex.edu` | 443 | HTTPS/TLS 1.3 | Proctor heartbeat and security violation telemetry |
| `edge.cortex.edu` | 443 | WSS/TLS 1.3 | Real-time proctor broadcast websocket channel |

### 7.2. Proxy and Deep Packet Inspection (DPI)

1. **Proxy Autoconfiguration (PAC)**:
   - Cortex Lockdown uses system proxy settings via WebView2. In environments requiring an authenticating proxy, Kerberos / Negotiate SSO must be configured for the student domain account.
2. **Deep Packet Inspection (DPI) & SSL Interception**:
   - If the institution employs TLS inspection (e.g., Palo Alto Networks, Zscaler, Fortinet), the institutional Root CA certificate must be installed into the Windows System Trusted Root Certification Authorities store.
   - For optimal exam latency, IT administrators should create an SSL bypass rule for `*.cortex.edu` on the border firewall.

---

## 8. MULTI-MONITOR AND PERIPHERAL ENFORCEMENT

Managed lab workstations must adhere to peripheral constraints:
1. **Secondary Display Isolation**:
   - Secondary VGA, HDMI, DisplayPort, or USB-C external displays will trigger an immediate full-screen lock and display the following message:
     `Multi-monitor setups are prohibited during high-stakes examinations. Please disconnect external monitors.`
   - Hardware detection is driven by `EnumDisplayMonitors` Win32 API.
2. **Virtual Display Adapters**:
   - Software drivers such as DisplayLink, Duet Display, Splashtop Virtual Display, and Miracast wireless casting must be disabled via GPO or uninstalled from lab images.
3. **USB Audio/Video Peripherals**:
   - Standard USB webcams and USB stereo headsets are supported. Bluetooth audio devices are restricted via GPO to prevent wireless signal transmission into adjacent rooms.

---

## 9. PILOT DEPLOYMENT READINESS CHECKLIST

Before commencing an on-campus controlled pilot:

- [x] Workstation OS confirmed as Windows 10/11 Enterprise or Education (x64).
- [x] WebView2 Runtime Evergreen installed and verified across all lab endpoints.
- [x] Automated deployment script successfully executed and verified via SHA-256.
- [x] Custom URI scheme `cortex-lockdown://` launches native client from institutional browser.
- [x] Low-level keyboard hook prevents Windows key, Alt+Tab, Task Manager shortcut.
- [x] Process watchdog runs in Class C detection mode without crashing system background services.
- [x] AppLocker policy active and hash-allowlisted for certified executable.
- [x] Network egress to `*.cortex.edu` on port 443 verified with under 40 ms latency.
- [x] Emergency recovery procedure tested and validated by designated lab proctor.
