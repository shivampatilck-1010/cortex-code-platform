# CORTEX LOCKDOWN — APPLOCKER & WDAC ARCHITECTURAL VALIDATION

Document Identifier: CL-MRE-APP-01
Programme: Cortex Lockdown v1.0
Baseline: Release Candidate v1.0.0-rc3 (Master Programme Complete)
Target Environment: Managed Institutional Computer Labs, Windows 10 & 11 Enterprise / Education (x64)
Classification: Operating System Application Control & Policy Architecture

---

## 1. EXECUTIVE SUMMARY

Application control is the cornerstone of institutional examination integrity on Windows workstations. When candidate workstations run under standard non-administrator profiles, application control ensures that only authorized, certified binaries can execute.

This document validates the production AppLocker policy template ([`AppLocker-CortexLockdown.xml`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/docs/lockdown/master-release-closure/AppLocker-CortexLockdown.xml)), presents an architectural comparison between AppLocker and Windows Defender Application Control (WDAC), outlines executable hash rotation procedures, and provides a repeatable validation plan for enterprise domain environments.

---

## 2. APPLOCKER XML POLICY ARCHITECTURE & VALIDATION

The official AppLocker template `AppLocker-CortexLockdown.xml` has been audited and validated against the Microsoft AppLocker XML schema.

### 2.1. Rule Collection Breakdown

1. **Administrator Recovery Access (`Id: 921cc481...`)**:
   - `Action="Allow" UserOrGroupSid="S-1-5-32-544" Condition="FilePathCondition Path="*"`
   - Preserves complete operational and emergency recovery capabilities for local IT administrators and lab technicians.
2. **Windows System Binaries (`Id: a61c8b27...`)**:
   - `Action="Allow" UserOrGroupSid="S-1-1-0" Condition="FilePathCondition Path="%WINDIR%\*"`
   - Authorizes essential Windows operating system binaries and drivers for all users.
3. **Certified Cortex Lockdown Executable Hash Rule (`Id: a4f91b72...`)**:
   - `Action="Allow" UserOrGroupSid="S-1-1-0"`
   - `FileHash Type="SHA256" Data="0x68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466"`
   - `SourceFileName="CortexLockdown.exe" SourceFileLength="33280"`
   - Authorizes execution of the official RC3 binary on candidate terminals regardless of path, while preventing any patched, tampered, or modified binary from running.
4. **Microsoft Edge WebView2 Evergreen Runtime Dependencies (`Id: c198f244...` & `Id: d209a355...`)**:
   - Authorizes `msedgewebview2.exe` located within protected `%PROGRAMFILES(X86)%\Microsoft\EdgeWebView\Application\*` and `%PROGRAMFILES%\Microsoft\EdgeWebView\Application\*` directories.
   - Ensures the kiosk UI renderer executes without blocking child process creation.

---

## 3. APPLOCKER VS. WDAC: ARCHITECTURAL COMPARISON & RECOMMENDATION

Institutional IT directors frequently confuse AppLocker with Windows Defender Application Control (WDAC). The table below outlines their architectural differences:

```
+-------------------------------------------------------------------------------------------------------+
|                                    APPLOCKER VS. WDAC COMPARISON MATRIX                               |
+-------------------------------------------------------------------------------------------------------+
| Feature Vector                 | Microsoft AppLocker            | Windows Defender App Control (WDAC) |
+--------------------------------+--------------------------------+-------------------------------------+
| Operating System Kernel Hook   | appid.sys / AppIDSvc Service   | CI.dll (Hypervisor-Protected HVCI)  |
| Enforced Security Boundary     | Standard Users vs System       | Kernel Integrity / Admin Isolation  |
| Defense Against Local Admin    | None (Admin can stop service)  | Absolute (Cannot be stopped by Admin|
| Policy Format                  | XML (Import via secpol / GPO)  | Binary .cip compiled from XML       |
| Performance Overhead           | Negligible                     | Zero (Hardware accelerated)         |
| Script & DLL Enforcement       | Supported (PowerShell Constrain| Supported with UMCI / KMCI          |
| Target Deployment Scenario     | Managed Computer Labs (GPO)    | High-Security BYOD / Defense Enclave|
+-------------------------------------------------------------------------------------------------------+
```

### 3.1. Strategic Recommendation
- **For Managed Institutional Computer Labs**: **AppLocker is the Recommended Standard**. In computer labs, students log in with standard domain accounts (`Users`). Local Administrator privileges are withheld. In this threat model, AppLocker provides immediate, reliable execution whitelisting without requiring complex UEFI signing or reboot-dependent binary policy deployments.
- **For Student BYOD Laptops (Future Phase)**: **WDAC is Recommended**. When students own their laptops and possess local administrator rights, WDAC coupled with Hypervisor-Enforced Code Integrity (HVCI) is the only mechanism that prevents administrative bypass.

---

## 4. HASH ROTATION & VERSION UPGRADE PROCEDURE

When a new maintenance release or security patch of Cortex Lockdown is issued, institutions must execute the following hash-rotation procedure:

```
[ Step 1: Compute Digest of Certified Release ]
  $NewHash = (Get-FileHash -Path "C:\deploy\CortexLockdown.exe" -Algorithm SHA256).Hash
       |
       v
[ Step 2: Stage New Hash in AppLocker GPO (Audit Mode / Staging Rule) ]
  Add New FileHashCondition with $NewHash alongside existing RC3 hash.
       |
       v
[ Step 3: Deploy New Package via MECM / Intune ]
  Execute Deploy-CortexLockdown.ps1 with -ExpectedExeHash $NewHash.
       |
       v
[ Step 4: De-provision Deprecated Hash ]
  Once all lab workstations report successful deployment, remove the old RC3 hash rule.
```

---

## 5. REPEATABLE VALIDATION PLAN FOR ENTERPRISE LAB WORKSTATIONS

For institutions commissioning testing labs on genuine Windows 10/11 Enterprise or Education workstations:

```powershell
# ==============================================================================
# Script: Test-InstitutionalLabWorkstation.ps1
# Description: On-Site Acceptance Test for Enterprise Lab Workstations
# ==============================================================================

# 1. Verify Domain Membership
$domainInfo = Get-CimInstance -ClassName Win32_ComputerSystem
if (-not $domainInfo.PartOfDomain) {
    Write-Warning "[BLOCKED] Workstation is not domain-joined. Host must be on institutional domain."
} else {
    Write-Output "[PASS] Domain: $($domainInfo.Domain)"
}

# 2. Verify Application Identity Service (AppIDSvc)
$svc = Get-Service -Name "AppIDSvc" -ErrorAction SilentlyContinue
if ($svc.Status -ne "Running") {
    Write-Warning "[BLOCKED] AppIDSvc is not running. AppLocker policies will not enforce."
} else {
    Write-Output "[PASS] AppIDSvc is active and running."
}

# 3. Verify Effective AppLocker Policy
try {
    $policy = Get-AppLockerPolicy -Effective -ErrorAction Stop
    $exeRules = $policy.GetRuleCollection([Microsoft.Security.ApplicationId.PolicyManagement.PolicyModel.RuleType]::Exe)
    $hasCortex = $exeRules | Where-Object { $_.Conditions.FileHash.Data -contains "0x68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466" }
    if ($hasCortex) {
        Write-Output "[PASS] Certified Cortex Lockdown hash rule is active in effective policy."
    } else {
        Write-Warning "[FAIL] Cortex Lockdown hash rule is missing from effective policy."
    }
} catch {
    Write-Warning "[BLOCKED] Get-AppLockerPolicy cmdlet unavailable or failed: $_"
}

# 4. Verify Task Manager GPO Restriction
$taskMgrKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System"
$val = (Get-ItemProperty -Path $taskMgrKey -Name "DisableTaskMgr" -ErrorAction SilentlyContinue).DisableTaskMgr
if ($val -eq 1) {
    Write-Output "[PASS] Task Manager is disabled via User Policy for standard students."
} else {
    Write-Warning "[WARN] Task Manager is not disabled in student registry profile."
}
```

---
*End of AppLocker & WDAC Architectural Validation.*
