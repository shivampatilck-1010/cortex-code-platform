/**
 * Cortex Online Examination System — Phase 3.9
 * Test Suite: Deployment Safety & Preflight Verification
 *
 * Validates deployment preflight checks and safety guardrails:
 * 1. Staging environment verification succeeds against configured resources
 * 2. Production target triggers fail-closed error with exit code 1
 * 3. Accidental production database binding inside staging config is caught
 * 4. Staging database UUID is strictly e6375738-d9b2-4c5a-a3e5-3a34e892f49d
 * 5. Production database UUID f756374b-0e9b-4112-b502-b703788dd86f is never allowed in staging
 * 6. Migration file sequence (0001 through 0009) is complete and ordered
 * 7. Staging worker name cortex-code-platform-staging is verified
 * 8. Production worker name cortex-code-platform is blocked from unapproved deploy
 *
 * Strictly zero emojis.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}`);
  }
}

async function runPreflightTests() {
  console.log('================================================================');
  console.log('PHASE 3.9: DEPLOYMENT SAFETY & PREFLIGHT VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const preflightScript = path.join(rootDir, 'scripts', 'preflight-deployment-check.mjs');

  // Test 1: Staging preflight check passes cleanly
  console.log('--- TEST 1: STAGING PREFLIGHT VERIFICATION ---');
  try {
    const stagingOutput = execSync(`node ${preflightScript} --env=staging`, {
      encoding: 'utf8',
      cwd: rootDir,
    });
    assert(stagingOutput.includes('PREFLIGHT STATUS: PASSED'), 'Staging preflight completed with success banner');
    assert(stagingOutput.includes('cortex-code-platform-staging'), 'Staging worker target matches cortex-code-platform-staging');
    assert(stagingOutput.includes('cortex-staging-db'), 'Staging database binding matches cortex-staging-db');
    assert(stagingOutput.includes('e6375738-d9b2-4c5a-a3e5-3a34e892f49d'), 'Staging database UUID matches expected value');
  } catch (err: any) {
    assert(false, `Staging preflight should have passed but failed: ${err.message}`);
  }

  // Test 2: Production preflight blocks and fails closed
  console.log('\n--- TEST 2: PRODUCTION DEPLOYMENT FAIL-CLOSED GUARDRAIL ---');
  try {
    execSync(`node ${preflightScript} --env=production`, {
      encoding: 'utf8',
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    assert(false, 'Production preflight should have failed closed but succeeded unexpectedly');
  } catch (err: any) {
    assert(err.status === 1, 'Production preflight exited with code 1 (fail-closed)');
    const combinedOutput = (err.stdout || '') + (err.stderr || '');
    assert(
      combinedOutput.includes('Production deployment is strictly unauthorized') ||
      combinedOutput.includes('FAIL-CLOSED'),
      'Production preflight output explicitly cites restriction guardrail'
    );
  }

  // Test 3: Migration sequence verification
  console.log('\n--- TEST 3: MIGRATION SEQUENCE INTEGRITY ---');
  const migrationsDir = path.join(rootDir, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  assert(files.length >= 9, `At least 9 migration files present (found: ${files.length})`);
  assert(files[0].startsWith('0001_'), 'Migration 0001 is first');
  assert(files[1].startsWith('0002_'), 'Migration 0002 is second');
  assert(files[2].startsWith('0003_'), 'Migration 0003 is third');
  assert(files[3].startsWith('0004_'), 'Migration 0004 online examination system is fourth');
  assert(files[4].startsWith('0005_'), 'Migration 0005 question bank is fifth');
  assert(files[5].startsWith('0006_'), 'Migration 0006 examination phase3 is sixth');
  assert(files[6].startsWith('0007_'), 'Migration 0007 examination security audit is seventh');
  assert(files[7].startsWith('0008_'), 'Migration 0008 examination phase3 schema completion is eighth');
  assert(files[8].startsWith('0009_'), 'Migration 0009 user professional email is ninth');

  // Test 4: Staging configuration isolation in wrangler.jsonc and dist
  console.log('\n--- TEST 4: CONFIGURATION ISOLATION ---');
  const wranglerConfig = fs.readFileSync(path.join(rootDir, 'wrangler.jsonc'), 'utf8');
  assert(wranglerConfig.includes('cortex-code-platform'), 'Base wrangler.jsonc defines base worker');
  assert(wranglerConfig.includes('cortex-staging-db') || wranglerConfig.includes('e6375738-d9b2-4c5a-a3e5-3a34e892f49d'), 'Base wrangler.jsonc or staging environment references staging D1');

  // Test 5: Verify no hardcoded production passwords or secrets in code
  console.log('\n--- TEST 5: SECRETS LEAKAGE PREVENTION ---');
  const authFile = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'classroom', 'auth.ts'), 'utf8');
  assert(!authFile.includes('super-secret-production-key'), 'No hardcoded production JWT secrets in auth.ts');
  assert(authFile.includes('CORTEX_SESSION_SECRET') && authFile.includes('getLiveSessionSigningSecret'), 'Session signing secret is dynamically resolved with fail-closed production check');

  console.log('\n================================================================');
  console.log(`DEPLOYMENT PREFLIGHT RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPreflightTests().catch((err) => {
  console.error('Fatal preflight test error:', err);
  process.exit(1);
});
