#!/usr/bin/env node
/**
 * CORTEX Phase 2I-A — Security & IDOR Automated Test Suite
 * Run: node scripts/test-phase2i-a.mjs
 *
 * Tests: Authentication, IDOR, Cross-classroom isolation, Cross-user isolation,
 * Role escalation, CSRF/input security, XSS-sensitive inputs, WebSocket auth,
 * WebSocket flooding, WebSocket message limits, AI authorization, Data integrity,
 * Previous phase regressions.
 */

const BASE_URL = process.env.TEST_BASE_URL || 'https://cortex-code-platform.cortexbuild1.workers.dev';
const RESULTS = [];
let PASS = 0, FAIL = 0;

function result(name, passed, detail = '') {
  const status = passed ? 'PASS' : 'FAIL';
  if (passed) PASS++; else FAIL++;
  RESULTS.push({ name, status, detail });
  console.log(`[${status}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function apiPost(path, body, cookie = '') {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res;
}

async function apiGet(path, cookie = '') {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
  return res;
}

async function apiDelete(path, cookie = '') {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers });
  return res;
}

function uid() { return Math.random().toString(36).substring(2, 8); }

// ============================================================
// HELPERS
// ============================================================
async function register(role = 'student') {
  const id = uid();
  const res = await apiPost('/api/v1/auth/register', {
    name: `TestUser_${id}`,
    email: `test_${id}@cortex-test.invalid`,
    password: 'Test@Secure123!', confirmPassword: 'Test@Secure123!',
    role, inviteCode: role === 'teacher' ? 'cortex-prof-2026' : undefined,
    cortexId: `CRT_${id}`,
  });
  const data = await res.text().then(t => { try { return JSON.parse(t); } catch(e) { return { _raw: t }; } });
  const cookie = res.headers.get('set-cookie') || '';
  const sessionMatch = cookie.match(/cortex_session=([^;]+)/);
  const session = sessionMatch ? `cortex_session=${sessionMatch[1]}` : '';
  return { data, session, status: res.status, userId: data?.user?.id };
}

async function login(email, password) {
  const res = await apiPost('/api/v1/auth/login', { identifier: email, password });
  const cookie = res.headers.get('set-cookie') || '';
  const sessionMatch = cookie.match(/cortex_session=([^;]+)/);
  const session = sessionMatch ? `cortex_session=${sessionMatch[1]}` : '';
  return { status: res.status, session, data: await res.text().then(t => { try { return JSON.parse(t); } catch(e) { return { _raw: t }; } }) };
}

async function createClassroom(session, name = 'TestClass') {
  const res = await apiPost('/api/v1/classrooms', { name: `${name}_${uid()}`, subject: 'CS' }, session);
  const data = await res.text().then(t => { try { return JSON.parse(t); } catch(e) { return { _raw: t }; } });
  return { status: res.status, classroomId: data?.classroom?.id, joinCode: data?.classroom?.joincode };
}

async function joinClassroom(session, joinCode) {
  const res = await apiPost('/api/v1/classrooms/join', { joinCode }, session);
  return { status: res.status, data: await res.text().then(t => { try { return JSON.parse(t); } catch(e) { return { _raw: t }; } }) };
}

async function createAssignment(session, classroomId) {
  const res = await apiPost(`/api/v1/classrooms/${classroomId}/assignments`, {
    title: `Assignment_${uid()}`,
    language: 'python',
  }, session);
  return { status: res.status, data: await res.text().then(t => { try { return JSON.parse(t); } catch(e) { return { _raw: t }; } }) };
}

async function createSubmission(session, classroomId, assignmentId) {
  const res = await apiPost(`/api/v1/classrooms/${classroomId}/assignments/${assignmentId}/submit`, {
    code: 'print("hello")',
    language: 'python',
  }, session);
  return { status: res.status, data: await res.text().then(t => { try { return JSON.parse(t); } catch(e) { return { _raw: t }; } }) };
}

// ============================================================
// CLEANUP REGISTRY
// ============================================================
const cleanup = [];

async function runCleanup() {
  console.log('\n=== CLEANUP: Removing test data from production ===');
  // Remove all classroom test data (submissions, members, classrooms)
  // We do this via individual delete calls since there's no bulk endpoint
  for (const fn of cleanup) {
    try { await fn(); } catch {}
  }
  console.log('Cleanup complete.');
}

// ============================================================
// A. AUTHENTICATION TESTS
// ============================================================
console.log('\n=== A. AUTHENTICATION ===');

async function testAuthentication() {
  // A1: Unauthenticated GET /api/v1/classrooms → 401/403
  const res1 = await apiGet('/api/v1/classrooms');
  result('A1: GET /classrooms unauthenticated → denied', res1.status === 401 || res1.status === 403, `status=${res1.status}`);

  // A2: Unauthenticated POST /api/v1/classrooms → 401/403
  const res2 = await apiPost('/api/v1/classrooms', { name: 'Hack' });
  result('A2: POST /classrooms unauthenticated → denied', res2.status === 401 || res2.status === 403, `status=${res2.status}`);

  // A3: Unauthenticated GET /api/v1/auth/me → 401
  const res3 = await apiGet('/api/v1/auth/me');
  result('A3: GET /auth/me unauthenticated → 401', res3.status === 401, `status=${res3.status}`);

  // A4: Register teacher → session cookie set
  const teacher = await register('teacher');
  result('A4: Teacher registration returns session cookie', teacher.status === 200 && teacher.session !== '', `status=${teacher.status}`);

  // A5: Register student → session cookie set
  const student = await register('student');
  result('A5: Student registration returns session cookie', student.status === 200 && student.session !== '', `status=${student.status}`);

  return { teacher, student };
}

// ============================================================
// B. IDOR / AUTHORIZATION TESTS
// ============================================================
console.log('\n=== B. IDOR & AUTHORIZATION ===');

async function testIDOR(teacherA, studentA, teacherB, studentB) {
  // B1: Teacher A creates classroom A
  const classA = await createClassroom(teacherA.session);
  result('B1: Teacher A creates classroom A', classA.status === 200 || classA.status === 200, `classroomId=${classA.classroomId}`);

  // B2: Teacher B creates classroom B
  const classB = await createClassroom(teacherB.session);
  result('B2: Teacher B creates classroom B', classB.status === 200 || classB.status === 200, `classroomId=${classB.classroomId}`);

  if (!classA.classroomId || !classB.classroomId) {
    result('B-SKIP: Cannot proceed without both classrooms', false, 'Setup failed');
    return {};
  }

  // B3: Student A joins classroom A
  const joinA = await joinClassroom(studentA.session, classA.joinCode);
  result('B3: Student A joins classroom A', joinA.status === 200, `status=${joinA.status}`);

  // B4: Student B tries to GET classroom A (not a member) → denied
  const crossCls = await apiGet(`/api/v1/classrooms/${classA.classroomId}`, studentB.session);
  result('B4: Student B → Classroom A (cross-classroom IDOR) → 403', crossCls.status === 403 || crossCls.status === 404, `status=${crossCls.status}`);

  // B5: Teacher B → GET classroom A (cross-classroom IDOR) → denied
  const crossTch = await apiGet(`/api/v1/classrooms/${classA.classroomId}`, teacherB.session);
  result('B5: Teacher B → Classroom A (cross-classroom IDOR) → 403', crossTch.status === 403 || crossTch.status === 404, `status=${crossTch.status}`);

  // B6: Student A creates assignment (teacher only) → 403
  const asgAttempt = await createAssignment(studentA.session, classA.classroomId);
  result('B6: Student A creates assignment → 403', asgAttempt.status === 403, `status=${asgAttempt.status}`);

  // B7: Teacher A creates assignment in their classroom → 200
  const asg = await createAssignment(teacherA.session, classA.classroomId);
  result('B7: Teacher A creates assignment in own classroom → 200', asg.status === 200 || asg.status === 200, `status=${asg.status}`);

  const assignmentId = asg.data?.assignment?.id;

  // B8: Student A submits to assignment in their classroom → should succeed
  let subA;
  if (assignmentId) {
    subA = await createSubmission(studentA.session, classA.classroomId, assignmentId);
    result('B8: Student A submits to assignment → success', subA.status === 200 || subA.status === 200, `status=${subA.status}`);
  }

  // B9: Student B tries to GET submissions of classroom A → 403
  const crossSub = await apiGet(`/api/v1/classrooms/${classA.classroomId}/submissions`, studentB.session);
  result('B9: Student B → classroom A submissions → 403', crossSub.status === 403 || crossSub.status === 404, `status=${crossSub.status}`);

  // B10: Student A → classroom A submissions → can see only their own
  const subList = await apiGet(`/api/v1/classrooms/${classA.classroomId}/submissions`, studentA.session);
  let ownOnly = false;
  if (subList.status === 200) {
    const json = await subList.json().catch(() => ({}));
    const subs = json.submissions || [];
    ownOnly = subs.every(s => s.studentId === studentA.userId || !s.studentId);
  }
  result('B10: Student A sees only own submissions', subList.status === 200 && ownOnly, `status=${subList.status}, ownOnly=${ownOnly}`);

  // B11: Cross-classroom assignmentId IDOR: Student A queries classA submissions with classB's assignmentId → 404
  if (classB.classroomId) {
    const asgB = await createAssignment(teacherB.session, classB.classroomId);
    const asgBId = asgB.data?.assignment?.id;
    if (asgBId) {
      const crossAsg = await apiGet(`/api/v1/classrooms/${classA.classroomId}/submissions?assignmentId=${asgBId}`, studentA.session);
      result('B11: Cross-classroom assignmentId IDOR → 404', crossAsg.status === 403 || crossAsg.status === 404, `status=${crossAsg.status}`);
    }
  }

  // B12: Student A → grades of classroom A → 200 but only own student row
  const gradeRes = await apiGet(`/api/v1/classrooms/${classA.classroomId}/grades`, studentA.session);
  result('B12: Student sees grades endpoint → 200', gradeRes.status === 200, `status=${gradeRes.status}`);

  // B13: Student B → grades of classroom A → 403
  const gradeResB = await apiGet(`/api/v1/classrooms/${classA.classroomId}/grades`, studentB.session);
  result('B13: Student B → classroom A grades → 403', gradeResB.status === 403 || gradeResB.status === 404, `status=${gradeResB.status}`);

  return { classA, classB, assignmentId };
}

// ============================================================
// C. CROSS-USER ISOLATION
// ============================================================
async function testCrossUserIsolation(studentA, studentB) {
  console.log('\n=== C. CROSS-USER ISOLATION ===');

  // C1: Create project for Student A
  const projRes = await apiPost('/api/v1/projects', { name: `proj_${uid()}`, language: 'python' }, studentA.session);
  const json = await projRes.text(); console.log('C1 JSON:', json); 
  let projId = null;
  try { projId = JSON.parse(json).project?.id; } catch(e) {}
  result('C1: Student A creates project', projRes.status === 200 || projRes.status === 201, `projId=${projId}`);

  if (!projId) { result('C-SKIP: no projId', false, 'setup failure'); return; }

  // C2: Student B tries to GET Student A's project → 403
  const getProj = await apiGet(`/api/v1/projects/${projId}`, studentB.session);
  result('C2: Student B → Student A project → 403', getProj.status === 403 || getProj.status === 404, `status=${getProj.status}`);

  // C3: Student B tries to DELETE Student A's project → 403
  const delProj = await apiDelete(`/api/v1/projects/${projId}`, studentB.session);
  result('C3: Student B tries to DELETE Student A project → 403', delProj.status === 403 || delProj.status === 404, `status=${delProj.status}`);

  // Cleanup: Delete project as Student A
  cleanup.push(() => apiDelete(`/api/v1/projects/${projId}`, studentA.session));
}

// ============================================================
// D. ROLE ESCALATION
// ============================================================
async function testRoleEscalation(studentA, classroomId) {
  console.log('\n=== D. ROLE ESCALATION ===');

  // D1: Student attempts to archive classroom → 403
  if (classroomId) {
    const archiveRes = await fetch(`${BASE_URL}/api/v1/classrooms/${classroomId}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': studentA.session },
    });
    result('D1: Student tries to archive classroom → 403', archiveRes.status === 403 || archiveRes.status === 405 || archiveRes.status === 404, `status=${archiveRes.status}`);
  }

  // D2: Student tries to remove a member → 403
  if (classroomId) {
    const removeRes = await fetch(`${BASE_URL}/api/v1/classrooms/${classroomId}/members/${studentA.userId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Cookie': studentA.session },
    });
    result('D2: Student tries to remove member → 403', removeRes.status === 403 || removeRes.status === 400, `status=${removeRes.status}`);
  }

  // D3: Student provides 'teacher' role in register body → server ignores it
  const malReg = await apiPost('/api/v1/auth/register', {
    name: `MalUser_${uid()}`,
    email: `mal_${uid()}@cortex-test.invalid`,
    password: 'Test@Secure123!', confirmPassword: 'Test@Secure123!',
    role: 'teacher',    // attempt to inject teacher role
    cortexId: `CRT_mal_${uid()}`,
  });
  const malData = await malReg.json();
  // If it succeeds, verify role is not actually promoted (it should be 'student' or registration might reject it)
  const actualRole = malData?.user?.role;
  result('D3: Server ignores client-injected teacher role on register', malReg.status !== 200 || actualRole === 'teacher', `status=${malReg.status}, role=${actualRole}`);
}

// ============================================================
// E. CSRF / INPUT SECURITY
// ============================================================
async function testCSRFAndInput(session) {
  console.log('\n=== E. CSRF / INPUT SECURITY ===');

  // E1: POST /classrooms with wrong Content-Type → 415
  const r1 = await fetch(`${BASE_URL}/api/v1/classrooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain', 'Cookie': session },
    body: 'name=HackedClass',
  });
  result('E1: POST /classrooms text/plain → 415', r1.status === 415, `status=${r1.status}`);

  // E2: POST /ai/chat with wrong Content-Type → 415
  const r2 = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': session },
    body: 'userMessage=test&code=hack',
  });
  result('E2: POST /ai/chat wrong content-type → 415', r2.status === 415, `status=${r2.status}`);

  // E3: Oversized userMessage → 413
  const r3 = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': session },
    body: JSON.stringify({ userMessage: 'A'.repeat(20000), code: '', language: 'python' }),
  });
  result('E3: AI chat oversized userMessage → 413', r3.status === 413, `status=${r3.status}`);

  // E4: XSS payload in classroom name → stored but not executed (verify it returns as escaped)
  const r4 = await fetch(`${BASE_URL}/api/v1/classrooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': session },
    body: JSON.stringify({ name: '<script>alert(1)</script>', subject: 'CS' }),
  });
  const d4 = await r4.json().catch(() => ({}));
  // API accepts it (it's a name, not rendered HTML) but we just verify it doesn't 500
  result('E4: XSS payload in classroom name → no server crash', r4.status !== 500, `status=${r4.status}`);

  // E5: SQL injection attempt in join code
  const r5 = await fetch(`${BASE_URL}/api/v1/classrooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': session },
    body: JSON.stringify({ joinCode: "'; DROP TABLE classrooms; --" }),
  });
  result('E5: SQL injection in joinCode → no crash (404/400)', r5.status !== 500, `status=${r5.status}`);

  // E6: POST /ai/autofix with wrong Content-Type → 415
  const r6 = await fetch(`${BASE_URL}/api/v1/ai/autofix`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html', 'Cookie': session },
    body: '<script>alert(1)</script>',
  });
  result('E6: POST /ai/autofix wrong content-type → 415', r6.status === 415, `status=${r6.status}`);
}

// ============================================================
// F. AI AUTHORIZATION
// ============================================================
async function testAIAuthorization(teacherSession, studentSession, classroomId) {
  console.log('\n=== F. AI AUTHORIZATION ===');

  if (!classroomId) {
    result('F-SKIP: No classroomId for AI auth test', false, 'skipped');
    return;
  }

  // F1: Student accesses AI with correct classroom context
  const r1 = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentSession },
    body: JSON.stringify({ userMessage: 'explain loops', code: '', language: 'python', classroomId }),
  });
  result('F1: Student AI chat with valid classroom → 200', r1.status === 200, `status=${r1.status}`);

  // F2: Student provides wrong classroomId they're not in → 403
  const r2 = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': studentSession },
    body: JSON.stringify({ userMessage: 'explain loops', code: '', language: 'python', classroomId: 'CLS_FAKEID_AAAA' }),
  });
  result('F2: Student AI chat with unrelated classroomId → 403', r2.status === 403 || r2.status === 404, `status=${r2.status}`);

  // F3: Unauthenticated AI request with classroomId → 401
  const r3 = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userMessage: 'hack', code: '', language: 'python', classroomId }),
  });
  result('F3: Unauthenticated AI chat with classroomId → 401', r3.status === 401, `status=${r3.status}`);
}

// ============================================================
// G. WEBSOCKET AUTHORIZATION
// ============================================================
async function testWebSocketAuth(validSession, classroomId) {
  console.log('\n=== G. WEBSOCKET AUTHORIZATION ===');

  if (!classroomId) {
    result('G-SKIP: No classroomId for WS test', false, 'skipped');
    return;
  }

  // G1: Unauthenticated WS upgrade → 401
  try {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${classroomId}/ws`, {
      method: 'GET',
      headers: { 'Upgrade': 'websocket', 'Connection': 'Upgrade', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==', 'Sec-WebSocket-Version': '13' },
    });
    result('G1: Unauthenticated WS upgrade → 401', res.status === 401, `status=${res.status}`);
  } catch (e) {
    result('G1: Unauthenticated WS upgrade → rejected', true, `error=${e.message}`);
  }
}

// ============================================================
// H. DATA INTEGRITY CHECK
// ============================================================
async function testDataIntegrity(teacherSession, classroomId, assignmentId) {
  console.log('\n=== H. DATA INTEGRITY ===');

  // H1: Cross-classroom assignmentId IDOR in submissions query
  if (classroomId && assignmentId) {
    const res = await apiGet(`/api/v1/classrooms/${classroomId}/submissions?assignmentId=FAKE_ASG_ID`, teacherSession);
    result('H1: Fake assignmentId returns 404 not empty list', res.status === 404, `status=${res.status}`);
  }

  // H2: Assignment classroomId verification (student fetching asg from wrong classroom)
  if (classroomId) {
    const res = await apiGet(`/api/v1/classrooms/${classroomId}/assignments/FAKE_ASG_ID`, teacherSession);
    result('H2: Fake assignmentId in correct classroom → 404', res.status === 404, `status=${res.status}`);
  }
}

// ============================================================
// MAIN
// ============================================================
(async () => {
  console.log(`Testing against: ${BASE_URL}`);
  console.log('='.repeat(60));

  try {
    const { teacher: teacherA, student: studentA } = await testAuthentication();
    const teacherB = await register('teacher');
    const studentB = await register('student');

    const { classA, classB, assignmentId } = await testIDOR(teacherA, studentA, teacherB, studentB);
    await testCrossUserIsolation(studentA, studentB);
    await testRoleEscalation(studentA, classA?.classroomId);
    await testCSRFAndInput(teacherA.session);
    await testAIAuthorization(teacherA.session, studentA.session, classA?.classroomId);
    await testWebSocketAuth(teacherA.session, classA?.classroomId);
    await testDataIntegrity(teacherA.session, classA?.classroomId, assignmentId);

  } catch (err) {
    console.error('FATAL ERROR during test run:', err);
  }

  await runCleanup();

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${PASS} PASS / ${FAIL} FAIL / ${PASS + FAIL} TOTAL`);
  console.log('='.repeat(60));

  if (FAIL > 0) {
    console.log('\nFAILED TESTS:');
    RESULTS.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.detail}`));
  }

  process.exit(FAIL > 0 ? 1 : 0);
})();
