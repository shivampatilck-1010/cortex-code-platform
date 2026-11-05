# CORTEX LOCKDOWN — ACTIVE KNOWN DEFECT REGISTER

**Document Version:** 1.0.0-rc1.2  
**Strictly Zero Emojis Enforced:** Yes  

---

| Defect ID | Severity | Subsystem | Description & Operational Impact | Workaround & Remediation Path | Target Phase |
| :--- | :---: | :--- | :--- | :--- | :---: |
| **DEF-RC1-001** | High | SAML 2.0 Engine | Custom XML canonicalizer does not support full W3C Exclusive C14N (missing ancestor namespace inheritance and prefix lists). Multi-institution federation BLOCKED. | Use LTI 1.3 Advantage for LMS integrations; migrate to industrial XMLDSIG engine for SAML. | v1.0 GA |
| **DEF-RC1-002** | High | Cloudflare D1 | High-concurrency lockdown workloads have not been benchmarked live on Cloudflare D1. D1 lacks native BEGIN IMMEDIATE / row locks. | Deploy verified single-server SQLite 3 WAL engine for current pilots. | v1.0 GA |
| **DEF-RC1-003** | Medium | SSRF Defense | Node.js fetch executes secondary DNS lookup at socket connection time, creating a theoretical sub-second TOCTOU rebinding window. | Deploy dedicated enterprise forward proxy with destination socket IP pinning. | v1.0 GA |
| **DEF-RC1-004** | Low | Hardware Display | Passive HDMI capture cards split physical TMDS signals downstream of the GPU, bypassing display affinity. | Physical proctoring and cabling inspection required. Documented non-goal. | Non-Goal |
| **DEF-RC1-005** | Medium | Process Security | Absence of kernel-mode driver permits local Administrator accounts to terminate application process. | Restrict student accounts to standard user privileges via Group Policy. | v1.0 GA |
| **DEF-RC1-006** | Medium | Windows Deployment | Unsigned application binary triggers Windows Defender SmartScreen unrecognized publisher warning on unmanaged PCs. | Campus IT pre-authorization via AppLocker or WDAC hash rule. "Run Anyway" prohibited. | v1.0 GA |
| **DEF-RC1-007** | Low | Storage Sanitization | Solid-state drive Flash Translation Layer (FTL) wear leveling leaves unzeroed ciphertext blocks in physical flash NAND. | Confidentiality rests on AES-256-GCM authenticated encryption barrier. | Non-Goal |
