const BASE_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';
async function run() {
    let t = Math.random().toString(36).substring(2, 10);
    let email_t = 'teacher' + t + '@test.com';
    let pwd = 'Password123!';
    let r1 = await fetch(BASE_URL + '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: 'Teacher', email: email_t, cortexId: 'TC' + t, password: pwd, confirmPassword: pwd, role: 'teacher', inviteCode: 'cortex-prof-2026' 
        })
    });
    console.log('Reg:', await r1.text());
    let r2 = await fetch(BASE_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email_t, password: pwd })
    });
    console.log('Login headers:', [...r2.headers.entries()]);
}
run();
