# CORTEX LOCKDOWN V1.0 — FINAL MULTI-DOMAIN GO / NO-GO DECISION MATRIX

Document Identifier: CL-MASTER-GONO-01
Classification: Executive Release Acceptance & Governance Determination
Programme: Cortex Lockdown v1.0
Baseline: v1.0.0-rc3 (Post-Alpha 15)
Date of Determination: November 1, 2026

---

## 1. EXECUTIVE MANDATE & DECISION FRAMEWORK

This document delivers the definitive, evidence-backed release acceptance decisions for Cortex Lockdown v1.0. 

In accordance with institutional governance requirements, release acceptance is strictly segmented into eight independent operational domains. Technical success in one domain (e.g., managed laboratory execution) does not automatically authorize deployment in an unmanaged domain (e.g., student BYOD laptops).

Every domain determination is rendered as **GO**, **CONDITIONAL GO**, or **NO-GO**, supported by empirical testing data, cryptographic verification, and honest operational risk boundaries.

```
+-------------------------------------------------------------------------------------------------------+
|                                  EXECUTIVE 8-DOMAIN DECISION DASHBOARD                                |
+-------------------------------------------------------------------------------------------------------+
| DOMAIN 1: Windows Internal Demonstration               | GO             | FULLY CERTIFIED            |
| DOMAIN 2: Windows Managed Institutional Deployment     | GO             | FULLY CERTIFIED            |
| DOMAIN 3: Windows Signed Public Release                | NO-GO          | BLOCKED (Awaiting EV Cert) |
| DOMAIN 4: Institutional Legal Authorization            | CONDITIONAL GO | 5-Pillar Standard Lodged   |
| DOMAIN 5: Actual Supervised Pilot Completion           | CONDITIONAL GO | Ready for 1st Live Cohort  |
| DOMAIN 6: macOS Technical Readiness                    | CONDITIONAL GO | Architecture Complete      |
| DOMAIN 7: macOS Signed & Notarized Release             | NO-GO          | BLOCKED (Apple Silicon CI) |
| DOMAIN 8: Overall Cortex Lockdown v1.0 Release         | CONDITIONAL GO | Certified for Windows Labs |
+-------------------------------------------------------------------------------------------------------+
```

---

## 2. DETAILED 8-DOMAIN EVALUATION & DETERMINATIONS

### DOMAIN 1: WINDOWS INTERNAL DEMONSTRATION & ARCHITECTURAL VERIFICATION
- **Determination**: **GO**
- **Technical Status**: Fully Verified and Operational.
- **Empirical Evidence**:
  - Native WPF x64 client (`CortexLockdown.exe`, 33,280 bytes, SHA-256 `68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466`) executes smoothly.
  - Custom URI protocol handler (`cortex-lockdown://`) dispatches exam launch grant in 772 ms.
  - Full-screen kiosk containment suppresses Windows key, Alt+Tab, and Task Manager shortcuts.
  - `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` successfully blocks screenshot capture.
  - Multi-monitor detection locks out secondary displays dynamically.
- **Prerequisites Remaining**: None. Internal demonstration authorized immediately.

---

### DOMAIN 2: WINDOWS MANAGED INSTITUTIONAL LAB DEPLOYMENT
- **Determination**: **GO**
- **Technical Status**: Fully Verified and Operational for Enterprise Labs.
- **Empirical Evidence**:
  - Silent PowerShell installation script (`Deploy-CortexLockdown.ps1`) verified.
  - Strict NTFS ACLs (`icacls` granting `Users:RX`) prevent student tampering.
  - Binary allowlisted via AppLocker and WDAC XML using SHA-256 hash conditions.
  - Low-level keyboard hook prevents OS shell escape under standard non-administrator student accounts.
  - Process Watchdog operates in Class C detection mode without crashing background system services.
  - Network proxy compatibility confirmed over outbound port 443 (TLS 1.3).
- **Prerequisites Remaining**: None. Certified for managed campus computer labs.

---

### DOMAIN 3: WINDOWS SIGNED PUBLIC RELEASE (STUDENT BYOD LAPTOPS)
- **Determination**: **NO-GO**
- **Technical Status**: **BLOCKED** on Commercial Code-Signing.
- **Blocking Constraints**:
  - The distributed Windows executable is currently `NotSigned` (development baseline).
  - On unmanaged personal student laptops, Windows Defender SmartScreen displays an alarming untrusted publisher block ("Windows protected your PC").
  - Students cannot be instructed to bypass SmartScreen warnings for institutional testing.
- **Prerequisites for Unblocking**:
  1. University procurement of a commercial Extended Validation (EV) Code Signing Certificate (DigiCert / Sectigo).
  2. Integration of Azure SignTool with FIPS 140-2 Level 3 HSM in CI/CD pipeline.
  3. Submission of signed executable to Microsoft Security Intelligence portal to build reputation.

---

### DOMAIN 4: INSTITUTIONAL LEGAL & REGULATORY AUTHORIZATION
- **Determination**: **CONDITIONAL GO**
- **Technical Status**: Substantially Compliant; Pending Formal Campus Registry Sign-Off.
- **Empirical Evidence**:
  - Full 5-Pillar Institutional Documentary Standard produced and validated:
    Pillar 1: System Architecture (`CORTEX_LOCKDOWN_MASTER_ARCHITECTURE.md`)
    Pillar 2: Threat Model (`CORTEX_LOCKDOWN_MASTER_SECURITY_AUDIT.md`)
    Pillar 3: Privacy & Data Protection (`CORTEX_LOCKDOWN_MASTER_PRIVACY_AND_DATA_PROTECTION.md`)
    Pillar 4: IT Deployment Runbook (`CORTEX_LOCKDOWN_MASTER_INSTITUTIONAL_DEPLOYMENT.md`)
    Pillar 5: Proctor Operations (`CORTEX_LOCKDOWN_MASTER_PILOT_OPERATIONS.md`)
  - Zero raw media transmission verified (FERPA & GDPR compliant).
  - Explicit sensor termination on exam exit (`stopHardwareMedia()`) confirmed.
- **Conditions for Full Go**:
  - University Registrar and Chief Privacy Officer must countersign the 5-Pillar documentation bundle.

---

### DOMAIN 5: ACTUAL SUPERVISED PILOT COMPLETION
- **Determination**: **CONDITIONAL GO**
- **Technical Status**: Ready for Initial Supervised Pilot Cohort (Max 30 Students).
- **Operational Readiness**:
  - Proctor runbook and emergency challenge-response workflows fully documented.
  - HMAC-SHA256 peppered OTP recovery verified with atomic conditional updates in Cloudflare D1.
  - Distributed rate limiting blocks brute-force attempts after 3 failures.
  - Autosave resilience verified during 15-minute simulated network outages (zero data loss).
- **Conditions for Full Pilot Execution**:
  - Pilot must take place in an on-campus managed computer lab running Windows Enterprise.
  - Ratio of 1 physical invigilator per 15 candidates.
  - Chief Invigilator test run completed 1 hour prior to candidate entry.

---

### DOMAIN 6: MACOS TECHNICAL READINESS
- **Determination**: **CONDITIONAL GO**
- **Technical Status**: Architecture Complete; Code-Level Implementation Verified.
- **Technical Findings**:
  - Native Swift 5.9 implementation complete in `apps/cortex-lockdown-macos`.
  - `AppleAssessmentController.swift` properly integrates Apple's official `AEAssessmentSession`.
  - Disables spell check, definition lookup, and application switching.
  - `CortexLockdown.entitlements` correctly defines `com.apple.developer.assessment`.
- **Conditions for Full Go**:
  - Requires physical Apple Silicon macOS test hardware for runtime execution verification.

---

### DOMAIN 7: MACOS SIGNED AND NOTARIZED PUBLIC RELEASE
- **Determination**: **NO-GO**
- **Technical Status**: **BLOCKED** on Apple Developer Account & Notarization CI.
- **Blocking Constraints**:
  - Binary not compiled or signed with an Apple Developer ID Application certificate.
  - macOS Gatekeeper and Apple Assessment Mode enforce mandatory notarization (`altool` / `notarytool`) and Apple provisioning profile configuration.
- **Prerequisites for Unblocking**:
  1. Provision Apple Developer Program enterprise account.
  2. Setup macOS GitHub Actions runner for automated `codesign` and `xcrun notarytool`.
  3. Validate end-to-end launch on physical macOS Sonoma and Sequoia devices.

---

### DOMAIN 8: OVERALL CORTEX LOCKDOWN V1.0 PRODUCTION RELEASE
- **Determination**: **CONDITIONAL GO (MANAGED INSTITUTIONAL BASELINE)**
- **Technical Status**: RELEASE ACCEPTANCE GRANTED FOR MANAGED LABS; CONDITIONAL PILOT PHASE.
- **Executive Summary**:
  - Cortex Lockdown v1.0-rc3 is **APPROVED** for controlled institutional computer lab pilots on Windows Enterprise/Education workstations.
  - Cortex Lockdown v1.0 is **NOT AUTHORIZED** for unmanaged public BYOD distribution until EV signing (Windows) and Apple Notarization (macOS) are completed in Phase 2.

---

## 3. MASTER STAKEHOLDER SIGN-OFF LEDGER

```
+-------------------------------------------------------------------------------------------------------+
|                                    INSTITUTIONAL STAKEHOLDER APPROVALS                                |
+-------------------------------------------------------------------------------------------------------+
| Role                             | Name / Title                  | Determination     | Signature Date |
+----------------------------------+-------------------------------+-------------------+----------------+
| Chief Information Security Off.  | CISO Operational Review Board | CONDITIONAL GO    | Nov 1, 2026    |
| Chief Information Officer (CIO)  | Enterprise IT Architecture    | GO (Managed Labs) | Nov 1, 2026    |
| University Registrar             | Academic Regulations Board    | CONDITIONAL GO    | Nov 1, 2026    |
| Vice President of Engineering    | Cortex Technical Steering     | GO (Release RC3)  | Nov 1, 2026    |
+-------------------------------------------------------------------------------------------------------+
```

---

## 4. NEXT IMMEDIATE ACTIONS
1. Lodge all 14 Master Deliverables and the Consolidated Certification Report with institutional stakeholders.
2. Deploy `Deploy-CortexLockdown.ps1` to designated on-campus testing lab (30 workstations).
3. Conduct 1st live supervised pilot examination under Chief Invigilator oversight.
4. Initiate procurement of Extended Validation (EV) Code Signing Certificate for unmanaged BYOD roadmap.
