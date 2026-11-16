/**
 * Cortex Online Examination System - Production Deployment Wrapper
 *
 * Guarantees that production deployment executes preflight safety checks,
 * validates dist/server/wrangler.json targets the production worker (cortex-code-platform)
 * and production database (cortex-db), and executes the deployment.
 *
 * Strictly zero emojis.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runPreflight } from './preflight-deployment-check.mjs';

async function deployProduction() {
  console.log('================================================================');
  console.log('CORTEX PRODUCTION DEPLOYMENT WRAPPER');
  console.log('================================================================\n');

  // Step 1: Prepare production configuration in dist/server/wrangler.json
  console.log('[Step 1] Preparing production configuration artifact...');
  const prepareScript = path.resolve('scripts', 'prepare-production-wrangler.mjs');
  execSync(`node "${prepareScript}"`, { stdio: 'inherit' });

  // Step 2: Execute preflight verification for production
  console.log('\n[Step 2] Executing deployment preflight safety checks...');
  const preflightResult = await runPreflight({ targetEnv: 'production', allowProduction: true });

  if (!preflightResult.allPassed) {
    console.error('\n[DEPLOYMENT ABORTED] Preflight safety verification failed. Review errors above.');
    process.exit(1);
  }

  // Step 3: Verify dist/server/wrangler.json content safety
  console.log('\n[Step 3] Hardening artifact check on dist/server/wrangler.json...');
  const distConfigPath = path.resolve('dist', 'server', 'wrangler.json');
  const distContent = fs.readFileSync(distConfigPath, 'utf8');
  const distConfig = JSON.parse(distContent);

  const EXPECTED_PROD_WORKER = 'cortex-code-platform';
  const EXPECTED_PROD_DB_ID = 'f756374b-0e9b-4112-b502-b703788dd86f';

  if (distConfig.name !== EXPECTED_PROD_WORKER) {
    console.error(`FATAL: Worker name is '${distConfig.name}', expected '${EXPECTED_PROD_WORKER}'.`);
    process.exit(1);
  }

  const d1 = distConfig.d1_databases?.[0];
  if (d1?.database_id !== EXPECTED_PROD_DB_ID) {
    console.error(`FATAL: Database ID is '${d1?.database_id}', expected '${EXPECTED_PROD_DB_ID}'.`);
    process.exit(1);
  }

  if (distConfig.r2_buckets && distConfig.r2_buckets.length > 0) {
    console.error('FATAL: r2_buckets must be excluded because cortex-assets is unprovisioned.');
    process.exit(1);
  }

  console.log('[PASS] Production configuration verified. Target is safe to deploy.');

  // Step 4: Execute Wrangler deploy targeting dist/server/wrangler.json ONLY
  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('\n[DRY RUN] Preflight passed. Deployment command:');
    console.log('  node ./node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.json');
    console.log('Deployment dry run completed successfully.');
    return;
  }

  console.log('\n[Step 4] Executing deployment: node ./node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.json...');
  execSync('node ./node_modules/wrangler/bin/wrangler.js deploy --config dist/server/wrangler.json', { stdio: 'inherit' });
  console.log('\n[DEPLOYMENT SUCCESSFUL] Cortex production deployment complete.');
}

deployProduction().catch((err) => {
  console.error('\nFatal production deployment wrapper error:', err.message);
  process.exit(1);
});
