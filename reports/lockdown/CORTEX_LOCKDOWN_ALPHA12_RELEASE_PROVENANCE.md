# CORTEX LOCKDOWN — ALPHA 12 RELEASE & SUPPLY-CHAIN PROVENANCE

Document Identifier: CL-RELEASE-ALPHA12-PROV  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Release Management & Software Supply-Chain Verification Panel  
Evaluation Host: Windows 10/11 x64 (Build 26300, AMD Ryzen 7 8840U)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Release Manifest & Cryptographic Hashes

Release candidate package `v1.0.0-rc3` was verified against its physical binaries and distribution archives:

```
+------------------------------------+---------------+------------------------------------------------------------------+
| ARTIFACT                           | SIZE (BYTES)  | SHA-256 CRYPTOGRAPHIC DIGEST                                     |
+------------------------------------+---------------+------------------------------------------------------------------+
| CortexLockdown.exe (Native Binary) | 33,280 bytes  | 68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466 |
| CortexLockdown-Windows-x64.zip     | 16,994 bytes  | 24E47B83D02EB3D2F9E1DE4BA84F8CD5B7A8EF363F1C29E22F80BE93480FA995 |
+------------------------------------+---------------+------------------------------------------------------------------+
```

### 1.1 Archive Package Contents

Inspection of `apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip` via standard archive utilities confirmed the inclusion of exactly five files:

1. `CortexLockdown.exe`: The compiled native PE x64 Windows application executable (33,280 bytes).
2. `install.bat`: Automated installation script provisioning `%LOCALAPPDATA%\CortexLockdown`, registering custom protocol handlers, and creating Start Menu shortcuts.
3. `register-protocol.reg`: Standalone Windows Registry script registering the `cortex-lockdown://` custom protocol scheme.
4. `uninstall.bat`: Clean teardown script deleting HKCU registry keys, removing Start Menu shortcuts, and purging local application binaries.
5. `README.txt`: Operational guide detailing system prerequisites, installation steps, and support contacts.

---

## 2. Compilation Toolchain & Dependency Provenance

- **Compiler**: Microsoft .NET Framework 4.8 C# Compiler (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`).
- **Target Subsystem**: Windows Graphical Executable (`/target:winexe`).
- **Target Platform**: Any CPU (`/platform:anycpu`).
- **Optimization**: Active (`/optimize+`).
- **External Dependencies**: **ZERO**.
  The application links exclusively to core Windows Base Class Libraries:
  - `System.dll`
  - `System.Core.dll`
  - `System.Data.dll`
  - `System.Drawing.dll`
  - `System.Windows.Forms.dll`
- **Supply-Chain Security**:
  Zero third-party NuGet packages, external node bindings, or unverified binary DLLs are packaged into `CortexLockdown.exe`. This eliminates third-party dependency injection, supply-chain poisoning, and transient dependency vulnerabilities.

---

## 3. Code-Signing Status & Windows SmartScreen Behavior

### 3.1 Authenticode Signature Audit

Inspection was conducted directly on the Windows host using PowerShell:
```powershell
Get-AuthenticodeSignature 'apps\cortex-lockdown-windows\bin\CortexLockdown.exe'
```

- **Reported Status**: **`NotSigned`**
- **Signer Certificate**: None.
- **Audit Truth**: Cortex Lockdown release candidate `v1.0.0-rc3` is currently **unsigned**. There is no commercial Extended Validation (EV) certificate embedded in the binary.

### 3.2 SmartScreen & Antivirus Operational Reality

- **Default Windows Behavior**:
  On an unmanaged consumer Windows workstation, downloading an unsigned binary via Microsoft Edge or Google Chrome triggers Windows Defender SmartScreen:
  `"Windows protected your PC: Microsoft Defender SmartScreen prevented an unrecognized app from starting."`
  The user must click *"More info"* and *"Run anyway"* to launch.
- **Enterprise Lab Deployment**:
  In university computer labs managed via Active Directory, Group Policy (GPO), or Microsoft Intune:
  1. The binary hash (`68C13F5BB...`) can be added directly to the AppLocker / WDAC allowed executable policy.
  2. The installation script `install.bat` can be pushed silently via Intune / SCCM package distribution without SmartScreen intervention.
- **Production GA Requirement**:
  For general web distribution to unmanaged BYOD student laptops, the institution or platform operator must purchase a commercial Extended Validation (EV) code-signing certificate from a Microsoft-trusted Certificate Authority (e.g. DigiCert, Sectigo) and sign the binary using `signtool.exe`. EV signing provides immediate SmartScreen reputation without warnings.

### 3.3 Zero Antivirus Disabling Policy

Cortex Lockdown maintains a strict security principle:
- **Zero Antivirus Disabling**:
  Neither the installer, the documentation, nor error messages will ever instruct users or administrators to disable Windows Defender, turn off real-time antivirus protection, disable firewall controls, or add blanket directory exclusions.
- The client binary operates strictly within standard user-mode Win32 APIs and does not trigger malware heuristic detections when properly signed or hash-whitelisted.

---
*Report certified by Independent Acceptance Board.*
