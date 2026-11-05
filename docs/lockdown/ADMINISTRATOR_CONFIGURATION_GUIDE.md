# CORTEX LOCKDOWN - ADMINISTRATOR CONFIGURATION GUIDE

Document Version: 1.0.0-rc1
Milestone: Alpha 38 Release Candidate Qualification
Classification: Institutional IT / System Administration
Target Audience: Campus System Administrators, LMS Technical Integrators, and IT Security Engineers

---

## 1. System Architecture Overview

Cortex Lockdown integrates with campus infrastructure across three functional tiers:

1. Client Tier: Hardened Windows desktop application (`CortexLockdown-Hardened.exe`) utilizing WebView2, Win32 display affinity APIs, and low-level keyboard hooks.
2. Gateway Tier: Node.js / Express or Edge API routes providing launch grant signing, LTI 1.3 token verification, anti-SSRF filtering, and rate limiting.
3. Persistence Tier:
   - Primary Evaluation / Pilot Storage: Local SQLite with Write-Ahead Logging (WAL) and `busy_timeout = 5000ms`.
   - Planned Multi-Tenant Production Storage: Distributed PostgreSQL with row-level locking (`SELECT FOR UPDATE`), advisory locks, and transactional CAS.
   - Cloudflare D1: Classified as NOT TESTED for live institutional deployment.

---

## 2. LTI 1.3 Advantage Integration (Pilot Qualified)

Cortex Lockdown is rated PILOT QUALIFIED for LTI 1.3 Core, Assignment and Grade Services (AGS), and Names and Role Provisioning Services (NRPS).

### Institutional LMS Registration Parameters

To configure Cortex Lockdown within Canvas, Blackboard, or Moodle, register the tool with the following metadata:

* Tool Name: Cortex Lockdown Secure Assessment
* Target Link URI: `https://[CAMPUS_HOST]/api/lockdown/lti/launch`
* OpenID Connect (OIDC) Initiation URL: `https://[CAMPUS_HOST]/api/lockdown/lti/login`
* Public Keys URL (JWKS): `https://[CAMPUS_HOST]/api/lockdown/lti/jwks`
* Supported Message Types: `LtiResourceLinkRequest`, `LtiDeepLinkingRequest`
* Scope Requirements:
  - `https://purl.imsglobal.org/spec/lti-ags/scope/score`
  - `https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly`
  - `https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly`

### Platform Registration Configuration File (`lti-platforms.json`)

Configure trusted LMS platforms in the gateway configuration:

```json
{
  "platforms": {
    "https://canvas.institution.edu": {
      "issuer": "https://canvas.institution.edu",
      "clientId": "10000000000042",
      "authLoginUrl": "https://canvas.institution.edu/api/lti/authorize_redirect",
      "authTokenUrl": "https://canvas.institution.edu/login/oauth2/token",
      "keySetUrl": "https://canvas.institution.edu/api/lti/security/jwks",
      "deploymentIds": ["dept_engineering_01", "dept_science_02"],
      "enabled": true
    }
  }
}
```

### SSRF Protection and JWKS Security

All dynamic JWKS queries from `LtiJwksResolver` execute under strict SSRF validation:

* Protocol Enforcement: Only `https:` endpoints are permitted.
* Address Screening: Rejects loopback (`127.0.0.0/8`, `::1`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), CGNAT (`100.64.0.0/10`), link-local (`169.254.0.0/16`, `fe80::/10`), IPv4-mapped IPv6 (`::ffff:...`), and cloud metadata IP addresses (`169.254.169.254`, `100.100.100.200`, `fd00:ec2::254`).
* Multi-Record DNS Defense: If a hostname resolves to multiple A/AAAA records, any single private/loopback record causes the entire resolution to be rejected (`LTI_SSRF_DNS_REBINDING_BLOCKED`).
* Unknown Key Throttling: Key resolution for unknown `kid` identifiers is throttled to at most one outbound fetch per 60 seconds (`LTI_JWKS_REFRESH_RATE_LIMITED`).
* Connection-Level Pinning: In multi-tenant cloud environments, outbound socket pinning or dedicated egress proxies should be deployed to prevent DNS rebinding during HTTP connect phases.

---

## 3. SAML 2.0 Identity Provider Policy (Federation BLOCKED)

IMPORTANT ARCHITECTURAL ADVISORY:
Production SAML 2.0 Identity Provider federation is designated BLOCKED for Release Candidate 1.

### Technical Rationale for Blocked Status

* While Cortex Lockdown enforces signature verification, assertion replay protection, and XML Signature Wrapping (XSW 1-8) mitigations, its XML canonicalization utilizes a restricted, deterministic subset rather than a fully conformant W3C Exclusive XML Canonicalization (C14N) engine.
* Production SAML federations (such as InCommon, EduGAIN, or Shibboleth multi-IdP meshes) utilize arbitrary whitespace interleaving, dynamic namespace inheritance, and complex XMLDSig transform structures that can cause signature mismatch or evasion.
* Permitted SAML Usage: Synthetic academic testing, single-tenant bilateral IdP integration with strict element normalization, and isolated demonstration environments only.

---

## 4. Database Configuration and Concurrency Maintenance

### SQLite Production Hardening (Local / Single Node)

When hosting the examination gateway on a single server or institutional VM:

1. Journal Mode: Enforce WAL mode (`PRAGMA journal_mode = WAL;`).
2. Busy Timeout: Enforce 5000ms (`PRAGMA busy_timeout = 5000;`) to prevent `SQLITE_BUSY` exceptions during concurrent student check-ins.
3. Synchronous Mode: Set `PRAGMA synchronous = NORMAL;` for high throughput with filesystem safety.
4. Auto-Vacuum: Enable incremental vacuuming to prevent database file bloat.

### Audit Log Integrity and Checkpoint Signing

The audit logging subsystem creates sequential hash-chained records (`GENESIS_LOCKDOWN_AUDIT_BLOCK_000000` -> `H_1` -> `H_2` ...).

Administrators should execute regular cryptographic checkpoint verification:

```typescript
const result = await classroomDb.verifyAuditLogCheckpoints({
  keyring: {
    k1: process.env.CORTEX_AUDIT_KEY_V1,
    k2: process.env.CORTEX_AUDIT_KEY_V2
  }
});
if (!result.valid) {
  console.error(`Audit log integrity alert: ${result.reason}`);
}
```

---

## 5. Environment Variables Reference

* `PORT`: HTTP port for exam gateway (default: 3000).
* `NODE_ENV`: Set to `production` or `test`.
* `LOCKDOWN_SECRET`: 64-character hex string for HMAC launch grant and receipt signing.
* `LOCKDOWN_AUDIT_SECRET`: 32-character or longer secret for audit checkpoint signatures.
* `CORTEX_STORAGE_DIR`: Path to persistent database directory (default: `./data`).
* `CORTEX_LMS_JWKS_CACHE_TTL_MS`: JWKS in-memory cache time-to-live (default: 3600000 [1 hour]).
