const BASE_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';
async function run() {
    const res = await fetch(BASE_URL + '/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: 'Teacher', email: 'teacher@test.com', cortexId: 'TC123', 
            password: 'Password123!', confirmPassword: 'Password123!', 
            role: 'teacher', inviteCode: 'cortex-prof-2026' 
        })
    });
    console.log(await res.text());
}
run();
