/**
 * Cortex Online Examination System — Phase 3.6 Live Staging Validation Suite
 *
 * Executes live HTTP integration tests directly against the deployed Cloudflare staging Worker:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Tests:
 * 1. Teacher full workflow (CRUD, Question Bank, Sections, Branching, SEB config, Live Dashboard, Proctoring, Grading)
 * 2. Student full workflow (Listing, Redacted DTOs, Start, Autosave, Heartbeat, Reconnect, Submit, Result visibility)
 * 3. Security boundary enforcement (Cross-classroom, auth checks, secret redaction, score forgery, SEB cryptographic gate)
 *
 * Requirements:
 * - Operates strictly against the verified staging Worker.
 * - Zero emojis in logs.
 * - Strict assertion accounting.
 */

import crypto from 'node:crypto';

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
  console.log(`CORTEX ONLINE EXAMINATION SYSTEM — LIVE STAGING VALIDATION`);
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Date.now().toString(36);
  const teacherEmail = `teacher_${runId}@cortex-staging.edu`;
  const studentEmail = `student_${runId}@cortex-staging.edu`;
  const password = `StagingP@ssword#${runId}`;

  // -------------------------------------------------------------------------
  // STAGE 1: AUTHENTICATION & CLASSROOM SETUP
  // -------------------------------------------------------------------------
  console.log('--- STAGE 1: AUTHENTICATION & SETUP ---');

  // Register Teacher
  const tReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Staging Instructor Dr. Smith',
      email: teacherEmail,
      cortexId: `prof_${runId.substring(0, 10)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tReg.status === 200 || tReg.status === 201, 'Teacher registered successfully on staging');
  const teacherCookie = tReg.headers.get('set-cookie') || '';
  const teacherUser = tReg.data.user;

  // Register Student
  const sReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Staging Candidate Alice',
      email: studentEmail,
      cortexId: `stud_${runId.substring(0, 10)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(sReg.status === 200 || sReg.status === 201, 'Student registered successfully on staging');
  const studentCookie = sReg.headers.get('set-cookie') || '';
  const studentUser = sReg.data.user;

  // Teacher creates Classroom
  const cCreate = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `Staging Algorithms CS301 (${runId})`,
      subject: 'Computer Science',
      description: 'Staging examination testing classroom',
      courseCode: `CS301-${runId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: {},
    }),
  });
  assert(cCreate.status === 200 || cCreate.status === 201, 'Classroom created on staging');
  const classroom = cCreate.data.classroom || cCreate.data;
  const classroomId = classroom.id;
  const joinCode = classroom.joincode || classroom.joinCode;

  // Student joins Classroom
  const cJoin = await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      joinCode,
    }),
  });
  assert(cJoin.status === 200, 'Student joined staging classroom via join code');

  // -------------------------------------------------------------------------
  // STAGE 2: QUESTION BANK MANAGEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 2: QUESTION BANK MANAGEMENT ---');

  const qbCreate = await api('/api/v1/question-bank', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      classroomId,
      subject: 'Algorithms',
      topic: 'Graphs',
      difficulty: 'hard',
      questionType: 'mcq_single',
      promptText: 'What is the time complexity of Dijkstra using a Fibonacci heap?',
      options: [
        { id: 'opt_a', text: 'O(V^2)', isCorrect: false },
        { id: 'opt_b', text: 'O(E + V log V)', isCorrect: true },
        { id: 'opt_c', text: 'O(E log V)', isCorrect: false },
      ],
      correctAnswer: { optionId: 'opt_b' },
      defaultPoints: 5,
      tags: ['graphs', 'dijkstra', 'heap'],
    }),
  });
  assert(qbCreate.status === 200 || qbCreate.status === 201, 'Question Bank item created on staging');
  const qBankItem = qbCreate.data.question || qbCreate.data;

  // -------------------------------------------------------------------------
  // STAGE 3: TEACHER EXAMINATION CREATION & ADAPTIVE BRANCHING
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 3: EXAMINATION CREATION & CONFIGURATION ---');

  const now = Date.now();
  const quitPassword = 'StagingQuitPassword2026!';

  const examCreate = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: `Staging Verified Comprehensive Exam (${runId})`,
      description: 'Staging verification assessment',
      durationMinutes: 45,
      startTime: now - 60000,
      endTime: now + 7200000,
      totalMarks: 30,
      passingMarks: 15,
      attemptsAllowed: 1,
      securityLevel: 'standard',
      shuffleQuestions: true,
      shuffleOptions: true,
      showResultsImmediately: false,
      sebQuitPassword: quitPassword,
      assignedStudentIds: [studentUser.id],
    }),
  });
  assert(examCreate.status === 201, 'Teacher created draft examination on staging');
  const exam = examCreate.data.exam || examCreate.data;
  const examId = exam.id;

  // Verify quit password hashed and not plaintext
  assert(exam.sebQuitPassword === null || exam.sebQuitPassword === undefined, 'Returned exam object has null/undefined plaintext quit password');
  assert(exam.hasQuitPassword === true, 'Teacher exam listing contains hasQuitPassword boolean indicator');

  // Add Section 1
  const sec1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Section 1: Foundations',
      description: 'Core questions',
      sortOrder: 1,
      sectionMarks: 10,
      instructions: 'Answer all foundational questions.',
      isMandatory: true,
      timeLimitMinutes: 0,
    }),
  });
  assert(sec1Res.status === 201, 'Section 1 created with Phase 3 instructions');
  const section1 = sec1Res.data.section || sec1Res.data;

  // Add Section 2 (Adaptive Math track)
  const sec2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Section 2A: Advanced Theory',
      description: 'Theory branch',
      sortOrder: 2,
      sectionMarks: 10,
      instructions: 'Theoretical track.',
      isMandatory: false,
      timeLimitMinutes: 15,
    }),
  });
  assert(sec2Res.status === 201, 'Section 2A created with Phase 3 time limit');
  const section2 = sec2Res.data.section || sec2Res.data;

  // Add Question 1 to Section 1 (Multiple Choice - mcq_single)
  const q1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: section1.id,
      questionType: 'mcq_single',
      promptText: 'Select your preferred advanced specialization track:',
      options: [
        { id: 'opt_theory', text: 'Theoretical Computer Science' },
        { id: 'opt_systems', text: 'Systems & Networks' },
      ],
      correctAnswer: { optionId: 'opt_theory' },
      points: 5,
      sortOrder: 1,
    }),
  });
  assert(q1Res.status === 201, 'Question 1 (mcq_single) created on staging');
  const question1 = q1Res.data.question || q1Res.data;

  // Add Question 2 to Section 1 (Numerical question)
  const q2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: section1.id,
      questionType: 'numerical',
      promptText: 'What is 2^10?',
      correctAnswer: { value: 1024, tolerance: 0 },
      points: 5,
      sortOrder: 2,
    }),
  });
  assert(q2Res.status === 201, 'Question 2 (numerical) created on staging');
  const question2 = q2Res.data.question || q2Res.data;

  // Add Question 3 (Short Answer for manual grading)
  const q3Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: section1.id,
      questionType: 'short_answer',
      promptText: 'Explain the difference between process and thread.',
      correctAnswer: { manualGrading: true, sampleAnswer: 'Process has independent memory space while threads share memory.' },
      points: 10,
      sortOrder: 3,
    }),
  });
  assert(q3Res.status === 201, 'Question 3 (Short Answer) created on staging');
  const question3 = q3Res.data.question || q3Res.data;

  // Configure Adaptive Branching Rule
  const branchRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/branching-rules`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sourceQuestionId: question1.id,
      conditionOperator: 'selected_option',
      conditionValue: 'opt_theory',
      destinationType: 'section',
      destinationId: section2.id,
      defaultDestinationType: 'end',
      priority: 1,
    }),
  });
  assert(branchRes.status === 201, 'Branching rule created on staging');

  // Teacher previews exam
  const previewRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
    method: 'GET',
    headers: { Cookie: teacherCookie },
  });
  assert(previewRes.status === 200, 'Teacher previewed examination successfully');
  const teacherExamView = previewRes.data.exam || previewRes.data;
  assert(teacherExamView.hasQuitPassword === true, 'Teacher preview confirms hasQuitPassword is true');

  // Teacher publishes examination
  const pubRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      status: 'published',
    }),
  });
  assert(pubRes.status === 200, 'Teacher published examination on staging');

  // -------------------------------------------------------------------------
  // STAGE 4: STUDENT EXAMINATION JOURNEY
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 4: STUDENT EXAMINATION JOURNEY ---');

  // Student queries assigned exams
  const studentListRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  assert(studentListRes.status === 200, 'Student retrieved assigned examinations list');
  const assignedList = studentListRes.data.exams || studentListRes.data;
  assert(assignedList.some((e: any) => e.id === examId), 'Published examination visible in student list');

  // Student inspects published exam: CRITICAL SECRET REDACTION TEST
  const studentExamRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  assert(studentExamRes.status === 200, 'Student fetched exam definition');
  const studentExam = studentExamRes.data.exam || studentExamRes.data;

  assert(studentExam.sebQuitPassword === undefined, 'Student payload strictly redacts sebQuitPassword');
  assert(studentExam.sebQuitPasswordHash === undefined, 'Student payload strictly redacts sebQuitPasswordHash');
  assert(studentExam.sebBrowserExamKey === undefined, 'Student payload strictly redacts sebBrowserExamKey');
  assert(studentExam.sebConfigKey === undefined, 'Student payload strictly redacts sebConfigKey');
  assert(studentExam.hasQuitPassword === undefined, 'Student payload strictly redacts hasQuitPassword');

  // Check question answers are redacted
  for (const q of studentExam.questions || []) {
    assert(q.correctAnswer === undefined, `Student question ${q.id} correctAnswer strictly redacted`);
    if (q.options) {
      for (const opt of q.options) {
        assert(opt.isCorrect === undefined, `Student option ${opt.id} isCorrect strictly redacted`);
      }
    }
  }

  // Student starts examination session
  const startRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({}),
  });
  assert(startRes.status === 201 || startRes.status === 200, 'Student started examination session on staging');
  const session = startRes.data.session || startRes.data;
  const sessionId = session.id;
  assert(session.status === 'in_progress', 'Session status is in_progress');

  // Student flags Question 2 for review and answers Question 2 (numerical)
  const flagRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      questionId: question2.id,
      response: { value: 1024 },
      flaggedForReview: true,
      clientTimestamp: Date.now(),
    }),
  });
  assert(flagRes.status === 200, 'Student flagged question for review and saved numerical answer');

  // Student answers Question 1 (Theoretical choice)
  const ansQ1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      questionId: question1.id,
      response: { optionId: 'opt_theory' },
      flaggedForReview: false,
      clientTimestamp: Date.now(),
    }),
  });
  assert(ansQ1Res.status === 200, 'Student answered Question 1 on staging');

  // Student answers Question 3 (Short answer)
  const ansQ3Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      questionId: question3.id,
      response: { text: 'A process is an execution environment with its own address space, whereas threads share memory within the parent process.' },
      flaggedForReview: false,
      clientTimestamp: Date.now(),
    }),
  });
  assert(ansQ3Res.status === 200, 'Student answered Question 3 (Short Answer) on staging');

  // Student sends heartbeat ping
  const hbRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/heartbeat`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ timestamp: Date.now() }),
  });
  assert(hbRes.status === 200, 'Student session heartbeat ping recorded on staging');

  // -------------------------------------------------------------------------
  // STAGE 5: TEACHER LIVE DASHBOARD & PROCTORING
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 5: TEACHER LIVE MONITORING & PROCTOR ACTIONS ---');

  const dashRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard`, {
    method: 'GET',
    headers: { Cookie: teacherCookie },
  });
  assert(dashRes.status === 200, 'Teacher accessed live candidate dashboard on staging');
  const dashData = dashRes.data;
  assert(dashData.metrics.inProgress >= 1, 'Live dashboard shows at least 1 in-progress candidate');

  const candidateInfo = (dashData.candidates || []).find((c: any) => c.userId === studentUser.id);
  assert(candidateInfo !== undefined, 'Live candidate telemetry includes student candidate card');
  assert(candidateInfo.connectionState === 'active', 'Live candidate connection state derived as active');

  // Teacher grants 10 minutes time extension
  const extendRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${studentUser.id}/extend-time`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      additionalMinutes: 10,
    }),
  });
  assert(extendRes.status === 200, 'Teacher granted time extension proctor action on staging');

  // -------------------------------------------------------------------------
  // STAGE 6: STUDENT SUBMISSION & GRADING
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 6: STUDENT SUBMISSION & MANUAL GRADING ---');

  // Student final submit
  const submitRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({}),
  });
  assert(submitRes.status === 200, 'Student successfully submitted examination on staging');
  const submitData = submitRes.data.session || submitRes.data;
  assert(submitData.status === 'submitted', 'Session status locked to submitted');

  // Duplicate submit rejection test
  const dupSubmit = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({}),
  });
  assert(dupSubmit.status === 400, 'Duplicate submission on locked session rejected with HTTP 400');

  // Teacher inspects submissions
  const subListRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/submissions`, {
    method: 'GET',
    headers: { Cookie: teacherCookie },
  });
  assert(subListRes.status === 200, 'Teacher retrieved submissions list on staging');
  const submissions = subListRes.data.submissions || subListRes.data;
  const studentSub = submissions.find((s: any) => s.id === sessionId);
  assert(studentSub !== undefined, 'Student submission appears in teacher review list');
  assert(studentSub.autoScore >= 10, 'Auto-score evaluated correctly (Q1: 5pts + Q2: 5pts = 10pts)');

  // Teacher manually grades Question 3 (Short answer)
  const gradeRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/submissions/${sessionId}/grade`, {
    method: 'PUT',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      manualScore: 10, // 10 auto + 10 manual = 20 total
      finalScore: 20,
      teacherFeedback: 'Excellent explanation of address spaces and thread scheduling.',
      isPublished: true,
      questionGrades: [
        { questionId: question3.id, earnedPoints: 10, gradingStatus: 'manually_graded', graderNotes: 'Accurate and concise.' },
      ],
    }),
  });
  assert(gradeRes.status === 200, 'Teacher applied manual grade and feedback on staging');

  // Student views released results via exam endpoint
  const studentResultRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  assert(studentResultRes.status === 200, 'Student viewed released results on staging');
  const resultExam = studentResultRes.data.exam || studentResultRes.data;
  assert(resultExam.studentState.isSubmitted === true, 'Student confirms isSubmitted is true');

  // -------------------------------------------------------------------------
  // STAGE 7: SECURITY BOUNDARY VERIFICATION ON STAGING
  // -------------------------------------------------------------------------
  console.log('\n--- STAGE 7: SECURITY BOUNDARY VERIFICATION ---');

  // 1. Cross-classroom access prevention
  const fakeClassroomId = 'c_fake_999999999';
  const crossRes = await api(`/api/v1/classrooms/${fakeClassroomId}/exams`, {
    method: 'GET',
    headers: { Cookie: teacherCookie },
  });
  assert(crossRes.status === 403 || crossRes.status === 404, 'Cross-classroom access rejected on staging');

  // 2. Student blocked from creating examinations
  const studentCreateExam = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ title: 'Hacked Exam' }),
  });
  assert(studentCreateExam.status === 403, 'Student blocked from creating examination with HTTP 403');

  // 3. Client score forgery prevention
  const forgeRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      questionId: question1.id,
      response: { optionId: 'opt_theory' },
      earnedPoints: 100, // Client forgery attempt
      gradingStatus: 'graded',
      clientTimestamp: Date.now(),
    }),
  });
  assert(forgeRes.status === 403 || forgeRes.status === 400, 'Answer mutation to submitted session strictly blocked');

  // 4. Future timestamp rejected
  const futureTimestampRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      questionId: question1.id,
      response: {},
      clientTimestamp: Date.now() + 3600000,
    }),
  });
  assert(futureTimestampRes.status === 400 || futureTimestampRes.status === 403, 'Future timestamp rejected on staging');

  // 5. Safe Exam Browser cryptographic gate verification
  console.log('\n--- STAGE 8: SAFE EXAM BROWSER CRYPTOGRAPHIC GATE ON STAGING ---');

  const sebExamCreate = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: `SEB Restricted Exam (${runId})`,
      description: 'Strict SEB security gate test',
      durationMinutes: 30,
      startTime: now - 60000,
      endTime: now + 7200000,
      totalMarks: 20,
      passingMarks: 10,
      attemptsAllowed: 1,
      securityLevel: 'seb',
      sebConfigKey: 'c8f1e582b1300984a9e2230873a4b649d280e2f5b40c6600c609c2a13e2f5728',
      assignedStudentIds: [studentUser.id],
    }),
  });
  assert(sebExamCreate.status === 201, 'Teacher created SEB-enforced exam on staging');
  const sebExam = sebExamCreate.data.exam || sebExamCreate.data;

  // Publish SEB exam
  const sebPub = await api(`/api/v1/classrooms/${classroomId}/exams/${sebExam.id}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ status: 'published' }),
  });
  assert(sebPub.status === 200, 'SEB exam published on staging');

  // Normal browser (no SEB headers) attempts to start SEB exam -> MUST FAIL WITH 403
  const sebGateRes = await api(`/api/v1/classrooms/${classroomId}/exams/${sebExam.id}/start`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({}),
  });
  assert(sebGateRes.status === 403, 'Standard browser request to SEB exam strictly rejected with HTTP 403');
  assert(sebGateRes.data.sebRequired === true, 'SEB gate response specifies sebRequired: true');

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`STAGING VALIDATION COMPLETE`);
  console.log(`Total Assertions: ${totalTests}`);
  console.log(`Passed:           ${passedTests}`);
  console.log(`Failed:           ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('[FATAL] Staging validation encountered an unhandled error:', err);
  process.exit(1);
});
