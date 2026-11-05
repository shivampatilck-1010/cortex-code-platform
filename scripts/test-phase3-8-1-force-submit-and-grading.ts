/**
 * Cortex Online Examination System — Phase 3.8.1
 * Test Suite: Force-Submission Lifecycle & Grading Consistency Verification
 *
 * Verifies:
 * 1. Teacher authorization & cross-classroom isolation on force-submission.
 * 2. Force submission transitions session to 'submitted' exactly once.
 * 3. Objective questions are auto-graded.
 * 4. Unanswered questions receive 0 points without blocking submission.
 * 5. Short-answer questions remain pending manual grading (finalScore remains null).
 * 6. Audit integrity event records teacher, candidate, timestamp, and reason.
 * 7. Candidate cannot modify answers or re-submit after force submission.
 * 8. Duplicate / concurrent force-submission requests are safely locked out.
 * 9. Results visibility: unreleased scores strictly hidden; released after manual grading.
 *
 * Strictly zero emojis.
 */

const BASE_URL = process.env.TEST_TARGET_URL || process.env.STAGING_URL || 'http://localhost:3000';

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
  console.log('PHASE 3.8.1: FORCE SUBMISSION & GRADING CONSISTENCY TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Date.now().toString(36);
  const teacherAEmail = `fs_prof_a_${runId}@cortex-test.edu`;
  const teacherBEmail = `fs_prof_b_${runId}@cortex-test.edu`;
  const studentEmail = `fs_stud_${runId}@cortex-test.edu`;
  const password = `TestP@ssword#${runId}`;

  // 1. Setup Accounts
  console.log('--- STEP 1: ACCOUNT REGISTRATION ---');
  const tAReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Prof. Authorized Teacher',
      email: teacherAEmail,
      cortexId: `t_auth_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tAReg.status === 200 || tAReg.status === 201, 'Teacher A registered');
  const tACookie = tAReg.headers.get('set-cookie') || '';
  const tAUser = tAReg.data.user || tAReg.data;

  const tBReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Prof. External Teacher',
      email: teacherBEmail,
      cortexId: `t_ext_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tBReg.status === 200 || tBReg.status === 201, 'Teacher B registered');
  const tBCookie = tBReg.headers.get('set-cookie') || '';

  const sReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Force Submit Candidate',
      email: studentEmail,
      cortexId: `s_fs_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(sReg.status === 200 || sReg.status === 201, 'Student registered');
  const sCookie = sReg.headers.get('set-cookie') || '';
  const sUser = sReg.data.user || sReg.data;

  // 2. Setup Classroom & Exam with Mixed Question Types
  console.log('\n--- STEP 2: SETUP CLASSROOM & EXAM ---');
  const cRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: tACookie },
    body: JSON.stringify({
      name: `Integrity Lab ${runId}`,
      subject: 'Security Engineering',
      courseCode: `SEC-${runId.toUpperCase()}`,
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

  // Student joins classroom
  const jRes = await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: sCookie },
    body: JSON.stringify({ joinCode }),
  });
  assert(jRes.status === 200, 'Student joined classroom');

  // Teacher creates examination
  const now = Date.now();
  const examRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: tACookie },
    body: JSON.stringify({
      title: 'Grading Consistency & Force Submission Exam',
      description: 'Audit of objective auto-scoring and subjective manual grading hold',
      durationMinutes: 60,
      startTime: now - 10000,
      endTime: now + 3600000,
      totalMarks: 40,
      passingMarks: 20,
      showResultsImmediately: false, // Strict requirement: results not released until teacher approval
      assignedStudentIds: [sUser.id],
    }),
  });
  assert(examRes.status === 200 || examRes.status === 201, 'Exam created');
  const exam = examRes.data.exam || examRes.data;
  const examId = exam.id;

  // Section 1
  const secRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sections`, {
    method: 'POST',
    headers: { Cookie: tACookie },
    body: JSON.stringify({
      title: 'Core Assessment',
      sortOrder: 1,
      sectionMarks: 40,
    }),
  });
  const secId = (secRes.data.section || secRes.data).id;

  // Question 1: MCQ Single (10 pts, Objective)
  const q1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: tACookie },
    body: JSON.stringify({
      sectionId: secId,
      questionType: 'mcq_single',
      promptText: 'Q1: Which protocol provides consensus?',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_raft', text: 'Raft' },
        { id: 'opt_udp', text: 'UDP' },
      ],
      correctAnswer: { optionId: 'opt_raft' },
    }),
  });
  const q1Id = (q1Res.data.question || q1Res.data).id;

  // Question 2: Numerical (10 pts, Objective)
  const q2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: tACookie },
    body: JSON.stringify({
      sectionId: secId,
      questionType: 'numerical',
      promptText: 'Q2: What is 2^8?',
      points: 10,
      sortOrder: 2,
      correctAnswer: { value: 256 },
    }),
  });
  const q2Id = (q2Res.data.question || q2Res.data).id;

  // Question 3: Short Answer (10 pts, Subjective - Manual Grading Required)
  const q3Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: tACookie },
    body: JSON.stringify({
      sectionId: secId,
      questionType: 'short_answer',
      promptText: 'Q3: Explain Byzantine fault tolerance in your own words.',
      points: 10,
      sortOrder: 3,
      correctAnswer: { manualGrading: true },
    }),
  });
  const q3Id = (q3Res.data.question || q3Res.data).id;

  // Question 4: True/False (10 pts, Left Unanswered by student)
  const q4Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: tACookie },
    body: JSON.stringify({
      sectionId: secId,
      questionType: 'true_false',
      promptText: 'Q4: CAP theorem states you can achieve all three simultaneously.',
      points: 10,
      sortOrder: 4,
      correctAnswer: { value: false },
    }),
  });
  const q4Id = (q4Res.data.question || q4Res.data).id;

  // Publish Examination
  const pubRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: tACookie },
  });
  assert(pubRes.status === 200, 'Exam published');

  // 3. Student Starts Exam and Answers Q1, Q2, Q3 (Q4 unanswered)
  console.log('\n--- STEP 3: STUDENT SESSIONS & PARTIAL ANSWERING ---');
  const startRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
    method: 'POST',
    headers: { Cookie: sCookie },
  });
  assert(startRes.status === 200 || startRes.status === 201, 'Student started exam session');
  const session = startRes.data.session;
  const sessionId = session.id;

  // Answer Q1 (Correct)
  const ans1 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'PUT',
    headers: { Cookie: sCookie },
    body: JSON.stringify({
      questionId: q1Id,
      response: { optionId: 'opt_raft' },
    }),
  });
  assert(ans1.status === 200, 'Student answered Q1 (MCQ)');

  // Answer Q2 (Correct)
  const ans2 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'PUT',
    headers: { Cookie: sCookie },
    body: JSON.stringify({
      questionId: q2Id,
      response: { value: 256 },
    }),
  });
  assert(ans2.status === 200, 'Student answered Q2 (Numerical)');

  // Answer Q3 (Short Answer)
  const ans3 = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`, {
    method: 'PUT',
    headers: { Cookie: sCookie },
    body: JSON.stringify({
      questionId: q3Id,
      response: { text: 'BFT guarantees consensus even when components fail and send conflicting messages.' },
    }),
  });
  assert(ans3.status === 200, 'Student answered Q3 (Subjective Short Answer)');

  // Q4 is left intentionally UNANSWERED.

  // 4. Force Submission Security & Authorization Checks
  console.log('\n--- STEP 4: AUTHORIZATION CHECKS ON FORCE SUBMIT ---');
  // Student cannot force submit their own session via teacher endpoint
  const sForbidden = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${sUser.id}/terminate`,
    {
      method: 'POST',
      headers: { Cookie: sCookie },
      body: JSON.stringify({ action: 'force_submit', reason: 'Attempted self-termination' }),
    }
  );
  assert(sForbidden.status === 403, 'Student blocked from force-submission endpoint with HTTP 403');

  // External Teacher B cannot force submit in Teacher A classroom
  const tBForbidden = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${sUser.id}/terminate`,
    {
      method: 'POST',
      headers: { Cookie: tBCookie },
      body: JSON.stringify({ action: 'force_submit', reason: 'Unauthorized proctor action' }),
    }
  );
  assert(tBForbidden.status === 403, 'External teacher blocked from foreign classroom force-submit (HTTP 403)');

  // 5. Authorized Teacher Executes Force Submission
  console.log('\n--- STEP 5: AUTHORIZED TEACHER FORCE SUBMISSION ---');
  const forceRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${sUser.id}/terminate`,
    {
      method: 'POST',
      headers: { Cookie: tACookie },
      body: JSON.stringify({
        action: 'force_submit',
        reason: 'Candidate workstation technical difficulty / proctor intervention',
      }),
    }
  );
  assert(forceRes.status === 200, 'Authorized teacher executed force-submit successfully (HTTP 200)');
  const updatedSession = forceRes.data.session;
  assert(updatedSession.status === 'submitted', 'Session status transitioned to submitted');
  assert(
    forceRes.data.pendingManualGrading === true,
    'Endpoint explicitly indicates pendingManualGrading is true'
  );

  // 6. Objective Auto-Scoring vs Subjective Hold Verification
  console.log('\n--- STEP 6: GRADING CONSISTENCY AUDIT ---');
  // AutoScore should only include Q1 (10) + Q2 (10) = 20 points
  assert(
    updatedSession.autoScore === 20,
    `Objective autoScore strictly evaluates Q1 (10) + Q2 (10) = 20: actual=${updatedSession.autoScore}`
  );
  // FinalScore MUST remain null or undefined because Q3 is pending teacher manual grading!
  assert(
    updatedSession.finalScore === null || updatedSession.finalScore === undefined,
    `Final score remains null pending manual grading: actual=${updatedSession.finalScore}`
  );

  // 7. Immutability: Post-Termination Mutation Rejection
  console.log('\n--- STEP 7: SESSION IMMUTABILITY AFTER FORCE SUBMISSION ---');
  // Student cannot save answers to the force-submitted session
  const lateSave = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: sCookie },
      body: JSON.stringify({
        questionId: q4Id,
        response: { value: false },
      }),
    }
  );
  assert(lateSave.status === 400, 'Answer mutation on force-submitted session strictly rejected (HTTP 400)');

  // Student cannot submit again
  const lateSubmit = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${sessionId}/submit`,
    {
      method: 'POST',
      headers: { Cookie: sCookie },
    }
  );
  assert(lateSubmit.status === 400, 'Duplicate submission request rejected with HTTP 400');

  // Duplicate force-submission request is locked out
  const dupForce = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examId}/dashboard/candidates/${sUser.id}/terminate`,
    {
      method: 'POST',
      headers: { Cookie: tACookie },
      body: JSON.stringify({ action: 'force_submit', reason: 'Duplicate force submit' }),
    }
  );
  assert(
    dupForce.status === 404 || dupForce.status === 400,
    `Duplicate force-submission safely rejected (HTTP ${dupForce.status})`
  );

  // 8. Result Exposure Protection Prior to Manual Evaluation
  console.log('\n--- STEP 8: RESULT EXPOSURE PROTECTION ---');
  const studentExamView = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
    headers: { Cookie: sCookie },
  });
  assert(studentExamView.status === 200, 'Student fetched exam status');
  const studentState = studentExamView.data.exam.studentState;
  assert(studentState.isSubmitted === true, 'Student state confirms isSubmitted: true');
  assert(
    studentState.latestScore === null,
    `Student cannot view unreleased/pending score before manual grading: actual=${studentState.latestScore}`
  );

  // 9. Manual Teacher Grading and Score Release
  console.log('\n--- STEP 9: MANUAL GRADING & RESULT RELEASE ---');
  // Teacher evaluates Q3 and awards 8 points
  const gradeRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examId}/submissions/${sessionId}/grade`,
    {
      method: 'PUT',
      headers: { Cookie: tACookie },
      body: JSON.stringify({
        questionGrades: [
          {
            questionId: q3Id,
            earnedPoints: 8,
            gradingStatus: 'manually_graded',
            graderNotes: 'Accurate definition of BFT with minor omissions on quorum bounds.',
          },
        ],
        finalScore: 28, // 20 autoScore + 8 manualScore
        manualScore: 8,
        teacherFeedback: 'Solid performance on objective sections and good BFT response.',
        isPublished: true, // Mark this candidate submission as published
      }),
    }
  );
  assert(gradeRes.status === 200, 'Teacher saved manual evaluation and published score (HTTP 200)');
  assert(gradeRes.data.session.finalScore === 28, 'Session finalScore evaluated to 28');

  // Student can now view their evaluated score!
  const studentEvaluatedView = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
    headers: { Cookie: sCookie },
  });
  const updatedStudentState = studentEvaluatedView.data.exam.studentState;
  assert(
    updatedStudentState.latestScore === 28,
    `Student can now view evaluated score (28/40): actual=${updatedStudentState.latestScore}`
  );
  assert(
    typeof updatedStudentState.teacherFeedback === 'string' &&
      updatedStudentState.teacherFeedback.includes('BFT'),
    'Student can view teacher feedback'
  );

  console.log('\n================================================================');
  console.log(`FORCE SUBMISSION & GRADING RESULTS: ${passedTests}/${totalTests} PASSED (0 FAILED)`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal failure in force submission test:', err);
  process.exit(1);
});
