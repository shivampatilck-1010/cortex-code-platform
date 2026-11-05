const fs = require('fs');
const path = require('path');
const p = path.resolve(__dirname, '..', 'src', 'lib', 'classroom', 'db', 'index.ts');
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/ProjectTeamStatus,[\r\n\s]*\}[\s]*Exam,/, 'ProjectTeamStatus,\n  Exam,');
fs.writeFileSync(p, c, 'utf8');
console.log('Cleaned up imports in db/index.ts');
