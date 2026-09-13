const fs = require('fs');
let code = fs.readFileSync('src/lib/classroom/db/index.ts', 'utf8');
code = code.replace(/await stmt\.run\(/, 'console.log("INSERTING: ", user.id);\n    await stmt.run(');
fs.writeFileSync('src/lib/classroom/db/index.ts', code);
