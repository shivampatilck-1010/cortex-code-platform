const fs = require('fs');
let code = fs.readFileSync('scripts/test-auth.ts', 'utf8');

code = code.replace(/assert\(res.status === 200 && data.user.cortexId === `STU_\$\{runId\}`.toUpperCase\(\), 'Valid session persists correctly', res.status\);/g,
  "assert(res.status === 200 && data.user.cortexId === `STU_${runId}`.toUpperCase(), 'Valid session persists correctly', JSON.stringify(data));");

code = code.replace(/assert\(res.status === 200 && data.user.cortexId === `STU_\$\{runId\}`.toUpperCase\(\), 'x-user-id and role spoofing completely ignored', res.status\);/g,
  "assert(res.status === 200 && data.user.cortexId === `STU_${runId}`.toUpperCase(), 'x-user-id and role spoofing completely ignored', JSON.stringify(data));");

fs.writeFileSync('scripts/test-auth.ts', code);
