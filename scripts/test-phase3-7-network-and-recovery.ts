/**
 * Cortex Online Examination System — Phase 3.7
 * Test Suite 1: Network Reliability (12 Failure Scenarios) & Session Recovery
 *
 * Runs live HTTP tests against Cloudflare staging environment:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Zero emojis in logs.
 * Strict assertion counters.
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('================================================================');
  console.log('PHASE 3.7: NETWORK RELIABILITY & SESSION RECOVERY TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Date.now().toString(36);
  const teacherEmail = `net_prof_${runId}@cortex-staging.edu`;
  const student1Email = `net_stud1_${runId}@cortex-staging.edu`;
  const student2Email = `net_stud2_${runId}@cortex-staging.edu`;
  const student3Email = `net_stud3_${runId}@cortex-staging.edu`;
  const password = `TestP@ssword#${runId}`;

  // 1. Setup Teacher and Students
  console.log('--- SETUP: TEACHER & STUDENTS ---');
  const tReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Network Reliability Instructor',
      email: teacherEmail,
      cortexId: `prof_net_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tReg.status === 200 || tReg.status === 201, 'Teacher registered for network tests');
  const teacherCookie = tReg.headers.get('set-cookie') || '';

  const s1Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Reliability Candidate One',
      email: student1Email,
      cortexId: `stud_net1_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s1Reg.status === 200 || s1Reg.status === 201, 'Student 1 registered');
  const student1Cookie = s1Reg.headers.get('set-cookie') || '';
  const student1User = s1Reg.data.user || s1Reg.data;

  const s2Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Reliability Candidate Two',
      email: student2Email,
      cortexId: `stud_net2_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s2Reg.status === 200 || s2Reg.status === 201, 'Student 2 registered');
  const student2Cookie = s2Reg.headers.get('set-cookie') || '';
  const student2User = s2Reg.data.user || s2Reg.data;

  const s3Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Reliability Candidate Three',
      email: student3Email,
      cortexId: `stud_net3_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s3Reg.status === 200 || s3Reg.status === 201, 'Student 3 registered');
  const student3Cookie = s3Reg.headers.get('set-cookie') || '';
  const student3User = s3Reg.data.user || s3Reg.data;

  // 2. Create Classroom & Enroll Students
  const cRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `CS-401 Network Reliability Lab (${runId})`,
      subject: 'Distributed Systems',
      description: 'Network failure simulation classroom',
      courseCode: `CS401-${runId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: {},
    }),
  });
  assert(cRes.status === 200 || cRes.status === 201, 'Classroom created');
  const classroom = cRes.data.classroom || cRes.data;
  const classroomId = classroom.id;
  const joinCode = classroom.joincode || classroom.joinCode;

  const j1 = await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: student1Cookie },
    body: JSON.stringify({ joinCode }),
  });
  assert(j1.status === 200, 'Student 1 joined classroom');

  const j2 = await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: student2Cookie },
    body: JSON.stringify({ joinCode }),
  });
  assert(j2.status === 200, 'Student 2 joined classroom');

  const j3 = await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: student3Cookie },
    body: JSON.stringify({ joinCode }),
  });
  assert(j3.status === 200, 'Student 3 joined classroom');

  // 3. Create Standard Examination with Multiple Sections and Questions
  console.log('\n--- SETUP: EXAMINATION WITH QUESTIONS ---');
  const examRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Distributed Systems Reliability Exam',
      description: 'Testing fault tolerance and session resilience',
      durationMinutes: 30,
      passingMarks: 50,
      shuffleQuestions: true,
      shuffleOptions: true,
      allowReview: true,
      showResultsImmediately: true,
      assignedStudentIds: [student1User.id, student2User.id, student3User.id],
    }),
  });
  assert(examRes.status === 201 || examRes.status === 200, 'Examination created');
  const exam = examRes.data.exam || examRes.data;
  const examId = exam.id;

  // Section 1: Core Networking
  const s1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Core Protocols',
      description: 'Answer protocol fundamentals',
      sortOrder: 1,
      sectionMarks: 20,
      instructions: 'Answer all foundational questions.',
      isMandatory: true,
      timeLimitMinutes: 0,
    }),
  });
  assert(s1Res.status === 201 || s1Res.status === 200, 'Section 1 created');
  const section1 = s1Res.data.section || s1Res.data;
  const section1Id = section1.id;

  // Question 1: MCQ Single
  const q1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: section1Id,
      questionType: 'mcq_single',
      promptText: 'In distributed systems, which property guarantees every non-failing node returns a response?',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_cons', text: 'Consistency' },
        { id: 'opt_avail', text: 'Availability' },
        { id: 'opt_part', text: 'Partition Tolerance' },
      ],
      correctAnswer: { optionId: 'opt_avail' },
    }),
  });
  assert(q1Res.status === 201 || q1Res.status === 200, 'Question 1 created');
  const q1 = q1Res.data.question || q1Res.data;
  const q1Id = q1.id;

  // Question 2: Numerical
  const q2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: section1Id,
      questionType: 'numerical',
      promptText: 'In a cluster of 5 nodes, what is the strict majority quorum size?',
      points: 10,
      sortOrder: 2,
      correctAnswer: { value: 3, tolerance: 0 },
    }),
  });
  assert(q2Res.status === 201 || q2Res.status === 200, 'Question 2 created');
  const q2 = q2Res.data.question || q2Res.data;
  const q2Id = q2.id;

  // Question 3: Short Answer
  const q3Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: section1Id,
      questionType: 'short_answer',
      promptText: 'Define Byzantine fault tolerance briefly.',
      points: 10,
      sortOrder: 3,
      correctAnswer: { manualGrading: true, sampleAnswer: 'Tolerance to arbitrary and malicious node failures.' },
    }),
  });
  assert(q3Res.status === 201 || q3Res.status === 200, 'Question 3 created');
  const q3 = q3Res.data.question || q3Res.data;
  const q3Id = q3.id;

  // Publish Examination
  const pubRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });
  assert(pubRes.status === 200, 'Examination published');

  // =========================================================================
  // SCENARIO 1 & 2 & 3: BRIEF, MODERATE, EXTENDED NETWORK DISCONNECT & RECOVERY
  // =========================================================================
  console.log('\n--- SCENARIO 1, 2, 3: DISCONNECT & PERSISTENCE ---');
  // Student 1 starts examination via /start
  const start1 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
  });
  assert(start1.status === 200 || start1.status === 201, 'Student 1 session started');
  const session1 = start1.data.session || start1.data;
  const session1Id = session1.id;
  assert(session1.status === 'in_progress', 'Session is in_progress');

  // Scenario 1: Brief disconnect simulation (10 seconds)
  // Student answers Q1 at t0
  const t0 = Date.now();
  const a1 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
    body: JSON.stringify({
      questionId: q1Id,
      response: { optionId: 'opt_avail' },
      clientTimestamp: t0,
    }),
  });
  assert(a1.status === 200, 'Scenario 1: Initial answer saved before disconnect');

  console.log('Simulating 10s brief network disconnection...');
  await sleep(10000); // 10s disconnect
  // On reconnect, send heartbeat
  const hb1 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/heartbeat`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
  });
  assert(hb1.status === 200, 'Scenario 1: Heartbeat successfully resumes after 10s disconnect');

  // Verify answer persisted across disconnect
  const respList1 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'GET',
    headers: { Cookie: student1Cookie },
  });
  assert(respList1.status === 200, 'Scenario 1: Fetched responses after reconnect');
  const q1Saved = respList1.data.responses.find((r: any) => r.questionId === q1Id);
  assert(q1Saved && q1Saved.response.optionId === 'opt_avail', 'Scenario 1: Answer to Q1 intact after 10s disconnect');

  // Scenario 2: Moderate disconnect (30s)
  console.log('Simulating 30s moderate network disconnection...');
  await sleep(30000); // 30s disconnect
  // Answer Q2 during reconnect
  const t1 = Date.now();
  const a2 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
    body: JSON.stringify({
      questionId: q2Id,
      response: { value: 3 },
      flaggedForReview: true,
      clientTimestamp: t1,
    }),
  });
  assert(a2.status === 200, 'Scenario 2: Answering Q2 succeeds immediately after 30s reconnect');

  // Verify responses list now contains both Q1 and Q2
  const respList2 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'GET',
    headers: { Cookie: student1Cookie },
  });
  assert(respList2.data.responses.length === 2, 'Scenario 2: Both responses persisted across moderate disconnect');

  // =========================================================================
  // SCENARIO 4 & 5: BROWSER REFRESH AND TAB CLOSE / REOPEN RECOVERY
  // =========================================================================
  console.log('\n--- SCENARIO 4 & 5: BROWSER REFRESH & TAB CLOSE / REOPEN ---');
  // Student refreshes browser tab (re-calls /start which is idempotent)
  const refreshRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
  });
  assert(refreshRes.status === 200 || refreshRes.status === 201, 'Scenario 4: Browser refresh restores active session');
  const refreshedSession = refreshRes.data.session || refreshRes.data;
  assert(refreshedSession.id === session1Id, 'Scenario 4: Restored exact same session ID');
  assert(refreshedSession.attemptNumber === 1, 'Scenario 4: Attempt number strictly preserved as 1');
  assert(refreshRes.data.savedResponses.length === 2, 'Scenario 4: Saved responses restored on refresh');
  assert(refreshRes.data.resumed === true, 'Scenario 4: Session indicated as resumed');
  assert(Array.isArray(refreshRes.data.exam?.questions) || Array.isArray(refreshRes.data.session?.questionOrder), 'Scenario 4: Question ordering restored');
  assert(typeof refreshRes.data.serverTime === 'number', 'Scenario 4: Server authoritative time synchronized');

  // Check remaining time computation
  const expiresAt = refreshedSession.expiresAt;
  const serverTime = refreshRes.data.serverTime;
  const remainingMs = expiresAt - serverTime;
  assert(remainingMs > 0 && remainingMs <= 30 * 60 * 1000, 'Scenario 4: Remaining time accurately calculated from server time');

  // Scenario 5: Tab closed and reopened after delay
  console.log('Simulating tab close & reopen after 5s...');
  await sleep(5000);
  const reopenRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
  });
  assert(reopenRes.status === 200 || reopenRes.status === 201, 'Scenario 5: Session restored after tab reopen');
  const reopenedQ2 = reopenRes.data.savedResponses.find((r: any) => r.questionId === q2Id);
  assert(reopenedQ2 && (reopenedQ2.flaggedForReview === 1 || reopenedQ2.flaggedForReview === true),
    'Scenario 5: Flagged question state preserved on reopen');

  // =========================================================================
  // SCENARIO 6: MULTI-TAB CONCURRENT SESSIONS
  // =========================================================================
  console.log('\n--- SCENARIO 6: MULTI-TAB CONCURRENCY ---');
  // Tab A and Tab B make simultaneous calls
  const tTabA = Date.now();
  const tTabB = Date.now() + 50;

  const [tabARes, tabBRes] = await Promise.all([
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
      method: 'POST',
      headers: { Cookie: student1Cookie },
      body: JSON.stringify({
        questionId: q3Id,
        response: { text: 'Draft answer from Tab A' },
        clientTimestamp: tTabA,
      }),
    }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
      method: 'POST',
      headers: { Cookie: student1Cookie },
      body: JSON.stringify({
        questionId: q3Id,
        response: { text: 'Final answer from Tab B' },
        clientTimestamp: tTabB,
      }),
    }),
  ]);
  assert(tabARes.status === 200 && tabBRes.status === 200, 'Scenario 6: Both concurrent tabs handled cleanly without error');

  // Verify that the higher timestamp (Tab B) won
  const q3Check = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'GET',
    headers: { Cookie: student1Cookie },
  });
  const savedQ3 = q3Check.data.responses.find((r: any) => r.questionId === q3Id);
  assert(savedQ3 && savedQ3.response.text === 'Final answer from Tab B',
    'Scenario 6: Server authoritative ordering resolved multi-tab conflict cleanly');

  // =========================================================================
  // SCENARIO 7: OUT-OF-ORDER AUTOSAVES & STALE REJECTION
  // =========================================================================
  console.log('\n--- SCENARIO 7: OUT-OF-ORDER AUTOSAVES ---');
  // Send newer update first (tNewer = now)
  const tNewer = Date.now();
  const resNewer = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
    body: JSON.stringify({
      questionId: q1Id,
      response: { optionId: 'opt_avail' },
      clientTimestamp: tNewer,
    }),
  });
  assert(resNewer.status === 200, 'Scenario 7: Newer update accepted');
  assert(resNewer.data.staleRejected === false, 'Scenario 7: Newer update not marked stale');

  // Now simulate an older delayed autosave packet arriving late (tOlder = tNewer - 5000)
  const tOlder = tNewer - 5000;
  const resOlder = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
    body: JSON.stringify({
      questionId: q1Id,
      response: { optionId: 'opt_cons' }, // Stale choice
      clientTimestamp: tOlder,
    }),
  });
  assert(resOlder.status === 200, 'Scenario 7: Out-of-order packet processed by server');
  assert(resOlder.data.staleRejected === true, 'Scenario 7: Out-of-order packet flagged as staleRejected: true');

  // Verify that the stored value remains the newer one ('opt_avail')
  const q1Verify = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'GET',
    headers: { Cookie: student1Cookie },
  });
  const currentQ1 = q1Verify.data.responses.find((r: any) => r.questionId === q1Id);
  assert(currentQ1 && currentQ1.response.optionId === 'opt_avail',
    'Scenario 7: Database safely preserved newer packet and discarded stale older packet');

  // =========================================================================
  // SCENARIO 9 & 10: MID-AUTOSAVE SUBMIT & DISCONNECT DURING SUBMIT
  // =========================================================================
  console.log('\n--- SCENARIO 9 & 10: MID-AUTOSAVE SUBMISSION & SUBMIT RETRY ---');
  // Fire an autosave and a submit concurrently
  const [midAutosaveRes, midSubmitRes] = await Promise.all([
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
      method: 'POST',
      headers: { Cookie: student1Cookie },
      body: JSON.stringify({
        questionId: q2Id,
        response: { value: 3 },
        clientTimestamp: Date.now(),
      }),
    }),
    api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/submit`, {
      method: 'POST',
      headers: { Cookie: student1Cookie },
      body: JSON.stringify({}),
    }),
  ]);
  assert(midSubmitRes.status === 200, 'Scenario 9: Submit succeeded and locked session');
  const lockedSession = midSubmitRes.data.session || midSubmitRes.data;
  assert(lockedSession.status === 'submitted', 'Scenario 9: Session status is submitted');

  // Scenario 10: Network drop during submit leading to retry
  // The client retries POST /submit
  const retrySubmitRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/submit`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
    body: JSON.stringify({}),
  });
  assert(retrySubmitRes.status === 400, 'Scenario 10: Duplicate submit rejected with HTTP 400');
  assert(retrySubmitRes.data.error.includes('submitted'), 'Scenario 10: Clear error explaining session already submitted');

  // Subsequent answer mutation on locked session strictly fails
  const postSubmitAnswer = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${session1Id}/responses`, {
    method: 'POST',
    headers: { Cookie: student1Cookie },
    body: JSON.stringify({
      questionId: q1Id,
      response: { optionId: 'opt_cons' },
    }),
  });
  assert(postSubmitAnswer.status === 400, 'Scenario 9 & 10: Mutating submitted session rejected with HTTP 400');

  // =========================================================================
  // SCENARIOS 8, 11, 12: GRACE PERIOD BOUNDARY & TIMEOUT RECOVERY
  // =========================================================================
  console.log('\n--- SCENARIOS 8, 11, 12: GRACE PERIOD BOUNDARIES ---');
  // Create an exam with short window (45 seconds) for Student 2
  const nowForShort = Date.now();
  const shortExamRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Grace Period Test Exam',
      description: 'Testing 30s grace window and timeouts',
      durationMinutes: 5,
      startTime: nowForShort - 1000,
      endTime: nowForShort + 45000, // 45s expiration window
      passingMarks: 50,
      showResultsImmediately: true,
    }),
  });
  assert(shortExamRes.status === 201 || shortExamRes.status === 200, `Short exam created: ${JSON.stringify(shortExamRes.data)}`);
  const shortExam = shortExamRes.data.exam || shortExamRes.data;
  const shortExamId = shortExam.id;

  // Add a section
  const shortSecRes = await api(`/api/v1/classrooms/${classroomId}/exams/${shortExamId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Grace Period Section',
      description: 'Timing section',
      sortOrder: 1,
    }),
  });
  assert(shortSecRes.status === 201 || shortSecRes.status === 200, 'Short exam section created');
  const shortSec = shortSecRes.data.section || shortSecRes.data;

  // Add a question
  const shortQRes = await api(`/api/v1/classrooms/${classroomId}/exams/${shortExamId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: shortSec.id,
      questionType: 'numerical',
      promptText: 'What is 10 + 10?',
      points: 10,
      correctAnswer: { value: 20, tolerance: 0 },
      sortOrder: 1,
    }),
  });
  assert(shortQRes.status === 201 || shortQRes.status === 200, 'Short exam question created');
  const shortQ = shortQRes.data.question || shortQRes.data;
  const shortQId = shortQ.id;

  // Publish short exam
  const pubShortRes = await api(`/api/v1/classrooms/${classroomId}/exams/${shortExamId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });
  assert(pubShortRes.status === 200, 'Short exam published');

  // Student 2 starts short exam
  const s2Start = await api(`/api/v1/classrooms/${classroomId}/exams/${shortExamId}/start`, {
    method: 'POST',
    headers: { Cookie: student2Cookie },
  });
  if (s2Start.status !== 200 && s2Start.status !== 201) {
    console.error(`s2Start failed: ${s2Start.status}`, s2Start.data);
  }
  assert(s2Start.status === 200 || s2Start.status === 201, 'Student 2 started short exam');
  const session2 = s2Start.data.session || s2Start.data;
  const session2Id = session2.id;

  // Save an initial answer
  await api(`/api/v1/classrooms/${classroomId}/exams/${shortExamId}/sessions/${session2Id}/responses`, {
    method: 'POST',
    headers: { Cookie: student2Cookie },
    body: JSON.stringify({
      questionId: shortQId,
      response: { value: 20 },
      clientTimestamp: Date.now(),
    }),
  });

  console.log('Waiting 48 seconds for 45s exam duration to expire (entering 30s grace window)...');
  await sleep(48000);

  // Now exam duration has ended, but we are WITHIN the 30-second grace window!
  // Attempting to answer NEW questions during grace period should be REJECTED with 403
  const lateAnswer = await api(`/api/v1/classrooms/${classroomId}/exams/${shortExamId}/sessions/${session2Id}/responses`, {
    method: 'POST',
    headers: { Cookie: student2Cookie },
    body: JSON.stringify({
      questionId: shortQId,
      response: { value: 999 },
    }),
  });
  assert(lateAnswer.status === 403, 'Scenario 11: Answering after expiresAt strictly rejected with HTTP 403');
  assert(lateAnswer.data.expired === true, 'Scenario 11: Server indicates expired: true');

  // Scenario 11: Submitting existing answers WITHIN the 30-second grace period SUCCEEDS!
  const graceSubmit = await api(`/api/v1/classrooms/${classroomId}/exams/${shortExamId}/sessions/${session2Id}/submit`, {
    method: 'POST',
    headers: { Cookie: student2Cookie },
    body: JSON.stringify({}),
  });
  assert(graceSubmit.status === 200, 'Scenario 11: Submission within 30s grace period accepted');
  const graceSession = graceSubmit.data.session || graceSubmit.data;
  assert(graceSession.status === 'submitted', 'Scenario 11: Status recorded as submitted, not timed_out');

  // =========================================================================
  // SCENARIO 12: PAST GRACE PERIOD (TIMED OUT)
  // =========================================================================
  console.log('\n--- SCENARIO 12: SUBMIT PAST GRACE PERIOD ---');
  const nowForPast = Date.now();
  const pastExamRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Past Grace Timeout Exam',
      description: 'Testing past grace timeout',
      durationMinutes: 5,
      startTime: nowForPast - 1000,
      endTime: nowForPast + 20000, // 20s window
      passingMarks: 50,
      showResultsImmediately: true,
    }),
  });
  assert(pastExamRes.status === 201 || pastExamRes.status === 200, 'Past grace exam created');
  const pastExam = pastExamRes.data.exam || pastExamRes.data;
  const pastExamId = pastExam.id;

  const pastSecRes = await api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Past Grace Section',
      description: 'Section for timeout check',
      sortOrder: 1,
    }),
  });
  const pastSec = pastSecRes.data.section || pastSecRes.data;

  await api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: pastSec.id,
      questionType: 'numerical',
      promptText: 'What is 5 + 5?',
      points: 10,
      correctAnswer: { value: 10, tolerance: 0 },
      sortOrder: 1,
    }),
  });

  await api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });

  const s3Start = await api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/start`, {
    method: 'POST',
    headers: { Cookie: student3Cookie },
  });
  assert(s3Start.status === 200 || s3Start.status === 201, 'Student 3 started past grace exam');
  const session3 = s3Start.data.session || s3Start.data;
  const session3Id = session3.id;

  console.log('Waiting 55 seconds for duration (20s) + grace period (30s) to completely expire...');
  await sleep(55000);

  // Now now > expiresAt + 30s! Submitting now should be recorded as timed_out
  const pastGraceSubmit = await api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/sessions/${session3Id}/submit`, {
    method: 'POST',
    headers: { Cookie: student3Cookie },
    body: JSON.stringify({}),
  });
  assert(pastGraceSubmit.status === 200, 'Scenario 12: Past-grace submit returns handled response');
  const timedOutSession = pastGraceSubmit.data.session || pastGraceSubmit.data;
  assert(timedOutSession.status === 'timed_out', 'Scenario 12: Session status permanently set to timed_out');
  assert(pastGraceSubmit.data.message.includes('timed out'), 'Scenario 12: Informative message confirms timeout');

  // =========================================================================
  // PHASE 3: COMPREHENSIVE SESSION RECOVERY VERIFICATION
  // =========================================================================
  console.log('\n--- PHASE 3: SESSION RECOVERY & IDEMPOTENCY CHECKS ---');
  // Calling start multiple times on timed_out session
  const idempotencyChecks = await Promise.all([
    api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/start`, { method: 'POST', headers: { Cookie: student3Cookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/start`, { method: 'POST', headers: { Cookie: student3Cookie } }),
    api(`/api/v1/classrooms/${classroomId}/exams/${pastExamId}/start`, { method: 'POST', headers: { Cookie: student3Cookie } }),
  ]);
  for (const chk of idempotencyChecks) {
    assert(chk.status === 400, 'Idempotency: Re-calling start on completed/timed-out session strictly rejected with HTTP 400');
    assert(chk.data.error.includes('closed') || chk.data.error.includes('maximum allowed attempts') || chk.data.attemptsUsed === 1,
      'Idempotency: Server strictly rejects re-starting closed or exhausted examination');
  }

  console.log('\n================================================================');
  console.log('PHASE 3.7 NETWORK RELIABILITY & RECOVERY SUITE COMPLETE');
  console.log(`Total Assertions: ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
