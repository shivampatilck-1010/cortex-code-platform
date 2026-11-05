# Cortex Online Examination System — Phase 3.9 Issues & Remediation Register

This register details all defects, security gaps, operational risks, and architectural issues identified, triaged, and remediated during **Phase 3.9: Production-Readiness Engineering**.

---

## Issue Summary Matrix

| Issue ID | Severity | Area | Status | Resolution | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-3.9-01** | High | Deployment Safety | Closed | Preflight verification script (`preflight-deployment-check.mjs`) | `test-phase3-9-deployment-preflight.ts` |
| **ISSUE-3.9-02** | High | Security / Auth | Closed | In-memory sliding window rate limiter & progressive account lockout | `test-phase3-9-security-hardening.ts` |
| **ISSUE-3.9-03** | High | Security / Auth | Closed | Production fail-closed secret validation (>= 32 chars) | `ClassroomAuth.getLiveSessionSigningSecret()` |
| **ISSUE-3.9-04** | Medium | Observability | Closed | Production health probe (`/api/v1/health`) & `getHealthStats()` | `test-phase3-9-monitoring-health.ts` |
| **ISSUE-3.9-05** | Medium | Database Reliability | Closed | Automated backup manager with WAL flush & SHA-256 checksums | `test-phase3-9-backup-and-recovery.ts` |
| **ISSUE-3.9-06** | Medium | Observability | Closed | Structured JSON logger with recursive secret redaction | `CortexLogger` unit & integration tests |
| **ISSUE-3.9-07** | Low | Test Suite | Closed | Corrected `exam_integrity_events` schema alignment in test suite | Backup test suite re-execution |

---

## Detailed Issue Records

### ISSUE-3.9-01: Risk of Accidental Production Deployment and Binding Cross-Contamination
* **Category**: Infrastructure & Deployment Safety
* **Severity**: High
* **Description**:
  When `npm run build:vinext` compiles the project, it creates `dist/server/wrangler.json` mirroring the root `wrangler.jsonc`. By default, this generated file targeted the production worker (`cortex-code-platform`) and production database (`cortex-db`). Although a helper script `prepare-staging-wrangler.mjs` modified this file for staging, there was no automated verification gate preventing an operator from accidentally deploying staging code to production or deploying to staging with a production database binding.
* **Root Cause**: Build tools generate default production artifacts without an automated verification gate prior to deployment.
* **Remediation**:
  Authored `scripts/preflight-deployment-check.mjs`. The script validates:
  1. Target environment (`staging` vs `production`).
  2. Production deployment fail-closed block (strictly prohibits production deploy).
  3. Staging configuration integrity (ensures worker is `cortex-code-platform-staging` and D1 is `cortex-staging-db` with UUID `e6375738-d9b2-4c5a-a3e5-3a34e892f49d`).
  4. Cross-environment leakage detection (explicitly flags if staging points to production database UUID `f756374b-0e9b-4112-b502-b703788dd86f`).
  5. Sequential migration completeness (verifies migrations `0001` through `0009`).
* **Verification**:
  Executed `scripts/test-phase3-9-deployment-preflight.ts`. Staging preflight passed; production preflight cleanly failed closed with exit code 1.

---

### ISSUE-3.9-02: Absence of Rate Limiting and Brute-Force Lockout on Authentication Endpoints
* **Category**: Authentication Security
* **Severity**: High
* **Description**:
  The `/api/v1/auth/login` endpoint lacked request throttling, allowing potential attackers to execute dictionary brute-force attacks or credential stuffing without rate-based restriction.
* **Root Cause**: Authentication route relied solely on downstream password hash verification without edge or in-memory throttling.
* **Remediation**:
  Implemented `InMemoryRateLimiter` (`src/lib/classroom/rate-limiter.ts`):
  1. Sliding window request limiter: Client IP restricted to 20 login attempts per 60 seconds (HTTP 429 Too Many Requests with `Retry-After`).
  2. Progressive target account lockout: 5 consecutive failed attempts lock the account for 60 seconds; 10 consecutive failed attempts lock the account for 15 minutes.
  3. Failure counter reset upon successful authentication.
  4. Memory pruning mechanism to remove expired timestamps and avoid memory leaks.
* **Verification**:
  Verified through `scripts/test-phase3-9-security-hardening.ts`. Exceeded rate limits returned 429; progressive lockout triggered after 5 and 10 failures; success cleared lockout.

---

### ISSUE-3.9-03: Insecure Development Secret Fallback Risk in Production
* **Category**: Cryptographic Secrets Management
* **Severity**: High
* **Description**:
  In `ClassroomAuth.getLiveSessionSigningSecret()`, if `CORTEX_SESSION_SECRET` was not provided, the code fell back to a default hardcoded development secret. If deployed to production without the secret configured, the platform would use the insecure fallback.
* **Root Cause**: Lenient fallback logic intended for development convenience was active across all execution contexts.
* **Remediation**:
  Hardened `ClassroomAuth.getLiveSessionSigningSecret()` in `src/lib/classroom/auth.ts`:
  ```typescript
  if (isProd) {
    if (!secret || typeof secret !== 'string' || secret.trim().length < 32) {
      throw new Error('[ClassroomAuth] FATAL: Production environment requires CORTEX_SESSION_SECRET of at least 32 characters.');
    }
    return secret.trim();
  }
  ```
* **Verification**:
  Verified through `test-phase3-9-deployment-preflight.ts` and unit checks.

---

### ISSUE-3.9-04: Lack of Comprehensive Production Health Probe
* **Category**: Operational Observability
* **Severity**: Medium
* **Description**:
  External uptime monitoring services (e.g. BetterStack, Datadog) had no endpoint to verify database connectivity, measure query latency, or inspect runtime state.
* **Root Cause**: Endpoints were limited to application business logic without dedicated monitoring probes.
* **Remediation**:
  1. Added `getHealthStats()` to `ClassroomDatabase` in `src/lib/classroom/db/index.ts`, executing lightweight count queries on `users`, `exams`, and `exam_sessions`.
  2. Authored `src/app/api/v1/health/route.ts` returning HTTP 200 with JSON payload reporting `status: healthy`, `database: healthy`, `totalLatencyMs`, `environment`, and operational counts. If database fails, returns HTTP 503 `status: unhealthy`.
* **Verification**:
  Verified via `scripts/test-phase3-9-monitoring-health.ts` (17/17 assertions passed, probe latency 1ms).

---

### ISSUE-3.9-05: Absence of Automated Database Backup, Checkpointing & Recovery Tooling
* **Category**: Database Reliability & Disaster Recovery
* **Severity**: Medium
* **Description**:
  There was no standardized script or mechanism to perform WAL checkpoints, atomic file copies, SHA-256 integrity verification, or isolated restoration.
* **Root Cause**: Backup procedures had been performed ad-hoc or manually.
* **Remediation**:
  Authored `CortexBackupManager` (`scripts/cortex-db-backup.ts`):
  1. WAL flush via `PRAGMA wal_checkpoint(TRUNCATE)`.
  2. Atomic copy to timestamped archive.
  3. SHA-256 cryptographic digest calculation and `.meta.json` manifest generation.
  4. Integrity verification via `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
  5. Isolated restoration into clean target.
  6. Automatic backup retention pruning.
* **Verification**:
  Verified via `scripts/test-phase3-9-backup-and-recovery.ts` (32/32 assertions passed; RTO measured at 5ms).

---

### ISSUE-3.9-06: Unredacted Logging Risk in Application Observability
* **Category**: Data Protection & Privacy
* **Severity**: Medium
* **Description**:
  Standard `console.log` statements throughout API routes could inadvertently serialize credentials, authentication tokens, or student answer keys into log aggregation systems.
* **Root Cause**: Absence of an application-wide structured logger with data redaction filters.
* **Remediation**:
  Authored `CortexLogger` (`src/lib/classroom/logger.ts`) with `redactSensitiveData()`:
  * Masks 18 sensitive key patterns (`password`, `token`, `secret`, `seb_quit_password`, `correct_answer_json`, etc.) with `"[REDACTED]"`.
  * Sanitizes Bearer authorization headers via regex.
  * Formats logs as JSON with ISO timestamps, log level, correlation IDs, and execution latency.
* **Verification**:
  Verified in `scripts/test-phase3-9-security-hardening.ts` (100% of sensitive fields redacted).

---

### ISSUE-3.9-07: Schema Column Mismatch in Integrity Event Insertion
* **Category**: Test Infrastructure
* **Severity**: Low
* **Description**:
  During test suite authoring, `test-phase3-9-backup-and-recovery.ts` attempted to insert into `exam_integrity_events` with separate columns `severity`, `client_timestamp`, and `server_timestamp`, which caused an SQLite logic error because the schema defines `(id, session_id, event_type, timestamp, details_json)`.
* **Root Cause**: Test code referenced an earlier prototype schema instead of the canonical migration schema in `0004_online_examination_system.sql`.
* **Remediation**:
  Updated the test SQL insert statement to store `severity` and proctor actions inside the structured `details_json` column.
* **Verification**:
  Re-ran `test-phase3-9-backup-and-recovery.ts` with 32/32 clean passes.
