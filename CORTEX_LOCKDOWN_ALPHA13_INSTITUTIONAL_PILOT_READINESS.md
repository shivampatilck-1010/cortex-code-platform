# CORTEX LOCKDOWN — ALPHA 13 INSTITUTIONAL PILOT READINESS

Document Identifier: CL-PILOT-ALPHA13-READY  
Target Release: Cortex Lockdown v1.0.0-rc3  
Auditing Authority: Institutional Governance & Academic Pilot Accreditation Board  
Evaluation Host: Windows 10/11 x64 (Build 26300, AMD Ryzen 7 8840U)  
Governance Policy: Strictly Zero Emojis  

---

## 1. Institutional Pilot Governance Framework

To protect academic integrity and maintain strict legal governance, Cortex Lockdown release candidate v1.0.0-rc3 distinguishes between **internal demonstration fixtures** and **verified external institutional pilots**.

Under no circumstances may a synthetic demonstration fixture silently transition into active institutional pilot status, nor may an external university be authorized without independently audited documentary evidence.

---

## 2. Institutional Registry Status

The authoritative institutional configuration in [`src/lib/lockdown/pilot-config.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts) defines:

```
+------------------+-------------------------------+------------+--------------------+-------------------------+---------------------------------+
| INSTITUTION ID   | INSTITUTION NAME              | DOMAIN     | RECORD TYPE        | AUTHORIZATION STATUS    | OPERATIONAL STATUS              |
+------------------+-------------------------------+------------+--------------------+-------------------------+---------------------------------+
| inst_cit_01      | Cortex Institute of Tech      | cit.edu    | demonstration      | demonstration_only      | Active in Demo mode; BLOCKED in |
|                  |                               |            |                    |                         | Production & Institutional mode |
+------------------+-------------------------------+------------+--------------------+-------------------------+---------------------------------+
| inst_state_eng   | State Engineering University  | seu.edu    | demonstration      | demonstration_only      | Active in Demo mode; BLOCKED in |
|                  |                               |            |                    |                         | Production & Institutional mode |
+------------------+-------------------------------+------------+--------------------+-------------------------+---------------------------------+
| inst_mpu_pilot   | Metropolitan Poly University  | mpu.edu    | institutional_pilot| pending_institutional_  | STRICTLY BLOCKED; Pending       |
|                  |                               |            |                    | authorization           | bilateral countersigned MOU     |
+------------------+-------------------------------+------------+--------------------+-------------------------+---------------------------------+
| inst_unverified  | Unverified Academy            | unver.org  | institutional_pilot| pending_institutional_  | STRICTLY BLOCKED; Test fixture  |
|                  |                               |            |                    | authorization           |                                 |
+------------------+-------------------------------+------------+--------------------+-------------------------+---------------------------------+
```

---

## 3. Five-Pillar Administrative Evidence Standard

To promote any external university from `pending_institutional_authorization` to `verified_institutional_pilot`, five mandatory legal and technical pillars must be fulfilled. Storing placeholder strings or demo text is strictly prohibited:

1. **Countersigned Bilateral Pilot Agreement (MOU)**:
   - A legally binding Pilot Agreement PDF executed by both the institutional executive and the Cortex platform director.
   - An immutable SHA-256 cryptographic digest of the signed PDF must be computed and recorded in `pilotAgreementRef`.
2. **Authorized Institutional Signatory Verification**:
   - The signatory must be an authorized academic executive (University Provost, Academic Dean, Registrar, or Vice Chancellor).
3. **Cryptographic Domain Ownership Verification**:
   - Verification of the university domain (`*.edu`) via DNS TXT challenge token (`_cortex-auth-verification=<token>`) or SAML 2.0 / OIDC institutional federation metadata.
4. **Independent Evidence Review Audit Log**:
   - Independent verification recorded in `administrativeEvidenceDoc`, `evidenceVerifiedAt`, and `evidenceVerifiedBy`.
5. **Scoped Cohort & Hardware Workstation Allowlists**:
   - Explicit whitelist bindings for enrolled classrooms, authorized candidate student IDs, and lab workstation hardware fingerprints (`allowedDeviceIds`).

---

## 4. Controlled Internal Demonstration Safety Standards

Internal evaluation across classrooms `CSE276`, `CS301`, and `CS402` is certified under strict operational safety protocols:

1. **Fail-Closed Mode Enforcement**:
   - In production mode (`CORTEX_LOCKDOWN_MODE=production`), demo institutions are blocked fail-closed ([`pilot-config.ts`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts#L542)):
     ```typescript
     if (currentPilotConfig.mode === 'production' && (institution.domain === 'cit.edu' || institution.recordType === 'demonstration')) {
       return { authorized: false, status: 'not_in_pilot', reason: 'Demonstration institutions cannot authorize examinations in production mode' };
     }
     ```
   - Verified in test suite check `A13-12`.
2. **Standard Non-Administrator Accounts**:
   - University lab workstations must enforce standard domain user accounts. Students must never be granted local administrator rights.
3. **Group Policy Provisioning**:
   - Task Manager must be disabled on examination lab machines via GPO (`DisableTaskMgr = 1`).
4. **Single Display Physical Requirement**:
   - Auxiliary displays must be physically unplugged.
5. **In-Person Faculty Proctoring**:
   - Human proctors must remain present in the examination room at all times to monitor for external cameras, smartphones, and unauthorized hardware devices.

---

## 5. Reconciled Quota Model & Active Session Management

To prevent lab workstation overscheduling while providing room for hardware swaps:

```
+---------------+-------------------+----------------+--------------------+---------------------------------------+
| CLASSROOM ID  | INSTITUTION ID    | BASELINE QUOTA | HARD MAX CAPACITY  | PURPOSE / OVERFLOW BUFFER             |
+---------------+-------------------+----------------+--------------------+---------------------------------------+
| CSE276        | inst_cit_01       | 50 Candidates  | 60 Workstations    | Computer Science Midterm (10 Hot-Spare|
|               |                   |                |                    | Terminals for hardware failover)      |
+---------------+-------------------+----------------+--------------------+---------------------------------------+
| CS301         | inst_cit_01       | 50 Candidates  | 60 Workstations    | Algorithms Examination Cohort         |
+---------------+-------------------+----------------+--------------------+---------------------------------------+
| CS402         | inst_state_eng    | 30 Candidates  | 40 Workstations    | Advanced Operating Systems Lab        |
+---------------+-------------------+----------------+--------------------+---------------------------------------+
```

- **Quota Modification Governance**:
  Updating quotas requires administrative justification via [`updateClassroomQuota()`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/lockdown/pilot-config.ts#L348) and records an immutable entry in `pilot-config.auditLogs`.
- **Ghost Session Filtering**:
  Active candidate counts are calculated authoritatively via [`getAuthoritativeActiveSessionCount(examId, 120)`](file:///C:/Users/shiva/.gemini/antigravity/scratch/universal-code-platform/src/lib/classroom/db/index.ts#L3354), excluding terminated sessions and stale heartbeats older than 120 seconds.

---
*Report certified by Institutional Governance Board.*
