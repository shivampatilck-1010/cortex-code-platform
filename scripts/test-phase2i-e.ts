/**
 * CORTEX PHASE 2I-E TEST SUITE
 * Learning & Courses Completion Verification
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let PASS = 0;
let FAIL = 0;
let NEEDS_VERIF = 0;
const RESULTS: any[] = [];

function uid() { return Math.random().toString(36).substring(2, 9); }
function result(name: string, status: 'PASS' | 'FAIL' | 'NEEDS VERIFICATION', detail = '') {
  if (status === 'PASS') { PASS++; console.log(`[PASS] ${name} ${detail}`); }
  else if (status === 'FAIL') { FAIL++; console.error(`[FAIL] ${name} ${detail}`); }
  else { NEEDS_VERIF++; console.warn(`[NEEDS VERIFICATION] ${name} ${detail}`); }
  RESULTS.push({ name, status, detail });
}

async function apiGet(path: string, session?: string | null) {
  return await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: session ? { 'Cookie': `cortex_session=${session}` } : {}
  });
}

async function apiPost(path: string, body: any, session?: string | null) {
  return await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'Cookie': `cortex_session=${session}` } : {})
    },
    body: JSON.stringify(body)
  });
}

async function createTestUser(email: string) {
  const password = 'Password123!';
  const r = await apiPost('/api/v1/auth/register', { 
    email, 
    password, 
    confirmPassword: password,
    name: 'Test User',
    cortexId: uid(),
    role: 'student'
  });
  if (!r.ok) {
    console.error('Failed to register user', await r.text());
  }
  const d = await r.json();
  const cookie = r.headers.get('set-cookie');
  const session = cookie ? cookie.split(';')[0].split('=')[1] : null;
  return { id: d.user?.id, session };
}

async function run() {
  console.log(`\n=== CORTEX PHASE 2I-E TEST SUITE ===\nTarget: ${BASE_URL}\n`);

  // Setup test users
  const userA = await createTestUser(`userA_${uid()}@test.com`);
  const userB = await createTestUser(`userB_${uid()}@test.com`);

  console.log('\n--- COURSES (PUBLIC) ---');
  // 1. GET courses
  const res1 = await apiGet('/api/v1/learn/courses');
  if (res1.ok) {
    const d1 = await res1.json();
    if (d1.courses && d1.courses.length > 0) result('Courses: Public retrieval successful', 'PASS', `found ${d1.courses.length}`);
    else result('Courses: Public retrieval successful', 'FAIL', 'No courses found');
  } else result('Courses: Public retrieval successful', 'FAIL', `Status: ${res1.status}`);

  let courseId = 'cpp-fundamentals';
  let lessonId = 'cpp-1';

  // 2. GET course details
  const res2 = await apiGet(`/api/v1/learn/courses/${courseId}`);
  if (res2.ok) {
    const d2 = await res2.json();
    if (d2.course && d2.course.lessons && d2.course.lessons.length > 0) {
      result('Courses: Course details & structure retrieval', 'PASS', `found ${d2.course.lessons.length} lessons`);
      lessonId = d2.course.lessons[0].id;
    } else result('Courses: Course details & structure retrieval', 'FAIL', 'Missing lessons array');
  } else result('Courses: Course details & structure retrieval', 'FAIL', `Status: ${res2.status}`);


  console.log('\n--- PROGRESS & AUTH ---');
  // 3. GET progress unauthenticated
  const res3 = await apiGet('/api/v1/learn/progress');
  if (res3.status === 401) result('Auth: Unauthenticated GET progress rejected', 'PASS', 'Status 401');
  else result('Auth: Unauthenticated GET progress rejected', 'FAIL', `Expected 401, got ${res3.status}`);

  // 4. POST progress unauthenticated
  const res4 = await apiPost('/api/v1/learn/progress', { courseId, lessonId, status: 'completed' });
  if (res4.status === 401) result('Auth: Unauthenticated POST progress rejected', 'PASS', 'Status 401');
  else result('Auth: Unauthenticated POST progress rejected', 'FAIL', `Expected 401, got ${res4.status}`);

  // 5. POST progress A
  const res5 = await apiPost('/api/v1/learn/progress', { courseId, lessonId, status: 'in_progress', lastCode: 'int main() {}' }, userA.session);
  if (res5.ok) {
    const d = await res5.json();
    if (d.progress && d.progress.status === 'in_progress') result('Progress: Authenticated POST creates progress', 'PASS');
    else result('Progress: Authenticated POST creates progress', 'FAIL', 'Missing expected data');
  } else result('Progress: Authenticated POST creates progress', 'FAIL', `Status: ${res5.status}`);

  // 6. GET progress A
  const res6 = await apiGet('/api/v1/learn/progress', userA.session);
  if (res6.ok) {
    const d = await res6.json();
    if (d.progress && d.progress.length > 0 && d.progress[0].last_code === 'int main() {}') {
      result('Progress: Authenticated GET retrieves progress', 'PASS', `Found: ${d.progress[0].last_code}`);
    } else result('Progress: Authenticated GET retrieves progress', 'FAIL');
  } else result('Progress: Authenticated GET retrieves progress', 'FAIL');

  // 7. Complete lesson A (idempotency/update)
  const res7 = await apiPost('/api/v1/learn/progress', { courseId, lessonId, status: 'completed', lastCode: 'int main() { return 0; }' }, userA.session);
  if (res7.ok) {
    const d = await res7.json();
    if (d.progress && d.progress.status === 'completed') result('Progress: Status update to completed is idempotent/works', 'PASS');
    else result('Progress: Status update to completed is idempotent/works', 'FAIL');
  } else result('Progress: Status update to completed is idempotent/works', 'FAIL', `Status: ${res7.status}`);

  
  console.log('\n--- SECURITY & IDOR ---');
  // 8. IDOR B cannot see A's progress
  const res8 = await apiGet('/api/v1/learn/progress', userB.session);
  if (res8.ok) {
    const d = await res8.json();
    if (d.progress && d.progress.length === 0) result('IDOR: User B cannot see User A progress', 'PASS', '0 items returned');
    else result('IDOR: User B cannot see User A progress', 'FAIL', `User B saw ${d.progress?.length} items`);
  } else result('IDOR: User B cannot see User A progress', 'FAIL', `Status: ${res8.status}`);

  // 9. Forged Identity Payload (A tries to update B by passing B's id in body - wait, the API ignores body.userId, but we can try to forge it)
  const res9 = await apiPost('/api/v1/learn/progress', { courseId, lessonId, status: 'completed', userId: userB.id }, userA.session);
  if (res9.ok) {
    // A updated their own progress again, let's verify B's progress is still empty
    const res9b = await apiGet('/api/v1/learn/progress', userB.session);
    const d9b = await res9b.json();
    if (d9b.progress.length === 0) result('Security: API ignores forged client userId payload', 'PASS');
    else result('Security: API ignores forged client userId payload', 'FAIL', 'User B was updated!');
  } else result('Security: API ignores forged client userId payload', 'FAIL');

  // 10. Invalid Input
  const res10 = await apiPost('/api/v1/learn/progress', { courseId, lessonId, status: 'hacked' }, userA.session);
  if (res10.status === 400) result('Security: Invalid progress status rejected', 'PASS', 'Status 400');
  else result('Security: Invalid progress status rejected', 'FAIL', `Expected 400, got ${res10.status}`);

  
  console.log('\n=== RESULTS ===');
  console.log(`PASS: ${PASS} | FAIL: ${FAIL} | NEEDS VERIFICATION: ${NEEDS_VERIF}`);
  
  if (FAIL > 0) process.exit(1);
}

run().catch(console.error);
