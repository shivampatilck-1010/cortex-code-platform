const fs = require('fs');
let code = fs.readFileSync('scripts/test-phase2i-a.mjs', 'utf8');
code = code.replace(/password:\s*'Test@Secure123!'/g, "password: 'Test@Secure123!', confirmPassword: 'Test@Secure123!'");
code = code.replace(/cortexId:\s*'CRT_TEACHER1'/g, "cortexId: 'CRT_TEACHER1', inviteCode: 'TEACHER2024'");
fs.writeFileSync('scripts/test-phase2i-a.mjs', code);
