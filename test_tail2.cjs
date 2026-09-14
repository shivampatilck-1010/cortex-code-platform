const { spawn } = require('child_process');
const tail = spawn('npx', ['wrangler', 'tail', 'cortex-code-platform'], { shell: true });
tail.stdout.on('data', d => console.log(d.toString()));
tail.stderr.on('data', d => console.log(d.toString()));
setTimeout(() => {
    fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: 'Teacher', email: 'teacher@test.com', cortexId: 'TC123', 
            password: 'Password123!', confirmPassword: 'Password123!', 
            role: 'teacher', inviteCode: 'cortex-prof-2026' 
        })
    }).then(r => r.text()).then(console.log);
}, 5000);
setTimeout(() => process.exit(0), 10000);
