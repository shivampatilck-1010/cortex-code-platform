const BASE_URL = 'http://localhost:3000/api/v1/auth';

async function runTests() {
  console.log('--- Cortex Auth Security Test Suite ---');
  let passed = 0;
  let failed = 0;
  let currentSessionCookie = '';

  const assert = (condition: boolean, message: string, details?: any) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`, details ? details : '');
      failed++;
    }
  };

  // randomize username to prevent duplicate email failures across test runs
  const runId = Math.random().toString(36).substring(2, 7);

  // 1. Valid Student Registration
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Student A', email: `studentA_${runId}@test.com`, cortexId: `STU_${runId}`,
        password: 'Password123!', confirmPassword: 'Password123!', role: 'student'
      })
    });
    const data = await res.json();
    assert(res.status === 200 && data.success, 'Valid student registration', res.status);
    currentSessionCookie = res.headers.get('set-cookie') || '';
  } catch (e: any) { assert(false, 'Valid student registration threw', e.message); }

  // 2. Valid Professor Registration
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Prof A', email: `profA_${runId}@test.com`, cortexId: `PROF_${runId}`,
        password: 'Password123!', confirmPassword: 'Password123!', role: 'teacher', inviteCode: 'cortex-prof-2026'
      })
    });
    assert(res.status === 200, 'Valid professor registration', res.status);
  } catch (e: any) { assert(false, 'Valid professor registration threw', e.message); }

  // 3. Duplicate Email
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Clone', email: `studentA_${runId}@test.com`, cortexId: `CLONE_${runId}`,
        password: 'Password123!', confirmPassword: 'Password123!', role: 'student'
      })
    });
    assert(res.status === 409, 'Duplicate email blocked', res.status);
  } catch (e: any) { assert(false, 'Duplicate email check threw', e.message); }

  // 6. Weak password
  try {
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Weak', email: `weak_${runId}@test.com`, cortexId: `WEAK_${runId}`,
        password: 'weak', confirmPassword: 'weak', role: 'student'
      })
    });
    assert(res.status === 400, 'Weak password blocked', res.status);
  } catch (e: any) { assert(false, 'Weak password check threw', e.message); }

  // 10. Email + correct password login
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: `studentA_${runId}@test.com`, password: 'Password123!' })
    });
    const data = await res.json();
    assert(res.status === 200, 'Email + correct password login', res.status + " " + data.error);
    currentSessionCookie = res.headers.get('set-cookie') || '';
  } catch (e: any) { assert(false, 'Email login threw', e.message); }

  // 13. Cortex ID + wrong password
  try {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: `STU_${runId}`, password: 'wrong' })
    });
    assert(res.status === 401, 'Cortex ID + wrong password blocked', res.status);
  } catch (e: any) { assert(false, 'Wrong password check threw', e.message); }

  // 15. Valid session
  try {
    const res = await fetch(`${BASE_URL}/me`, {
      headers: { 'Cookie': currentSessionCookie }
    });
    const data = await res.json();
    assert(res.status === 200 && data.user.cortexId === `STU_${runId}`.toUpperCase(), 'Valid session persists correctly', JSON.stringify(data));
  } catch (e: any) { assert(false, 'Valid session check threw', e.message); }

  // 20. x-user-id spoofing (Try to spoof as Prof A)
  try {
    // get prof A ID
    const loginProf = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: `PROF_${runId}`, password: 'Password123!' })
    });
    const profData = await loginProf.json();
    const profId = profData.user?.id;

    const res = await fetch(`${BASE_URL}/me`, {
      headers: { 
        'Cookie': currentSessionCookie, // Student session
        'x-user-id': profId || 'failed_to_get_prof_id',
        'x-user-role': 'admin'
      }
    });
    const data = await res.json();
    assert(res.status === 200 && data.user.role === 'student' && data.user.cortexId === `STU_${runId}`.toUpperCase(), 'x-user-id and role spoofing completely ignored', res.status);
  } catch (e: any) { assert(false, 'Spoofing check threw', e.message); }

  // 18. Logout
  try {
    const res = await fetch(`${BASE_URL}/logout`, {
      method: 'POST',
      headers: { 'Cookie': currentSessionCookie }
    });
    assert(res.status === 200, 'Logout works', res.status);
    
    const meRes = await fetch(`${BASE_URL}/me`, {
      headers: { 'Cookie': currentSessionCookie } // Should be invalid now
    });
    assert(meRes.status === 401, 'Logout invalidates session database', meRes.status);
  } catch (e: any) { assert(false, 'Logout check threw', e.message); }

  console.log(`\nResults: ${passed} Passed, ${failed} Failed`);
}

runTests();
