# Cortex Online Examination System — Phase 3.9 Deployment & Release Runbook

## 1. Purpose, Scope & Strict Production Restriction Notice

This runbook provides the definitive operational procedures for deploying, verifying, monitoring, and rolling back releases of the **Cortex Online Examination System**.

> [!WARNING]
> **STRICT PRODUCTION RESTRICTION NOTICE**:
> Production deployment is strictly **PROHIBITED** in Phase 3.9. No deployment commands may target the production Worker (`cortex-code-platform`) or production database (`cortex-db`). All deployment workflows, migrations, and release verifications in this phase must target the isolated **Staging Environment** exclusively.

---

## 2. Environment Configuration Matrix

| Environment Parameter | Staging Environment (Authorized) | Production Environment (STRICTLY RESTRICTED) |
| :--- | :--- | :--- |
| **Worker Service Name** | `cortex-code-platform-staging` | `cortex-code-platform` |
| **Deployment URL** | `https://cortex-code-platform-staging.cortexbuild1.workers.dev` | `https://cortex-code-platform.cortexbuild1.workers.dev` |
| **Cloudflare D1 Name** | `cortex-staging-db` | `cortex-db` |
| **Cloudflare D1 UUID** | `e6375738-d9b2-4c5a-a3e5-3a34e892f49d` | `f756374b-0e9b-4112-b502-b703788dd86f` |
| **Target Config File** | `dist/server/wrangler.json` (rewritten for staging) | `wrangler.jsonc` (base production) |
| **Durable Objects Namespace** | `LIVE_CLASSROOM` (Staging isolate) | `LIVE_CLASSROOM` (Production isolate) |
| **Preflight Command** | `node scripts/preflight-deployment-check.mjs --env=staging` | `node scripts/preflight-deployment-check.mjs --env=production` (Fails closed) |

---

## 3. Deployment Safety Tooling: Preflight Check

The preflight verifier (`scripts/preflight-deployment-check.mjs`) is a mandatory gatekeeper. It must be executed before every deployment attempt:

### Guardrails Enforced:
1. **Target Verification**: Validates whether the deployment is targeting `staging` or `production`.
2. **Production Fail-Closed Gate**: Blocks execution with exit code 1 if targeting production without explicit overrides.
3. **Database UUID Cross-Matching**: Detects and aborts if `dist/server/wrangler.json` references the production database UUID `f756374b-0e9b-4112-b502-b703788dd86f` while deploying to staging.
4. **Migration Sequence Audit**: Verifies that all 9 migrations (`0001` through `0009`) exist on disk and follow numerical ordering.
5. **Artifact Completeness**: Confirms that `dist/client` and `dist/server` contain complete build assets.
6. **Required Secrets**: Validates presence of necessary environment configuration flags.

```bash
# Execute staging preflight check:
node scripts/preflight-deployment-check.mjs --env=staging
```

---

## 4. Staging Deployment Execution Runbook

Follow these sequential steps in order:

### Step 1: Pre-Deployment Safety & Git Status Check
Ensure the workspace is clean and no unexpected files are present:
```bash
git status --short
```

### Step 2: Create Pre-Deployment Authoritative Backup
Ensure a snapshot is archived before any changes:
```bash
npx tsx -e "
import { CortexBackupManager } from './scripts/cortex-db-backup.ts';
const mgr = new CortexBackupManager('./backups');
mgr.createBackup({ sourceDbPath: 'cortex-staging-db', environment: 'staging', backupType: 'pre_deployment' });
"
```

### Step 3: Compile Staging Build Assets
```bash
npm run build:vinext
```

### Step 4: Prepare Staging Configuration Artifact
The default build targets production. Run the preparation script to adapt `dist/server/wrangler.json` for staging:
```bash
node scripts/prepare-staging-wrangler.mjs
```

### Step 5: Run Preflight Verification Gate
```bash
node scripts/preflight-deployment-check.mjs --env=staging
```
*If preflight exits with any failure or non-zero exit code, STOP immediately.*

### Step 6: Apply Database Migrations to Staging D1
```bash
npx wrangler d1 migrations apply cortex-staging-db --remote
```

### Step 7: Deploy Staging Worker
```bash
npx wrangler deploy --config dist/server/wrangler.json
```

### Step 8: Post-Deployment Smoke Verification & Health Probe
Execute health probe against the deployed staging endpoint:
```bash
curl -s https://cortex-code-platform-staging.cortexbuild1.workers.dev/api/v1/health | jq .
```
Verify:
* `status` is `"healthy"`.
* `database.status` is `"healthy"`.
* `database.latencyMs` is `< 100ms`.
* `environment` is `"staging"`.

Run automated staging regression test:
```bash
npx tsx scripts/test-phase3-6-staging-validation.ts
```

---

## 5. Rollback Runbooks

In the event of an unexpected regression, latency spike, or functional defect during release, follow these rollback procedures:

### Runbook A: Worker Application Code Rollback
Cloudflare Workers supports instant rollback to prior active deployments:

1. **List Recent Deployments**:
   ```bash
   npx wrangler deployments list --config dist/server/wrangler.json
   ```
2. **Execute Instant Rollback**:
   ```bash
   npx wrangler rollback [DEPLOYMENT_ID] --config dist/server/wrangler.json
   ```
   *Rollback takes effect globally across Cloudflare edge nodes in < 15 seconds.*

3. **Verify Health**:
   ```bash
   curl -s https://cortex-code-platform-staging.cortexbuild1.workers.dev/api/v1/health
   ```

### Runbook B: Database Schema / State Rollback
1. **Identify Corruption or Regressed Timestamp**:
   Determine the exact UTC timestamp immediately prior to the failed deployment.
2. **Execute Cloudflare D1 Time-Travel Restore**:
   ```bash
   npx wrangler d1 time-travel restore cortex-staging-db --timestamp="YYYY-MM-DDTHH:MM:SSZ"
   ```
3. **Verify Foreign Keys & Data Consistency**:
   Execute integrity verification script to confirm zero orphaned records.

---

## 6. Production Promotion Prerequisites Checklist

Before Cortex can be authorized for a production deployment in future phases, all of the following gates must be formally satisfied and approved:

* [ ] 100% test pass rate across all 11 automated test suites.
* [ ] Zero high or critical severity vulnerabilities open in security audit.
* [ ] Cloudflare WAF rate limiting rules configured on production domain.
* [ ] Production `CORTEX_SESSION_SECRET` provisioned via `wrangler secret put` with >= 32 characters entropy.
* [ ] Dedicated monitoring dashboard and Slack/PagerDuty alert webhooks configured.
* [ ] Formal sign-off by Academic Operations and Lead Systems Architect.
* [ ] Initial production scope restricted to Track A (General Objective & Subjective Exams) with Track B (Programming) and Track C (Native SEB) held for subsequent phases.
