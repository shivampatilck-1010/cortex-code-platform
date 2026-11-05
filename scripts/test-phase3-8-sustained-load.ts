/**
 * Cortex Online Examination System — Phase 3.8
 * Sustained Concurrency & Load Benchmark Suite (Cohorts: 25, 50, 100, 150)
 *
 * Runs live against Cloudflare staging environment:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Measures:
 * 1. Concurrent Session Starts (/start)
 * 2. Optimized Autosave Responses (/responses with touchSessionHeartbeat)
 * 3. Candidate Heartbeats (/heartbeat with touchSessionHeartbeat)
 * 4. Burst Submissions (/submit)
 *
 * Strictly zero emojis.
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

async function api(path: string, options: RequestInit = {}): Promise<{ status: number; data: any; headers: Headers; latency: number }> {
  const url = `${BASE_URL}${path}`;
  const start = performance.now();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const latency = Math.round(performance.now() - start);

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, headers: res.headers, latency };
}

function calculatePercentiles(latencies: number[]) {
  if (latencies.length === 0) return { p50: 0, p90: 0, p95: 0, max: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const max = sorted[sorted.length - 1];
  return { p50, p90, p95, max };
}

interface CohortSummary {
  cohortSize: number;
  startMetrics: { p50: number; p90: number; p95: number; max: number };
  saveMetrics: { p50: number; p90: number; p95: number; max: number };
  heartbeatMetrics: { p50: number; p90: number; p95: number; max: number };
  submitMetrics: { p50: number; p90: number; p95: number; max: number };
}

async function runCohort(
  cohortSize: number,
  classroomId: string,
  joinCode: string,
  examId: string,
  questionId: string
): Promise<CohortSummary> {
  console.log(`\n================================================================`);
  console.log(`EXECUTING SUSTAINED LOAD TEST: COHORT SIZE ${cohortSize}`);
  console.log(`================================================================`);

  const runId = Math.random().toString(36).substring(2, 7);
  const password = `LoadP@ss#${cohortSize}_${runId}`;

  // 1. Concurrent Registration of Students
  console.log(`[COHORT ${cohortSize}] Registering ${cohortSize} concurrent student accounts...`);
  const regStart = performance.now();
  const studentCredentials = Array.from({ length: cohortSize }, (_, i) => ({
    name: `Load Candidate ${cohortSize}_${i + 1}`,
    email: `load38_${cohortSize}_${i + 1}_${runId}@cortex-staging.edu`,
    cortexId: `c38_${cohortSize}_${i + 1}_${runId}`,
    password,
    confirmPassword: password,
    role: 'student',
  }));

  const regResults = await Promise.all(
    studentCredentials.map((cred) =>
      api('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(cred),
      })
    )
  );

  const regFailures = regResults.filter((r) => r.status !== 200 && r.status !== 201);
  assert(regFailures.length === 0, `[COHORT ${cohortSize}] All ${cohortSize} students registered (failures: ${regFailures.length})`);
  const studentCookies = regResults.map((r) => r.headers.get('set-cookie') || '');

  // 2. Concurrent Classroom Join
  console.log(`[COHORT ${cohortSize}] Enrolling ${cohortSize} students into classroom...`);
  const joinResults = await Promise.all(
    studentCookies.map((cookie) =>
      api('/api/v1/classrooms/join', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({ joinCode }),
      })
    )
  );
  const joinFailures = joinResults.filter((r) => r.status !== 200 && r.status !== 201);
  assert(joinFailures.length === 0, `[COHORT ${cohortSize}] All ${cohortSize} students joined classroom (failures: ${joinFailures.length})`);
  console.log(`[COHORT ${cohortSize}] Enrollment complete in ${Math.round(performance.now() - regStart)}ms`);

  // 3. Burst Start Exam (All calling /start concurrently)
  console.log(`[COHORT ${cohortSize}] Burst Exam Start (${cohortSize} simultaneous requests)...`);
  const startResults = await Promise.all(
    studentCookies.map((cookie) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
        method: 'POST',
        headers: { Cookie: cookie },
      })
    )
  );
  const startLatencies = startResults.map((r) => r.latency);
  const startFailures = startResults.filter((r) => r.status !== 200 && r.status !== 201);
  const startMetrics = calculatePercentiles(startLatencies);

  assert(startFailures.length === 0, `[COHORT ${cohortSize}] All ${cohortSize} sessions started (p50: ${startMetrics.p50}ms, p95: ${startMetrics.p95}ms, max: ${startMetrics.max}ms)`);
  const sessionIds = startResults.map((r) => (r.data.session ? r.data.session.id : r.data.id));

  // 4. Optimized Autosave Responses (with touchSessionHeartbeat)
  console.log(`[COHORT ${cohortSize}] Optimized Autosaves across cohort (PUT /responses)...`);
  const saveResults = await Promise.all(
    sessionIds.map((sessionId, idx) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
        method: 'PUT',
        headers: { Cookie: studentCookies[idx] },
        body: JSON.stringify({
          questionId,
          response: { optionId: 'opt_avail' },
          clientTimestamp: Date.now(),
        }),
      })
    )
  );
  const saveLatencies = saveResults.map((r) => r.latency);
  const saveFailures = saveResults.filter((r) => r.status !== 200);
  const saveMetrics = calculatePercentiles(saveLatencies);

  assert(saveFailures.length === 0, `[COHORT ${cohortSize}] All ${cohortSize} autosaves persisted (p50: ${saveMetrics.p50}ms, p95: ${saveMetrics.p95}ms, max: ${saveMetrics.max}ms)`);

  // 5. Candidate Heartbeats (with touchSessionHeartbeat)
  console.log(`[COHORT ${cohortSize}] Candidate Heartbeats across cohort (POST /heartbeat)...`);
  const heartbeatResults = await Promise.all(
    sessionIds.map((sessionId, idx) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
        headers: { Cookie: studentCookies[idx] },
        body: JSON.stringify({}),
      })
    )
  );
  const heartbeatLatencies = heartbeatResults.map((r) => r.latency);
  const heartbeatFailures = heartbeatResults.filter((r) => r.status !== 200);
  const heartbeatMetrics = calculatePercentiles(heartbeatLatencies);

  assert(heartbeatFailures.length === 0, `[COHORT ${cohortSize}] All ${cohortSize} heartbeats acknowledged (p50: ${heartbeatMetrics.p50}ms, p95: ${heartbeatMetrics.p95}ms, max: ${heartbeatMetrics.max}ms)`);

  // 6. Burst Submission
  console.log(`[COHORT ${cohortSize}] Burst Final Submission (${cohortSize} simultaneous requests)...`);
  const submitResults = await Promise.all(
    sessionIds.map((sessionId, idx) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: { Cookie: studentCookies[idx] },
        body: JSON.stringify({}),
      })
    )
  );
  const submitLatencies = submitResults.map((r) => r.latency);
  const submitFailures = submitResults.filter((r) => r.status !== 200);
  const submitMetrics = calculatePercentiles(submitLatencies);

  assert(submitFailures.length === 0, `[COHORT ${cohortSize}] All ${cohortSize} submissions processed (p50: ${submitMetrics.p50}ms, p95: ${submitMetrics.p95}ms, max: ${submitMetrics.max}ms)`);

  console.log(`\n--- COHORT ${cohortSize} BENCHMARK SUMMARY ---`);
  console.log(`* Concurrency:       ${cohortSize} active students`);
  console.log(`* Start Exam:        p50 = ${startMetrics.p50}ms | p90 = ${startMetrics.p90}ms | p95 = ${startMetrics.p95}ms | max = ${startMetrics.max}ms`);
  console.log(`* Autosave Response: p50 = ${saveMetrics.p50}ms | p90 = ${saveMetrics.p90}ms | p95 = ${saveMetrics.p95}ms | max = ${saveMetrics.max}ms`);
  console.log(`* Candidate Beat:    p50 = ${heartbeatMetrics.p50}ms | p90 = ${heartbeatMetrics.p90}ms | p95 = ${heartbeatMetrics.p95}ms | max = ${heartbeatMetrics.max}ms`);
  console.log(`* Burst Submit:      p50 = ${submitMetrics.p50}ms | p90 = ${submitMetrics.p90}ms | p95 = ${submitMetrics.p95}ms | max = ${submitMetrics.max}ms`);
  console.log(`* Error Rate:        0.00%`);
  console.log(`----------------------------------------------------------------\n`);

  return {
    cohortSize,
    startMetrics,
    saveMetrics,
    heartbeatMetrics,
    submitMetrics,
  };
}

async function run() {
  console.log('================================================================');
  console.log('PHASE 3.8: CONCURRENCY & SUSTAINED LOAD TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Date.now().toString(36);
  const teacherEmail = `load38_prof_${runId}@cortex-staging.edu`;
  const password = `LoadInstructorP@ss#${runId}`;

  // Setup Teacher & Benchmark Classroom
  const tReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Load Benchmark Instructor 3.8',
      email: teacherEmail,
      cortexId: `p38_load_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tReg.status === 200 || tReg.status === 201, 'Load benchmark teacher registered');
  const teacherCookie = tReg.headers.get('set-cookie') || '';

  const cRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `Phase 3.8 Benchmarks (${runId})`,
      subject: 'Performance Engineering',
      courseCode: `P38LOAD-${runId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: {},
    }),
  });
  assert(cRes.status === 200 || cRes.status === 201, 'Benchmark classroom created');
  const classroom = cRes.data.classroom || cRes.data;
  const classroomId = classroom.id;
  const joinCode = classroom.joinCode || classroom.joincode;

  // Create High-Capacity Benchmark Exam
  const examRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Phase 3.8 Sustained Load Benchmark',
      description: 'System stress test for cohorts up to 150 candidates',
      durationMinutes: 120,
      passingMarks: 50,
      showResultsImmediately: true,
    }),
  });
  assert(examRes.status === 200 || examRes.status === 201, 'Benchmark exam created');
  const exam = examRes.data.exam || examRes.data;
  const examId = exam.id;

  // Add Section & Question
  const secRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Benchmark Section',
      description: 'Load test questions',
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
      promptText: 'Benchmark load verification question',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_avail', text: 'High Availability' },
        { id: 'opt_stale', text: 'Stale' },
      ],
      correctAnswer: { optionId: 'opt_avail' },
    }),
  });
  const q = qRes.data.question || qRes.data;
  const questionId = q.id;

  await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });

  // Execute Cohorts
  const summary25 = await runCohort(25, classroomId, joinCode, examId, questionId);
  const summary50 = await runCohort(50, classroomId, joinCode, examId, questionId);
  const summary100 = await runCohort(100, classroomId, joinCode, examId, questionId);
  const summary150 = await runCohort(150, classroomId, joinCode, examId, questionId);

  console.log('\n================================================================');
  console.log('ALL CONCURRENCY COHORTS COMPLETED SUCCESSFULLY');
  console.log(`Cohorts Verified: 25, 50, 100, 150 students`);
  console.log(`Total Assertions: ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);
  console.log('================================================================\n');

  console.log('--- COMPREHENSIVE PERFORMANCE TABLE ---');
  console.log(JSON.stringify([summary25, summary50, summary100, summary150], null, 2));
}

run().catch((err) => {
  console.error('Fatal load test failure:', err);
  process.exit(1);
});
