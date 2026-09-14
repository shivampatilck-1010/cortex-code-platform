async function loginAndCheck() {
    let t = Math.random().toString(36).substring(2, 10);
    const pwd = 'Password123!';
    let r = await fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'T', email: 't' + t + '@test.com', cortexId: 'TC' + t, password: pwd, confirmPassword: pwd, role: 'teacher', inviteCode: 'cortex-prof-2026' })
    });
    console.log('Reg Cookie:', r.headers.get('set-cookie'));
    
    let l = await fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 't' + t + '@test.com', password: pwd })
    });
    console.log('Login Cookie:', l.headers.get('set-cookie'));
}
loginAndCheck();
