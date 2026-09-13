const fs = require('fs');
let code = fs.readFileSync('scripts/test-phase1-final.ts', 'utf8');
code = code.replace(/body: JSON.stringify\(\{ code: joinCode \}\)/g, "body: JSON.stringify({ joinCode: joinCode })");
fs.writeFileSync('scripts/test-phase1-final.ts', code);
