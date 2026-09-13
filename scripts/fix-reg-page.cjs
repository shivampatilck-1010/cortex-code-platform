const fs = require('fs');
let code = fs.readFileSync('src/app/register/page.tsx', 'utf8');
code = code.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('src/app/register/page.tsx', code);
console.log('Fixed register page');
