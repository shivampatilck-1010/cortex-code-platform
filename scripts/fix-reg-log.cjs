const fs = require('fs');
let code = fs.readFileSync('src/app/api/v1/auth/register/route.ts', 'utf8');
code = code.replace(/await classroomDb\.createUser\(user\);/, 'console.log("REGISTER ROUTE CALLING CREATE USER");\n    await classroomDb.createUser(user);');
fs.writeFileSync('src/app/api/v1/auth/register/route.ts', code);
