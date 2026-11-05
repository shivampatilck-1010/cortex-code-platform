const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string, details?: any) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${desc}`);
  } else {
    failed++;
    console.error(`[FAIL] ${desc}`, details ? details : '');
  }
}

async function main() {
  console.log('====================================================');
  console.log('CORTEX DUAL LOGIN & HTTP IDENTITY END-TO-END TEST');
  console.log('====================================================\n');

  const ts = Date.now();
  const testEmail = `dual_auth_${ts}@example.com`;
  const testPassword = 'SecurePassword123!';
  const testName = 'Dual Login Tester';
  const cortexId = `DUAL_${ts}`.slice(0, 20);

  // 1. Register new user
  console.log('--- Step 1: Registering User via /api/v1/auth/register ---');
  const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: testName,
      email: testEmail,
      password: testPassword,
      confirmPassword: testPassword,
      cortexId,
      role: 'student',
    }),
  });

  const regData = await regRes.json();
  assert(regRes.status === 200 || regRes.status === 201, 'User registration succeeds', regData);
  assert(regData.user?.professionalEmail?.endsWith('@cortex.com'), 'Registration assigns professional @cortex.com identity', regData.user);
  
  const assignedProfessionalEmail = regData.user?.professionalEmail;
  console.log(`  Assigned Professional Email: ${assignedProfessionalEmail}`);

  // 2. Login using personal authentication email
  console.log('\n--- Step 2: Login via Personal Authentication Email ---');
  const loginAuthRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: testEmail,
      password: testPassword,
    }),
  });

  const loginAuthData = await loginAuthRes.json();
  assert(loginAuthRes.status === 200, 'Login via personal email returns HTTP 200', loginAuthData);
  assert(loginAuthData.success === true, 'Login response confirms success: true');
  assert(loginAuthData.user?.professionalEmail === assignedProfessionalEmail, 'Login response includes professionalEmail');

  const authCookie = loginAuthRes.headers.get('set-cookie') || '';
  assert(authCookie.includes('cortex_session='), 'Set-Cookie header sets cortex_session');

  // 3. Login using professional email
  console.log('\n--- Step 3: Dual Login via Virtual Professional Identity ---');
  const loginProfRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: assignedProfessionalEmail,
      password: testPassword,
    }),
  });

  const loginProfData = await loginProfRes.json();
  assert(loginProfRes.status === 200, 'Login via professional email returns HTTP 200', loginProfData);
  assert(loginProfData.success === true, 'Login via professional email confirms success: true');
  assert(loginProfData.user?.id === regData.user?.id, 'Professional email login resolves to same user ID');

  const profCookie = loginProfRes.headers.get('set-cookie') || '';
  const matchProfSess = profCookie.match(/cortex_session=([^;]+)/);
  assert(Boolean(matchProfSess), 'Professional login issues valid cortex_session cookie');

  // 4. Test authenticated /api/v1/auth/me endpoint
  console.log('\n--- Step 4: Profile Verification via /api/v1/auth/me ---');
  const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
    headers: {
      Cookie: `cortex_session=${matchProfSess ? matchProfSess[1] : ''}`,
    },
  });

  const meData = await meRes.json();
  assert(meRes.status === 200, '/api/v1/auth/me returns HTTP 200', meData);
  assert(meData.user?.professionalEmail === assignedProfessionalEmail, '/api/v1/auth/me returns professionalEmail');
  assert(meData.user?.role === 'student', 'User role remains student');

  // 5. Test invalid credentials
  console.log('\n--- Step 5: Invalid Credentials Protection ---');
  const badLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: assignedProfessionalEmail,
      password: 'WrongPassword999!',
    }),
  });
  assert(badLoginRes.status === 401, 'Invalid password rejected with HTTP 401');

  // Summary
  console.log('\n====================================================');
  console.log(`HTTP TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[HttpTest] FATAL:', err);
  process.exit(1);
});
