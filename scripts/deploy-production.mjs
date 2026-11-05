/**
 * Cortex Online Examination System — Production Deployment Wrapper
 *
 * Guarantees that production deployment is fail-closed, requires explicit flags,
 * executes preflight verification, validates generated configuration in dist/server/wrangler.json,
 * and strictly prevents staging database or worker leakage.
 *
 * Strictly zero emojis.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runPreflight } from './preflight-deployment-check.mjs';

const EXPECTED_PROD_WORKER = 'cortex-code-platform';
const EXPECTED_PROD_DB_ID = 'f756374b-0e9b-4112-b502-b703788dd86f';
const EXPECTED_PROD_DB_NAME = 'cortex-db';
const FORBIDDEN_STAGING_DB_ID = 'e6375738-d9b2-4c5a-a3e5-3a34e892f49d';

async function deployProduction() {
  console.log('================================================================');
  console.log('CORTEX PRODUCTION DEPLOYMENT WRAPPER');
  console.log('================================================================\n');

  // Guardrail 1: Require explicit authorization flag and environment variable
  const hasFlag = process.argv.includes('--allow-production');
  const hasEnv = process.env.ALLOW_PRODUCTION_DEPLOY === 'true';

  if (!hasFlag || !hasEnv) {
    console.error('FATAL PRODUCTION GUARDRAIL:');
    console.error('Production deployment requires both:');
    console.error('  1. Flag: --allow-production');
    console.error('  2. Environment: ALLOW_PRODUCTION_DEPLOY=true');
    console.error('Deployment aborted.\n');
    process.exit(1);
  }

  // Step 1: Preflight verification for production
  console.log('[Step 1] Executing production preflight safety checks...');
  const preflightResult = await runPreflight({ targetEnv: 'production', allowProduction: true });

  if (!preflightResult.allPassed) {
    console.error('\n[DEPLOYMENT ABORTED] Preflight safety verification failed. Review errors above.');
    process.exit(1);
  }

  // Step 2: Verify dist/server/wrangler.json content safety
  console.log('\n[Step 2] Hardening artifact check on dist/server/wrangler.json...');
  const distConfigPath = path.resolve('dist', 'server', 'wrangler.json');
  if (!fs.existsSync(distConfigPath)) {
    console.error('FATAL: dist/server/wrangler.json not found. Run "npm run build:vinext" first.');
    process.exit(1);
  }

  const distContent = fs.readFileSync(distConfigPath, 'utf8');
  const distConfig = JSON.parse(distContent);

  if (distConfig.name !== EXPECTED_PROD_WORKER) {
    console.error(`FATAL: Worker name is '${distConfig.name}', expected '${EXPECTED_PROD_WORKER}'.`);
    process.exit(1);
  }

  const d1 = distConfig.d1_databases?.[0];
  if (d1?.database_id === FORBIDDEN_STAGING_DB_ID) {
    console.error(`FATAL SECURITY BLOCK: Artifact references STAGING database UUID ${FORBIDDEN_STAGING_DB_ID}!`);
    process.exit(1);
  }

  if (d1?.database_id !== EXPECTED_PROD_DB_ID) {
    console.error(`FATAL: Database ID is '${d1?.database_id}', expected '${EXPECTED_PROD_DB_ID}'.`);
    process.exit(1);
  }

  if (d1?.database_name !== EXPECTED_PROD_DB_NAME) {
    console.error(`FATAL: Database name is '${d1?.database_name}', expected '${EXPECTED_PROD_DB_NAME}'.`);
    process.exit(1);
  }

  console.log('[PASS] Production configuration verified. Target is confirmed safe to deploy.');

  // Step 3: Check current active deployment version
  console.log('\n[Step 3] Querying active production Worker version before deployment...');
  try {
    const listOut = execSync('npx wrangler deployments list --config dist/server/wrangler.json', { encoding: 'utf8' });
    console.log(listOut.split('\n').slice(-15).join('\n'));
  } catch (err) {
    console.warn('Notice: Could not list prior deployments:', err.message);
  }

  const isDryRun = process.argv.includes('--dry-run');
  if (isDryRun) {
    console.log('\n[DRY RUN] Preflight passed. Deployment command:');
    console.log(`  npx wrangler deploy --config dist/server/wrangler.json`);
    console.log('Production deployment dry run completed successfully.');
    return;
  }

  // Step 4: Execute Wrangler deploy targeting dist/server/wrangler.json ONLY
  console.log('\n[Step 4] Executing production deployment: npx wrangler deploy --config dist/server/wrangler.json...');
  execSync('npx wrangler deploy --config dist/server/wrangler.json', { stdio: 'inherit' });
  console.log('\n[DEPLOYMENT SUCCESSFUL] Cortex production Worker deployment complete.');
}

deployProduction().catch((err) => {
  console.error('\nFatal production deployment wrapper error:', err.message);
  process.exit(1);
});
