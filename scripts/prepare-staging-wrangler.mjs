import fs from 'node:fs';
import path from 'node:path';

const distWranglerPath = path.resolve('dist/server/wrangler.json');
if (!fs.existsSync(distWranglerPath)) {
  console.error(`File not found: ${distWranglerPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(distWranglerPath, 'utf-8');
const config = JSON.parse(raw);

config.name = 'cortex-code-platform-staging';
config.topLevelName = 'cortex-code-platform-staging';

config.vars = {
  ...(config.vars || {}),
  APP_ENV: 'staging',
  // Staging secrets are non-secret fixtures for non-production environments.
  CORTEX_SESSION_SECRET: 'cortex-staging-live-session-cryptographic-secret-2026-secure',
  LOCKDOWN_POLICY_SECRET: 'cortex-staging-lockdown-policy-secret-2026',
  LTI_HMAC_SECRET: 'cortex-staging-lti-hmac-secret-2026',
  GITHUB_CLIENT_ID: 'cortex-staging-github-id',
  GITHUB_CLIENT_SECRET: 'cortex-staging-github-secret',
  LOCKDOWN_SERVER_PEPPER: 'cortex-staging-pepper-2026',
  JWT_SECRET: 'cortex-staging-jwt-secret-2026',
};

if (config.d1_databases && config.d1_databases.length > 0) {
  config.d1_databases[0].database_name = 'cortex-staging-db';
  config.d1_databases[0].database_id = 'e6375738-d9b2-4c5a-a3e5-3a34e892f49d';
}

// Staging operates with in-memory asset fallback store unless R2 is explicitly provisioned in dashboard
delete config.r2_buckets;

fs.writeFileSync(distWranglerPath, JSON.stringify(config, null, 2), 'utf-8');
console.log('Successfully prepared dist/server/wrangler.json for staging:');
console.log(`Worker name: ${config.name}`);
console.log(`Database name: ${config.d1_databases[0].database_name}`);
console.log(`Database ID: ${config.d1_databases[0].database_id}`);
console.log(`Vars APP_ENV: ${config.vars.APP_ENV}`);
