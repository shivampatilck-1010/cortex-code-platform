const fs = require('fs');
const file = 'src/lib/classroom/db/index.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

fs.writeFileSync(file, content, 'utf8');
