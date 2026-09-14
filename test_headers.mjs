async function getReg() {
    let t = Math.random().toString(36).substring(2, 10);
    const res = await fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'T', email: 't' + t + '@test.com', cortexId: 'TC' + t, password: 'Password123!', confirmPassword: 'Password123!', role: 'teacher', inviteCode: 'cortex-prof-2026' })
    });
    console.log('Status:', res.status);
    console.log('Headers:');
    res.headers.forEach((v,k) => console.log(k, v));
    console.log('Body:', await res.text());
}
getReg();
