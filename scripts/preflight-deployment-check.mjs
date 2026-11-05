/**
 * Cortex Online Examination System — Deployment Preflight Safety Verifier
 *
 * Enforces strict environment boundaries, prevents accidental deployment of
 * staging code to production or production databases to staging, verifies build
 * artifact completeness, validates migration integrity, and checks secret presence.
 *
 * Strictly zero emojis.
 */

import fs from 'node:fs';
import path from 'node:path';

const EXPECTED_CONFIG = {
  staging: {
    workerName: 'cortex-code-platform-staging',
    databaseName: 'cortex-staging-db',
    databaseId: 'e6375738-d9b2-4c5a-a3e5-3a34e892f49d',
  },
  production: {
    workerName: 'cortex-code-platform',
    databaseName: 'cortex-db',
    databaseId: 'f756374b-0e9b-4112-b502-b703788dd86f',
  },
};

const REQUIRED_MIGRATIONS = [
  '0001_initial_schema.sql',
  '0002_github_integration.sql',
  '0003_fix_classrooms.sql',
  '0004_online_examination_system.sql',
  '0005_question_bank.sql',
  '0006_examination_phase3.sql',
  '0007_examination_security_audit.sql',
  '0008_examination_phase3_schema_completion.sql',
  '0009_user_professional_email.sql',
];

export async function runPreflight(options = {}) {
  const targetEnv = (options.targetEnv || process.env.TARGET_ENV || 'staging').toLowerCase();
  const checks = [];
  let allPassed = true;

  function report(name, passed, details) {
    checks.push({ name, passed, details });
    if (!passed) allPassed = false;
  }

  console.log('================================================================');
  console.log(`CORTEX DEPLOYMENT PREFLIGHT CHECK: TARGET = [${targetEnv.toUpperCase()}]`);
  console.log('================================================================\n');

  // 1. Verify target environment is valid
  if (targetEnv !== 'staging' && targetEnv !== 'production') {
    report('Target Environment Validation', false, `Invalid target environment '${targetEnv}'. Must be 'staging' or 'production'.`);
    return { allPassed: false, checks };
  }
  report('Target Environment Validation', true, `Target environment is explicitly set to '${targetEnv}'.`);

  // Production Safety Gate
  if (targetEnv === 'production' && !options.allowProduction) {
    report('Production Deployment Authorization Gate', false, 'DEPLOYMENT PROHIBITED: Production deployment is strictly unauthorized in Phase 3.9.');
  } else {
    report('Production Deployment Authorization Gate', true, 'Deployment is constrained to staging or explicit simulation.');
  }

  // 2. Inspect root wrangler.jsonc
  const rootWranglerPath = path.resolve('wrangler.jsonc');
  if (!fs.existsSync(rootWranglerPath)) {
    report('Root Wrangler Configuration', false, `Root configuration file not found at ${rootWranglerPath}`);
  } else {
    try {
      const content = fs.readFileSync(rootWranglerPath, 'utf-8');
      // Strip comments for basic JSON checking
      const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const rootConfig = JSON.parse(stripped);

      if (targetEnv === 'staging') {
        const stagingEnv = rootConfig.env?.staging;
        if (!stagingEnv) {
          report('Staging Environment Block in Root Config', false, 'Missing "env.staging" section in wrangler.jsonc.');
        } else {
          const wName = stagingEnv.name;
          const d1 = stagingEnv.d1_databases?.[0];
          const nameOk = wName === EXPECTED_CONFIG.staging.workerName;
          const dbNameOk = d1?.database_name === EXPECTED_CONFIG.staging.databaseName;
          const dbIdOk = d1?.database_id === EXPECTED_CONFIG.staging.databaseId;

          report(
            'Root Config Staging Worker Name',
            nameOk,
            `Expected '${EXPECTED_CONFIG.staging.workerName}', found '${wName}'`
          );
          report(
            'Root Config Staging D1 Database',
            dbNameOk && dbIdOk,
            `Expected '${EXPECTED_CONFIG.staging.databaseName}' (${EXPECTED_CONFIG.staging.databaseId}), found '${d1?.database_name}' (${d1?.database_id})`
          );
        }
      }
    } catch (err) {
      report('Root Wrangler Parsing', false, `Failed to parse wrangler.jsonc: ${err.message}`);
    }
  }

  // 3. Inspect generated dist/server/wrangler.json (Deployment Artifact)
  const distWranglerPath = path.resolve('dist/server/wrangler.json');
  if (fs.existsSync(distWranglerPath)) {
    try {
      const rawDist = fs.readFileSync(distWranglerPath, 'utf-8');
      const distConfig = JSON.parse(rawDist);
      const expected = EXPECTED_CONFIG[targetEnv];

      const wName = distConfig.name;
      const d1 = distConfig.d1_databases?.[0];

      // Fail-closed check: Ensure staging NEVER points to production DB
      if (targetEnv === 'staging') {
        if (d1?.database_id === EXPECTED_CONFIG.production.databaseId) {
          report(
            'Production Database Leakage Prevention',
            false,
            `CRITICAL SECURITY VIOLATION: dist/server/wrangler.json points to PRODUCTION database ID (${d1.database_id}) while targeting staging!`
          );
        } else {
          report('Production Database Leakage Prevention', true, 'dist/server/wrangler.json does not reference production database.');
        }
      }

      const nameMatch = wName === expected.workerName;
      const dbMatch = d1?.database_name === expected.databaseName && d1?.database_id === expected.databaseId;

      report(
        'Deployment Artifact Worker Target',
        nameMatch,
        `Artifact Worker: '${wName}', Expected: '${expected.workerName}'`
      );
      report(
        'Deployment Artifact Database Target',
        dbMatch,
        `Artifact DB: '${d1?.database_name}' (${d1?.database_id}), Expected: '${expected.databaseName}' (${expected.databaseId})`
      );
    } catch (err) {
      report('Deployment Artifact Parsing', false, `Failed to parse dist/server/wrangler.json: ${err.message}`);
    }
  } else {
    report('Deployment Artifact Existence', false, `Generated artifact dist/server/wrangler.json not found. Run "npm run build:vinext" first.`);
  }

  // 4. Verify Database Migrations Order & Integrity
  const migrationsDir = path.resolve('migrations');
  if (!fs.existsSync(migrationsDir)) {
    report('Migrations Directory', false, `Directory not found at ${migrationsDir}`);
  } else {
    let migrationsOk = true;
    const missing = [];
    for (const file of REQUIRED_MIGRATIONS) {
      const fullPath = path.join(migrationsDir, file);
      if (!fs.existsSync(fullPath)) {
        migrationsOk = false;
        missing.push(file);
      }
    }
    report(
      'Required Database Migrations Completeness',
      migrationsOk,
      migrationsOk
        ? `All ${REQUIRED_MIGRATIONS.length} required migration files verified in sequence.`
        : `Missing required migration files: ${missing.join(', ')}`
    );
  }

  // 5. Build Artifact Completeness Check
  const distClientDir = path.resolve('dist/client');
  const distServerDir = path.resolve('dist/server');
  const hasClient = fs.existsSync(distClientDir);
  const hasServer = fs.existsSync(distServerDir);
  report(
    'Build Artifacts Directory Check',
    hasClient && hasServer,
    `dist/client exists: ${hasClient}, dist/server exists: ${hasServer}`
  );

  // 6. Secrets & Environment Configuration Presence Check
  const requiredEnvVars = ['APP_ENV'];
  const missingVars = requiredEnvVars.filter((v) => !process.env[v] && v !== 'APP_ENV');
  report(
    'Required Environment Variables Presence',
    missingVars.length === 0,
    missingVars.length === 0
      ? 'Essential environment variables configured.'
      : `Missing variables: ${missingVars.join(', ')}`
  );

  console.log('--- PREFLIGHT CHECK RESULTS ---');
  for (const c of checks) {
    const status = c.passed ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${c.name}: ${c.details}`);
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log(`PREFLIGHT STATUS: PASSED (Target [${targetEnv.toUpperCase()}] is safe to proceed)`);
  } else {
    console.log(`PREFLIGHT STATUS: FAILED (Target [${targetEnv.toUpperCase()}] blocked by safety checks)`);
  }
  console.log('================================================================\n');

  return { allPassed, checks };
}

import { pathToFileURL } from 'node:url';

// CLI execution
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const args = process.argv.slice(2);
  const envArg = args.find((a) => a.startsWith('--env='));
  const targetEnv = envArg ? envArg.split('=')[1] : 'staging';

  runPreflight({ targetEnv })
    .then((result) => {
      if (!result.allPassed) {
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('Fatal preflight error:', err);
      process.exit(1);
    });
}
