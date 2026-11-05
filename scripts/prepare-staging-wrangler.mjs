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
};

if (config.d1_databases && config.d1_databases.length > 0) {
  config.d1_databases[0].database_name = 'cortex-staging-db';
  config.d1_databases[0].database_id = 'e6375738-d9b2-4c5a-a3e5-3a34e892f49d';
}

fs.writeFileSync(distWranglerPath, JSON.stringify(config, null, 2), 'utf-8');
console.log('Successfully prepared dist/server/wrangler.json for staging:');
console.log(`Worker name: ${config.name}`);
console.log(`Database name: ${config.d1_databases[0].database_name}`);
console.log(`Database ID: ${config.d1_databases[0].database_id}`);
console.log(`Vars APP_ENV: ${config.vars.APP_ENV}`);
