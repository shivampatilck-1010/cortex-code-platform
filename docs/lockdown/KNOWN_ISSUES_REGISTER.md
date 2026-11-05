# CORTEX LOCKDOWN - KNOWN ISSUES AND DEFECT REGISTER

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional Public Defect Register
Maintenance Status: Active / Release Candidate 1

---

## 1. Defect Classification Scheme

Issues are classified according to standard institutional severity:

* Severity 1 (Critical): Prevents examination execution or causes unrecoverable data loss with no workaround.
* Severity 2 (Major): Impairs core security controls or protocol interoperability; workaround or compensating control required.
* Severity 3 (Moderate): Degrades non-essential feature or usability; viable workaround exists.
* Severity 4 (Minor): Cosmetic anomaly, documentation discrepancy, or minor latency deviation.

---

## 2. Active Defect Register

### Issue ID: DEF-038-001
* Title: SAML 2.0 Restricted Canonicalization Incompatibility with Complex InCommon XML
* Severity: Severity 2 (Major)
* Component: `src/lib/lockdown/institutional-integration.ts` (`canonicalizeXml`)
* Status: OPEN / ARCHITECTURALLY MITIGATED (Status = BLOCKED)
* Impact: Multi-institution SAML federations (InCommon, EduGAIN) utilizing non-standard XML namespace prefixes, comments inside signatures, or arbitrary attribute ordering may fail XMLDSig validation.
* Workaround: Institutions must deploy LTI 1.3 Advantage integration or utilize standalone signed launch grants. Production SAML federation remains designated BLOCKED.
* Planned Resolution: Replace custom subset canonicalizer with W3C Exclusive XML Canonicalization (C14N) compliant engine in Release Candidate 2.

### Issue ID: DEF-038-002
* Title: Cloudflare D1 Provider Concurrency Limitation Under High-Contention Locking
* Severity: Severity 2 (Major)
* Component: `src/lib/db/index.ts` (`MockD1Wrapper` / Cloudflare D1 bindings)
* Status: OPEN / CLASSIFIED (Status = NOT TESTED)
* Impact: Cloudflare D1 does not support explicit `BEGIN IMMEDIATE` or row-level `SELECT FOR UPDATE` locking statements. High-concurrency simultaneous CAS operations (>50 concurrent workers) have not been verified on live Cloudflare edge workers.
* Workaround: Deploy the gateway on Node.js / Linux / Windows using SQLite with WAL mode (`busy_timeout = 5000ms`) or standalone PostgreSQL.
* Planned Resolution: Implement optimistic concurrency retries with exponential jitter for D1 provider binding in Phase 4.

### Issue ID: DEF-038-003
* Title: Hardware HDMI Capture Cards Bypass User-Mode Display Affinity
* Severity: Severity 3 (Moderate)
* Component: Operating System Display Subsystem (`WDA_MONITOR`)
* Status: OPEN / DOCUMENTED NON-GOAL
* Impact: Hardware video capture devices (Elgato, Cam Link) connected physically between the GPU and monitor tap video signals downstream of Windows display affinity APIs.
* Workaround: Physical room proctoring, examination hall workstation cable inspections, and randomized seating configurations.
* Planned Resolution: Permanent architectural limitation of user-mode software; mitigated by physical proctoring protocols.

### Issue ID: DEF-038-004
* Title: Virtual Display Driver False Positives with Certain Remote Desktop Tools
* Severity: Severity 3 (Moderate)
* Component: `src/lib/lockdown/display-monitor.ts`
* Status: OPEN / MITIGATED
* Impact: Software that creates virtual display adapters (e.g. Duet Display, Spacedesk, or software drawing tablets) triggers the multi-monitor blocking policy even if no physical second screen is connected.
* Workaround: Examinees must disable or uninstall virtual display adapter drivers prior to launching the exam.
* Planned Resolution: Enhance device enumeration heuristics to distinguish virtual software adapters from physical video ports.

### Issue ID: DEF-038-005
* Title: Node.js 24 Child Process Deprecation Warning During Shell Execution
* Severity: Severity 4 (Minor)
* Component: `scripts/run-lockdown-regressions.mjs`
* Status: OPEN / BENIGN
* Impact: Console warning `[DEP0190] DeprecationWarning: Passing args to a child process with shell option true` logged during test suite execution on Node.js v24.19.0.
* Workaround: None required. Does not impact test execution, logic, or exit codes.
* Planned Resolution: Refactor regression harness to pass command arguments directly without shell expansion.

---

## 3. Resolved Defects Summary (Alpha 31 - Alpha 38)

* DEF-037-001 (Resolved in Alpha 38): Alternative IPv4 SSRF representations (DWORD, octal, hex) failing early on `http:` protocol check. Resolved by evaluating full matrix under `https:` and verifying exact loopback/private rejection categories.
* DEF-037-002 (Resolved in Alpha 38): Multi-record DNS rebinding defense failing closed if any record is private. Resolved and verified across IPv4, IPv6, and IPv4-mapped IPv6 formats.
* DEF-036-001 (Resolved in Alpha 37): LTI JWKS endpoint caching without rate limiting on unknown keys. Resolved by implementing 60-second anti-DoS refresh throttling.
* DEF-035-001 (Resolved in Alpha 36): SAML assertion replay vulnerability across process restarts. Resolved by adding persistent SQLite replay cache with automatic expiration pruning.
