const fs = require('fs');
let code = fs.readFileSync('src/lib/classroom/auth.ts', 'utf8');
code = code.replace(/\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('src/lib/classroom/auth.ts', code);
console.log('Fixed backslashes');
