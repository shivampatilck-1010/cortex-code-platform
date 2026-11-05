# CORTEX ONLINE EXAMINATION SYSTEM
# FINAL PRODUCTION RELEASE & DEPLOYMENT PLAN

**Target Production Worker**: `cortex-code-platform`  
**Production URL**: `https://cortex-code-platform.cortexbuild1.workers.dev`  
**Target Production D1**: `cortex-db` (`f756374b-0e9b-4112-b502-b703788dd86f`)  
**Current Active Version**: `7d8b2f0a-053c-4159-ad0a-e954df8549cb`  
**Date**: 2026-10-31  
**Status**: PREPARED & PENDING HUMAN AUTHORIZATION (Strictly Zero Emojis)

---

## 1. Preflight Deployment Verification

Prior to executing production deployment commands, verify the following baseline conditions:
1. `npm run lint` (`tsc --noEmit`) passes with 0 errors.
2. Full lifecycle regression suite (`scripts/test-phase4-11-full-regression.ts`) passes with 29/29 assertions.
3. No uncommitted modifications to unauthorized files exist in Git.

---

## 2. Sequential Production Deployment Steps (Upon Authorization)

### Step 1: Production D1 Pre-Deployment Backup
Export full schema and records to a timestamped backup archive:
```powershell
npx tsx scripts/run-production-backup.ts
```
Verify the generated SQL backup file size ($> 3.5\text{MB}$) and calculate SHA-256 checksum.

### Step 2: Production Database Migration Execution
Apply any pending database migrations to production `cortex-db`:
```powershell
npx wrangler d1 migrations apply cortex-db --remote
```
Confirm 0 errors and verify migration table records.

### Step 3: Production Cloudflare Worker Deployment
Deploy the validated application bundle to the production Cloudflare Worker:
```powershell
node scripts/deploy-production.mjs
```
Record the newly issued Cloudflare Worker version ID.

### Step 4: Post-Deployment Smoke Test
Execute the non-destructive production smoke verification:
```powershell
$env:TEST_TARGET_URL="https://cortex-code-platform.cortexbuild1.workers.dev"
npx tsx scripts/test-phase4-production-smoke.ts --allow-production
```
Verify:
- Public health probe returns HTTP 200 in $< 500\text{ms}$.
- Authentication cookies issue correctly.
- Synthetic smoke test entities are cleanly purged post-verification.

### Step 5: Rollback Contingency Trigger
If any post-deployment check fails:
```powershell
npx wrangler rollback --version 7d8b2f0a-053c-4159-ad0a-e954df8549cb
```
This restores the previously verified stable version in $< 5\text{ seconds}$.
