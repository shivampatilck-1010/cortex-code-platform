const fs = require('fs');
let code = fs.readFileSync('scripts/test-phase1-final.ts', 'utf8');
code = code.replace(/\/classroom\/\$\{classId\}/g, '/classrooms/${classId}');
fs.writeFileSync('scripts/test-phase1-final.ts', code);
