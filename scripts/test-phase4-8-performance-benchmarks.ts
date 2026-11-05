/**
 * Cortex Online Examination System — Phase 4.8 Test Suite
 * Performance, Concurrency & Scalability Benchmark Suite
 *
 * Runs live against Cloudflare Staging:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Evaluates cohorts:
 * - 1 candidate (baseline)
 * - 10 candidates (seminar)
 * - 25 candidates (standard class)
 * - 50 candidates (large course)
 * - 100 candidates (departmental cohort)
 *
 * Captures:
 * - Total requests, successful requests, error rate
 * - p50, p95, max latencies for start, autosave, heartbeat, and burst submission
 * - Teacher live monitoring polling latency under load
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
    try { data = await res.json(); } catch { data = null; }
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

interface BenchmarkResult {
  cohortSize: number;
  totalRequests: number;
  successRequests: number;
  errorRate: number;
  startMetrics: { p50: number; p95: number; max: number };
  saveMetrics: { p50: number; p95: number; max: number };
  submitMetrics: { p50: number; p95: number; max: number };
}

async function runBenchmarkCohort(
  cohortSize: number,
  classroomId: string,
  joinCode: string,
  examId: string,
  questionId: string,
  teacherCookie: string
): Promise<BenchmarkResult> {
  console.log(`\n================================================================`);
  console.log(`BENCHMARKING COHORT: ${cohortSize} CONCURRENT CANDIDATES`);
  console.log(`================================================================`);

  const runId = Math.random().toString(36).substring(2, 7);
  const password = `PerfP@ss!${cohortSize}_${runId}`;
  let totalRequests = 0;
  let successRequests = 0;

  // 1. Concurrent Registration
  console.log(`[COHORT ${cohortSize}] Registering ${cohortSize} candidate accounts...`);
  const studentCredentials = Array.from({ length: cohortSize }, (_, i) => ({
    name: `Perf Candidate ${cohortSize}_${i + 1}`,
    email: `perf_${cohortSize}_${i + 1}_${runId}@cortex-bench.edu`,
    cortexId: `p${cohortSize}_${i + 1}_${runId}`,
    password,
    confirmPassword: password,
    role: 'student',
  }));

  const regResults = await Promise.all(
    studentCredentials.map((c) =>
      api('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(c),
      })
    )
  );

  totalRequests += regResults.length;
  successRequests += regResults.filter((r) => r.status === 200 || r.status === 201).length;
  const studentCookies = regResults.map((r) => r.headers.get('set-cookie') || '');

  // 2. Concurrent Enrollment
  console.log(`[COHORT ${cohortSize}] Enrolling candidates into classroom...`);
  const joinResults = await Promise.all(
    studentCookies.map((cookie) =>
      api('/api/v1/classrooms/join', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({ joinCode }),
      })
    )
  );
  totalRequests += joinResults.length;
  successRequests += joinResults.filter((r) => r.status === 200 || r.status === 201).length;

  // 3. Simultaneous Exam Start Burst
  console.log(`[COHORT ${cohortSize}] Triggering simultaneous Exam Start burst...`);
  const startResults = await Promise.all(
    studentCookies.map((cookie) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
        method: 'POST',
        headers: { Cookie: cookie },
      })
    )
  );
  totalRequests += startResults.length;
  const startSuccess = startResults.filter((r) => r.status === 200 || r.status === 201);
  successRequests += startSuccess.length;

  const startLatencies = startResults.map((r) => r.latency);
  const startMetrics = calculatePercentiles(startLatencies);
  const sessionIds = startResults.map((r) => (r.data?.session ? r.data.session.id : r.data?.id));

  // 4. Simultaneous Autosave Burst
  console.log(`[COHORT ${cohortSize}] Triggering simultaneous Autosave burst...`);
  const saveResults = await Promise.all(
    sessionIds.map((sessionId, idx) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
        method: 'POST',
        headers: { Cookie: studentCookies[idx] },
        body: JSON.stringify({
          questionId,
          response: { optionId: 'opt_a' },
          clientTimestamp: Date.now(),
        }),
      })
    )
  );
  totalRequests += saveResults.length;
  const saveSuccess = saveResults.filter((r) => r.status === 200);
  successRequests += saveSuccess.length;
  const saveLatencies = saveResults.map((r) => r.latency);
  const saveMetrics = calculatePercentiles(saveLatencies);

  // 5. Simultaneous Heartbeat Ping
  console.log(`[COHORT ${cohortSize}] Dispatching concurrent Heartbeats...`);
  const hbResults = await Promise.all(
    sessionIds.map((sessionId, idx) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/heartbeat`, {
        method: 'POST',
        headers: { Cookie: studentCookies[idx] },
        body: JSON.stringify({ timestamp: Date.now() }),
      })
    )
  );
  totalRequests += hbResults.length;
  successRequests += hbResults.filter((r) => r.status === 200).length;

  // 6. Teacher Live Monitoring Poll while candidates are active
  const dashboardRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard`, {
    headers: { Cookie: teacherCookie },
  });
  totalRequests++;
  if (dashboardRes.status === 200) successRequests++;
  console.log(`[COHORT ${cohortSize}] Teacher live monitoring poll latency: ${dashboardRes.latency}ms`);

  // 7. Simultaneous Final Submission Spike
  console.log(`[COHORT ${cohortSize}] Triggering simultaneous Final Submission spike...`);
  const submitResults = await Promise.all(
    sessionIds.map((sessionId, idx) =>
      api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`, {
        method: 'POST',
        headers: { Cookie: studentCookies[idx] },
        body: JSON.stringify({}),
      })
    )
  );
  totalRequests += submitResults.length;
  const submitSuccess = submitResults.filter((r) => r.status === 200);
  successRequests += submitSuccess.length;
  const submitLatencies = submitResults.map((r) => r.latency);
  const submitMetrics = calculatePercentiles(submitLatencies);

  const errorRate = Math.round(((totalRequests - successRequests) / totalRequests) * 10000) / 100;

  console.log(`\n--- COHORT ${cohortSize} RESULTS SUMMARY ---`);
  console.log(`Total Requests:      ${totalRequests}`);
  console.log(`Successful Requests: ${successRequests}`);
  console.log(`Error Rate:          ${errorRate}%`);
  console.log(`Start Exam:          p50 = ${startMetrics.p50}ms | p95 = ${startMetrics.p95}ms | max = ${startMetrics.max}ms`);
  console.log(`Autosave Response:   p50 = ${saveMetrics.p50}ms | p95 = ${saveMetrics.p95}ms | max = ${saveMetrics.max}ms`);
  console.log(`Final Submission:    p50 = ${submitMetrics.p50}ms | p95 = ${submitMetrics.p95}ms | max = ${submitMetrics.max}ms`);

  assert(errorRate === 0, `[COHORT ${cohortSize}] Zero request errors (error rate: ${errorRate}%)`);
  const maxAllowedSaveLatency = cohortSize >= 100 ? 5000 : 3000;
  assert(saveMetrics.p50 < maxAllowedSaveLatency, `[COHORT ${cohortSize}] Autosave p50 < ${maxAllowedSaveLatency}ms (measured: ${saveMetrics.p50}ms)`);
  assert(submitMetrics.p50 < 6000, `[COHORT ${cohortSize}] Submission p50 < 6000ms (measured: ${submitMetrics.p50}ms)`);

  return {
    cohortSize,
    totalRequests,
    successRequests,
    errorRate,
    startMetrics,
    saveMetrics,
    submitMetrics,
  };
}

async function runPerformanceSuite() {
  console.log('================================================================');
  console.log('PHASE 4.8: PERFORMANCE, CONCURRENCY & SCALABILITY AUDIT');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Math.random().toString(36).substring(2, 7);
  const teacherEmail = `prof_perf_${runId}@cortex-bench.edu`;
  const teacherCortexId = `t_perf_${runId}`;
  const password = `TeacherP@ss#${runId}`;

  // Step 1: Teacher Registration & Setup
  console.log('--- STEP 1: PROVISION BENCHMARK TEACHER & EXAMINATION ---');
  const regTeacherRes = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Prof. Performance Benchmark',
      email: teacherEmail,
      cortexId: teacherCortexId,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });

  assert(regTeacherRes.status === 200 || regTeacherRes.status === 201, 'Benchmark teacher registered');
  const teacherCookie = regTeacherRes.headers.get('set-cookie') || '';

  const classRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `CS601 High Performance Systems ${runId}`,
      subject: 'Computer Science',
      academicYear: '2026-2027',
      section: 'A',
    }),
  });

  assert(classRes.status === 200 || classRes.status === 201, 'Benchmark classroom created');
  const classroomId = classRes.data.classroom?.id || classRes.data.id;
  const joinCode = classRes.data.classroom?.joincode || classRes.data.classroom?.joinCode || classRes.data.joincode || classRes.data.joinCode;

  // Create Benchmark Exam
  const examRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Scalability & Concurrency Benchmark Exam',
      description: 'Standardized automated performance workload',
      durationMinutes: 60,
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 7200000,
      totalMarks: 50,
      passingMarks: 20,
    }),
  });

  assert(examRes.status === 200 || examRes.status === 201, 'Benchmark exam provisioned');
  const examId = examRes.data.exam?.id || examRes.data.id;

  // Add Question
  const qRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      questionType: 'mcq_single',
      promptText: 'Which architectural component ensures sub-millisecond local reads?',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_a', text: 'Distributed Edge Caching & Durable Objects' },
        { id: 'opt_b', text: 'Centralized Disk Spindle' },
      ],
      correctAnswer: { optionId: 'opt_a' },
    }),
  });
  assert(qRes.status === 200 || qRes.status === 201, 'Benchmark question configured');
  const questionId = qRes.data.question?.id || qRes.data.id;

  // Publish Exam
  const pubRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });
  assert(pubRes.status === 200, 'Benchmark exam published');

  // Step 2: Execute Cohorts
  const cohortsToRun = [1, 10, 25, 50, 100];
  const benchmarkSummaries: BenchmarkResult[] = [];

  for (const cSize of cohortsToRun) {
    const res = await runBenchmarkCohort(cSize, classroomId, joinCode, examId, questionId, teacherCookie);
    benchmarkSummaries.push(res);
  }

  console.log('\n================================================================');
  console.log('PHASE 4.8 PERFORMANCE BENCHMARK MATRIX ACROSS COHORTS');
  console.log('================================================================');
  console.log('| Cohort | Requests | Error Rate | Start p50 / p95 | Autosave p50 / p95 | Submit p50 / p95 |');
  console.log('|---|---|---|---|---|---|');
  for (const b of benchmarkSummaries) {
    console.log(
      `| ${b.cohortSize} candidates | ${b.totalRequests} | ${b.errorRate}% | ${b.startMetrics.p50}ms / ${b.startMetrics.p95}ms | ${b.saveMetrics.p50}ms / ${b.saveMetrics.p95}ms | ${b.submitMetrics.p50}ms / ${b.submitMetrics.p95}ms |`
    );
  }

  console.log('\n================================================================');
  console.log(`PHASE 4.8 BENCHMARK SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPerformanceSuite().catch((err) => {
  console.error('Phase 4.8 Benchmark Error:', err);
  process.exit(1);
});
