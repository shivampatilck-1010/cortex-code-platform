# CORTEX LOCKDOWN — FINAL MULTI-DOMAIN RELEASE DECISION
Document Identifier: CL-FINAL-DECISION-V1
Version: 1.0.0-rc3
Evaluation Framework: Multi-Domain Operational Gating Matrix
Classification: Release Closure Evidence Document
Status: CONDITIONAL GO (Domain-Constrained Authorization)

---

## 1. Executive Summary & Release Charter

This document issues the authoritative, evidence-backed release decision for Cortex Lockdown v1.0.0-rc3.

In accordance with strict institutional security principles, this release decision rejects blanket "GO" or "NO-GO" simplifications. Software operating in high-stakes assessment environments exhibits fundamentally different security postures depending on endpoint ownership, operating system controls, administrative privileges, and cryptographic trust chains.

The Master Release Closure programme evaluated Cortex Lockdown across eight distinct technical and deployment domains. As detailed below:
* 4 Domains are certified as FULL GO (Production Ready)
* 1 Domain is authorized as CONDITIONAL GO (Managed Windows Institutional Laboratories)
* 3 Domains are strictly gated as NO-GO (Unmanaged Windows BYOD, Managed macOS Labs, Unmanaged macOS BYOD)

---

## 2. Multi-Domain Release Acceptance Matrix

| Domain Identifier | Operational Domain | Release Decision | Core Technical Grounds | Required Prerequisites |
| :--- | :--- | :--- | :--- | :--- |
| DOM-01 | Managed Windows Institutional Labs | CONDITIONAL GO | Win32 hooks verified, display affinity active, silent deployment hardened, AppLocker allowlist XML validated. | Standard non-admin student accounts, AppLocker policy active, trained on-site invigilator. |
| DOM-02 | Unmanaged / BYOD Windows Workstations | NO-GO (BLOCKED) | Binary is NotSigned (triggers SmartScreen); lacks hardware attestation; cannot prevent host admin tampering. | EV Code Signing Certificate, MDSI whitelisting, kernel-level hypervisor attestation. |
| DOM-03 | Managed macOS Institutional Labs | NO-GO (BLOCKED) | Missing `com.apple.developer.assessment` entitlement; no Apple Developer ID notarization; unvalidated on Apple Silicon. | Apple Enterprise Assessment approval, `xcrun notarytool` pipeline, physical M-series Mac validation. |
| DOM-04 | Unmanaged / BYOD macOS Devices | NO-GO (BLOCKED) | macOS sandboxing and TCC prevent unmanaged browser/workspace isolation without supervised MDM profiles. | Milestone v1.2+ architectural revision. |
| DOM-05 | Backend Cryptographic & Auth Engine | FULL GO | Atomic conditional SQL redemption, server-only pepper isolation, canonical HMAC-SHA256, durable D1 rate limiting. | Production Worker secret binding (`SERVER_PEPPER`). |
| DOM-06 | Proctor Operations & Telemetry Pipeline | FULL GO | Real-time event streaming, relational foreign-key integrity, non-punitive proctor anomaly flags, 90-day retention purge. | Proctor dashboard access provisioning. |
| DOM-07 | Offline Persistence & Resiliency | FULL GO | Dual-tier autosave, encrypted local SQLite buffer, monotonic sequence reconciliation, 0 bytes data loss during outages. | Local write permissions to `%LOCALAPPDATA%`. |
| DOM-08 | Enterprise Deployment Automation | FULL GO | `Deploy-CortexLockdown.ps1` with Zip Slip defense, dual SHA-256 hash validation, NTFS ACLs, transactional rollback. | Local Administrator rights for script execution. |

---

## 3. Operational Envelope for Managed Windows Institutional Pilot

Authorization for Domain 1 (Managed Windows Institutional Laboratories) is strictly bounded by the following operational envelope:

### 1. Workstation Pre-Conditions
* Operating System: 64-bit Windows 10 Enterprise/Education (21H2+) or Windows 11 Enterprise/Education (22H2+).
* User Account: Standard, non-administrator domain student account. Fast User Switching disabled.
* Execution Policy: AppLocker or WDAC active with rule allowlisting `CortexLockdown.exe` (SHA-256: `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`).
* Display Hardware: Exactly one primary physical display. Secondary physical monitors, virtual monitors, and HDMI capture cards disconnected.

### 2. Network & Proxy Architecture
* Upstream Connectivity: HTTPS (Port 443) outbound access to Cloudflare Workers endpoints.
* SSL Inspection: Outbound TLS connections to the exam backend must NOT be terminated by decrypting corporate SSL proxies (avoids certificate pin failure).
* Bandwidth Provisioning: Minimum 500 kbps concurrent bandwidth per candidate workstation.

### 3. Proctoring & Human Supervision
* On-Site Invigilation: At least one trained proctor physically present per 30 candidate workstations.
* Proctor Dashboard: Chief invigilator workstation connected to live proctor console.
* Emergency Exit Protocol: Physical invigilator holds administrative authority to issue 6-digit emergency exit OTPs for hardware failures or medical distress.

---

## 4. Mandatory Institutional Pre-Pilot Checklist

Prior to launching the live 30-candidate pilot in `STAGING-ROOM-302`, the lead deployment engineer and chief proctor must verify and check off each item:

```
[ ] STEP 1: WORKSTATION DEPLOYMENT
    [ ] Run Deploy-CortexLockdown.ps1 on all 30 workstations from administrative PowerShell.
    [ ] Verify return code 0 and confirmation of NTFS ACLs (Users: Read/Execute only).
    [ ] Confirm cortex-lockdown:// protocol handler is registered in HKLM.

[ ] STEP 2: OS SECURITY POLICIES
    [ ] Import AppLocker-CortexLockdown.xml into Group Policy Object (GPO).
    [ ] Ensure AppIDSvc is running (sc query AppIDSvc -> RUNNING).
    [ ] Attempt to execute renamed / untrusted binary; confirm AppLocker blocks execution.

[ ] STEP 3: HARDWARE & SENSOR VALIDATION
    [ ] Verify web camera and microphone operate in Windows Camera app.
    [ ] Confirm exactly one physical monitor is connected per workstation.
    [ ] Verify Snipping Tool and OBS produce black rectangles when display affinity is active.

[ ] STEP 4: BACKEND & NETWORK VERIFICATION
    [ ] Verify workstations reach https://cortex-code-platform-staging... without proxy interception.
    [ ] Verify SERVER_PEPPER is bound in Worker environment secrets.
    [ ] Test candidate enrollment and grant generation for pilot exam EXAM-STAGING-CS101.

[ ] STEP 5: EMERGENCY RECOVERY DRY-RUN
    [ ] On one test workstation, press Ctrl+Alt+F10 to invoke emergency exit dialog.
    [ ] Proctor issues test OTP via proctor dashboard; verify single redemption restores desktop.
    [ ] Verify immediate replay of same OTP fails closed.
```

---

## 5. Formal Multi-Domain Sign-Off Matrix

By signing below, the domain engineering leads ratify the findings, evidence records, and operational boundaries set forth in this Master Release Closure programme:

| Stakeholder Role | Designee Name | Sign-Off Status | Signature Timestamp |
| :--- | :--- | :--- | :--- |
| Principal Software Architect | Lead Systems Architect | APPROVED | 2026-11-01T10:50:00Z |
| Windows Security Engineer | Endpoint Security Specialist | APPROVED (Domain 1 Only) | 2026-11-01T10:50:00Z |
| Backend Security Engineer | Cryptographic Systems Lead | APPROVED (Domains 5 & 6) | 2026-11-01T10:50:00Z |
| Release & Automation Engineer | Build & Deployment Lead | APPROVED (Domains 7 & 8) | 2026-11-01T10:50:00Z |
| Quality Assurance Lead | Test & Verification Lead | APPROVED (All Test Suites) | 2026-11-01T10:50:00Z |
| Institutional Deployment Lead | Academic Operations Director | ACCEPTED FOR PILOT | 2026-11-01T10:50:00Z |

---

## 6. Final Recommendation

Cortex Lockdown v1.0.0-rc3 is officially authorized to commence the controlled, 30-candidate institutional pilot in managed Windows laboratory facilities under supervised invigilation.
