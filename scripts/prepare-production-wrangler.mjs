import fs from 'node:fs';
import path from 'node:path';

// Parse .env.local if present to inject local secrets into Cloudflare build
const envLocalVars = {};
const envLocalPath = path.resolve('.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        envLocalVars[key] = val;
      }
    }
  }
}

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
  CORTEX_SESSION_SECRET: process.env.CORTEX_SESSION_SECRET || envLocalVars.CORTEX_SESSION_SECRET || 'cortex-prod-session-cryptographic-secret-2026-secure',
  LOCKDOWN_POLICY_SECRET: process.env.LOCKDOWN_POLICY_SECRET || envLocalVars.LOCKDOWN_POLICY_SECRET || 'cortex-prod-lockdown-policy-secret-2026-sha256',
  LTI_HMAC_SECRET: process.env.LTI_HMAC_SECRET || envLocalVars.LTI_HMAC_SECRET || 'cortex-prod-lti-hmac-secret-2026-secure',
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || envLocalVars.GITHUB_CLIENT_ID || 'cortex-staging-github-id',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || envLocalVars.GITHUB_CLIENT_SECRET || 'cortex-staging-github-secret',
  LOCKDOWN_SERVER_PEPPER: process.env.LOCKDOWN_SERVER_PEPPER || envLocalVars.LOCKDOWN_SERVER_PEPPER || 'cortex-prod-lockdown-pepper-2026',
  JWT_SECRET: process.env.JWT_SECRET || envLocalVars.JWT_SECRET || 'cortex-prod-jwt-secret-2026-token',
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || envLocalVars.TURNSTILE_SITE_KEY || '0x4AAAAAAGF-NJJkbzT1RhYe',
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || envLocalVars.TURNSTILE_SECRET_KEY || '0x4AAAAAAGF-NMUYAR7cKfbt9ls1QZ1y-do',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || envLocalVars.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || envLocalVars.GOOGLE_CLIENT_SECRET || '',
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
