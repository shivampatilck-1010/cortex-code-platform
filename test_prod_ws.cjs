const WebSocket = require('ws');
async function testWS() {
    let t = Math.random().toString(36).substring(2, 10);
    // 1. Register teacher
    const regRes = await fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Teacher', email: 'ws' + t + '@test.com', cortexId: 'TCWS' + t, password: 'Password123!', confirmPassword: 'Password123!', role: 'teacher', inviteCode: 'cortex-prof-2026' })
    });
    const cookie = regRes.headers.get('set-cookie')?.split(';')[0];
    
    // 2. Create classroom
    const clsRes = await fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/classrooms', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ name: 'WS Class', description: 'WS', isPublic: true })
    });
    const cls = await clsRes.json();
    const classId = cls.data?.id || cls.classroom?.id;
    console.log('Created Class:', classId);
    
    // 3. Connect WS
    const ws = new WebSocket('wss://cortex-code-platform.cortexbuild1.workers.dev/api/v1/classrooms/' + classId + '/ws', {
        headers: { 'Cookie': cookie }
    });
    
    ws.on('open', () => {
        console.log('WS OPENED SUCCESSFULLY');
        setTimeout(() => ws.close(), 1000);
    });
    ws.on('message', (d) => {
        console.log('WS MSG:', d.length, 'bytes');
    });
    ws.on('close', () => {
        console.log('WS CLOSED');
    });
    ws.on('error', (e) => {
        console.error('WS ERROR:', e);
    });
}
testWS();

