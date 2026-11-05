# Cortex Lockdown - Alpha 15 Managed Windows Policy Audit

**Document Identifier:** CORTEX-LOCKDOWN-POL-A15-001  
**Classification:** Operating System Security & Institutional Policy Audit  
**Target Release:** v1.0.0-rc3  
**Audit Environment:** Physical Windows Workstation (`SHIVAM_1010`, Windows 11 Home x64 Build 26300)  
**Date of Audit:** November 2026  

---

## 1. Audit Scope & Evaluation Framework

Milestone Alpha 15 independently audits the real-world operating system policies, group policy configurations, application control layers, and privilege boundaries governing Cortex Lockdown `v1.0.0-rc3`.

In accordance with institutional honesty guidelines, this audit explicitly distinguishes between:
1. **Configured Policy:** Policy rules defined in configuration XML files, scripts, or documentation.
2. **Applied Policy:** Policy delivered to an endpoint via Active Directory Group Policy Object (GPO) or MDM (Intune).
3. **Enforced Policy:** Policy actively checked and blocked by OS kernel filter drivers (e.g., AppLocker `AppLockerFLTr`).
4. **Tested Enforcement:** Real-time empirical execution and failure verification on managed hardware.

```
+---------------------------------------------------------------------------------------------------------+
| POLICY DOMAIN                 | CONFIGURED | APPLIED (HOST) | ENFORCED (HOST) | AUDIT DETERMINATION     |
+-------------------------------+------------+----------------+-----------------+-------------------------+
| Standard Non-Admin Privilege  | YES        | YES            | YES             | PASS (VERIFIED)         |
| Custom Protocol (HKCU)        | YES        | YES            | YES             | PASS (VERIFIED)         |
| User-Space Silent Install     | YES        | YES            | YES             | PASS (VERIFIED)         |
| Active Directory Domain GPO   | YES        | NO             | NO              | BLOCKED (STANDALONE)    |
| AppLocker Executable Hashing  | YES        | NO             | NO              | BLOCKED (WIN 11 HOME)   |
| WDAC Application Control      | YES        | NO             | NO              | BLOCKED (STANDALONE)    |
| Task Manager Lockout Policy   | YES        | NO             | NO              | BLOCKED (UNMANAGED)     |
+-------------------------------+------------+----------------+-----------------+-------------------------+
```

---

## 2. Host System Policy & Environment Probing Output

Probing was executed directly on the host system via PowerShell (`scripts/probe-windows-policies.ps1`):

```powershell
=== 1. OS AND SYSTEM INFO ===
Caption        : Microsoft Windows 11 Home Single Language
Version        : 10.0.26300
BuildNumber    : 26300
OSArchitecture : 64-bit

=== 2. DOMAIN AND WORKGROUP MEMBERSHIP ===
Name         : SHIVAM_1010
Domain       : WORKGROUP
PartOfDomain : False
Workgroup    : WORKGROUP

=== 3. USER ACCOUNT AND PRIVILEGES ===
Current User: SHIVAM_1010\shiva
Is Administrator: False
User SID: S-1-5-21-3692722587-3517308436-1978866417-1003

=== 4. APPLOCKER AND WDAC SERVICES ===
Name          DisplayName                Status  StartType
----          -----------                ------  ---------
AppIDSvc      Application Identity       Stopped Manual
AppLockerFLTr Smartlocker Filter Driver  Stopped Manual

=== 5. PROTOCOL REGISTRATION STATUS ===
(default)    : "C:\Users\shiva\AppData\Local\CortexLockdown\CortexLockdown.exe" "%1"
PSPath       : HKCU:\Software\Classes\cortex-lockdown\shell\open\command
PSChildName  : command

=== 6. TASK MANAGER POLICIES ===
HKCU DisableTaskMgr: [NOT SET]
HKLM DisableTaskMgr: [NOT SET]

=== 7. APPLOCKER EFFECTIVE POLICY ===
AppLocker Policy Query Output: The term 'Get-AppLockerPolicy' is not recognized
```

---

## 3. Detailed Institutional Policy Findings

### 3.1 Standard Non-Administrator Student Account Context
- **Observation:** The active user `SHIVAM_1010\shiva` possesses standard non-administrative user privileges (`IsAdmin = False`).
- **Significance:** `CortexLockdown.exe`, its installer (`install.bat`), and its uninstaller (`uninstall.bat`) execute completely within the per-user `%LOCALAPPDATA%` and `HKCU` namespaces.
- **Verification Result:** **PASS**. Zero elevated UAC prompts are required for student installation, execution, or removal. Standard non-administrator privilege is the ideal posture for managed institutional testing labs.

### 3.2 Active Directory Domain Infrastructure Status
- **Observation:** `Win32_ComputerSystem` reports `PartOfDomain: False` and `Domain: WORKGROUP`.
- **Significance:** The test machine is a standalone non-domain workstation. Active Directory domain controllers, centralized group policy distribution (`sysvol`), and Kerberos computer accounts are not present on this local machine.
- **Verification Result:** **BLOCKED**. Centralized GPO distribution cannot be empirically tested on this standalone host and requires connection to an active institutional Active Directory domain controller.

### 3.3 AppLocker and Windows Defender Application Control (WDAC) Status
- **Observation:**
  - `AppIDSvc` (Application Identity service) is in `Stopped` status.
  - `AppLockerFLTr` (Smartlocker Filter Driver) is in `Stopped` status.
  - `Get-AppLockerPolicy` cmdlet failed with command not found because Windows 11 Home Single Language does not bundle the AppLocker management cmdlets (which require Windows 10/11 Enterprise, Education, or Pro editions).
- **Significance:** The executable hash allowlisting rule (`SHA-256: 68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`) is documented and configured in the lab deployment GPO guide, but cannot be actively enforced on Windows 11 Home.
- **Verification Result:** **BLOCKED**. Testing AppLocker policy enforcement requires a Windows 10/11 Enterprise or Education lab workstation with `AppIDSvc` enabled and running.

### 3.4 Custom URI Protocol Registration
- **Observation:** Registry key `HKCU:\Software\Classes\cortex-lockdown\shell\open\command` correctly contains:
  `"C:\Users\shiva\AppData\Local\CortexLockdown\CortexLockdown.exe" "%1"`
- **Significance:** Custom protocol handler registration succeeded without administrative elevation. Web browsers running under standard student accounts can trigger `cortex-lockdown://` launches seamlessly.
- **Verification Result:** **PASS**. Confirmed configured, applied, and enforced.

### 3.5 Task Manager Registry Lockout Policy (`DisableTaskMgr`)
- **Observation:** Neither `HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System` nor `HKLM` contains a `DisableTaskMgr` registry key.
- **Significance:** Pressing `Ctrl + Shift + Esc` on this host launches Task Manager. While `WH_KEYBOARD_LL` intercepts `Ctrl + Shift + Esc` during active kiosk execution, the underlying OS policy is not active on this unmanaged machine.
- **Verification Result:** **BLOCKED (UNMANAGED)**. In managed computer labs, IT administrators must import the GPO setting `DisableTaskMgr = 1` to prevent access to Task Manager if a student executes `Ctrl + Alt + Del` (the Secure Attention Sequence).

---

## 4. Institutional Lab IT Action Matrix

For institutional pilot deployment in managed computer labs (e.g. `CSE276` and `MPU201`), the university IT department must apply the following prerequisite policies prior to candidate seating:

| Institutional Policy | Target Hive / Mechanism | Parameter Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Disable Task Manager** | `HKLM\Software\Policies\Microsoft\Windows\System` | `DisableTaskMgr = 1` | Blocks Task Manager invocation from Ctrl+Alt+Del Secure Desktop. |
| **AppLocker Hash Rule** | Group Policy -> Application Control Policies | Allow `SHA-256: 68C13F5B...` | Restricts execution strictly to the verified release candidate binary. |
| **AppIDSvc Auto-Start** | Group Policy -> System Services | `StartMode = Automatic` | Activates Windows Application Identity kernel filter driver. |
| **Standard User Shell** | Active Directory Security Group | `Domain Users` | Restricts candidate workstation permissions to non-administrative context. |
| **Single Display Lock** | Lab Physical Infrastructure | 1 Physical Monitor Only | Prevents display perimeter expansion beyond primary monitor boundaries. |
