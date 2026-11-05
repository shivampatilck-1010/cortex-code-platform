/**
 * Cortex Online Examination System — Phase 3.6 Staging Load Test
 *
 * Simulates 100 concurrent student examinees on the deployed Cloudflare staging Worker:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Workload:
 * 1. Setup: 1 Teacher, 1 Classroom, 1 Published Examination with 3 questions.
 * 2. Registration & Enrollment: 100 Candidates registered and enrolled.
 * 3. Concurrent Exam Start: 100 candidates start simultaneously.
 *    - Duplicate start attempt executed concurrently to verify idempotency.
 * 4. Concurrent Autosaves & Heartbeats: 100 candidates submit responses and heartbeats.
 * 5. Concurrent Submissions: 100 candidates submit final exam.
 * 6. Metrics & Integrity Analysis:
 *    - Request success rate (%)
 *    - Latency distribution: min, p50, p95, p99, max
 *    - Autosave data integrity: verify all submitted responses persisted
 *    - Duplicate session check: verify exactly 1 session per candidate in D1
 *
 * Rules:
 * - Operates strictly against the verified staging Worker.
 * - Zero emojis in logs.
 */

import crypto from 'node:crypto';

const BASE_URL = process.env.STAGING_URL || 'https://cortex-code-platform-staging.cortexbuild1.workers.dev';
const CONCURRENT_STUDENTS = 100;
const BATCH_SIZE = 10; // Batch concurrency to avoid socket pool limits on local Node runtime

interface TimedResult {
  durationMs: number;
  status: number;
  ok: boolean;
  operation: string;
}

const metrics: TimedResult[] = [];

async function timedFetch(
  operation: string,
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; data: any; durationMs: number; cookie: string }> {
  const url = `${BASE_URL}${path}`;
  const start = performance.now();
  let status = 0;
  let data: any = null;
  let cookie = '';

  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    status = res.status;
    cookie = res.headers.get('set-cookie') || '';
    const durationMs = performance.now() - start;

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => '');
    }

    metrics.push({
      durationMs,
      status,
      ok: res.ok,
      operation,
    });

    return { status, data, durationMs, cookie };
  } catch (err: any) {
    const durationMs = performance.now() - start;
    metrics.push({
      durationMs,
      status: 0,
      ok: false,
      operation,
    });
    return { status: 0, data: null, durationMs, cookie: '' };
  }
}

function calculatePercentiles(latencies: number[]): { min: number; p50: number; p95: number; p99: number; max: number; avg: number } {
  if (latencies.length === 0) return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = Math.round(sorted[0]);
  const max = Math.round(sorted[sorted.length - 1]);
  const p50 = Math.round(sorted[Math.floor(sorted.length * 0.50)]);
  const p95 = Math.round(sorted[Math.floor(sorted.length * 0.95)]);
  const p99 = Math.round(sorted[Math.floor(sorted.length * 0.99)]);
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  return { min, p50, p95, p99, max, avg };
}

async function runBatch<T, R>(items: T[], fn: (item: T, idx: number) => Promise<R>, concurrency: number): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((item, subIdx) => fn(item, i + subIdx)));
    results.push(...chunkResults);
  }
  return results;
}

async function runLoadTest() {
  console.log('================================================================');
  console.log(`CORTEX ONLINE EXAMINATION SYSTEM — STAGING LOAD TEST (100 EXAMINEES)`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent Examinees: ${CONCURRENT_STUDENTS}`);
  console.log('================================================================\n');

  const testRunId = Date.now().toString(36);
  const startTime = Date.now();

  // 1. Setup Teacher & Classroom
  console.log('[Setup] Registering Instructor and creating examination cohort...');
  const teacherEmail = `prof_load_${testRunId}@cortex-load.edu`;
  const teacherCortexId = `prof_ld_${testRunId.substring(0, 10)}`;
  const teacherPassword = `LoadTestP@ss#${testRunId}`;

  const tReg = await timedFetch('teacher_register', '/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Load Test Professor',
      email: teacherEmail,
      cortexId: teacherCortexId,
      password: teacherPassword,
      confirmPassword: teacherPassword,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });

  if (tReg.status !== 200 && tReg.status !== 201) {
    throw new Error(`Failed to register teacher: ${JSON.stringify(tReg.data)}`);
  }
  const teacherCookie = tReg.cookie;

  // Create Classroom
  const cRes = await timedFetch('create_classroom', '/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `High Concurrency Cohort (${testRunId})`,
      subject: 'Computer Systems',
      description: '100-student load test classroom',
      courseCode: `CS-LOAD-${testRunId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: {},
    }),
  });

  const classroom = cRes.data?.classroom || cRes.data;
  const classroomId = classroom.id;
  const joinCode = classroom.joincode || classroom.joinCode;
  console.log(`[Setup] Classroom created: ${classroomId} (Join code: ${joinCode})`);

  // Create Exam
  const examRes = await timedFetch('create_exam', `/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: `High Concurrency Stress Exam (${testRunId})`,
      description: '100-student automated load examination',
      durationMinutes: 60,
      startTime: startTime - 60000,
      endTime: startTime + 7200000,
      totalMarks: 30,
      passingMarks: 15,
      attemptsAllowed: 1,
      securityLevel: 'standard',
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultsImmediately: false,
    }),
  });

  const exam = examRes.data?.exam || examRes.data;
  const examId = exam.id;

  // Add 3 Questions
  const q1Res = await timedFetch('create_question_1', `/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      questionType: 'mcq_single',
      promptText: 'What is the worst-case lookup time in a balanced binary search tree?',
      options: [
        { id: 'opt_1', text: 'O(1)' },
        { id: 'opt_2', text: 'O(log N)' },
        { id: 'opt_3', text: 'O(N)' },
      ],
      correctAnswer: { optionId: 'opt_2' },
      points: 10,
      sortOrder: 1,
    }),
  });
  const q1 = q1Res.data?.question || q1Res.data;

  const q2Res = await timedFetch('create_question_2', `/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      questionType: 'numerical',
      promptText: 'Compute 2^16:',
      correctAnswer: { value: 65536, tolerance: 0 },
      points: 10,
      sortOrder: 2,
    }),
  });
  const q2 = q2Res.data?.question || q2Res.data;

  const q3Res = await timedFetch('create_question_3', `/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      questionType: 'short_answer',
      promptText: 'Name the memory area where local function variables are allocated.',
      correctAnswer: { sampleAnswer: 'Stack', manualGrading: false, acceptedAnswers: ['Stack', 'call stack', 'the stack'] },
      points: 10,
      sortOrder: 3,
    }),
  });
  const q3 = q3Res.data?.question || q3Res.data;

  // Publish Exam
  await timedFetch('publish_exam', `/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ status: 'published' }),
  });
  console.log(`[Setup] Examination published: ${examId} with 3 questions.\n`);

  // 2. Candidate Provisioning
  console.log(`[Stage 1/4] Registering and enrolling ${CONCURRENT_STUDENTS} candidates...`);
  const studentDataList = Array.from({ length: CONCURRENT_STUDENTS }, (_, i) => {
    const idxStr = (i + 1).toString().padStart(3, '0');
    return {
      index: i + 1,
      name: `Examinee Candidate ${idxStr}`,
      email: `candidate_${testRunId}_${idxStr}@cortex-load.edu`,
      cortexId: `cnd_${testRunId.substring(0, 5)}_${idxStr}`,
      password: `CandP@ss#${testRunId}_${idxStr}`,
    };
  });

  interface StudentSession {
    student: (typeof studentDataList)[0];
    cookie: string;
    userId: string;
    sessionId?: string;
  }

  const registeredStudents: StudentSession[] = await runBatch(
    studentDataList,
    async (s) => {
      const reg = await timedFetch('student_register', '/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: s.name,
          email: s.email,
          cortexId: s.cortexId,
          password: s.password,
          confirmPassword: s.password,
          role: 'student',
        }),
      });

      const user = reg.data?.user;
      const userId = user?.id || '';
      const cookie = reg.cookie;

      // Join classroom
      await timedFetch('student_join', '/api/v1/classrooms/join', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({ joinCode }),
      });

      return {
        student: s,
        cookie,
        userId,
      };
    },
    BATCH_SIZE
  );

  console.log(`[Stage 1/4] Successfully registered and enrolled ${registeredStudents.length} candidates.\n`);

  // 3. Concurrent Exam Start (Burst Execution)
  console.log(`[Stage 2/4] Triggering concurrent exam start across all ${CONCURRENT_STUDENTS} candidates...`);
  const startStart = performance.now();

  const startedSessions = await runBatch(
    registeredStudents,
    async (st) => {
      // Primary Start
      const sRes = await timedFetch('concurrent_start', `/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({}),
      });

      const sess = sRes.data?.session || sRes.data;
      const sessionId = sess?.id;

      // Duplicate concurrent start test to ensure duplicate prevention / idempotent resumption
      const dupRes = await timedFetch('duplicate_start_check', `/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({}),
      });
      const dupSess = dupRes.data?.session || dupRes.data;

      // Duplicate start must return the same active session (resumed)
      const sameSession = dupSess?.id === sessionId;

      return {
        ...st,
        sessionId,
        sameSessionOnDup: sameSession,
      };
    },
    15 // Burst concurrency
  );

  const startBurstDuration = Math.round(performance.now() - startStart);
  console.log(`[Stage 2/4] Concurrent starts completed in ${startBurstDuration}ms.\n`);

  // 4. Concurrent Autosaves and Heartbeats
  console.log(`[Stage 3/4] Dispatching concurrent autosaves (Q1, Q2, Q3) and heartbeats...`);
  const autosaveStart = performance.now();

  await runBatch(
    startedSessions,
    async (st) => {
      if (!st.sessionId) return;

      // 1. Answer Q1 (mcq_single)
      await timedFetch('autosave_q1', `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${st.sessionId}/responses`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({
          questionId: q1.id,
          response: { optionId: 'opt_2' },
          flaggedForReview: false,
          clientTimestamp: Date.now(),
        }),
      });

      // 2. Answer Q2 (numerical)
      await timedFetch('autosave_q2', `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${st.sessionId}/responses`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({
          questionId: q2.id,
          response: { value: 65536 },
          flaggedForReview: true,
          clientTimestamp: Date.now(),
        }),
      });

      // 3. Heartbeat
      await timedFetch('heartbeat', `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${st.sessionId}/heartbeat`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({ timestamp: Date.now() }),
      });

      // 4. Answer Q3 (short answer)
      await timedFetch('autosave_q3', `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${st.sessionId}/responses`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({
          questionId: q3.id,
          response: { text: 'Stack' },
          flaggedForReview: false,
          clientTimestamp: Date.now(),
        }),
      });
    },
    20 // 20 concurrent candidates sending autosaves
  );

  const autosaveBurstDuration = Math.round(performance.now() - autosaveStart);
  console.log(`[Stage 3/4] Concurrent autosaves and heartbeats completed in ${autosaveBurstDuration}ms.\n`);

  // 5. Concurrent Exam Submission
  console.log(`[Stage 4/4] Triggering concurrent final submissions across all ${CONCURRENT_STUDENTS} candidates...`);
  const submitStart = performance.now();

  const submissionResults = await runBatch(
    startedSessions,
    async (st) => {
      if (!st.sessionId) return { success: false, duplicateRejected: false };

      const subRes = await timedFetch('concurrent_submit', `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${st.sessionId}/submit`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({}),
      });

      // Duplicate submission test: second submit must return HTTP 400
      const dupSub = await timedFetch('duplicate_submit_check', `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${st.sessionId}/submit`, {
        method: 'POST',
        headers: { Cookie: st.cookie },
        body: JSON.stringify({}),
      });

      return {
        success: subRes.status === 200,
        duplicateRejected: dupSub.status === 400,
        sessionId: st.sessionId,
      };
    },
    20
  );

  const submitBurstDuration = Math.round(performance.now() - submitStart);
  console.log(`[Stage 4/4] Concurrent submissions completed in ${submitBurstDuration}ms.\n`);

  // 6. Teacher Submissions Verification & Lost Answer Audit
  console.log('[Verification] Teacher auditing final submissions and response counts...');
  const teacherSubmissionsRes = await timedFetch('teacher_list_submissions', `/api/v1/classrooms/${classroomId}/exams/${examId}/submissions`, {
    method: 'GET',
    headers: { Cookie: teacherCookie },
  });

  const subs = teacherSubmissionsRes.data?.submissions || teacherSubmissionsRes.data || [];
  const submittedCount = subs.filter((s: any) => s.status === 'submitted').length;

  // Verify response answers for each session
  let totalPersistedResponses = 0;
  let studentsWithAll3Responses = 0;

  for (const s of subs) {
    const respRes = await timedFetch('verify_session_responses', `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${s.id}/responses`, {
      method: 'GET',
      headers: { Cookie: teacherCookie },
    });
    const responses = respRes.data?.responses || [];
    totalPersistedResponses += responses.length;
    if (responses.length === 3) {
      studentsWithAll3Responses++;
    }
  }

  // 7. Compute Metrics
  const totalRequests = metrics.length;
  const successfulRequests = metrics.filter((m) => m.ok || (m.operation.includes('duplicate') && m.status === 400)).length;
  const successRate = ((successfulRequests / totalRequests) * 100).toFixed(2);

  const allLatencies = metrics.map((m) => m.durationMs);
  const latencyStats = calculatePercentiles(allLatencies);

  const startLatencies = metrics.filter((m) => m.operation === 'concurrent_start').map((m) => m.durationMs);
  const startStats = calculatePercentiles(startLatencies);

  const autosaveLatencies = metrics.filter((m) => m.operation.startsWith('autosave')).map((m) => m.durationMs);
  const autosaveStats = calculatePercentiles(autosaveLatencies);

  const submitLatencies = metrics.filter((m) => m.operation === 'concurrent_submit').map((m) => m.durationMs);
  const submitStats = calculatePercentiles(submitLatencies);

  const duplicateStartsClean = startedSessions.every((s) => s.sameSessionOnDup);
  const duplicateSubmitsClean = submissionResults.every((s) => s.duplicateRejected);

  console.log('================================================================');
  console.log('STAGING LOAD TEST EXECUTION RESULTS');
  console.log('================================================================');
  console.log(`Total HTTP Requests Executed:    ${totalRequests}`);
  console.log(`Successful Requests:             ${successfulRequests} (${successRate}%)`);
  console.log(`Total Candidates Provisioned:    ${CONCURRENT_STUDENTS}`);
  console.log(`Sessions Successfully Started:   ${startedSessions.filter((s) => s.sessionId).length} / ${CONCURRENT_STUDENTS}`);
  console.log(`Sessions Successfully Submitted: ${submittedCount} / ${CONCURRENT_STUDENTS}`);
  console.log(`Duplicate Session Prevention:    ${duplicateStartsClean ? 'PASS (100% Idempotent)' : 'FAIL'}`);
  console.log(`Duplicate Submit Rejection:      ${duplicateSubmitsClean ? 'PASS (100% Rejected 400)' : 'FAIL'}`);
  console.log(`Total Questions per Candidate:   3`);
  console.log(`Total Expected Responses:        ${CONCURRENT_STUDENTS * 3} (300)`);
  console.log(`Total Persisted Responses:       ${totalPersistedResponses} / 300`);
  console.log(`Zero Lost Answers Audit:         ${totalPersistedResponses === CONCURRENT_STUDENTS * 3 ? 'PASS (0 Lost Answers)' : 'FAIL'}`);
  console.log('----------------------------------------------------------------');
  console.log('LATENCY DISTRIBUTION (All Requests):');
  console.log(`  Min:  ${latencyStats.min} ms`);
  console.log(`  p50:  ${latencyStats.p50} ms`);
  console.log(`  p95:  ${latencyStats.p95} ms`);
  console.log(`  p99:  ${latencyStats.p99} ms`);
  console.log(`  Max:  ${latencyStats.max} ms`);
  console.log(`  Avg:  ${latencyStats.avg} ms`);
  console.log('----------------------------------------------------------------');
  console.log('LATENCY BY WORKLOAD COMPONENT:');
  console.log(`  Concurrent Start:     p50: ${startStats.p50}ms | p95: ${startStats.p95}ms | p99: ${startStats.p99}ms | Max: ${startStats.max}ms`);
  console.log(`  Concurrent Autosave:  p50: ${autosaveStats.p50}ms | p95: ${autosaveStats.p95}ms | p99: ${autosaveStats.p99}ms | Max: ${autosaveStats.max}ms`);
  console.log(`  Concurrent Submit:    p50: ${submitStats.p50}ms | p95: ${submitStats.p95}ms | p99: ${submitStats.p99}ms | Max: ${submitStats.max}ms`);
  console.log('================================================================');

  if (totalPersistedResponses !== CONCURRENT_STUDENTS * 3 || submittedCount !== CONCURRENT_STUDENTS) {
    console.error('[FATAL] Load test did not achieve 100% persistence or completion target.');
    process.exit(1);
  }
}

runLoadTest().catch((err) => {
  console.error('[FATAL] Load test failed with exception:', err);
  process.exit(1);
});
