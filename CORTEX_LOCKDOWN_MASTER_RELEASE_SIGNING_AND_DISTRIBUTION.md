# CORTEX LOCKDOWN — MASTER RELEASE SIGNING & DISTRIBUTION SPECIFICATION

Document Identifier: CL-MASTER-SIGN-01
Classification: Release Engineering and Distribution Security Specification
Programme: Cortex Lockdown v1.0
Baseline: v1.0.0-rc3 (Post-Alpha 15)
Target Architectures: Windows x64 (MSIX / Portable ZIP), macOS Universal 2 (Planned)

---

## 1. EXECUTIVE SUMMARY

Software distribution integrity is critical to the Cortex Lockdown trust boundary. High-stakes institutional examination software must defend against binary tampering, unauthorized redistribution, malicious patching, and operating system untrusted software warnings.

This specification details the cryptographic signing architecture, Extended Validation (EV) code-signing procurement, RFC 3161 timestamping, Windows Defender SmartScreen reputation acceleration, binary provenance, and secure delivery channels for Cortex Lockdown v1.0.

---

## 2. CURRENT RELEASE CANDIDATE (RC3) SIGNING STATUS

An objective audit of release candidate artifacts confirms the following cryptographic baseline:

```
+-------------------------------------------------------------------------------------------------------+
|                                    RC3 ARTIFACT INTEGRITY LEDGER                                      |
+-------------------------------------------------------------------------------------------------------+
| Artifact Name:          apps/cortex-lockdown-windows/bin/CortexLockdown.exe                           |
| File Size:              33,280 bytes                                                                  |
| SHA-256 Digest:         68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466            |
| Target Framework:       .NET 8.0 Windows Desktop (x64)                                                |
| Authenticode Status:    NotSigned (Honest Status — Development / Controlled Lab Baseline)             |
+-------------------------------------------------------------------------------------------------------+
| Artifact Name:          apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip               |
| File Size:              16,994 bytes                                                                  |
| SHA-256 Digest:         24E47B83D02EB3D2F9E1DE4BA84F8CD5B7A8EF363F1C29E22F80BE93480FA995            |
| Distribution Mode:      Managed Lab Package (Deployed via AppLocker hash allowlist)                   |
+-------------------------------------------------------------------------------------------------------+
```

### 2.1. Controlled Institutional Pilot Authorization Without EV Signature

Under Domain 2 (Managed Institutional Deployment), software is deployed via enterprise Active Directory GPO or MECM/SCCM. In this environment:
1. Systems are managed by institutional IT administrators with elevated rights.
2. Binary integrity is enforced directly at the Windows kernel level using AppLocker or WDAC file-hash rules (`FileHashCondition` using the exact SHA-256 digest).
3. Therefore, an EV Authenticode signature is **NOT** a technical prerequisite for managed lab pilots where hash-allowlisting is enforced.

### 2.2. Public Unmanaged Student BYOD Gate

Under Domain 3 (Windows Signed Public Release for unmanaged BYOD laptops), an unsigned binary is **UNACCEPTABLE**. Windows Defender SmartScreen presents an intimidating untrusted publisher warning ("Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting"), which undermines student confidence and requires manual administrative override. Public release remains strictly **BLOCKED** until EV signing is operational.

---

## 3. COMMERCIAL EV CODE-SIGNING ARCHITECTURE

To transition from the controlled pilot baseline to general institutional availability, the following code-signing pipeline must be implemented:

```
[ Git Protected Tag v1.0.0 ]
              |
              v
[ GitHub Actions / Cloud Build Runner ]
              |
              v
[ Azure Key Vault / Cloud KMS HSM (FIPS 140-2 Level 3) ]
              |
              v
[ SignTool.exe / Azure Sign Tool ]
  - Digest Algorithm: SHA-256
  - RFC 3161 Timestamp Server: http://timestamp.digicert.com
              |
              v
[ Authenticode Signed & Timestamped Binary ]
```

### 3.1. Certificate Authority & Hardware Security Module (HSM)

1. **Certificate Authority**: Digicert, Sectigo, or GlobalSign Extended Validation (EV) Code Signing Certificate.
2. **Private Key Storage**:
   - In accordance with CA/Browser Forum requirements, private keys must be stored in a cloud Hardware Security Module (HSM) compliant with FIPS 140-2 Level 3 (e.g., Azure Key Vault Managed HSM or Google Cloud KMS).
   - Under no circumstances may private keys be exported to disk or stored as plain text repository secrets.
3. **Automated CI/CD Signing Invocation**:

```powershell
# Automated Signing using AzureSignTool and Key Vault HSM
AzureSignTool sign `
    -kvu "https://cortex-lockdown-vault.vault.azure.net" `
    -kvc "CortexLockdownEV2026" `
    -kvi $env:AZURE_CLIENT_ID `
    -kvs $env:AZURE_CLIENT_SECRET `
    -kvt $env:AZURE_TENANT_ID `
    -tr "http://timestamp.digicert.com" `
    -td sha256 `
    -fd sha256 `
    -v "C:\build\output\CortexLockdown.exe"
```

### 3.2. RFC 3161 Compliant Timestamping

To ensure that signatures remain valid indefinitely even after the signing certificate expires, all binaries must be timestamped using an RFC 3161 compliant Time Stamping Authority (TSA):
- Primary TSA: `http://timestamp.digicert.com`
- Fallback TSA: `http://timestamp.sectigo.com`
- Digest Algorithm: `SHA-256`

---

## 4. WINDOWS DEFENDER SMARTSCREEN REPUTATION ROADMAP

Unsigned binaries and newly signed binaries initially lack reputation in Microsoft's cloud-based SmartScreen filter.

### 4.1. The 3-Stage Reputation Lifecycle

```
[ Stage 1: EV Signing ]  ===>  Instant bypass of basic SmartScreen unknown publisher block
            |
            v
[ Stage 2: Submission ]  ===>  Submit binary to Microsoft Security Intelligence portal
            |
            v
[ Stage 3: Institutional GPO ] ===> GPO SmartScreen exclusion for campus workstations
```

1. **Immediate EV Trust**: An EV code signing certificate provides an initial trust uplift over standard code signing, significantly reducing the threshold of installs required to clear SmartScreen.
2. **Microsoft Security Intelligence Submission**:
   - Prior to public rollout, the signed binary is uploaded to `https://www.microsoft.com/en-us/wdsi/filesubmission` under the "Software Developer" program.
   - Microsoft automated analysis parses the binary within 4 to 12 hours, whitelisting it in the Defender definitions catalog.
3. **Enterprise GPO Bypass for Labs**:
   - Institutional networks configure the following Group Policy to bypass SmartScreen for internal educational applications:
     `Computer Configuration > Administrative Templates > Windows Components > File Explorer > Configure Windows Defender SmartScreen: Warn and prevent bypass (False) or Managed Path Exemption`.

---

## 5. BINARY PROVENANCE & SECURE DISTRIBUTION

### 5.1. Secure Download Pipeline

For student BYOD downloads, binaries are hosted behind Cloudflare Enterprise CDN with HTTP Strict Transport Security (HSTS) and SHA-256 verification sidecars:

```
GET https://releases.cortex.edu/lockdown/v1.0.0/CortexLockdown-Windows-x64.zip
GET https://releases.cortex.edu/lockdown/v1.0.0/CortexLockdown-Windows-x64.zip.sha256
GET https://releases.cortex.edu/lockdown/v1.0.0/CortexLockdown-Windows-x64.zip.sig (GPG/Cosign)
```

### 5.2. Client-Side Hash Verification

The Cortex web platform automatically renders the target SHA-256 checksum on the student download screen. Prior to launching the protocol handler, the student's web browser verifies that the downloaded package matches the institutional ledger.

---

## 6. RELEASE CERTIFICATION MATRIX

| Delivery Channel | Cryptographic Prerequisite | Pilot Status | Production Status |
|---|---|---|---|
| Managed Campus Lab (GPO / SCCM) | SHA-256 Hash Allowlist (AppLocker) | AUTHORIZED | READY |
| Managed Campus Lab (Domain Workstations) | Enterprise CA / Self-Signed Root | AUTHORIZED | READY |
| Student BYOD (Windows 10/11 Home/Pro) | Commercial EV Authenticode Signature | BLOCKED | PENDING PROCUREMENT |
| Student BYOD (macOS Sonoma/Sequoia) | Apple Developer ID + Notarization | BLOCKED | PENDING APPLE SILICON CI |

---

## 7. SIGNING DEPLOYMENT ROADMAP (PHASED SCHEDULE)

1. **Phase 1 (Immediate Pilot Baseline)**:
   - Deploy unsigned RC3 binary via AppLocker hash whitelisting on managed institutional workstations.
2. **Phase 2 (Pilot Verification Completion)**:
   - Procure DigiCert / Sectigo EV Hardware Security Module certificate through university procurement.
3. **Phase 3 (General Availability Release)**:
   - Sign, timestamp, and submit v1.0.0 release artifacts to Microsoft Security Intelligence.
   - Distribute signed MSIX and standard installer for broad multi-campus adoption.
