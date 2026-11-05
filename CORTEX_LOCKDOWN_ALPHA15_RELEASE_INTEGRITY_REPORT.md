# Cortex Lockdown - Alpha 15 Release Candidate Integrity & Provenance Audit

**Document Identifier:** CORTEX-LOCKDOWN-REL-A15-001  
**Classification:** Supply-Chain Security, Binary Provenance & Integrity Audit  
**Target Release Candidate:** v1.0.0-rc3 (Baseline Preserved)  
**Host Architecture:** Windows 10 & 11 x64 (.NET Framework 4.8.1 / WebView2)  
**Date of Audit:** November 2026  

---

## 1. Release Candidate Baseline Preservation

In accordance with release engineering standards, release candidate `v1.0.0-rc3` remains the authoritative, verified baseline. All Alpha 15 acceptance testing and verification procedures evaluated the identical binary artifacts generated during the RC3 release build.

Zero source code alterations were introduced to the compiled native C# executable, preserving its verified cryptographic digests and build provenance.

---

## 2. Cryptographic Digest & Artifact Provenance Register

All release candidate binaries and distribution archives were re-hashed directly on disk:

```
+------------------------------------+---------------+------------------------------------------------------------------+
| ARTIFACT NAME                      | SIZE (BYTES)  | SHA-256 CRYPTOGRAPHIC DIGEST                                     |
+------------------------------------+---------------+------------------------------------------------------------------+
| CortexLockdown.exe (Native PE)     | 33,280 bytes  | 68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466 |
| CortexLockdown-Windows-x64.zip     | 16,994 bytes  | 24E47B83D02EB3D2F9E1DE4BA84F8CD5B7A8EF363F1C29E22F80BE93480FA995 |
+------------------------------------+---------------+------------------------------------------------------------------+
```

### File Hierarchy & Internal Archive Structure
Inspection of `CortexLockdown-Windows-x64.zip` confirms the inclusion of four essential deployment assets:
1. `CortexLockdown.exe` (33,280 bytes): The standalone WinForms executable.
2. `CortexLockdown.exe.config` (186 bytes): .NET runtime binding and high-DPI awareness settings.
3. `install.bat` / `install.ps1`: Per-user installation and custom URI scheme registration scripts.
4. `uninstall.bat` / `uninstall.ps1`: Clean registry and filesystem removal scripts.

---

## 3. Authenticode Digital Signature Status

The standalone binary was evaluated using PowerShell `Get-AuthenticodeSignature`:

```powershell
PS C:\> (Get-AuthenticodeSignature .\CortexLockdown.exe).Status
NotSigned
```

### Deployment Impact & Policy Reality:
- **Laboratory GPO Deployment (Domain 2):** In managed university computer labs, Windows AppLocker and Software Restriction Policies can allow execution via the verified cryptographic file hash (`SHA-256: 68C13F5BB3409F8A...`) without requiring an Authenticode certificate.
- **Public BYOD Web Release (Domain 4):** On unmanaged student personal machines, Windows Defender SmartScreen will block the unsigned binary with an untrusted software warning (*"Windows protected your PC"*).
- **Public Release Blocker:** A commercial Extended Validation (EV) Code Signing Certificate from a Microsoft-trusted Certificate Authority (DigiCert, Sectigo) remains mandatory prior to public general web distribution.

---

## 4. Antivirus & Security Software Coexistence Policy

An audit of all documentation, user guides, setup scripts, and error recovery prompts confirms strict adherence to the **Zero Antivirus Disabling Policy**:
1. Zero instructions instruct or recommend students or IT administrators to disable Microsoft Defender Antivirus.
2. Zero instructions recommend disabling Windows Firewall or creating broad firewall bypass rules.
3. Zero instructions recommend disabling SmartScreen or lowering User Account Control (UAC) settings.
4. Network communication requires only standard outbound HTTPS (TCP 443) to the institutional Cortex domain.

---

## 5. Supply-Chain Build Reproducibility

The native Windows binary is compiled using standard Microsoft .NET Framework 4.8 tooling (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`):
- Optimization: `/optimize+`
- Target: `/target:winexe`
- Platform: `/platform:x64`
- Assemblies Referenced: `System.dll`, `System.Windows.Forms.dll`, `System.Drawing.dll`, `Microsoft.Win32.Primitives.dll`
- Zero third-party unmanaged DLLs or obscure native dependencies are packaged or required.
