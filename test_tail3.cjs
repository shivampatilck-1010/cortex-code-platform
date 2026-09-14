const { spawn } = require('child_process');
const tail = spawn('npx', ['wrangler', 'tail', 'cortex-code-platform', '--format=json'], { shell: true });
tail.stdout.on('data', d => console.log('TAIL OUT:', d.toString()));
tail.stderr.on('data', d => console.error('TAIL ERR:', d.toString()));
console.log('Waiting 15 seconds for tail to connect...');
setTimeout(() => {
    console.log('Sending request...');
    fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: 'Teacher', email: 'teacher@test.com', cortexId: 'TC123', 
            password: 'Password123!', confirmPassword: 'Password123!', 
            role: 'teacher', inviteCode: 'cortex-prof-2026' 
        })
    }).then(r => r.text()).then(t => console.log('REQ DONE:', t));
}, 15000);
setTimeout(() => process.exit(0), 30000);
