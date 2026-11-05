# Cortex Online Examination System — Phase 3.9.1 Deployment Guardrail Audit

## 1. Executive Summary & Audit Scope

This audit evaluates the deployment guardrails and preflight safety verification tooling of the **Cortex Online Examination System**.

It analyzes configuration generation by Vinext (`dist/server/wrangler.json`), environment bindings, root `wrangler.jsonc`, and potential bypass vectors where an operator or CI pipeline could inadvertently deploy staging code to production or leak production database bindings into staging.

---

## 2. Tested Deployment Scenarios & Empirical Evidence

The automated audit script `scripts/audit-phase3-9-1-deployment-guardrail.ts` tested 8 critical deployment safety scenarios:

| # | Scenario | Severity | Expected Behavior | Actual Behavior | Result |
| :---: | :--- | :---: | :--- | :--- | :---: |
| 1 | **Valid Staging Configuration** | HIGH | Preflight passes all checks | `allPassed = true` | PASS |
| 2 | **Production Target Block** | CRITICAL | Fails closed with error | `allPassed = false` (Code 1) | PASS |
| 3 | **Production UUID in Staging Config** | CRITICAL | Detects UUID cross-leakage | Fails closed: Security violation flagged | PASS |
| 4 | **Staging DB Name Mismatch** | HIGH | Flags database name mismatch | Fails closed: Mismatch reported | PASS |
| 5 | **Missing Database Binding** | HIGH | Flags missing binding | Fails closed: Missing DB flagged | PASS |
| 6 | **Invalid Environment Argument** | MEDIUM | Rejects unknown environment | Fails closed: Rejects invalid env | PASS |
| 7 | **Missing Generated Config** | HIGH | Aborts if `dist/server` missing | Fails closed: Missing artifact flagged | PASS |
| 8 | **Root Wrangler Direct Deploy Risk** | CRITICAL | Evaluates risk of bare `wrangler deploy` | Confirmed: Root config defaults to production | **IDENTIFIED RISK** |

---

## 3. Critical Architectural Finding: Root Wrangler Direct Invocation Risk

### Root Cause Analysis
* **Root Configuration**: `wrangler.jsonc` defines the base production worker:
  * Worker: `cortex-code-platform`
  * D1 Binding: `cortex-db` (UUID `f756374b-0e9b-4112-b502-b703788dd86f`)
* **Vinext Artifact Generation**: When `npm run build:vinext` runs, it generates `dist/server/wrangler.json` mirroring the root `wrangler.jsonc`.
* **Staging Adaptation**: `scripts/prepare-staging-wrangler.mjs` mutates `dist/server/wrangler.json` to point to `cortex-code-platform-staging` and `cortex-staging-db` (UUID `e6375738-d9b2-4c5a-a3e5-3a34e892f49d`).
* **Vulnerability / Human Error Vector**:
  If an operator runs `npx wrangler deploy` directly from the terminal without passing `--config dist/server/wrangler.json`, Wrangler defaults to reading `wrangler.jsonc`, which targets **PRODUCTION**.

---

## 4. Required Remediation in Phase 3.9.2

1. **Atomic Deployment Wrapper (`scripts/deploy-staging.mjs`)**:
   Implement a wrapper that automatically executes:
   - Staging config verification (`scripts/prepare-staging-wrangler.mjs`)
   - Preflight guardrail verification (`scripts/preflight-deployment-check.mjs --env=staging`)
   - Mandatory parameter binding: passes `--config dist/server/wrangler.json` to Wrangler.
2. **NPM Script Hardening**:
   Add `"deploy:staging": "node scripts/deploy-staging.mjs"` to `package.json`.
3. **Fail-Closed Production Stub**:
   Add a pre-deploy check or comment block in root `wrangler.jsonc` that halts direct production deployments without a specific `--env=production` flag and explicit authorization confirmation.
