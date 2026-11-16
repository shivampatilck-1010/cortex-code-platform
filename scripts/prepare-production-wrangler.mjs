import fs from 'node:fs';
import path from 'node:path';

const distWranglerPath = path.resolve('dist/server/wrangler.json');
if (!fs.existsSync(distWranglerPath)) {
  console.error(`File not found: ${distWranglerPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(distWranglerPath, 'utf-8');
const config = JSON.parse(raw);

config.name = 'cortex-code-platform';
config.topLevelName = 'cortex-code-platform';

config.vars = {
  ...(config.vars || {}),
  APP_ENV: 'production',
  CORTEX_SESSION_SECRET: process.env.CORTEX_SESSION_SECRET || 'cortex-prod-session-cryptographic-secret-2026-secure',
  LOCKDOWN_POLICY_SECRET: process.env.LOCKDOWN_POLICY_SECRET || 'cortex-prod-lockdown-policy-secret-2026-sha256',
  LTI_HMAC_SECRET: process.env.LTI_HMAC_SECRET || 'cortex-prod-lti-hmac-secret-2026-secure',
  LOCKDOWN_SERVER_PEPPER: process.env.LOCKDOWN_SERVER_PEPPER || 'cortex-prod-lockdown-pepper-2026',
  JWT_SECRET: process.env.JWT_SECRET || 'cortex-prod-jwt-secret-2026-token',
};

if (config.d1_databases && config.d1_databases.length > 0) {
  config.d1_databases[0].database_name = 'cortex-db';
  config.d1_databases[0].database_id = 'f756374b-0e9b-4112-b502-b703788dd86f';
}

// Fallback to in-memory asset store unless R2 is explicitly provisioned in Cloudflare dashboard
delete config.r2_buckets;

fs.writeFileSync(distWranglerPath, JSON.stringify(config, null, 2), 'utf-8');
console.log('Successfully prepared dist/server/wrangler.json for production:');
console.log(`Worker name: ${config.name}`);
console.log(`Database name: ${config.d1_databases[0].database_name}`);
console.log(`Database ID: ${config.d1_databases[0].database_id}`);
console.log(`Vars APP_ENV: ${config.vars.APP_ENV}`);
