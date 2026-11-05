# CORTEX LOCKDOWN RC1 - RELEASE NOTES

Release Candidate: RC1 (v1.0.0-rc1)
Release Date: November 2, 2026
Target Operating Systems: Windows 10 (64-bit, 21H2+), Windows 11 (64-bit, Build 22000+)
Total Project Expenditure: INR 0

## 1. Release Highlights
- Release Candidate 1 (RC1) represents the fully qualified, evidence-closed baseline for institutional evaluation and private college demonstrations.
- 100% verified regression status: 390 of 390 test checks passed across 14 regression suites.
- Bit-for-bit preservation of original college demonstration artifacts: `CortexLockdown-Hardened.exe` (SHA-256: `82518B2D...`), `CortexLockdown-Windows-x64.zip` (SHA-256: `08BD0C5A...`), and `CortexLockdown.exe` (SHA-256: `68C13F5B...`).
- High-efficiency physical host execution: SQLite CAS submission avg 0.460 ms, LTI JWT verification avg 0.059 ms, and RSS working set 84.8 MB on AMD Ryzen 7 8840U.

## 2. Security & Protocol Hardening
- Complete SSRF defense against alternative IPv4 representations (DWORD, octal, hex, mixed) verified under HTTPS protocol with exact loopback/private error classifications.
- Multi-record DNS rebinding defense failing closed if any resolved record is private or loopback.
- Dynamic JWKS response size limit enforcement (max 512KB) and 5000ms request timeout to prevent memory exhaustion DoS.
- Unknown Key ID refresh rate-limiting (60-second minimum interval) preventing CPU exhaustion.
- Persistent SQLite replay cache defending against SAML assertion and LTI nonce replay across server restarts.
- Single-winner Compare-And-Swap (CAS) submission guarantee preventing duplicate submission races.
- Authenticated AES-256-GCM local answer journaling with PBKDF2 key derivation for resilient offline examination continuation.

## 3. Clear Institutional Deployment Boundaries
- PRIVATE COLLEGE DEMONSTRATION: GO
- FACULTY EVALUATION: GO
- SUPERVISED INSTITUTIONAL PILOT: CONDITIONAL (requires campus IT approval, LMS developer key registration, and managed-device WDAC policy)
- FULL INSTITUTIONAL DEPLOYMENT: NO-GO (blocked on W3C Exc-C14N SAML federation engine and production multi-tenant database)
- PUBLIC BYOD RELEASE: NO-GO (unmanaged BYOD cannot defend against kernel drivers or external HDMI capture without managed device controls)
- MACOS RELEASE: NO-GO (Windows-only implementation; macOS Cocoa/WKWebView port not started)
