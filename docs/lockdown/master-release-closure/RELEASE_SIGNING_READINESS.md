# CORTEX LOCKDOWN — RELEASE SIGNING READINESS & PKI SPECIFICATION
Document Identifier: CL-RELEASE-SIGNING-V1
Version: 1.0.0-rc3
Target OS: Windows 10 / 11 x64
Classification: Release Closure Evidence Document
Status: GATED FOR MANAGED LABS / PROCUREMENT SPECIFIED

---

## 1. Executive Summary

This document establishes the official Code Signing Public Key Infrastructure (PKI) architecture and operational specification for Cortex Lockdown v1.0.

In the current development and staging baseline (v1.0.0-rc3), the Windows native PE binary `CortexLockdown.exe` (SHA-256: `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`) is Authenticode status `NotSigned`. 

For Managed Institutional Laboratories, this state is fully compensated by AppLocker and Windows Defender Application Control (WDAC) hash-based execution policies (`AppLocker-CortexLockdown.xml`), which explicitly allowlist the verified SHA-256 hash. However, for open institutional pilots, BYOD deployment, and general distribution, an Extended Validation (EV) digital signature is mandatory to prevent Windows Defender SmartScreen blocks and provide non-repudiation.

This specification details the cryptographic requirements, Cloud HSM architecture, RFC 3161 timestamping, CI/CD pipeline automation, and SmartScreen reputation acceleration strategy required for commercial production signing.

---

## 2. Current State vs. Production Requirements

| Attribute | Current Baseline (v1.0.0-rc3) | Production Target (v1.0.0 GA) | Institutional Impact |
| :--- | :--- | :--- | :--- |
| Authenticode Signature | NotSigned (Unsigned) | Extended Validation (EV) Signed | SmartScreen blocks on unmanaged PCs |
| Cryptographic Hash | SHA-256: `68C13F5B...` | SHA-256: Verified in CI | Unchanged file identity |
| Private Key Storage | None | FIPS 140-2 Level 3 Cloud HSM | Complies with CA/Browser Forum |
| Timestamp Authority | None | RFC 3161 SHA-256 TSA | Signature valid post-cert expiration |
| SmartScreen Status | Untrusted / Warning Prompt | Immediate Reputation Pass | Zero barrier to execution |
| Managed Lab Execution | Permitted via AppLocker Hash | Permitted via Publisher Rule | Simplifies administrative updates |
| BYOD Execution | BLOCKED (NO-GO) | Permitted (Post-Pilot) | Prevents user confusion |

---

## 3. Public Key Infrastructure (PKI) Architecture

### Certificate Authority & Certificate Profile
* Certificate Type: Extended Validation (EV) Code Signing Certificate.
* Certificate Authorities: DigiCert (Secure Site EV Code Signing) or Microsoft Azure Trusted Signing (formerly Azure Code Signing).
* Subject Distinguished Name (DN):
  - Common Name (CN): Cortex Learning Systems Inc.
  - Organization (O): Cortex Learning Systems Inc.
  - Organizational Unit (OU): Security & Release Engineering
  - Country (C): US / IN
  - Key Algorithm: RSA 4096-bit or ECC NIST P-384
* Key Usage: Digital Signature (80)
* Enhanced Key Usage (EKU): Code Signing (`1.3.6.1.5.5.7.3.3`)

### FIPS 140-2 Level 3 Cloud HSM Storage
Under CA/Browser Forum Baseline Requirements (effective June 2023), private keys for code signing cannot be exported to software `.pfx` or `.p12` files. Private keys must be stored in hardware tokens or compliant cloud HSMs:

* Selected Platform: Azure Key Vault Managed HSM or Azure Trusted Signing.
* Security Boundary: FIPS 140-2 Level 3 hardware security module.
* Access Control: Entra ID (Azure AD) Managed Identity with Role-Based Access Control (`Key Vault Crypto Officer`).
* Ephemeral Access: Signing tokens are short-lived (valid for 15 minutes) and generated via Workload Identity Federation in automated CI runners.

### RFC 3161 Compliant Timestamping
To ensure that signed binaries remain trusted and executable even after the code signing certificate reaches its validity expiration, signatures must be cryptographically timestamped by an authorized RFC 3161 Timestamp Authority (TSA):

* Primary TSA URL: `http://timestamp.digicert.com`
* Fallback TSA URL: `http://timestamp.sectigo.com`
* Digest Algorithm: SHA-256 (`/td sha256`)

---

## 4. Production CI/CD Signing Pipeline

The production signing workflow will be integrated into the GitHub Actions release runner using Microsoft Azure Trusted Signing (`TrustedSigning.Client` / `dlib` extension for `signtool.exe`).

### Automated Signing Workflow
```yaml
name: Production Release Signing Pipeline

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+'

jobs:
  sign-and-release:
    runs-on: windows-2022
    permissions:
      id-token: write
      contents: read
    steps:
      - name: Checkout Source
        uses: actions/checkout@v4

      - name: Authenticate to Azure Key Vault
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Setup Windows SDK (SignTool)
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Sign Native Executable
        shell: pwsh
        run: |
          $signTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
          $targetExe = "packages\desktop\dist\win-unpacked\CortexLockdown.exe"
          
          # Azure Trusted Signing invocation via dlib
          & $signTool sign /v /debug `
            /dlib "Azure.CodeSigning.Dlib.dll" `
            /dmc "signing-metadata.json" `
            /tr "http://timestamp.digicert.com" `
            /td sha256 `
            /fd sha256 `
            $targetExe

      - name: Verify Authenticode Signature
        shell: pwsh
        run: |
          $sig = Get-AuthenticodeSignature -FilePath "packages\desktop\dist\win-unpacked\CortexLockdown.exe"
          if ($sig.Status -ne "Valid") {
            throw "Authenticode signature validation failed: $($sig.StatusMessage)"
          }
          Write-Host "Authenticode verified: Subject=$($sig.SignerCertificate.Subject)"

      - name: Compute Signed Hashes and Generate Release Manifest
        shell: pwsh
        run: |
          $hash = (Get-FileHash -Path "packages\desktop\dist\win-unpacked\CortexLockdown.exe" -Algorithm SHA256).Hash
          Compress-Archive -Path "packages\desktop\dist\win-unpacked\*" -DestinationPath "release\CortexLockdown-Windows-x64-Signed.zip"
          $zipHash = (Get-FileHash -Path "release\CortexLockdown-Windows-x64-Signed.zip" -Algorithm SHA256).Hash
          
          $manifest = @{
            binarySha256 = $hash
            zipSha256 = $zipHash
            signingTimestamp = (Get-Date).ToUniversalTime().ToString("o")
            authenticodeStatus = "Valid"
          }
          $manifest | ConvertTo-Json | Set-Content "release\SIGNED_RELEASE_MANIFEST.json"
```

---

## 5. SmartScreen Reputation Acceleration Strategy

Windows Defender SmartScreen evaluates application reputation based on download volume, digital signature reputation, and absence of malicious behavioral flags. To prevent false-positive warnings during external deployment:

1. EV Certificate Reputation:
   EV certificates immediately confer a higher baseline reputation than standard OV certificates, eliminating SmartScreen warnings for the majority of installations.
2. Microsoft Defender Security Intelligence (MDSI) Pre-Submission:
   Prior to public distribution, the signed binary `CortexLockdown.exe` will be submitted to the Microsoft Defender Security Intelligence portal for automated static and dynamic detonation analysis.
3. Portal Whitelisting:
   Receipt of a clean MDSI analysis report ensures that Windows Defender definitions across all endpoint versions recognize the executable as a trusted educational security tool.
4. Telemetry Telemetry Feedback:
   Institutional pilot telemetry will monitor SmartScreen block reports during the controlled lab phase.

---

## 6. Implementation Roadmap & Procurement Schedule

| Milestone Stage | Activity | Owner | Target Timeline |
| :--- | :--- | :--- | :--- |
| Stage 1 | Azure Trusted Signing Tenant Registration | Release Engineering | Week 1 |
| Stage 2 | Dun & Bradstreet (D&B) Identity Verification | Legal / Finance | Week 2 |
| Stage 3 | Azure Key Vault Managed HSM Provisioning | Infrastructure Lead | Week 3 |
| Stage 4 | CI/CD GitHub Actions Pipeline Integration | DevOps Lead | Week 4 |
| Stage 5 | Dry-Run Signing & MDSI Whitelist Submission | Security Lead | Week 4 |
| Stage 6 | GA Production Release Binary Signing | Release Team | Milestone v1.0.0 GA |

---

## 7. Sign-Off & Operational Policy

* Controlled Windows Institutional Lab Pilot:
  AUTHORIZED TO PROCEED WITHOUT SIGNATURE.
  Controlled lab deployment uses AppLocker file-hash rules (`68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`), which bypass SmartScreen and enforce strict cryptographic integrity.
* External Institutional / BYOD Distribution:
  STRICTLY BLOCKED until completion of Stage 5 (Signed binary with MDSI pre-submission clearance).
