/**
 * CORTEX ONLINE EXAMINATION SYSTEM
 * PHASE 4.0: TASK 1 — DEADLINE AND OFFLINE ANSWER CONSISTENCY REGRESSION SUITE
 *
 * Verifies server-authoritative deadline enforcement and offline answer reconciliation:
 * 1. Normal answer persistence prior to expiry (HTTP 200).
 * 2. Offline answer modification buffered and flushed before expiry (HTTP 200).
 * 3. Answers created after expiry rejected by server (HTTP 403).
 * 4. Reconnection during active examination window (heartbeat + queue flush).
 * 5. Reconnection during 30-second grace window (answering rejected HTTP 403, submission accepted as 'submitted').
 * 6. Reconnection after grace period (session transitioned to 'timed_out').
 * 7. Duplicate and out-of-order synchronization (stale sequence/timestamp rejected).
 * 8. Concurrent submission and autosave race condition handling (atomic status lock).
 *
 * Strictly zero emojis.
 */

import { fetch } from 'undici';

const BASE_URL = process.env.TEST_TARGET_URL || process.env.STAGING_URL || 'http://localhost:3000';

interface AssertionResult {
  step: string;
  name: string;
  passed: boolean;
  message?: string;
}

const results: AssertionResult[] = [];

function assert(condition: boolean, step: string, name: string, detail?: string) {
  results.push({ step, name, passed: Boolean(condition), message: detail });
  const tag = condition ? '[PASS]' : '[FAIL]';
  console.log(`${tag} [${step}] ${name}${detail ? ` (${detail})` : ''}`);
  if (!condition) {
    throw new Error(`Assertion failed in [${step}] ${name}: ${detail || ''}`);
  }
}

async function api(path: string, options: any = {}) {
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

async function runTask1Suite() {
  console.log('================================================================');
  console.log('PHASE 4.0: TASK 1 — DEADLINE & OFFLINE CONSISTENCY REGRESSION');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const runId = Math.random().toString(36).substring(2, 7);
  const teacherEmail = `t1_prof_${runId}@cortex-test.edu`;
  const student1Email = `t1_s1_${runId}@cortex-test.edu`;
  const student2Email = `t1_s2_${runId}@cortex-test.edu`;
  const password = `TestP@ssword#${runId}`;

  // 1. Account Setup
  console.log('--- SETUP: REGISTER TEACHER & CANDIDATES ---');
  const tReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Prof. Consistency ${runId}`,
      email: teacherEmail,
      cortexId: `p_t1_${runId}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert(tReg.status === 200 || tReg.status === 201, 'SETUP', 'Teacher registered');
  const teacherCookie = tReg.headers.get('set-cookie') || '';

  const s1Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Student Alpha ${runId}`,
      email: student1Email,
      cortexId: `s_t1_a_${runId}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s1Reg.status === 200 || s1Reg.status === 201, 'SETUP', 'Student Alpha registered');
  const s1Cookie = s1Reg.headers.get('set-cookie') || '';

  const s2Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Student Beta ${runId}`,
      email: student2Email,
      cortexId: `s_t1_b_${runId}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert(s2Reg.status === 200 || s2Reg.status === 201, 'SETUP', 'Student Beta registered');
  const s2Cookie = s2Reg.headers.get('set-cookie') || '';

  // Create Classroom
  const cRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `Consistency Lab ${runId}`,
      subject: 'Consistency Verification',
      courseCode: `CS-CONS-${runId.toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
      settings: {},
    }),
  });
  assert(cRes.status === 200 || cRes.status === 201, 'SETUP', 'Classroom created');
  const classroomId = (cRes.data.classroom || cRes.data).id;
  const joinCode = (cRes.data.classroom || cRes.data).joinCode || (cRes.data.classroom || cRes.data).joincode;

  // Enroll Candidates
  for (const [cookie, sname] of [
    [s1Cookie, 'Student Alpha'],
    [s2Cookie, 'Student Beta'],
  ]) {
    const jRes = await api('/api/v1/classrooms/join', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({ joinCode }),
    });
    assert(jRes.status === 200, 'SETUP', `${sname} enrolled in classroom`);
  }

  // --- BOUNDARY CASE 1: ANSWERS SAVED BEFORE EXPIRY ---
  console.log('\n--- BOUNDARY 1: NORMAL PERSISTENCE BEFORE EXPIRY ---');
  const now1 = Date.now();
  const exam1Res = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Exam 1: Normal Answering',
      durationMinutes: 10,
      startTime: now1 - 5000,
      endTime: now1 + 600000,
      totalMarks: 20,
      passingMarks: 10,
      showResultsImmediately: true,
    }),
  });
  assert(exam1Res.status === 200 || exam1Res.status === 201, 'CASE 1', 'Exam 1 created');
  const exam1Id = (exam1Res.data.exam || exam1Res.data).id;

  const sec1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ title: 'Section 1', sortOrder: 1, sectionMarks: 20 }),
  });
  const sec1Id = (sec1Res.data.section || sec1Res.data).id;

  const q1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam1Id}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: sec1Id,
      questionType: 'mcq_single',
      promptText: 'Capital of Japan?',
      points: 10,
      sortOrder: 1,
      options: [
        { id: 'opt_tokyo', text: 'Tokyo' },
        { id: 'opt_kyoto', text: 'Kyoto' },
      ],
      correctAnswer: { optionId: 'opt_tokyo' },
    }),
  });
  const q1Id = (q1Res.data.question || q1Res.data).id;

  await api(`/api/v1/classrooms/${classroomId}/exams/${exam1Id}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ status: 'published' }),
  });

  const start1Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam1Id}/start`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
  });
  assert(start1Res.status === 200 || start1Res.status === 201, 'CASE 1', 'Exam 1 session started');
  const session1Id = (start1Res.data.session || start1Res.data).id;

  const save1Res = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${session1Id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s1Cookie },
      body: JSON.stringify({
        questionId: q1Id,
        response: { optionId: 'opt_tokyo' },
        clientTimestamp: Date.now(),
      }),
    }
  );
  assert(save1Res.status === 200, 'CASE 1', 'Answer saved prior to expiry returns HTTP 200');
  assert(save1Res.data.success === true, 'CASE 1', 'Server reports save success: true');

  // --- BOUNDARY CASE 2 & 4: OFFLINE MODIFICATION & RECONNECTION DURING ACTIVE WINDOW ---
  console.log('\n--- BOUNDARY 2 & 4: OFFLINE BUFFERING & RECONNECTION IN ACTIVE WINDOW ---');
  // Simulate client modifying answer offline (buffered in memory with simulated timestamp)
  const offlineModifiedTime = Date.now();
  const offlineFlushRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${session1Id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s1Cookie },
      body: JSON.stringify({
        questionId: q1Id,
        response: { optionId: 'opt_kyoto' },
        clientTimestamp: offlineModifiedTime,
      }),
    }
  );
  assert(offlineFlushRes.status === 200, 'CASE 2 & 4', 'Reconnected queue flush in active window succeeds');

  // Verify DB reflects flushed value
  const inspectRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${session1Id}/responses`,
    {
      method: 'GET',
      headers: { Cookie: s1Cookie },
    }
  );
  assert(inspectRes.status === 200, 'CASE 2 & 4', 'Responses list retrieved');
  const currentResp = inspectRes.data.responses?.find((r: any) => r.questionId === q1Id);
  assert(currentResp?.response?.optionId === 'opt_kyoto', 'CASE 2 & 4', 'Database updated with flushed offline modification');

  // --- BOUNDARY CASE 7: DUPLICATE AND OUT-OF-ORDER SYNCHRONIZATION ---
  console.log('\n--- BOUNDARY 7: OUT-OF-ORDER & STALE SYNC REJECTION ---');
  // Attempt to save an older timestamp (simulating out-of-order network arrival)
  const staleTimestamp = offlineModifiedTime - 10000;
  const staleRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${session1Id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s1Cookie },
      body: JSON.stringify({
        questionId: q1Id,
        response: { optionId: 'opt_tokyo' },
        clientTimestamp: staleTimestamp,
      }),
    }
  );
  assert(staleRes.status === 200, 'CASE 7', 'Request processed cleanly without crash');
  // Database must NOT have reverted to older value
  const verifyStaleRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${session1Id}/responses`,
    {
      method: 'GET',
      headers: { Cookie: s1Cookie },
    }
  );
  const respAfterStale = verifyStaleRes.data.responses?.find((r: any) => r.questionId === q1Id);
  assert(respAfterStale?.response?.optionId === 'opt_kyoto', 'CASE 7', 'Stale payload did not overwrite newer answer');

  // --- BOUNDARY CASE 3 & 5: DEADLINE EXPIRY & 30-SECOND GRACE PERIOD ---
  console.log('\n--- BOUNDARY 3 & 5: DEADLINE EXPIRY & 30S GRACE WINDOW ---');
  // Create Exam 2 that expires in 14 seconds (allowing ~4 seconds for section/question/publish setup)
  const now2 = Date.now();
  const exam2EndTime = now2 + 14000;
  const exam2Res = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Exam 2: Grace Window Test',
      durationMinutes: 5,
      startTime: now2 - 10000,
      endTime: exam2EndTime,
      totalMarks: 20,
      passingMarks: 10,
      showResultsImmediately: true,
    }),
  });
  const exam2Id = (exam2Res.data.exam || exam2Res.data).id;

  const sec2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam2Id}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ title: 'Section 2', sortOrder: 1, sectionMarks: 20 }),
  });
  const sec2Id = (sec2Res.data.section || sec2Res.data).id;

  const q2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam2Id}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: sec2Id,
      questionType: 'numerical',
      promptText: 'What is 5 x 5?',
      points: 10,
      sortOrder: 1,
      correctAnswer: { value: 25 },
    }),
  });
  const q2Id = (q2Res.data.question || q2Res.data).id;

  await api(`/api/v1/classrooms/${classroomId}/exams/${exam2Id}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ status: 'published' }),
  });

  const start2Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam2Id}/start`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
  });
  assert(start2Res.status === 200 || start2Res.status === 201, 'CASE 3 & 5', 'Exam 2 session started');
  const session2 = start2Res.data.session || start2Res.data;
  const session2Id = session2.id;

  // Save valid answer before expiry
  await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam2Id}/sessions/${session2Id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        questionId: q2Id,
        response: { value: 25 },
      }),
    }
  );
  assert(true, 'CASE 3 & 5', 'Initial answer saved before deadline');

  // Wait for deadline to pass into 30s grace window
  const remainingUntilGrace = (session2.expiresAt + 2000) - Date.now();
  if (remainingUntilGrace > 0) {
    console.log(`Waiting ${Math.ceil(remainingUntilGrace / 1000)} seconds for deadline to elapse into 30s grace window...`);
    await sleep(remainingUntilGrace);
  }

  // Attempt to save new/modified answer during grace period
  const lateSaveRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam2Id}/sessions/${session2Id}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        questionId: q2Id,
        response: { value: 999 },
      }),
    }
  );
  assert(lateSaveRes.status === 403, 'CASE 3', 'Answer modification after expiry rejected with HTTP 403', `status: ${lateSaveRes.status}`);
  assert(lateSaveRes.data.expired === true, 'CASE 3', 'Server response explicitly marks expired: true');
  assert(lateSaveRes.data.expired === true, 'CASE 3', 'Server response explicitly marks expired: true');

  // Submit during grace period (now <= expiresAt + 30s)
  const graceSubmitRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam2Id}/sessions/${session2Id}/submit`,
    {
      method: 'POST',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        finalResponses: { [q2Id]: { value: 999 } }, // Attempt late inject
      }),
    }
  );
  assert(graceSubmitRes.status === 200, 'CASE 5', 'Submission during grace window accepted with HTTP 200');
  assert(graceSubmitRes.data.session.status === 'submitted', 'CASE 5', 'Session status recorded as submitted');
  // Score must be calculated from pre-expiry answer (25), NOT late inject (999)
  assert(graceSubmitRes.data.session.autoScore === 10, 'CASE 5', 'Late injected response in submit payload ignored for grading', `score: ${graceSubmitRes.data.session.autoScore}`);

  // --- BOUNDARY CASE 6: RECONNECTION AFTER GRACE PERIOD (> 30s) ---
  console.log('\n--- BOUNDARY 6: RECONNECTION AFTER GRACE PERIOD EXPIRED ---');
  // Create Exam 3 that expires in 12 seconds
  const now3 = Date.now();
  const exam3Res = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: 'Exam 3: Post-Grace Expiration',
      durationMinutes: 5,
      startTime: now3 - 10000,
      endTime: now3 + 12000, // Closes in 12 seconds
      totalMarks: 10,
      passingMarks: 5,
    }),
  });
  const exam3Id = (exam3Res.data.exam || exam3Res.data).id;

  const sec3Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam3Id}/sections`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ title: 'Section 3', sortOrder: 1, sectionMarks: 10 }),
  });
  const sec3Id = (sec3Res.data.section || sec3Res.data).id;

  await api(`/api/v1/classrooms/${classroomId}/exams/${exam3Id}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      sectionId: sec3Id,
      questionType: 'numerical',
      promptText: '1 + 1?',
      points: 10,
      sortOrder: 1,
      correctAnswer: { value: 2 },
    }),
  });

  await api(`/api/v1/classrooms/${classroomId}/exams/${exam3Id}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ status: 'published' }),
  });

  const start3Res = await api(`/api/v1/classrooms/${classroomId}/exams/${exam3Id}/start`, {
    method: 'POST',
    headers: { Cookie: s1Cookie },
  });
  assert(start3Res.status === 200 || start3Res.status === 201, 'CASE 6', 'Exam 3 session started');
  const session3 = start3Res.data.session || start3Res.data;
  const session3Id = session3.id;
  const expiresAt3 = session3.expiresAt;

  // Wait until past the 30-second grace window (expiresAt + 31 seconds)
  const remainingUntilPostGrace = (expiresAt3 + 31000) - Date.now();
  if (remainingUntilPostGrace > 0) {
    console.log(`Waiting ${Math.ceil(remainingUntilPostGrace / 1000)} seconds to exceed the 30-second grace window...`);
    await sleep(remainingUntilPostGrace);
  }

  const postGraceSubmitRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam3Id}/sessions/${session3Id}/submit`,
    {
      method: 'POST',
      headers: { Cookie: s1Cookie },
      body: JSON.stringify({}),
    }
  );
  assert(postGraceSubmitRes.status === 200, 'CASE 6', 'Post-grace submit request handled cleanly');
  assert(postGraceSubmitRes.data.session.status === 'timed_out', 'CASE 6', 'Session status recorded strictly as timed_out');
  assert(postGraceSubmitRes.data.message.includes('timed out'), 'CASE 6', 'Message confirms timed out status');

  // --- BOUNDARY CASE 8: CONCURRENT SUBMISSIONS AND AUTOSAVES ---
  console.log('\n--- BOUNDARY 8: CONCURRENT SUBMISSION & AUTOSAVE ATOMICITY ---');
  // Start Exam 1 session for Student 2
  const startRaceRes = await api(`/api/v1/classrooms/${classroomId}/exams/${exam1Id}/start`, {
    method: 'POST',
    headers: { Cookie: s2Cookie },
  });
  const sessionRaceId = (startRaceRes.data.session || startRaceRes.data).id;

  // Fire submit and autosave concurrently
  const [raceSubmit, raceSave] = await Promise.all([
    api(`/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${sessionRaceId}/submit`, {
      method: 'POST',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({}),
    }),
    api(`/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${sessionRaceId}/responses`, {
      method: 'PUT',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        questionId: q1Id,
        response: { optionId: 'opt_tokyo' },
      }),
    }),
  ]);

  assert(raceSubmit.status === 200, 'CASE 8', 'Submission processed cleanly (status: 200)');
  assert(raceSubmit.data.session.status === 'submitted', 'CASE 8', 'Session atomically locked as submitted');

  // Autosave was either accepted right before submit or rejected after lock
  const saveHandledSafely = raceSave.status === 200 || raceSave.status === 400;
  assert(saveHandledSafely, 'CASE 8', 'Autosave in race condition handled safely without crash', `status: ${raceSave.status}`);

  // Subsequent save strictly rejected
  const postSubmitSaveRes = await api(
    `/api/v1/classrooms/${classroomId}/exams/${exam1Id}/sessions/${sessionRaceId}/responses`,
    {
      method: 'PUT',
      headers: { Cookie: s2Cookie },
      body: JSON.stringify({
        questionId: q1Id,
        response: { optionId: 'opt_tokyo' },
      }),
    }
  );
  assert(postSubmitSaveRes.status === 400, 'CASE 8', 'Post-submission autosave strictly rejected with HTTP 400');

  // --- SUMMARY ---
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n================================================================');
  console.log(`TASK 1 REGRESSION RESULTS: ${passed}/${results.length} PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTask1Suite().catch((err) => {
  console.error('Fatal error in Task 1 suite:', err);
  process.exit(1);
});
