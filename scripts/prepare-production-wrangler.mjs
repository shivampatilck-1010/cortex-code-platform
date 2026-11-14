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
};

if (config.d1_databases && config.d1_databases.length > 0) {
  config.d1_databases[0].database_name = 'cortex-db';
  config.d1_databases[0].database_id = 'f756374b-0e9b-4112-b502-b703788dd86f';
}

fs.writeFileSync(distWranglerPath, JSON.stringify(config, null, 2), 'utf-8');
console.log('Successfully prepared dist/server/wrangler.json for production:');
console.log(`Worker name: ${config.name}`);
console.log(`Database name: ${config.d1_databases[0].database_name}`);
console.log(`Database ID: ${config.d1_databases[0].database_id}`);
console.log(`Vars APP_ENV: ${config.vars.APP_ENV}`);
