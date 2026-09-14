const { spawn } = require('child_process');
const tail = spawn('npx', ['wrangler', 'tail', 'cortex-code-platform', '--format=json'], { shell: true });
tail.stdout.on('data', d => console.log('TAIL OUT:', d.toString()));
tail.stderr.on('data', d => console.error('TAIL ERR:', d.toString()));
setTimeout(() => {
    let t = Math.random().toString(36).substring(2, 10);
    fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: 'Teacher', email: 'teacher' + t + '@test.com', cortexId: 'TC' + t, password: 'Password123!', confirmPassword: 'Password123!', role: 'teacher', inviteCode: 'cortex-prof-2026' 
        })
    }).then(r => r.text()).then(txt => console.log('REQ DONE:', txt));
}, 10000);
setTimeout(() => process.exit(0), 20000);
