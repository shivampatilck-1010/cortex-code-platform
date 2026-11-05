/**
 * Cortex Online Examination System — Phase 3.7
 * Test Suite 4: Staging D1 Database Integrity, Foreign Keys & Concurrency Safety
 *
 * Runs live tests against Cloudflare staging environment:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Zero emojis in logs.
 * Strict database consistency assertions.
 */

const BASE_URL = process.env.STAGING_URL || 'https://cortex-code-platform-staging.cortexbuild1.workers.dev';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function api(path: string, options: RequestInit = {}): Promise<{ status: number; data: any; headers: Headers }> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers };
}

async function run() {
  console.log('================================================================');
  console.log('PHASE 3.7: STAGING D1 DATABASE INTEGRITY & IDEMPOTENCY SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Date.now().toString(36);
  const teacherEmail = `d1_prof_${runId}@cortex-staging.edu`;
  const studentEmail = `d1_stud_${runId}@cortex-staging.edu`;
  const password = `D1IntegrityP@ss#${runId}`;

  // 1. Setup Teacher & Student
  const tReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Database Integrity Auditor',
      email: teacherEmail,
      cortexId: `prof_d1_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tReg.status === 200 || tReg.status === 201, 'Integrity auditor teacher registered');
  const teacherCookie = tReg.headers.get('set-cookie') || '';

  const sReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Integrity Candidate',
      email: studentEmail,
      cortexId: `stud_d1_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(sReg.status === 200 || sReg.status === 201, 'Integrity candidate registered');
  const studentCookie = sReg.headers.get('set-cookie') || '';

  // 2. Create Classroom
  const cRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `D1 Integrity Lab (${runId})`,
      subject: 'Database Systems',
      courseCode: `D1-${runId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: {},
    }),
  });
  assert(cRes.status === 200 || cRes.status === 201, 'Classroom created');
  const classroom = cRes.data.classroom || cRes.data;
  const classroomId = classroom.id;
  const joinCode = classroom.joinCode || classroom.joincode;

  await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ joinCode }),
  });

  // 3. Create Examination
  const examRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'D1 Consistency & Idempotency Exam',
      durationMinutes: 60,
      passingMarks: 50,
      showResultsImmediately: true,
    }),
  });
  assert(examRes.status === 200 || examRes.status === 201, 'Examination created');
  const exam = examRes.data.exam || examRes.data;
  const examId = exam.id;

  const secRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Database Section',
      description: 'Integrity tests',
      sortOrder: 1,
    }),
  });
  const sec = secRes.data.section || secRes.data;

  const qRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: sec.id,
      questionType: 'mcq_single',
      promptText: 'Which isolation level prevents phantom reads?',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_ser', text: 'Serializable' },
        { id: 'opt_rc', text: 'Read Committed' },
      ],
      correctAnswer: { optionId: 'opt_ser' },
    }),
  });
  const q = qRes.data.question || qRes.data;
  const qId = q.id;

  await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });

  // 4. Session Start Idempotency
  console.log('--- TEST 1: SESSION START IDEMPOTENCY ---');
  const startCalls = await Promise.all([
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, { method: 'POST', headers: { Cookie: studentCookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, { method: 'POST', headers: { Cookie: studentCookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, { method: 'POST', headers: { Cookie: studentCookie } }),
  ]);
  const sessionIds = startCalls.map((c) => (c.data.session ? c.data.session.id : c.data.id));
  const uniqueSessionIds = new Set(sessionIds);
  assert(uniqueSessionIds.size === 1, 'Idempotency: Concurrent start calls resolved to exactly 1 session ID');
  const sessionId = Array.from(uniqueSessionIds)[0];

  // 5. Atomic Upsert & Uniqueness on (sessionId, questionId)
  console.log('\n--- TEST 2: CONCURRENT ATOMIC UPSERT INTEGRITY ---');
  // Fire 10 simultaneous response updates to the EXACT same question
  const now = Date.now();
  const concurrentSaves = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
        method: 'POST',
        headers: { Cookie: studentCookie },
        body: JSON.stringify({
          questionId: qId,
          response: { optionId: i % 2 === 0 ? 'opt_ser' : 'opt_rc' },
          clientTimestamp: now + i * 10,
        }),
      })
    )
  );

  const saveFailures = concurrentSaves.filter((r) => r.status !== 200);
  assert(saveFailures.length === 0, 'Concurrency: All 10 concurrent response writes succeeded (0 HTTP failures)');

  // Fetch responses from database: must contain EXACTLY ONE record for qId!
  const fetchResponses = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  const matching = fetchResponses.data.responses.filter((r: any) => r.questionId === qId);
  assert(matching.length === 1, `Database Integrity: (sessionId, questionId) contains exactly 1 row (found: ${matching.length})`);
  // The highest timestamp is now + 90, which corresponds to i=9 (opt_rc)
  assert(matching[0].response.optionId === 'opt_rc', 'Database Integrity: Highest timestamp was persisted');

  // 6. Heartbeat Idempotency
  console.log('\n--- TEST 3: HEARTBEAT IDEMPOTENCY ---');
  const hbCalls = await Promise.all([
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/heartbeat`, { method: 'POST', headers: { Cookie: studentCookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/heartbeat`, { method: 'POST', headers: { Cookie: studentCookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/heartbeat`, { method: 'POST', headers: { Cookie: studentCookie } }),
  ]);
  const hbFailures = hbCalls.filter((r) => r.status !== 200);
  assert(hbFailures.length === 0, 'Idempotency: Concurrent heartbeats processed cleanly');

  // 7. Final Submission & Lock Idempotency
  console.log('\n--- TEST 4: CONCURRENT SUBMISSIONS IDEMPOTENCY ---');
  const submitCalls = await Promise.all([
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`, { method: 'POST', headers: { Cookie: studentCookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`, { method: 'POST', headers: { Cookie: studentCookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`, { method: 'POST', headers: { Cookie: studentCookie } }),
  ]);
  // Exactly 1 must return 200, and others return 400 (already submitted)
  const okSubmits = submitCalls.filter((r) => r.status === 200);
  const lockedSubmits = submitCalls.filter((r) => r.status === 400);
  assert(okSubmits.length === 1, 'Idempotency: Exactly one concurrent submit succeeded (status 200)');
  assert(lockedSubmits.length === 2, 'Idempotency: Redundant concurrent submits locked out (status 400)');

  console.log('\n================================================================');
  console.log('PHASE 3.7 D1 DATABASE INTEGRITY & CONCURRENCY SUITE COMPLETE');
  console.log(`Total Assertions: ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal database integrity failure:', err);
  process.exit(1);
});
