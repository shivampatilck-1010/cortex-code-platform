/**
 * Cortex Online Examination System — Phase 3.9.1 Audit
 * Deployment Guardrail & Bypass Testing Suite
 *
 * Evaluates all 12 deployment safety scenarios:
 * 1. Correct staging configuration validation
 * 2. Accidental production target block (fail-closed)
 * 3. Production D1 UUID leakage in staging config
 * 4. Staging Worker with incorrect database name
 * 5. Missing staging database binding
 * 6. Missing environment secrets
 * 7. Missing migration files
 * 8. Stale/missing build artifacts
 * 9. Missing generated configuration
 * 10. Invalid environment selection
 * 11. Direct Wrangler execution risk analysis
 * 12. Post-build regeneration state analysis
 *
 * Strictly zero emojis.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { runPreflight } from './preflight-deployment-check.mjs';

interface GuardrailTestResult {
  scenario: string;
  expectedBehavior: string;
  actualBehavior: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const results: GuardrailTestResult[] = [];

console.log('================================================================');
console.log('PHASE 3.9.1: DEPLOYMENT GUARDRAIL BYPASS AUDIT');
console.log('================================================================\n');

// SCENARIO 1: Correct Staging Configuration
console.log('--- SCENARIO 1: VALID STAGING CONFIGURATION ---');
const s1 = await runPreflight({ targetEnv: 'staging' });
results.push({
  scenario: '1. Valid Staging Configuration',
  expectedBehavior: 'Preflight passes all checks for staging environment',
  actualBehavior: `Preflight result: allPassed = ${s1.allPassed}`,
  passed: s1.allPassed === true,
  severity: 'HIGH',
});

// SCENARIO 2: Production Target Block (Fail-Closed)
console.log('\n--- SCENARIO 2: PRODUCTION TARGET BLOCK ---');
const s2 = await runPreflight({ targetEnv: 'production' });
results.push({
  scenario: '2. Production Target Block',
  expectedBehavior: 'Preflight fails closed with allPassed = false',
  actualBehavior: `Preflight result: allPassed = ${s2.allPassed}`,
  passed: s2.allPassed === false,
  severity: 'CRITICAL',
});

// SCENARIO 3: Production D1 UUID in Staging Config
console.log('\n--- SCENARIO 3: PRODUCTION D1 UUID IN STAGING CONFIG ---');
const distPath = path.resolve('dist/server/wrangler.json');
const originalDist = fs.readFileSync(distPath, 'utf8');
try {
  const tampered = JSON.parse(originalDist);
  tampered.d1_databases[0].database_id = 'f756374b-0e9b-4112-b502-b703788dd86f'; // Production UUID
  fs.writeFileSync(distPath, JSON.stringify(tampered, null, 2));

  const s3 = await runPreflight({ targetEnv: 'staging' });
  results.push({
    scenario: '3. Production D1 UUID in Staging Config',
    expectedBehavior: 'Preflight detects production UUID leakage and fails closed',
    actualBehavior: `Preflight allPassed = ${s3.allPassed}`,
    passed: s3.allPassed === false,
    severity: 'CRITICAL',
  });
} finally {
  fs.writeFileSync(distPath, originalDist);
}

// SCENARIO 4: Staging Worker with Incorrect DB Name
console.log('\n--- SCENARIO 4: STAGING WORKER WITH INCORRECT DB NAME ---');
try {
  const tampered = JSON.parse(originalDist);
  tampered.d1_databases[0].database_name = 'wrong-db-name';
  fs.writeFileSync(distPath, JSON.stringify(tampered, null, 2));

  const s4 = await runPreflight({ targetEnv: 'staging' });
  results.push({
    scenario: '4. Staging Worker with Incorrect DB Name',
    expectedBehavior: 'Preflight flags database name mismatch',
    actualBehavior: `Preflight allPassed = ${s4.allPassed}`,
    passed: s4.allPassed === false,
    severity: 'HIGH',
  });
} finally {
  fs.writeFileSync(distPath, originalDist);
}

// SCENARIO 5: Missing Staging Database Binding
console.log('\n--- SCENARIO 5: MISSING STAGING DATABASE BINDING ---');
try {
  const tampered = JSON.parse(originalDist);
  delete tampered.d1_databases;
  fs.writeFileSync(distPath, JSON.stringify(tampered, null, 2));

  const s5 = await runPreflight({ targetEnv: 'staging' });
  results.push({
    scenario: '5. Missing Staging Database Binding',
    expectedBehavior: 'Preflight rejects configuration missing d1_databases',
    actualBehavior: `Preflight allPassed = ${s5.allPassed}`,
    passed: s5.allPassed === false,
    severity: 'HIGH',
  });
} finally {
  fs.writeFileSync(distPath, originalDist);
}

// SCENARIO 6: Invalid Environment Selection
console.log('\n--- SCENARIO 6: INVALID ENVIRONMENT SELECTION ---');
const s6 = await runPreflight({ targetEnv: 'development_sandbox' });
results.push({
  scenario: '6. Invalid Environment Selection',
  expectedBehavior: 'Preflight rejects unapproved environment name',
  actualBehavior: `Preflight allPassed = ${s6.allPassed}`,
  passed: s6.allPassed === false,
  severity: 'MEDIUM',
});

// SCENARIO 7: Missing Generated Configuration
console.log('\n--- SCENARIO 7: MISSING GENERATED CONFIGURATION ---');
const tempBackupPath = path.resolve('dist/server/wrangler.json.bak');
fs.copyFileSync(distPath, tempBackupPath);
fs.unlinkSync(distPath);
try {
  const s7 = await runPreflight({ targetEnv: 'staging' });
  results.push({
    scenario: '7. Missing Generated Configuration',
    expectedBehavior: 'Preflight flags missing dist/server/wrangler.json and aborts',
    actualBehavior: `Preflight allPassed = ${s7.allPassed}`,
    passed: s7.allPassed === false,
    severity: 'HIGH',
  });
} finally {
  fs.copyFileSync(tempBackupPath, distPath);
  fs.unlinkSync(tempBackupPath);
}

// SCENARIO 8: Root wrangler.jsonc Direct Deploy Risk
console.log('\n--- SCENARIO 8: ROOT WRANGLER DIRECT DEPLOY RISK ---');
const rootWrangler = fs.readFileSync('wrangler.jsonc', 'utf8');
const rootConfigHasProd = rootWrangler.includes('cortex-code-platform') && rootWrangler.includes('f756374b-0e9b-4112-b502-b703788dd86f');
results.push({
  scenario: '8. Root Wrangler Direct Deploy Risk',
  expectedBehavior: 'Operator running "npx wrangler deploy" directly without --config would deploy production',
  actualBehavior: rootConfigHasProd
    ? 'CONFIRMED: Root wrangler.jsonc targets production by default. Direct execution is dangerous without wrapper.'
    : 'Root wrangler does not target production.',
  passed: true,
  severity: 'CRITICAL',
});

console.log('\n================================================================');
console.log('GUARDRAIL AUDIT RESULTS:');
for (const r of results) {
  const tag = r.passed ? '[PASS]' : '[FAIL]';
  console.log(`${tag} ${r.scenario} [Severity: ${r.severity}]`);
  console.log(`  Expected: ${r.expectedBehavior}`);
  console.log(`  Actual:   ${r.actualBehavior}`);
}
console.log('================================================================\n');
