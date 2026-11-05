/**
 * CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3.2 ADVERSARIAL REGRESSION SUITE
 * Comprehensive validation across 15 adversarial attack scenarios:
 * 1. Cross-classroom exam access
 * 2. Unauthorized question modification
 * 3. Unauthorized Question Bank imports
 * 4. Student access to hidden answers
 * 5. Student access to hidden programming tests
 * 6. Forged SEB headers
 * 7. Incorrect canonical URL
 * 8. Untrusted forwarded headers
 * 9. Expired session saves & 30-second network delivery grace period
 * 10. Future timestamp manipulation
 * 11. Duplicate submissions
 * 12. Unauthorized proctor actions
 * 13. Client-side score manipulation
 * 14. Concurrent student sessions
 * 15. Database migration reruns
 */

import assert from 'assert';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { classroomDb } from '../src/lib/classroom/db';
import {
  computeSafeExamBrowserHash,
  generateCandidateUrls,
  verifySafeExamBrowserRequest,
} from '../src/lib/classroom/seb-security';
import { NextRequest } from 'next/server';

const BASE_URL = 'http://127.0.0.1:3000';

interface TestResult {
  scenario: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordPass(scenario: string) {
  console.log(`[PASS] ${scenario}`);
  results.push({ scenario, passed: true });
}

function recordFail(scenario: string, err: any) {
  console.error(`[FAIL] ${scenario}:`, err?.message || err);
  results.push({ scenario, passed: false, error: err?.message || String(err) });
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3.2 ADVERSARIAL SUITE');
  console.log('Target:', BASE_URL);
  console.log('================================================================\n');

  const timestamp = Date.now();
  const roomA = `CLASS_ADV_A_${timestamp}`;
  const roomB = `CLASS_ADV_B_${timestamp}`;

  const teacherAId = `teacher_a_${timestamp}`;
  const teacherBId = `teacher_b_${timestamp}`;
  const student1Id = `student_1_${timestamp}`;
  const student2Id = `student_2_${timestamp}`;

  const sessionTokenTeacherA = `sess_tok_ta_${timestamp}`;
  const sessionTokenTeacherB = `sess_tok_tb_${timestamp}`;
  const sessionTokenStudent1 = `sess_tok_s1_${timestamp}`;
  const sessionTokenStudent2 = `sess_tok_s2_${timestamp}`;

  // 1. Initialize Users and Classrooms
  const db = await (classroomDb as any).getDb();

  await db.prepare('INSERT OR REPLACE INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    teacherAId, 'Teacher Alpha', `ta_${timestamp}@cortex.test`, 'teacher', timestamp, timestamp
  );
  await db.prepare('INSERT OR REPLACE INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    teacherBId, 'Teacher Beta', `tb_${timestamp}@cortex.test`, 'teacher', timestamp, timestamp
  );
  await db.prepare('INSERT OR REPLACE INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    student1Id, 'Student One', `s1_${timestamp}@cortex.test`, 'student', timestamp, timestamp
  );
  await db.prepare('INSERT OR REPLACE INTO users (id, name, email, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    student2Id, 'Student Two', `s2_${timestamp}@cortex.test`, 'student', timestamp, timestamp
  );

  await db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    sessionTokenTeacherA, teacherAId, timestamp + 86400000, timestamp
  );
  await db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    sessionTokenTeacherB, teacherBId, timestamp + 86400000, timestamp
  );
  await db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    sessionTokenStudent1, student1Id, timestamp + 86400000, timestamp
  );
  await db.prepare('INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(
    sessionTokenStudent2, student2Id, timestamp + 86400000, timestamp
  );

  const authTeacherA = { Cookie: `cortex_session=${sessionTokenTeacherA}` };
  const authTeacherB = { Cookie: `cortex_session=${sessionTokenTeacherB}` };
  const authStudent1 = { Cookie: `cortex_session=${sessionTokenStudent1}` };
  const authStudent2 = { Cookie: `cortex_session=${sessionTokenStudent2}` };

  await classroomDb.createClassroom({
    id: roomA,
    name: 'Computer Architecture A',
    code: `CS${timestamp.toString().slice(-4)}A`,
    courseCode: `CS${timestamp.toString().slice(-4)}A`,
    teacherId: teacherAId,
  });
  await classroomDb.addMember({ classroomId: roomA, userId: teacherAId, role: 'teacher', userName: 'Teacher Alpha' });
  await classroomDb.addMember({ classroomId: roomA, userId: student1Id, role: 'student', userName: 'Student One' });

  await classroomDb.createClassroom({
    id: roomB,
    name: 'Operating Systems B',
    code: `CS${timestamp.toString().slice(-4)}B`,
    courseCode: `CS${timestamp.toString().slice(-4)}B`,
    teacherId: teacherBId,
  });
  await classroomDb.addMember({ classroomId: roomB, userId: teacherBId, role: 'teacher', userName: 'Teacher Beta' });
  await classroomDb.addMember({ classroomId: roomB, userId: student2Id, role: 'student', userName: 'Student Two' });

  // Create Exam in Classroom A
  const examA = await classroomDb.createExam({
    classroomId: roomA,
    title: 'Adversarial Security Test Exam',
    durationMinutes: 30,
    startTime: timestamp - 5000,
    endTime: timestamp + 3600000,
    totalMarks: 50,
    passingMarks: 20,
    securityLevel: 'seb',
    sebBrowserExamKey: 'bek_secret_key_1234567890abcdef1234567890abcdef',
    sebQuitPassword: 'SuperSecretQuitPassword999',
    status: 'published',
    assignedStudentIds: [student1Id],
    createdBy: teacherAId,
  });

  const q1 = await classroomDb.createExamQuestion({
    examId: examA.id,
    questionType: 'mcq_single',
    promptText: 'What is the bitwidth of an x86-64 general purpose register?',
    options: [
      { id: 'opt_1', text: '32-bit' },
      { id: 'opt_2', text: '64-bit' },
    ],
    correctAnswer: { optionId: 'opt_2' },
    points: 10,
    sortOrder: 0,
  });

  const qProg = await classroomDb.createExamQuestion({
    examId: examA.id,
    questionType: 'programming',
    promptText: 'Write a function returning the square of an integer.',
    language: 'javascript',
    initialCode: 'function square(n) { return 0; }',
    testCases: [
      { id: 'tc_pub', input: '4', expectedOutput: '16', isHidden: false, points: 5 },
      { id: 'tc_priv', input: '99', expectedOutput: '9801', isHidden: true, points: 15 },
    ],
    points: 20,
    sortOrder: 1,
  });

  console.log(`Initialized Test Environment. Exam ID: ${examA.id}\n`);

  // ================================================================
  // SCENARIO 1: CROSS-CLASSROOM EXAM ACCESS
  // ================================================================
  try {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomB}/exams/${examA.id}`, {
      headers: authTeacherB,
    });
    assert.strictEqual(res.status, 404, 'Cross-classroom exam query must return 404');
    recordPass('Scenario 1: Cross-classroom exam access blocked with 404');
  } catch (err: any) { recordFail('Scenario 1: Cross-classroom exam access', err); }

  // ================================================================
  // SCENARIO 2: UNAUTHORIZED QUESTION MODIFICATION
  // ================================================================
  try {
    const res1 = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/questions/${q1.id}`, {
      method: 'PUT',
      headers: { ...authStudent1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText: 'Tampered prompt by student' }),
    });
    assert.strictEqual(res1.status, 403, 'Student cannot modify exam questions (403)');

    const res2 = await fetch(`${BASE_URL}/api/v1/classrooms/${roomB}/exams/${examA.id}/questions/${q1.id}`, {
      method: 'PUT',
      headers: { ...authTeacherB, 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText: 'Tampered prompt by other teacher' }),
    });
    assert.strictEqual(res2.status, 404, 'Teacher from other classroom cannot modify question (404)');
    recordPass('Scenario 2: Unauthorized question modification blocked');
  } catch (err: any) { recordFail('Scenario 2: Unauthorized question modification', err); }

  // ================================================================
  // SCENARIO 3: UNAUTHORIZED QUESTION BANK IMPORTS
  // ================================================================
  try {
    const privateBankItem = await classroomDb.createQuestionBankItem({
      teacherId: teacherAId,
      title: 'Confidential Exam Question',
      questionType: 'mcq_single',
      promptText: 'Confidential prompt text',
      options: [{ id: 'opt_a', text: 'A' }],
      correctAnswer: { optionId: 'opt_a' },
      points: 5,
      isPublic: false,
    });

    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomB}/exams/${examA.id}/questions/import-from-bank`, {
      method: 'POST',
      headers: { ...authTeacherB, 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionBankId: privateBankItem.id }),
    });
    assert(res.status === 403 || res.status === 404, 'Unauthorized bank import must be rejected');
    recordPass('Scenario 3: Unauthorized Question Bank import blocked');
  } catch (err: any) { recordFail('Scenario 3: Unauthorized Question Bank import', err); }

  // ================================================================
  // SCENARIO 4: STUDENT ACCESS TO HIDDEN ANSWERS
  // ================================================================
  try {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}`, {
      headers: authStudent1,
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.exam.questions[0].correctAnswer, undefined, 'Student payload must not expose correctAnswer');
    assert.strictEqual(data.exam.sebQuitPassword, undefined, 'Student payload must not expose sebQuitPassword');
    assert.strictEqual(data.exam.sebQuitPasswordHash, undefined, 'Student payload must not expose sebQuitPasswordHash');
    recordPass('Scenario 4: Student access to hidden answers strictly redacted');
  } catch (err: any) { recordFail('Scenario 4: Student access to hidden answers', err); }

  // ================================================================
  // SCENARIO 5: STUDENT ACCESS TO HIDDEN PROGRAMMING TESTS
  // ================================================================
  try {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/questions/${qProg.id}`, {
      headers: authStudent1,
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    const hiddenTc = data.question.testCases.find((tc: any) => tc.isHidden);
    assert.strictEqual(hiddenTc.input, '[HIDDEN TEST CASE]', 'Hidden test case input must be redacted');
    assert.strictEqual(hiddenTc.expectedOutput, '[HIDDEN TEST CASE]', 'Hidden test case output must be redacted');
    recordPass('Scenario 5: Student access to hidden programming tests sanitized');
  } catch (err: any) { recordFail('Scenario 5: Student access to hidden programming tests', err); }

  // ================================================================
  // SCENARIO 6: FORGED SEB HEADERS
  // ================================================================
  try {
    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/start`, {
      method: 'POST',
      headers: {
        ...authStudent1,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SafeExamBrowser/3.3.2',
        'X-SafeExamBrowser-RequestHash': 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      },
    });
    assert.strictEqual(res.status, 403, 'Forged dummy SEB header must be rejected with 403 Forbidden');
    recordPass('Scenario 6: Forged SEB header rejected with 403 Forbidden');
  } catch (err: any) { recordFail('Scenario 6: Forged SEB header', err); }

  // ================================================================
  // SCENARIO 7: INCORRECT CANONICAL URL
  // ================================================================
  try {
    const fakeUrl = 'http://wrong-host.test/api/wrong-path';
    const fakeHash = computeSafeExamBrowserHash(fakeUrl, examA.sebBrowserExamKey!);

    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/start`, {
      method: 'POST',
      headers: {
        ...authStudent1,
        'X-SafeExamBrowser-RequestHash': fakeHash,
      },
    });
    assert.strictEqual(res.status, 403, 'Hash calculated on mismatched canonical URL must be rejected');
    recordPass('Scenario 7: Mismatched canonical URL hash rejected');
  } catch (err: any) { recordFail('Scenario 7: Mismatched canonical URL hash', err); }

  // ================================================================
  // SCENARIO 8: UNTRUSTED FORWARDED HEADERS
  // ================================================================
  try {
    const maliciousHost = 'attacker-domain.evil.com';
    const fakeUrl = `http://${maliciousHost}/api/v1/classrooms/${roomA}/exams/${examA.id}/start`;
    const attackerHash = computeSafeExamBrowserHash(fakeUrl, examA.sebBrowserExamKey!);

    const res = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/start`, {
      method: 'POST',
      headers: {
        ...authStudent1,
        'X-Forwarded-Host': maliciousHost,
        'X-Forwarded-Proto': 'http',
        'X-SafeExamBrowser-RequestHash': attackerHash,
      },
    });
    assert.strictEqual(res.status, 403, 'Untrusted forwarded host must not be allowed to validate SEB URL');
    recordPass('Scenario 8: Untrusted forwarded host does not influence canonical URL');
  } catch (err: any) { recordFail('Scenario 8: Untrusted forwarded host', err); }

  // ================================================================
  // START VALID STUDENT SESSION FOR TIMING & AUTOSAVE TESTS
  // ================================================================
  const validUrl = `${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/start`;
  const validHash = computeSafeExamBrowserHash(validUrl, examA.sebBrowserExamKey!);

  const startRes = await fetch(validUrl, {
    method: 'POST',
    headers: {
      ...authStudent1,
      'X-SafeExamBrowser-RequestHash': validHash,
    },
  });
  const startData = await startRes.json();
  assert(startRes.status === 200 || startRes.status === 201, `Legitimate SEB start must succeed: ${startRes.status}`);
  const activeSessionId = startData.session.id;

  // ================================================================
  // SCENARIO 9: EXPIRED SESSION SAVES & 30-SECOND GRACE PERIOD
  // ================================================================
  try {
    // Set expiration to 5 seconds ago (within 30s grace period)
    const now = Date.now();
    await classroomDb.updateExamSession(activeSessionId, { expiresAt: now - 5000 });

    // 1. Autosave after expiresAt must be rejected (no additional answering time permitted)
    const saveRes = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/sessions/${activeSessionId}/responses`, {
      method: 'PUT',
      headers: { ...authStudent1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: q1.id, response: { selectedOptionId: 'opt_1' } }),
    });
    assert.strictEqual(saveRes.status, 403, 'Autosave after expiresAt must be rejected with 403 Forbidden');

    // 2. Submit within 30s grace period is accepted for network delivery, BUT finalResponses are not saved
    const submitRes = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/sessions/${activeSessionId}/submit`, {
      method: 'POST',
      headers: { ...authStudent1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalResponses: { [q1.id]: { selectedOptionId: 'opt_2' } } }),
    });
    assert.strictEqual(submitRes.status, 200, 'Submit within 30s grace period succeeds');
    const submitData = await submitRes.json();
    assert.strictEqual(submitData.session.status, 'submitted', 'Status must be submitted (not timed_out) within grace period');

    // Check that finalResponses answer submitted after expiration was NOT saved
    const storedResps = await classroomDb.listExamResponses(activeSessionId);
    const q1Resp = storedResps.find((r) => r.questionId === q1.id);
    assert(
      !q1Resp || q1Resp.response?.selectedOptionId !== 'opt_2',
      'Grace period must not accept new answering responses'
    );
    recordPass('Scenario 9: Expired session autosave rejected & 30s grace period permits only final delivery');
  } catch (err: any) { recordFail('Scenario 9: Expired session & grace period', err); }

  // ================================================================
  // SCENARIO 10: FUTURE TIMESTAMP MANIPULATION
  // ================================================================
  try {
    // Reset session for student 1 to in_progress with valid expiration
    const resetSession = await classroomDb.updateExamSession(activeSessionId, {
      status: 'in_progress',
      expiresAt: Date.now() + 1800000,
    });

    // 1. Client supplies a future timestamp (e.g. +100 seconds)
    const futureRes = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/sessions/${activeSessionId}/responses`, {
      method: 'PUT',
      headers: { ...authStudent1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: q1.id,
        response: { selectedOptionId: 'opt_1' },
        clientTimestamp: Date.now() + 100000,
      }),
    });
    assert.strictEqual(futureRes.status, 400, 'Client future timestamp must be rejected with 400 Bad Request');

    // 2. Direct saveExamResponse clamp verification
    const directSave = await classroomDb.saveExamResponse({
      sessionId: activeSessionId,
      questionId: q1.id,
      response: { selectedOptionId: 'opt_1' },
      updatedAt: Date.now() + 500000,
    });
    assert(directSave.updatedAt <= Date.now() + 100, 'Direct save must clamp future timestamp to server now');

    // Subsequent legitimate save must succeed and not be blocked
    const legitSave = await classroomDb.saveExamResponse({
      sessionId: activeSessionId,
      questionId: q1.id,
      response: { selectedOptionId: 'opt_2' },
      updatedAt: Date.now() + 50,
    });
    const currentResp = (await classroomDb.listExamResponses(activeSessionId)).find((r) => r.questionId === q1.id);
    assert.strictEqual(currentResp?.response?.selectedOptionId, 'opt_2', 'Legitimate subsequent save must succeed');
    recordPass('Scenario 10: Future timestamp manipulation rejected and clamped');
  } catch (err: any) { recordFail('Scenario 10: Future timestamp manipulation', err); }

  // ================================================================
  // SCENARIO 11: DUPLICATE SUBMISSIONS
  // ================================================================
  try {
    // Submit session
    const sub1 = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/sessions/${activeSessionId}/submit`, {
      method: 'POST',
      headers: authStudent1,
    });
    assert.strictEqual(sub1.status, 200, 'Initial submission succeeds');

    // Second submit on submitted session must fail
    const sub2 = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/sessions/${activeSessionId}/submit`, {
      method: 'POST',
      headers: authStudent1,
    });
    assert.strictEqual(sub2.status, 400, 'Duplicate submission on completed session must return 400');
    recordPass('Scenario 11: Duplicate submissions rejected with 400');
  } catch (err: any) { recordFail('Scenario 11: Duplicate submissions', err); }

  // ================================================================
  // SCENARIO 12: UNAUTHORIZED PROCTOR ACTIONS
  // ================================================================
  try {
    // Reset session to in_progress for testing proctor actions
    await db.prepare("UPDATE exam_sessions SET status = 'in_progress', expires_at = ? WHERE id = ?").run(
      Date.now() + 600000, activeSessionId
    );

    // Student attempts to extend own time
    const res1 = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/dashboard/candidates/${student1Id}/extend-time`, {
      method: 'POST',
      headers: { ...authStudent1, 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalMinutes: 15 }),
    });
    assert.strictEqual(res1.status, 403, 'Student cannot execute proctor time extension');

    // Teacher extends negative time
    const res2 = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/dashboard/candidates/${student1Id}/extend-time`, {
      method: 'POST',
      headers: { ...authTeacherA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ additionalMinutes: -15 }),
    });
    assert.strictEqual(res2.status, 400, 'Negative time extension must return 400');
    recordPass('Scenario 12: Unauthorized proctor actions blocked');
  } catch (err: any) { recordFail('Scenario 12: Unauthorized proctor actions', err); }

  // ================================================================
  // SCENARIO 13: CLIENT-SIDE SCORE MANIPULATION
  // ================================================================
  try {
    // Ensure session is in_progress for testing score injection
    await db.prepare("UPDATE exam_sessions SET status = 'in_progress', expires_at = ? WHERE id = ?").run(
      Date.now() + 600000, activeSessionId
    );

    // Save response with forged earnedPoints: 100
    await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/sessions/${activeSessionId}/responses`, {
      method: 'PUT',
      headers: { ...authStudent1, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: q1.id,
        response: {
          selectedOptionId: 'opt_1', // Wrong answer! Correct is opt_2
          earnedPoints: 100,
          gradingStatus: 'auto_graded',
        },
      }),
    });

    // Submit session
    const subRes = await fetch(`${BASE_URL}/api/v1/classrooms/${roomA}/exams/${examA.id}/sessions/${activeSessionId}/submit`, {
      method: 'POST',
      headers: authStudent1,
    });
    const subData = await subRes.json();
    assert.strictEqual(subRes.status, 200);
    // Verify server database holds 0 points, not forged 100 points
    const sessionInDb = await classroomDb.getExamSession(activeSessionId);
    assert.strictEqual(sessionInDb?.autoScore, 0, 'Server-authoritative autoScore must be 0 for incorrect answer');
    recordPass('Scenario 13: Client-side score manipulation rejected');
  } catch (err: any) { recordFail('Scenario 13: Client-side score manipulation', err); }

  // ================================================================
  // SCENARIO 14: CONCURRENT STUDENT SESSIONS
  // ================================================================
  try {
    // Reset session to in_progress
    await db.prepare("UPDATE exam_sessions SET status = 'in_progress', expires_at = ? WHERE id = ?").run(
      Date.now() + 600000, activeSessionId
    );

    // Try starting another session while one is active
    const concurrentRes = await fetch(validUrl, {
      method: 'POST',
      headers: {
        ...authStudent1,
        'X-SafeExamBrowser-RequestHash': validHash,
      },
    });
    const concurrentData = await concurrentRes.json();
    assert.strictEqual(concurrentRes.status, 200);
    assert.strictEqual(concurrentData.resumed, true, 'Subsequent start must resume existing active session');
    assert.strictEqual(concurrentData.session.id, activeSessionId, 'Must return same session ID');
    recordPass('Scenario 14: Concurrent student sessions safely resume single active attempt');
  } catch (err: any) { recordFail('Scenario 14: Concurrent student sessions', err); }

  // ================================================================
  // SCENARIO 15: DATABASE MIGRATION RERUNS (IDEMPOTENCY)
  // ================================================================
  try {
    const stdout = execSync('node scripts/run-phase3-1-migration.cjs', { encoding: 'utf8' });
    assert(stdout.includes('PHASE 3.1 MIGRATION COMPLETE AND VERIFIED'), 'Migration rerun must succeed');
    recordPass('Scenario 15: Database migration rerun executes idempotently');
  } catch (err: any) { recordFail('Scenario 15: Database migration rerun', err); }

  // ================================================================
  // SUMMARY
  // ================================================================
  console.log('\n================================================================');
  console.log('PHASE 3.2 ADVERSARIAL SUITE EXECUTION SUMMARY');
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Scenarios: ${results.length}`);
  console.log(`Passed:          ${passedCount}`);
  console.log(`Failed:          ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nFailures encountered in scenarios:');
    results.filter((r) => !r.passed).forEach((r) => console.error(`- ${r.scenario}: ${r.error}`));
    process.exit(1);
  } else {
    console.log('\n>>> ALL 15 ADVERSARIAL SCENARIOS PASSED WITH ZERO VULNERABILITIES! <<<');
  }
}

runAdversarialSuite().catch((err) => {
  console.error('Fatal execution error in adversarial suite:', err);
  process.exit(1);
});
