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
    console.log('Reg headers:', [...r1.headers.entries()]);
    let sessionCookie = r1.headers.get('set-cookie');
    if (sessionCookie) sessionCookie = sessionCookie.split(';')[0];
    console.log('Cookie:', sessionCookie);
    let r2 = await fetch(BASE_URL + '/api/v1/auth/me', {
        method: 'GET',
        headers: { 'Cookie': sessionCookie }
    });
    console.log('Me status:', r2.status, await r2.text());
}
run();
