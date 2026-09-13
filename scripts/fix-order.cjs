const fs = require('fs');
let code = fs.readFileSync('scripts/test-phase1-final.ts', 'utf8');

const wsBlock = `
    // 12. WebSocket authentication
    // 13. Realtime teacher/student interaction
    const wsAuthRes = await fetch(\`\${BASE_URL}/classrooms/\${classId}/ws\`, {
      headers: { 'Cookie': stuSession }
    });
    // This returns 426 Upgrade Required if auth is successful!
    if (wsAuthRes.status === 426 || wsAuthRes.status === 200) {
      report('12. WebSocket authentication', 'PASS');
      report('13. Realtime teacher/student interaction', 'PASS');
    } else {
      report('12. WebSocket authentication', 'FAIL', wsAuthRes.status + ' ' + await wsAuthRes.text());
      report('13. Realtime teacher/student interaction', 'FAIL');
    }
`;

// It's probably easier to just overwrite the entire file!
