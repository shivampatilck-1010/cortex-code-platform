const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'app', 'api', 'v1', 'execute', 'route.ts');
let code = fs.readFileSync(targetPath, 'utf8');

code = code.replace(
  'let traceSession = undefined;',
  'let traceSession: any = undefined;'
);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Fixed traceSession type in execute/route.ts');
