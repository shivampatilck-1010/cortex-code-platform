const fs = require('fs');
const file = 'src/lib/classroom/db/index.ts';
let content = fs.readFileSync(file, 'utf8');

// The original query has 11 ? marks but only 10 columns. We remove the extra ?.
content = content.replace(
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

fs.writeFileSync(file, content, 'utf8');
