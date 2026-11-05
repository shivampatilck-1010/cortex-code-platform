# CORTEX LOCKDOWN RC1 - TEST EVIDENCE INDEX

Package Version: 1.0.0-rc1
Classification: Quality Assurance Test & Regression Evidence Ledger

## 1. Cumulative Regression Suite Overview

Total Test Suites: 14 Executed Suites
Total Executed Checks: 390 Checks
Pass Rate: 100.0% (390 Passed, 0 Failed, 0 Skipped)
Harness Command: `node scripts/run-lockdown-regressions.mjs`

### Suite Breakdown
1. Packaging & Installer (`scripts/test-lockdown-packaging-and-installer.ts`): 7 checks [E]
2. Physical Process Crash (`scripts/test-lockdown-physical-process-crash.ts`): 1 check [E]
3. College Demonstration 22-Step (`scripts/test-lockdown-college-demonstration.ts`): 22 checks [E]
4. Alpha 28 Proctoring & Integrity (`scripts/test-lockdown-alpha28-proctoring-and-integrity.ts`): 17 checks [B/C]
5. Alpha 29 Reliability & Adversarial (`scripts/test-lockdown-alpha29-reliability-and-adversarial.ts`): 22 checks [B/C/D]
6. Alpha 30 Institutional & Accessibility (`scripts/test-lockdown-alpha30-institutional-and-accessibility.ts`): 25 checks [B/C]
7. Alpha 31 Policy Enforcement & RBAC (`scripts/test-lockdown-alpha31-policy-enforcement-and-rbac.ts`): 27 checks [B/C]
8. Alpha 32 End-to-End Enforcement (`scripts/test-lockdown-alpha32-end-to-end-enforcement.ts`): 17 checks [B/C/E]
9. Alpha 33 Identity & Cryptographic Security (`scripts/test-lockdown-alpha33-identity-and-cryptographic-security.ts`): 29 checks [B/C]
10. Alpha 34 Distributed Security & Concurrency (`scripts/test-lockdown-alpha34-distributed-security.ts`): 32 checks [B/C]
11. Alpha 35 Standards & Release Readiness (`scripts/test-lockdown-alpha35-standards-and-release-readiness.ts`): 35 checks [A/B/C]
12. Alpha 36 Protocol Interoperability (`scripts/test-lockdown-alpha36-protocol-interoperability.ts`): 39 checks [A/B/C]
13. Alpha 37 Adversarial Security & Qualification (`scripts/test-lockdown-alpha37-adversarial-verification.ts`): 47 checks [A/B/C]
14. Alpha 38 Release Qualification (`scripts/test-lockdown-alpha38-release-qualification.ts`): 70 checks [A/B/C/D/E]

## 2. Evidence Classification Code Reference
- [A] Source Code Inspection: Static verification of types, algorithms, schemas, and policy definitions.
- [B] Unit Test: Isolated deterministic functional verification of specific functions or cryptographic primitives.
- [C] Integration Test: Multi-component workflow validation (e.g. database transactions, session handshakes, delta synchronization).
- [D] Simulation: Controlled simulation of environmental faults (e.g. network drops, DNS rebinding, server outages).
- [E] Physical Windows Execution: Direct execution on host Windows 11 workstation exercising Win32 APIs, file I/O, and PE binaries.
- [F] Institutional Managed-Device Validation: Validation under enterprise MDM, WDAC, or Active Directory Group Policy.
