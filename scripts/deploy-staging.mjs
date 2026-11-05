/**
 * Cortex Online Examination System — Staging Deployment Wrapper
 *
 * Guarantees that staging deployment is fail-closed, executes preflight verification,
 * validates generated configuration in dist/server/wrangler.json, and strictly disallows
 * accidental production target deployment.
 *
 * Strictly zero emojis.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runPreflight } from './preflight-deployment-check.mjs';

async function deployStaging() {
  console.log('================================================================');
  console.log('CORTEX STAGING DEPLOYMENT WRAPPER');
  console.log('================================================================\n');

  // Step 1: Prepare staging configuration in dist/server/wrangler.json
  console.log('[Step 1] Preparing staging configuration artifact...');
  const prepareScript = path.resolve('scripts', 'prepare-staging-wrangler.mjs');
  execSync(`node "${prepareScript}"`, { stdio: 'inherit' });

  // Step 2: Execute preflight verification for staging
  console.log('\n[Step 2] Executing deployment preflight safety checks...');
  const preflightResult = await runPreflight({ targetEnv: 'staging' });

  if (!preflightResult.allPassed) {
    console.error('\n[DEPLOYMENT ABORTED] Preflight safety verification failed. Review errors above.');
    process.exit(1);
  }

  // Step 3: Verify dist/server/wrangler.json content safety
  console.log('\n[Step 3] Hardening artifact check on dist/server/wrangler.json...');
  const distConfigPath = path.resolve('dist', 'server', 'wrangler.json');
  const distContent = fs.readFileSync(distConfigPath, 'utf8');
  const distConfig = JSON.parse(distContent);

  const EXPECTED_STAGING_WORKER = 'cortex-code-platform-staging';
  const EXPECTED_STAGING_DB_ID = 'e6375738-d9b2-4c5a-a3e5-3a34e892f49d';
  const FORBIDDEN_PROD_DB_ID = 'f756374b-0e9b-4112-b502-b703788dd86f';

  if (distConfig.name !== EXPECTED_STAGING_WORKER) {
    console.error(`FATAL: Worker name is '${distConfig.name}', expected '${EXPECTED_STAGING_WORKER}'.`);
    process.exit(1);
  }

  const d1 = distConfig.d1_databases?.[0];
  if (d1?.database_id === FORBIDDEN_PROD_DB_ID) {
    console.error(`FATAL SECURITY BLOCK: Artifact references PRODUCTION database UUID ${FORBIDDEN_PROD_DB_ID}.`);
    process.exit(1);
  }

  if (d1?.database_id !== EXPECTED_STAGING_DB_ID) {
    console.error(`FATAL: Database ID is '${d1?.database_id}', expected '${EXPECTED_STAGING_DB_ID}'.`);
    process.exit(1);
  }

  console.log('[PASS] Staging configuration verified. Target is safe to deploy.');

  // Step 4: Execute Wrangler deploy targeting dist/server/wrangler.json ONLY
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('\n[DRY RUN] Preflight passed. Deployment command:');
    console.log(`  npx wrangler deploy --config dist/server/wrangler.json`);
    console.log('Deployment dry run completed successfully.');
    return;
  }

  console.log('\n[Step 4] Executing deployment: npx wrangler deploy --config dist/server/wrangler.json...');
  execSync('npx wrangler deploy --config dist/server/wrangler.json', { stdio: 'inherit' });
  console.log('\n[DEPLOYMENT SUCCESSFUL] Cortex staging deployment complete.');
}

deployStaging().catch((err) => {
  console.error('\nFatal staging deployment wrapper error:', err.message);
  process.exit(1);
});
