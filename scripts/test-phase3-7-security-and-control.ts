/**
 * Cortex Online Examination System — Phase 3.7
 * Test Suite 2: Security, Authorization & Live Teacher Proctoring Controls
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

async function run() {
  console.log('================================================================');
  console.log('PHASE 3.7: SECURITY, AUTHORIZATION & PROCTORING TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Date.now().toString(36);
  const teacherAEmail = `sec_prof_a_${runId}@cortex-staging.edu`;
  const studentAEmail = `sec_stud_a_${runId}@cortex-staging.edu`;
  const teacherBEmail = `sec_prof_b_${runId}@cortex-staging.edu`;
  const studentBEmail = `sec_stud_b_${runId}@cortex-staging.edu`;
  const password = `SecP@ssword#${runId}`;

  // -------------------------------------------------------------------------
  // 1. SETUP TWO INDEPENDENT CLASSROOMS (A & B)
  // -------------------------------------------------------------------------
  console.log('--- SETUP: DUAL CLASSROOMS FOR CROSS-TENANT AUDIT ---');

  // Teacher A & Student A
  const tAReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Instructor Alice',
      email: teacherAEmail,
      cortexId: `prof_a_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tAReg.status === 200 || tAReg.status === 201, 'Teacher A registered');
  const teacherACookie = tAReg.headers.get('set-cookie') || '';

  const sAReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Student Alice',
      email: studentAEmail,
      cortexId: `stud_a_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(sAReg.status === 200 || sAReg.status === 201, 'Student A registered');
  const studentACookie = sAReg.headers.get('set-cookie') || '';
  const studentAUser = sAReg.data.user || sAReg.data;
  const studentAId = studentAUser.id;

  // Teacher B & Student B
  const tBReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Instructor Bob',
      email: teacherBEmail,
      cortexId: `prof_b_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tBReg.status === 200 || tBReg.status === 201, 'Teacher B registered');
  const teacherBCookie = tBReg.headers.get('set-cookie') || '';

  const sBReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Student Bob',
      email: studentBEmail,
      cortexId: `stud_b_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(sBReg.status === 200 || sBReg.status === 201, 'Student B registered');
  const studentBCookie = sBReg.headers.get('set-cookie') || '';
  const studentBUser = sBReg.data.user || sBReg.data;
  const studentBId = studentBUser.id;

  // Create Classroom A
  const cARes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      name: `Classroom Alpha (${runId})`,
      subject: 'Security Studies',
      courseCode: `SEC-A-${runId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: {},
    }),
  });
  assert(cARes.status === 200 || cARes.status === 201, 'Classroom A created');
  const classroomA = cARes.data.classroom || cARes.data;
  const classroomAId = classroomA.id;
  const joinCodeA = classroomA.joinCode || classroomA.joincode;
  await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: studentACookie },
    body: JSON.stringify({ joinCode: joinCodeA }),
  });

  // Create Classroom B
  const cBRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherBCookie },
    body: JSON.stringify({
      name: `Classroom Beta (${runId})`,
      subject: 'Cryptographic Protocols',
      courseCode: `SEC-B-${runId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'B',
      joinEnabled: true,
      settings: {},
    }),
  });
  assert(cBRes.status === 200 || cBRes.status === 201, 'Classroom B created');
  const classroomB = cBRes.data.classroom || cBRes.data;
  const classroomBId = classroomB.id;
  const joinCodeB = classroomB.joinCode || classroomB.joincode;
  await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: studentBCookie },
    body: JSON.stringify({ joinCode: joinCodeB }),
  });

  // Create Examination in Classroom A
  const examARes = await api(`/api/v1/classrooms/${classroomAId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      title: 'Classroom A Final Security Exam',
      description: 'Confidential assessment',
      durationMinutes: 45,
      passingMarks: 50,
      sebQuitPassword: 'SuperSecretQuitPassword2026!',
    }),
  });
  assert(examARes.status === 200 || examARes.status === 201, 'Exam A created in Classroom A');
  const examA = examARes.data.exam || examARes.data;
  const examAId = examA.id;

  // Add Section 1 to Exam A
  const secARes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      title: 'Security Foundations',
      description: 'Core concepts',
      sortOrder: 1,
      sectionMarks: 25,
      instructions: 'Answer all questions.',
    }),
  });
  assert(secARes.status === 200 || secARes.status === 201, 'Section 1 added to Exam A');
  const secA = secARes.data.section || secARes.data;

  // Add Question 1 (MCQ Single)
  const qARes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      sectionId: secA.id,
      questionType: 'mcq_single',
      promptText: 'What is the purpose of a non-repudiation protocol?',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_1', text: 'Proof of origin and integrity' },
        { id: 'opt_2', text: 'Speed up transmission' },
      ],
      correctAnswer: { optionId: 'opt_1' },
      explanation: 'Non-repudiation prevents denying having sent the message.',
    }),
  });
  assert(qARes.status === 200 || qARes.status === 201, 'Question 1 added to Exam A');
  const qA = qARes.data.question || qARes.data;
  const qAId = qA.id;

  // Add Question 2 (Short Answer requiring manual grading)
  const qA2Res = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      sectionId: secA.id,
      questionType: 'short_answer',
      promptText: 'Explain why zero-knowledge proofs do not leak secret witnesses.',
      points: 15,
      sortOrder: 2,
      correctAnswer: { manualGrading: true, sampleAnswer: 'Interactive verification with simulator equivalence.' },
    }),
  });
  assert(qA2Res.status === 200 || qA2Res.status === 201, 'Question 2 added to Exam A');
  const qA2 = qA2Res.data.question || qA2Res.data;
  const qA2Id = qA2.id;

  // Publish Exam A
  await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
  });

  // -------------------------------------------------------------------------
  // 2. CROSS-CLASSROOM BOUNDARY ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- AUDIT 1: CROSS-CLASSROOM BOUNDARIES ---');

  // Student B attempts to access Exam A in Classroom A
  const crossList = await api(`/api/v1/classrooms/${classroomAId}/exams`, {
    method: 'GET',
    headers: { Cookie: studentBCookie },
  });
  assert(crossList.status === 403, 'Cross-classroom: Student B cannot list exams in Classroom A (HTTP 403)');

  // Student B attempts to start session for Exam A in Classroom A
  const crossStart = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/start`, {
    method: 'POST',
    headers: { Cookie: studentBCookie },
  });
  assert(crossStart.status === 403, 'Cross-classroom: Student B cannot start session for Exam A (HTTP 403)');

  // Teacher B attempts to view Teacher A's examination dashboard
  const crossDash = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/dashboard`, {
    method: 'GET',
    headers: { Cookie: teacherBCookie },
  });
  assert(crossDash.status === 403, 'Cross-classroom: Teacher B cannot view Teacher A proctoring dashboard (HTTP 403)');

  // -------------------------------------------------------------------------
  // 3. ROLE-BASED PRIVILEGE ENFORCEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- AUDIT 2: ROLE-BASED ACCESS CONTROL ---');

  // Student A attempts to create an exam in Classroom A
  const studCreateExam = await api(`/api/v1/classrooms/${classroomAId}/exams`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
    body: JSON.stringify({ title: 'Student Malicious Exam' }),
  });
  assert(studCreateExam.status === 403, 'RBAC: Student cannot create examinations (HTTP 403)');

  // Student A attempts to publish an exam
  const studPublish = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/publish`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
  });
  assert(studPublish.status === 403, 'RBAC: Student cannot publish examinations (HTTP 403)');

  // Student A attempts to access teacher live proctoring dashboard
  const studDashboard = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/dashboard`, {
    method: 'GET',
    headers: { Cookie: studentACookie },
  });
  assert(studDashboard.status === 403, 'RBAC: Student cannot access proctoring dashboard (HTTP 403)');

  // -------------------------------------------------------------------------
  // 4. STUDENT PAYLOAD REDACTION & SECRET PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n--- AUDIT 3: SECRET REDACTION IN STUDENT DTOs ---');

  const studExamView = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}`, {
    method: 'GET',
    headers: { Cookie: studentACookie },
  });
  assert(studExamView.status === 200, 'Student can fetch assigned exam definition');

  const examData = studExamView.data.exam || studExamView.data;
  // Verify SEB secrets are completely absent
  assert(examData.sebQuitPassword === undefined, 'Redaction: sebQuitPassword strictly stripped');
  assert(examData.sebQuitPasswordHash === undefined, 'Redaction: sebQuitPasswordHash strictly stripped');
  assert(examData.sebBrowserExamKey === undefined, 'Redaction: sebBrowserExamKey strictly stripped');
  assert(examData.sebConfigKey === undefined, 'Redaction: sebConfigKey strictly stripped');
  assert(examData.hasQuitPassword === undefined, 'Redaction: hasQuitPassword boolean indicator stripped from student');

  // Verify questions redact correctAnswer and isCorrect
  for (const q of (examData.questions || [])) {
    assert(q.correctAnswer === undefined, `Redaction: Question ${q.id} correctAnswer stripped`);
    assert(q.explanation === undefined, `Redaction: Question ${q.id} explanation stripped`);
    if (q.options) {
      for (const opt of q.options) {
        assert(opt.isCorrect === undefined, `Redaction: Option ${opt.id} isCorrect stripped`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. SCORE FORGERY & TIMESTAMP SPOOFING PREVENTION
  // -------------------------------------------------------------------------
  console.log('\n--- AUDIT 4: SCORE FORGERY & TIMESTAMP MANIPULATION ---');

  // Student A starts exam
  const startARes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/start`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
  });
  assert(startARes.status === 200 || startARes.status === 201, 'Student A started Exam A session');
  const sessionA = startARes.data.session || startARes.data;
  const sessionAId = sessionA.id;

  // Student attempts to inject score parameters into response
  const spoofScoreRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/sessions/${sessionAId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
    body: JSON.stringify({
      questionId: qAId,
      response: {
        optionId: 'opt_1',
        earnedPoints: 100, // Client forgery attempt
        gradingStatus: 'graded',
        graderNotes: 'Injected high score by candidate',
      },
      clientTimestamp: Date.now(),
    }),
  });
  assert(spoofScoreRes.status === 200, 'Server processed response with stripped parameters');
  // Check that earnedPoints was NOT saved into response
  assert(spoofScoreRes.data.response.earnedPoints === 0 || spoofScoreRes.data.response.earnedPoints === null,
    'Integrity: Client-injected earnedPoints was discarded by server');

  // Timestamp spoofing: client sends timestamp 1 hour in the future
  const futureTimestamp = Date.now() + 3600 * 1000;
  const futureTimeRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/sessions/${sessionAId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
    body: JSON.stringify({
      questionId: qAId,
      response: { optionId: 'opt_1' },
      clientTimestamp: futureTimestamp,
    }),
  });
  assert(futureTimeRes.status === 400, 'Integrity: Future client timestamp rejected with HTTP 400');
  assert(futureTimeRes.data.error.includes('future'), 'Integrity: Clear error message regarding future timestamp');

  // -------------------------------------------------------------------------
  // 6. SAFE EXAM BROWSER CRYPTOGRAPHIC GATEWAY
  // -------------------------------------------------------------------------
  console.log('\n--- AUDIT 5: SAFE EXAM BROWSER CRYPTOGRAPHIC GATEWAY ---');

  const sebExamRes = await api(`/api/v1/classrooms/${classroomAId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      title: 'Proctored High-Stakes SEB Exam',
      durationMinutes: 60,
      passingMarks: 60,
      securityLevel: 'seb',
      sebBrowserExamKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    }),
  });
  assert(sebExamRes.status === 200 || sebExamRes.status === 201, 'SEB Exam created');
  const sebExam = sebExamRes.data.exam || sebExamRes.data;
  const sebExamId = sebExam.id;

  await api(`/api/v1/classrooms/${classroomAId}/exams/${sebExamId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
  });

  // Request WITHOUT SEB header
  const noSebRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${sebExamId}/start`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
  });
  assert(noSebRes.status === 403, 'SEB Gate: Non-SEB client strictly blocked with HTTP 403');
  assert(noSebRes.data.sebRequired === true, 'SEB Gate: Response specifies sebRequired: true');

  // Request with INVALID SEB hash
  const badSebRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${sebExamId}/start`, {
    method: 'POST',
    headers: {
      Cookie: studentACookie,
      'X-SafeExamBrowser-RequestHash': 'deadbeefbadhash000000000000000000000000000000000000000000000000',
    },
  });
  assert(badSebRes.status === 403, 'SEB Gate: Tampered/invalid SEB hash strictly blocked with HTTP 403');

  // -------------------------------------------------------------------------
  // 7. TEACHER LIVE PROCTORING & CANDIDATE CONTROL
  // -------------------------------------------------------------------------
  console.log('\n--- AUDIT 6: TEACHER LIVE PROCTORING CONTROLS ---');

  // Teacher accesses live dashboard for Exam A
  const dashRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/dashboard`, {
    method: 'GET',
    headers: { Cookie: teacherACookie },
  });
  assert(dashRes.status === 200, 'Teacher accesses proctoring dashboard');
  assert(Array.isArray(dashRes.data.candidates), 'Dashboard returns candidates list');
  const candA = dashRes.data.candidates.find((c: any) => c.userId === studentAId);
  assert(candA !== undefined, 'Dashboard contains telemetry for Student A');
  assert(candA.connectionState === 'active' || candA.connectionState === 'idle',
    'Candidate connection state accurately derived from heartbeat');

  // PROCTOR ACTION: Time Extension (+10 minutes)
  const originalExpiresAt = sessionA.expiresAt;
  const extendRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/dashboard/candidates/${studentAId}/extend-time`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({ additionalMinutes: 10 }),
  });
  assert(extendRes.status === 200, 'Proctor: Time extension applied successfully');

  // Verify Student A sees new extended time on resume
  const studentCheck = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/start`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
  });
  const updatedSession = studentCheck.data.session || studentCheck.data;
  assert(updatedSession.expiresAt > originalExpiresAt,
    'Proctor: Student session dynamically updated with extended expiration');

  // PROCTOR ACTION: Force Submit & Early Termination with Auto-Grading
  // Student A answers Q1 correctly
  await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/sessions/${sessionAId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
    body: JSON.stringify({
      questionId: qAId,
      response: { optionId: 'opt_1' },
      clientTimestamp: Date.now(),
    }),
  });

  // Student A also answers Short Answer Q2
  await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/sessions/${sessionAId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentACookie },
    body: JSON.stringify({
      questionId: qA2Id,
      response: { text: 'Zero-knowledge proofs use simulation to prove validity without revealing witness' },
      clientTimestamp: Date.now(),
    }),
  });

  // Teacher forces submission for Student A
  const terminateRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/dashboard/candidates/${studentAId}/terminate`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      action: 'force_submit',
      reason: 'Proctor early close for cohort evaluation',
    }),
  });
  assert(terminateRes.status === 200, 'Proctor: Force submit executed successfully');

  // Verify session status is submitted and auto-graded
  const termCheck = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/submissions`, {
    method: 'GET',
    headers: { Cookie: teacherACookie },
  });
  const submissions = termCheck.data.submissions || termCheck.data;
  const subA = submissions.find((s: any) => s.userId === studentAId || s.id === sessionAId);
  assert(subA !== undefined, 'Proctor: Submission record exists for terminated candidate');
  assert(subA.status === 'submitted', 'Proctor: Session status locked to submitted');
  assert(subA.autoScore === 10, 'Proctor: Correct answer to Q1 awarded 10 auto-score points on force submit');

  // -------------------------------------------------------------------------
  // 8. MANUAL GRADING & RESULT RELEASE
  // -------------------------------------------------------------------------
  console.log('\n--- AUDIT 7: MANUAL GRADING & RESULT RELEASE ---');

  // Teacher reviews and manually grades Short Answer Q2 (awards 15 points)
  const gradeRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/submissions/${subA.id}/grade`, {
    method: 'PUT',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({
      manualScore: 15, // 10 auto + 15 manual = 25 total
      finalScore: 25,
      teacherFeedback: 'Excellent explanation of zero-knowledge simulation.',
      isPublished: true,
      questionGrades: [
        { questionId: qA2Id, earnedPoints: 15, gradingStatus: 'manually_graded', graderNotes: 'Full points awarded.' },
      ],
    }),
  });
  assert(gradeRes.status === 200, 'Teacher manually graded Short Answer question');

  // Teacher transitions exam to ended, then publishes/releases examination results
  const endRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({ status: 'ended' }),
  });
  assert(endRes.status === 200, 'Teacher transitioned exam to ended');

  const releaseRes = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherACookie },
    body: JSON.stringify({ status: 'results_published' }),
  });
  assert(releaseRes.status === 200 || releaseRes.status === 201, 'Teacher released results');

  // Student views released results
  const studentResults = await api(`/api/v1/classrooms/${classroomAId}/exams/${examAId}`, {
    method: 'GET',
    headers: { Cookie: studentACookie },
  });
  assert(studentResults.status === 200, 'Student views released exam results');

  console.log('\n================================================================');
  console.log('PHASE 3.7 SECURITY & PROCTORING SUITE COMPLETE');
  console.log(`Total Assertions: ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
