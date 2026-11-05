# CORTEX LOCKDOWN — ALPHA 13 RELEASE SIGNING & DISTRIBUTION READINESS

Document Identifier: CL-SIGNING-ALPHA13-READINESS  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Release Engineering & Cryptographic Identity Panel  
Evaluation Host: Windows 10/11 x64 (Build 26300, AMD Ryzen 7 8840U)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Release Baseline & Unsigned Status Audit

Release candidate `v1.0.0-rc3` was verified against its physical binaries and distribution archives:

```
+------------------------------------+---------------+------------------------------------------------------------------+
| ARTIFACT                           | SIZE (BYTES)  | SHA-256 CRYPTOGRAPHIC DIGEST                                     |
+------------------------------------+---------------+------------------------------------------------------------------+
| CortexLockdown.exe (Native Binary) | 33,280 bytes  | 68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466 |
| CortexLockdown-Windows-x64.zip     | 16,994 bytes  | 24E47B83D02EB3D2F9E1DE4BA84F8CD5B7A8EF363F1C29E22F80BE93480FA995 |
+------------------------------------+---------------+------------------------------------------------------------------+
```

### 1.1 Empirical Authenticode Signature Audit

Inspection via PowerShell:
```powershell
Get-AuthenticodeSignature 'apps\cortex-lockdown-windows\bin\CortexLockdown.exe'
```
- **Reported Status**: **`NotSigned`**
- **Signer Certificate**: None.
- **Audit Truth**: The binary is currently unsigned. No commercial Extended Validation (EV) certificate is present in the release candidate binary.

---

## 2. Authenticode Signing Architecture & Procurement Plan

To transition Cortex Lockdown from internal laboratory testing to unrestricted public web downloads on unmanaged student laptops (BYOD), a commercial code-signing architecture must be deployed.

### 2.1 Certificate Procurement Requirements

1. **Certificate Authority (CA)**:
   Must be issued by a Microsoft-trusted Root CA (e.g. DigiCert, Sectigo, GlobalSign).
2. **Certificate Type**:
   **Extended Validation (EV) Code Signing Certificate**. Standard Organization Validation (OV) certificates require building download reputation over time, during which students would experience SmartScreen warnings. EV certificates provide immediate Microsoft SmartScreen reputation.
3. **Private Key Storage & Protection**:
   Under CA/Browser Forum baseline requirements, private keys cannot be stored as `.pfx` files on standard hard drives. The private key must reside in:
   - FIPS 140-2 Level 2 hardware cryptographic USB token (e.g. SafeNet eToken 5110).
   - Cloud Hardware Security Module (HSM), such as Azure Key Vault Trusted Signing or AWS CloudHSM.

### 2.2 Precise Signing & Timestamping Command Syntax

Signing must be performed using Microsoft Windows SDK `signtool.exe` with RFC 3161 compliant SHA-256 timestamping:

```cmd
signtool.exe sign ^
    /fd SHA256 ^
    /tr http://timestamp.digicert.com ^
    /td SHA256 ^
    /d "Cortex Lockdown Assessment Client" ^
    /du "https://cortex.edu/lockdown" ^
    /sha1 <CERTIFICATE_THUMBPRINT> ^
    "apps\cortex-lockdown-windows\bin\CortexLockdown.exe"
```

- **/fd SHA256**: Specifies the file digest algorithm as SHA-256 (SHA-1 is deprecated and rejected by Windows Defender).
- **/tr http://timestamp.digicert.com**: RFC 3161 timestamping server URL.
- **/td SHA256**: Specifies SHA-256 as the timestamp digest algorithm.
- **/sha1 <THUMBPRINT>**: Identifies the certificate in the Windows Certificate Store or hardware token.

### 2.3 Post-Signing Signature Verification

Verification must be confirmed using both `signtool.exe` and PowerShell:

```cmd
signtool.exe verify /pa /v "apps\cortex-lockdown-windows\bin\CortexLockdown.exe"
```

```powershell
$sig = Get-AuthenticodeSignature "apps\cortex-lockdown-windows\bin\CortexLockdown.exe"
if ($sig.Status -eq "Valid") {
    Write-Host "Code signing verified: $($sig.SignerCertificate.Subject)"
} else {
    Write-Error "Invalid signature: $($sig.StatusMessage)"
}
```

---

## 3. Windows SmartScreen & Antivirus Operating Realities

### 3.1 Unsigned Binary Behavior on Consumer Windows
- When an unsigned binary is downloaded via Microsoft Edge or Google Chrome on an unmanaged PC, Windows Defender SmartScreen displays:
  `"Windows protected your PC: Microsoft Defender SmartScreen prevented an unrecognized app from starting."`
- The student must manually click *"More info"* and *"Run anyway"*. While manageable in an internal testing environment, this is unacceptable for general commercial release.

### 3.2 Enterprise Lab Deployment Without EV Certificate
In institutional computer labs, IT administrators bypass SmartScreen without disabling antivirus:
1. **Intune / SCCM Deployment**: The package is pushed via administrative MDM channels, which bypasses consumer browser SmartScreen checks.
2. **AppLocker / WDAC Whitelisting**: IT administrators add the binary SHA-256 hash (`68C13F5BB...`) directly to the lab's allowed execution policy.

### 3.3 Zero Antivirus Disabling Policy
Cortex Lockdown maintains an absolute rule:
- **Never instruct users or administrators to disable Windows Defender, disable antivirus, or create broad directory exclusions.**
- Operating within standard Win32 APIs ensures that properly signed binaries do not trigger malware heuristics.

---

## 4. Secure Binary Update & Version Deprecation Strategy

To ensure candidates cannot execute vulnerable or outdated client versions:

```
[Candidate launches CortexLockdown.exe]
                 |
[Client requests signed Launch Grant via API]
                 |
[Backend checks Client Version & Policy Hash]
                 |
        +--------+--------+
        |                 |
     Valid             Outdated
        v                 v
[Launch Grant Issued]  [HTTP 426 Upgrade Required]
                       [Client Displays Mandatory Update Link]
```

1. **Policy Hash Binding**:
   Launch grant tokens bind `policyHash` calculated from [`hashPolicy()`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/security-policy.ts#L85). If security settings change, previous tokens fail verification.
2. **Fail-Closed Version Gate**:
   The `/api/v1/lockdown/authorize-launch` endpoint verifies that the client version meets or exceeds `minClientVersion`. Requests from deprecated versions receive HTTP 426 with a direct link to download the latest signed release.

---
*Report certified by Release Engineering Panel.*
