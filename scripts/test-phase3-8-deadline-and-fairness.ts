/**
 * Cortex Online Examination System — Phase 3.8
 * Test Suite: Deadline Boundaries, Grace Period, and Examination Fairness
 *
 * Verifies:
 * 1. Clock manipulation resilience (future timestamps rejected with HTTP 400).
 * 2. Normal answer persistence prior to deadline (expiresAt).
 * 3. Grace period answering rejection (new answers attempted after expiresAt rejected with HTTP 403).
 * 4. Grace period submission delivery (existing answers submitted within expiresAt + 30s accepted as 'submitted').
 * 5. Fairness preservation (finalResponses payloads submitted during grace period are not accepted).
 * 6. Post-grace period expiration (submissions after expiresAt + 30s transition session to 'timed_out').
 * 7. Teacher dynamic time extension (+5 minutes) extends session deadline and permits continued answering.
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('================================================================');
  console.log('PHASE 3.8: DEADLINE BOUNDARIES & EXAMINATION FAIRNESS TEST SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Date.now().toString(36);
  const teacherEmail = `fair_prof_${runId}@cortex-test.edu`;
  const student1Email = `fair_s1_${runId}@cortex-test.edu`;
  const student2Email = `fair_s2_${runId}@cortex-test.edu`;
  const student3Email = `fair_s3_${runId}@cortex-test.edu`;
  const password = `TestP@ssword#${runId}`;

  // 1. Setup Accounts
  console.log('--- STEP 1: REGISTER TEACHER AND STUDENTS ---');
  const tReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Prof. Assessment Fairness',
      email: teacherEmail,
      cortexId: `prof_fair_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tReg.status === 200 || tReg.status === 201, 'Teacher registered successfully');
  const teacherCookie = tReg.headers.get('set-cookie') || '';
  const teacherUser = tReg.data.user || tReg.data;

  const s1Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Fairness Candidate One',
      email: student1Email,
      cortexId: `s_fair1_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s1Reg.status === 200 || s1Reg.status === 201, 'Student 1 registered');
  const s1Cookie = s1Reg.headers.get('set-cookie') || '';
  const s1User = s1Reg.data.user || s1Reg.data;

  const s2Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Fairness Candidate Two',
      email: student2Email,
      cortexId: `s_fair2_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s2Reg.status === 200 || s2Reg.status === 201, 'Student 2 registered');
  const s2Cookie = s2Reg.headers.get('set-cookie') || '';
  const s2User = s2Reg.data.user || s2Reg.data;

  const s3Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Fairness Candidate Three',
      email: student3Email,
      cortexId: `s_fair3_${runId.substring(0, 8)}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s3Reg.status === 200 || s3Reg.status === 201, 'Student 3 registered');
  const s3Cookie = s3Reg.headers.get('set-cookie') || '';
  const s3User = s3Reg.data.user || s3Reg.data;

  // 2. Create Classroom & Enroll Students
  console.log('\n--- STEP 2: CREATE CLASSROOM & ENROLL STUDENTS ---');
  const cRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `CS-501 Assessment Boundaries Lab (${runId})`,
      subject: 'Computer Science',
      description: 'Assessment Fairness and Deadline Boundaries',
      courseCode: `CS501-${runId.toUpperCase()}`,
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

  for (const [cookie, sid, sname] of [
    [s1Cookie, s1User.id, 'Student 1'],
    [s2Cookie, s2User.id, 'Student 2'],
    [s3Cookie, s3User.id, 'Student 3'],
  ]) {
    const jRes = await api('/api/v1/classrooms/join', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({ joinCode }),
    });
    assert(jRes.status === 200, `${sname} joined classroom`);
  }

  // 3. Test Scenario A: Clock Manipulation Resilience
  console.log('\n--- STEP 3: CLOCK MANIPULATION RESILIENCE ---');
  const nowA = Date.now();
  const examARes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Exam A: Integrity & Clock Test',
      description: 'Clock manipulation rejection test',
      durationMinutes: 10,
      startTime: nowA - 60000,
      endTime: nowA + 600000,
      totalMarks: 10,
      passingMarks: 5,
      assignedStudentIds: [s1User.id],
    }),
  });
  assert(examARes.status === 200 || examARes.status === 201, 'Exam A created');
  const examA = examARes.data.exam || examARes.data;
  const examAId = examA.id;

  const secARes = await api(`/api/v1/classrooms/${classroomId}/exams/${examAId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Section A',
      sortOrder: 1,
      sectionMarks: 10,
    }),
  });
  const secAId = (secARes.data.section || secARes.data).id;

  const qARes = await api(`/api/v1/classrooms/${classroomId}/exams/${examAId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: secAId,
      questionType: 'numerical',
      promptText: 'What is 2 + 2?',
      points: 10,
      sortOrder: 1,
      correctAnswer: { value: 4 },
    }),
  });
  const qA1Id = (qARes.data.question || qARes.data).id;

  // Publish Exam A
  const pubARes = await api(`/api/v1/classrooms/${classroomId}/exams/${examAId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });
  assert(pubARes.status === 200, 'Exam A published');

  // Student 1 starts Exam A
  const startARes = await api(`/api/v1/classrooms/${classroomId}/exams/${examAId}/start`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
  });
  assert(startARes.status === 200 || startARes.status === 201, 'Student 1 started Exam A');
  const s1Session = startARes.data.session;
  const s1SessionId = s1Session.id;

  // Attempt to save response with future client timestamp (+60 seconds)
  const futureTime = Date.now() + 60000;
  const manipRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examAId}/sessions/${s1SessionId}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s1Cookie },
      body: JSON.stringify({
        questionId: qA1Id,
        response: { value: 4 },
        clientTimestamp: futureTime,
      }),
    }
  );
  assert(manipRes.status === 400, 'Future client timestamp rejected with HTTP 400');
  assert(
    typeof manipRes.data.error === 'string' && manipRes.data.error.includes('future'),
    `Rejection error explicitly cites future timestamp: "${manipRes.data.error}"`
  );

  // Normal save with current timestamp succeeds
  const validRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examAId}/sessions/${s1SessionId}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s1Cookie },
      body: JSON.stringify({
        questionId: qA1Id,
        response: { value: 4 },
        clientTimestamp: Date.now() - 50,
      }),
    }
  );
  assert(validRes.status === 200, 'Normal timestamp response saved successfully');

  // 4. Test Scenario B: 30-Second Grace Period & Answering Cutoff
  console.log('\n--- STEP 4: DEADLINE CUTOFF & 30-SECOND GRACE PERIOD SUBMISSION ---');
  // Create an exam that expires in 5 seconds (endTime = now + 5000)
  const nowB = Date.now();
  const examBRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Exam B: Deadline Boundaries',
      durationMinutes: 5,
      startTime: nowB - 10000,
      endTime: nowB + 5000, // Closes in 5 seconds
      totalMarks: 20,
      passingMarks: 10,
      showResultsImmediately: true,
      assignedStudentIds: [s2User.id],
    }),
  });
  assert(examBRes.status === 200 || examBRes.status === 201, 'Exam B created with short window');
  const examB = examBRes.data.exam || examBRes.data;
  const examBId = examB.id;

  const secBRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examBId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Section B',
      sortOrder: 1,
      sectionMarks: 20,
    }),
  });
  const secBId = (secBRes.data.section || secBRes.data).id;

  // Question 1: MCQ Single
  const qB1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examBId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: secBId,
      questionType: 'mcq_single',
      promptText: 'Question 1: Valid MCQ',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_b1_c', text: 'Correct Option' },
        { id: 'opt_b1_i', text: 'Incorrect Option' },
      ],
      correctAnswer: { optionId: 'opt_b1_c' },
    }),
  });
  const qB1Id = (qB1Res.data.question || qB1Res.data).id;

  // Question 2: MCQ Single
  const qB2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${examBId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: secBId,
      questionType: 'mcq_single',
      promptText: 'Question 2: Late MCQ',
      points: 10,
      sortOrder: 2,
      options: [
        { id: 'opt_b2_c', text: 'Option Alpha (Correct)' },
        { id: 'opt_b2_i', text: 'Option Beta (Incorrect)' },
      ],
      correctAnswer: { optionId: 'opt_b2_c' },
    }),
  });
  const qB2Id = (qB2Res.data.question || qB2Res.data).id;

  // Publish Exam B
  await api(`/api/v1/classrooms/${classroomId}/exams/${examBId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });

  // Student 2 starts Exam B
  const startBRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examBId}/start`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
  });
  assert(startBRes.status === 200 || startBRes.status === 201, 'Student 2 started Exam B');
  const s2Session = startBRes.data.session;
  const expiresAtB = s2Session.expiresAt;
  console.log(`Session starts with expiresAt = ${new Date(expiresAtB).toISOString()}`);

  // Immediately answer Question 1 while examination is active
  const saveB1 = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examBId}/sessions/${s2Session.id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        questionId: qB1Id,
        response: { optionId: 'opt_b1_c' },
      }),
    }
  );
  assert(saveB1.status === 200, 'Question 1 saved during active examination time');

  // Wait until deadline has passed (wait remaining time until expiresAt + 1500ms)
  const remainingUntilDeadline = expiresAtB - Date.now();
  if (remainingUntilDeadline > 0) {
    console.log(`Waiting ${remainingUntilDeadline + 1500}ms for examination deadline to elapse...`);
    await sleep(remainingUntilDeadline + 1500);
  }

  // Verify that answering is now CLOSED (now > expiresAt, but now <= expiresAt + 30s)
  const nowAfterDeadline = Date.now();
  assert(
    nowAfterDeadline > expiresAtB,
    `Current time (${nowAfterDeadline}) is past expiresAt (${expiresAtB})`
  );
  assert(
    nowAfterDeadline < expiresAtB + 30000,
    `Current time is within the 30-second grace window`
  );

  // Attempt to save or update an answer after deadline
  const lateSaveRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examBId}/sessions/${s2Session.id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        questionId: qB2Id,
        response: { optionId: 'opt_b2_c' },
      }),
    }
  );
  assert(
    lateSaveRes.status === 403,
    'Attempt to answer question after deadline is rejected with HTTP 403'
  );
  assert(
    lateSaveRes.data.expired === true,
    'Server explicitly flags response as expired: true'
  );

  // Attempt submission within the 30-second grace window with finalResponses payload
  // The pre-existing Question 1 should be graded, but late Question 2 in finalResponses must be ignored!
  const graceSubmitRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examBId}/sessions/${s2Session.id}/submit`,
    {
      method: 'POST',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        finalResponses: {
          [qB2Id]: { optionId: 'opt_b2_c' },
        },
      }),
    }
  );
  assert(graceSubmitRes.status === 200, 'Submission during 30s grace window succeeds with HTTP 200');
  assert(
    graceSubmitRes.data.session.status === 'submitted',
    'Session status is submitted (not timed_out) because submission was delivered within grace window'
  );
  // Auto score should only reflect Question 1 (10 pts), NOT the late Question 2
  assert(
    graceSubmitRes.data.session.autoScore === 10,
    `Score is 10/20 (Question 1 counted, late Question 2 in finalResponses ignored): actual=${graceSubmitRes.data.session.autoScore}`
  );

  // 5. Test Scenario C: Post-Grace Period Expiration (> 30s)
  console.log('\n--- STEP 5: POST-GRACE PERIOD TIMEOUT (> 30s) ---');
  // Create Exam C with a 3-second window
  const nowC = Date.now();
  const examCRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Exam C: Post Grace Expiration',
      durationMinutes: 5,
      startTime: nowC - 10000,
      endTime: nowC + 3000, // Closes in 3 seconds
      totalMarks: 10,
      passingMarks: 5,
      assignedStudentIds: [s1User.id],
    }),
  });
  assert(examCRes.status === 200 || examCRes.status === 201, 'Exam C created');
  const examC = examCRes.data.exam || examCRes.data;
  const examCId = examC.id;

  const secCRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examCId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Section C',
      sortOrder: 1,
      sectionMarks: 10,
    }),
  });
  const secCId = (secCRes.data.section || secCRes.data).id;

  const qCRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examCId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: secCId,
      questionType: 'numerical',
      promptText: 'Question C1',
      points: 10,
      sortOrder: 1,
      correctAnswer: { value: 42 },
    }),
  });
  const qC1Id = (qCRes.data.question || qCRes.data).id;

  // Publish Exam C
  await api(`/api/v1/classrooms/${classroomId}/exams/${examCId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });

  // Student 1 starts Exam C
  const startCRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examCId}/start`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
  });
  assert(startCRes.status === 200 || startCRes.status === 201, 'Student 1 started Exam C');
  const s1SessionC = startCRes.data.session;
  const expiresAtC = s1SessionC.expiresAt;

  // Answer during active window
  await api(
    `/api/v1/classrooms/${classroomId}/exams/${examCId}/sessions/${s1SessionC.id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s1Cookie },
      body: JSON.stringify({
        questionId: qC1Id,
        response: { value: 42 },
      }),
    }
  );

  // Wait until past the 30-second grace window (expiresAt + 31 seconds)
  const remainingUntilPostGrace = (expiresAtC + 31000) - Date.now();
  if (remainingUntilPostGrace > 0) {
    console.log(`Waiting ${Math.ceil(remainingUntilPostGrace / 1000)} seconds for post-grace window timeout...`);
    await sleep(remainingUntilPostGrace);
  }

  // Now attempt submission after 30s grace window
  const postGraceSubmitRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examCId}/sessions/${s1SessionC.id}/submit`,
    {
      method: 'POST',
      headers: { Cookie: s1Cookie },
    }
  );
  assert(postGraceSubmitRes.status === 200, 'Late submit returns HTTP 200');
  assert(
    postGraceSubmitRes.data.session.status === 'timed_out',
    'Session status is explicitly recorded as timed_out after grace window'
  );
  assert(
    typeof postGraceSubmitRes.data.message === 'string' &&
      postGraceSubmitRes.data.message.includes('timed out'),
    'Submission message confirms timed out status'
  );

  // 6. Test Scenario D: Dynamic Teacher Time Extension
  console.log('\n--- STEP 6: DYNAMIC TEACHER TIME EXTENSION ---');
  const nowD = Date.now();
  const examDRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Exam D: Time Extension Test',
      durationMinutes: 5,
      startTime: nowD - 5000,
      endTime: nowD + 8000, // Closes in 8 seconds initially
      totalMarks: 10,
      passingMarks: 5,
      assignedStudentIds: [s3User.id],
    }),
  });
  assert(examDRes.status === 200 || examDRes.status === 201, 'Exam D created');
  const examD = examDRes.data.exam || examDRes.data;
  const examDId = examD.id;

  const secDRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examDId}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Section D',
      sortOrder: 1,
      sectionMarks: 10,
    }),
  });
  const secDId = (secDRes.data.section || secDRes.data).id;

  const qDRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examDId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: secDId,
      questionType: 'numerical',
      promptText: 'Question D1',
      points: 10,
      sortOrder: 1,
      correctAnswer: { value: 99 },
    }),
  });
  const qD1Id = (qDRes.data.question || qDRes.data).id;

  // Publish Exam D
  await api(`/api/v1/classrooms/${classroomId}/exams/${examDId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
  });

  // Student 3 starts Exam D
  const startDRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examDId}/start`, {
    method: 'POST',
    headers: { Cookie: s3Cookie },
  });
  assert(startDRes.status === 200 || startDRes.status === 201, 'Student 3 started Exam D');
  const s3SessionD = startDRes.data.session;
  const initialExpiresAtD = s3SessionD.expiresAt;
  console.log(`Student 3 initial expiresAt: ${new Date(initialExpiresAtD).toISOString()}`);

  // Teacher grants 5 minutes time extension
  const extendRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examDId}/dashboard/candidates/${s3User.id}/extend-time`,
    {
      method: 'POST',
      headers: { Cookie: teacherCookie },
      body: JSON.stringify({ additionalMinutes: 5 }),
    }
  );
  assert(extendRes.status === 200, 'Teacher granted 5 minutes time extension');
  const newExpiresAtD = extendRes.data.newExpiresAt;
  assert(
    newExpiresAtD === initialExpiresAtD + 5 * 60 * 1000,
    `New expiration correctly extended by 300,000ms: expected=${initialExpiresAtD + 300000}, actual=${newExpiresAtD}`
  );

  // Wait 10 seconds (past initial 8-second deadline)
  console.log('Waiting 10 seconds to pass the initial deadline...');
  await sleep(10000);

  // Student 3 can STILL save answer because of the teacher extension!
  const extSaveRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examDId}/sessions/${s3SessionD.id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s3Cookie },
      body: JSON.stringify({
        questionId: qD1Id,
        response: { value: 99 },
      }),
    }
  );
  assert(
    extSaveRes.status === 200,
    'Student 3 successfully saved answer after initial deadline thanks to time extension'
  );

  // Student 3 submits successfully
  const extSubmitRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${examDId}/sessions/${s3SessionD.id}/submit`,
    {
      method: 'POST',
      headers: { Cookie: s3Cookie },
    }
  );
  assert(extSubmitRes.status === 200, 'Student 3 submitted successfully with extension');
  assert(
    extSubmitRes.data.session.status === 'submitted',
    'Session recorded as submitted (not timed out)'
  );

  console.log('\n================================================================');
  console.log(`FAIRNESS & DEADLINE RESULTS: ${passedTests}/${totalTests} PASSED (0 FAILED)`);
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal error during fairness test execution:', err);
  process.exit(1);
});
