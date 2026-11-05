# CORTEX LOCKDOWN RC1 - KNOWN ISSUES REGISTER

Package Version: 1.0.0-rc1  
Classification: Active Defect & Technical Limitation Register  
Zero Emojis Enforced: Yes  

---

## 1. Active Defects & Limitations

### DEF-RC1-001: Production Multi-Institution SAML Federation Blocked
- Severity: Major (Severity 2)
- Component: `src/lib/lockdown/institutional-integration.ts` (`canonicalizeXml`)
- Status: OPEN / ARCHITECTURALLY MITIGATED (Status = BLOCKED)
- Description: Custom XML canonicalizer does not support full W3C Exclusive XML Canonicalization (C14N), missing ancestor namespace inheritance, InclusiveNamespaces, and `xml:lang` inheritance.
- Impact: Multi-institution federations (InCommon, EduGAIN) with complex whitespace or prefixes may fail signature validation.
- Workaround: Use LTI 1.3 Advantage or standalone launch grants. Production SAML federation remains designated BLOCKED.

### DEF-RC1-002: Cloudflare D1 Concurrency Limitation (NOT TESTED)
- Severity: Major (Severity 2)
- Component: `src/lib/db/index.ts` (`MockD1Wrapper`)
- Status: OPEN / CLASSIFIED (Status = NOT TESTED)
- Description: Cloudflare D1 lacks native `BEGIN IMMEDIATE` and pessimistic row-level locking. High-concurrency simultaneous CAS operations on live D1 edge workers have not been tested.
- Workaround: Deploy the gateway on Node.js using SQLite with WAL mode (`busy_timeout = 5000ms`) or standalone PostgreSQL.

### DEF-RC1-003: Connection-Level Socket Destination Pinning Not Enforced
- Severity: Moderate (Severity 3)
- Component: Outbound HTTP / JWKS Fetching Engine
- Status: OPEN / DOCUMENTED BOUNDARY
- Description: Node.js `fetch` executes an internal secondary DNS resolution at socket connect time. Sub-second TTL DNS rebinding (TOCTOU) is theoretically possible without socket-level IP binding.
- Workaround: In production, route outbound federation traffic through a dedicated forward proxy with IP pinning.

### DEF-RC1-004: Hardware HDMI Splitters / Capture Cards Unmitigated
- Severity: Moderate (Severity 3)
- Component: Windows Display Pipeline (`WDA_MONITOR`)
- Status: OPEN / DOCUMENTED NON-GOAL
- Description: Passive HDMI hardware splitters tap video downstream of the GPU display controller and cannot be detected by user-mode software.
- Workaround: Physical room proctoring and workstation inspection.

### DEF-RC1-005: Virtual Display Software False Positives
- Severity: Minor (Severity 4)
- Component: Display Monitoring Subsystem
- Status: OPEN / MITIGATED
- Description: Software drawing tablets and virtual display drivers (Duet, Spacedesk) trigger multi-monitor detection.
- Workaround: Disable virtual display adapters before launching the exam.

### DEF-RC1-006: Unsigned Binary & Windows Defender SmartScreen Warning
- Severity: Moderate (Severity 3)
- Component: Windows Application Deployment
- Status: OPEN / PROCESS MITIGATED
- Description: Executable is not signed with a commercial Authenticode Extended Validation (EV) certificate (INR 0 budget constraint). Windows SmartScreen will display an unrecognized app notice on unmanaged PCs.
- Safe Mitigation: Bypassing SmartScreen via "Run Anyway" is strictly prohibited in institutional protocols. Demonstrations must be conducted on dedicated test machines pre-authorized by campus IT via local WDAC / AppLocker allowlists.

### DEF-RC1-007: SSD / NAND Flash Physical Media Deletion Limitation
- Severity: Minor (Severity 4)
- Component: Answer Store (`clearEncryptedAnswers`)
- Status: OPEN / CRYPTOGRAPHICALLY MITIGATED
- Description: User-space zeroing and file unlinking cannot guarantee physical bit-level destruction on SSD/NVMe media due to Flash Translation Layer (FTL) wear-leveling and out-of-place writes.
- Mitigation: Examination answers are stored exclusively as AES-256-GCM authenticated ciphertext (PBKDF2 100,000 iterations). Confidentiality is guaranteed by the cryptography rather than physical flash erasure.
