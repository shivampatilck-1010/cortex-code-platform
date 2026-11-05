# CORTEX LOCKDOWN — ALPHA 14 MANAGED LAB DEPLOYMENT & IT OPERATIONS GUIDE

Document Identifier: CL-DEPLOY-ALPHA14-ITGUIDE  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Institutional Enterprise Infrastructure & Lab Systems Panel  
Evaluation Host: Windows 10/11 x64 (Build 26300, AMD Ryzen 7 8840U)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Managed Computer Lab Architecture

For university computer laboratories hosting high-stakes midterms and final examinations, deploying Cortex Lockdown in conjunction with **Windows Group Policy (GPO)** and **Active Directory / Microsoft Intune** converts user-mode protections into operating-system-enforced laboratory security.

```
+---------------------------------------------------------------------------------------------------------+
|                                UNIVERSITY DOMAIN CONTROLLER (ACTIVE DIRECTORY / GPO)                   |
|                                                                                                         |
|  [GPO 1: Standard Domain User Profiles (Zero Local Admin Privileges)]                                   |
|  [GPO 2: Disable Task Manager (DisableTaskMgr = 1)]                                                     |
|  [GPO 3: Windows Defender Application Control (WDAC) / AppLocker Binary Whitelist]                      |
+---------------------------------------------------+-----------------------------------------------------+
                                                    |
                                                    | Push Package / Group Policy Deployment
                                                    v
+---------------------------------------------------------------------------------------------------------+
|                                    MANAGED LAB WORKSTATIONS (WINDOWS 10/11)                             |
|                                                                                                         |
|  - Pre-installed at %LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe                                    |
|  - Custom URI Scheme: cortex-lockdown:// registered in HKCU / HKLM                                      |
|  - Physical Environment: Single monitor connected; auxiliary HDMI cables disconnected                   |
|  - Network: Port 443 Outbound HTTPS open to Cortex Cloud                                                |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Institutional IT Requirements & Configuration

### 2.1 Standard Non-Administrator Accounts
- **Mandatory Policy**:
  Students logging into computer lab workstations must use standard domain accounts.
- **Security Impact**:
  Standard accounts cannot access `SeDebugPrivilege`, cannot launch tools with elevated rights, and cannot forcefully kill user-mode security applications via administrative taskkill commands.

### 2.2 Group Policy Configuration (GPO)
University IT administrators must configure the following Group Policy Objects for examination lab organizational units (OUs):

1. **Disable Task Manager**:
   - Path: `User Configuration -> Administrative Templates -> System -> Ctrl+Alt+Del Options`
   - Policy: `Remove Task Manager` = **Enabled** (`DisableTaskMgr = 1` in `HKCU\Software\Microsoft\Windows\CurrentVersion\Policies\System`).
   - Effect: When a student presses `Ctrl + Alt + Del`, the Task Manager option is greyed out/disabled, preventing process inspection.
2. **Disable Command Prompt & PowerShell**:
   - Path: `User Configuration -> Administrative Templates -> System`
   - Policy: `Prevent access to the command prompt` = **Enabled**.
3. **Restrict Registry Editing Tools**:
   - Policy: `Prevent access to registry editing tools` = **Enabled**.

### 2.3 Application Whitelisting via AppLocker / WDAC
To eliminate the limitations of heuristic blacklists, administrators configure **Windows Defender Application Control (WDAC)** or **AppLocker**:

- **AppLocker Executable Rule**:
  Create an Executable Hash Rule binding to the exact SHA-256 hash of `CortexLockdown.exe`:
  `Hash: 68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`
- **Effect**:
  Any unlisted executable (including renamed OBS, portable browsers, or custom cheat scripts) is blocked by the Windows kernel before execution starts:
  `"This app has been blocked by your system administrator."`

---

## 3. Automated Deployment & Installation Procedures

### 3.1 Silent Lab Deployment via Microsoft Intune / SCCM
IT administrators can deploy Cortex Lockdown silently across an entire lab cohort:

1. **Package Preparation**:
   - Place `CortexLockdown.exe` and `install.bat` inside the deployment share.
2. **Silent Command**:
   ```cmd
   cmd.exe /c install.bat
   ```
3. **Registry Verification**:
   Verify that `HKCU\Software\Classes\cortex-lockdown\shell\open\command` evaluates to:
   `"%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe" "%1"`

### 3.2 Network & Firewall Prerequisites
Managed lab switches and perimeter firewalls must allow outbound traffic on standard web ports:

```
+------------------------------------+-----------+-------------------+------------------------------------+
| TARGET DESTINATION HOST            | PORT      | PROTOCOL          | OPERATIONAL PURPOSE                |
+------------------------------------+-----------+-------------------+------------------------------------+
| *.cortexbuild1.workers.dev         | Port 443  | HTTPS (TLS 1.3)   | API, Authentication & Telemetry   |
+------------------------------------+-----------+-------------------+------------------------------------+
| cortex-code-platform.*.workers.dev | Port 443  | HTTPS / WSS       | Live Heartbeat & Session Quota     |
+------------------------------------+-----------+-------------------+------------------------------------+
| timestamp.digicert.com             | Port 80   | HTTP (RFC 3161)   | Authenticode Timestamp Validation  |
+------------------------------------+-----------+-------------------+------------------------------------+
```

- **Zero Inbound Ports**: The client requires **zero inbound open ports**, eliminating local network exposure.

---

## 4. Teardown, Rollback & Uninstallation Procedures

### 4.1 Automated Uninstallation (`uninstall.bat`)
To clean up lab terminals post-examination:

```cmd
cmd.exe /c uninstall.bat
```

- **Teardown Actions**:
  1. Deletes `HKCU\Software\Classes\cortex-lockdown` registry hierarchy.
  2. Purges `%LOCALAPPDATA%\CortexLockdown\CortexLockdown.exe`.
  3. Removes Start Menu shortcut from `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`.
  4. Removes the `%LOCALAPPDATA%\CortexLockdown\` directory.

### 4.2 Emergency Workstation Rollback
If a terminal freezes due to hardware fault:
1. Proctor executes emergency override using `Ctrl + Alt + F10` and single-use proctor OTP.
2. If the terminal is unresponsive, the proctor issues a standard reboot; the server-authoritative autosave guarantees the candidate's responses are restored upon re-login.

---
*Report certified by Institutional IT Operations Panel.*
