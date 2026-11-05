// Cortex Online Examination System — Phase 3.3 Workstream C: Autosave Ordering & Integrity Suite
// Validates server-authoritative response persistence, timestamp clamping, out-of-order rejection,
// multi-tab conflict resolution, clock drift handling, expired session lockout, and 30s grace-period rules.

import { classroomDb } from '../src/lib/classroom/db';
import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';
const CLASSROOM_ID = 'CLS_AUTOSAVE_P33';
const TEACHER_ID = 'usr_teacher_auto';
const STUDENT_ID = 'usr_student_auto';
const TEACHER_COOKIE = 'sess_auto_teacher';
const STUDENT_COOKIE = 'sess_auto_student';

console.log('================================================================');
console.log('CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3.3 AUTOSAVE ORDERING SUITE');
console.log('Target: ' + BASE_URL);
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${name}${details ? ': ' + details : ''}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${name}${details ? ': ' + details : ''}`);
  }
}

function request(method: string, path: string, body?: any, cookie?: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cookie) {
      headers['Cookie'] = `cortex_session=${cookie}`;
    }

    const req = http.request(
      url,
      {
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed: any = {};
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode || 500, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function setup() {
  const db = await classroomDb.getDb();
  const now = Date.now();

  // Create users
  await db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(TEACHER_ID, 'Prof. Autosave', 'teacher.auto@cortex.edu', 'teacher', now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(STUDENT_ID, 'Student Autosave', 'student.auto@cortex.edu', 'student', now, now);

  // Create classroom
  await db.prepare(`
    INSERT OR REPLACE INTO classrooms (
      id, name, subject, description, course_code, academic_year, section,
      teacher_id, teacher_name, join_code, join_enabled, status, settings_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', '{}', ?, ?)
  `).run(
    CLASSROOM_ID, 'Autosave Integrity Testing Lab', 'Computer Science', 'Test Lab',
    'CS-AUTO', '2026', 'A', TEACHER_ID, 'Prof. Autosave', 'JOINAUTO', now, now
  );

  // Classroom members
  await db.prepare(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 1)
  `).run(`mem_${CLASSROOM_ID}_${TEACHER_ID}`, CLASSROOM_ID, TEACHER_ID, 'Prof. Autosave', 'teacher.auto@cortex.edu', 'teacher', now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 1)
  `).run(`mem_${CLASSROOM_ID}_${STUDENT_ID}`, CLASSROOM_ID, STUDENT_ID, 'Student Autosave', 'student.auto@cortex.edu', 'student', now, now);

  // Sessions
  await db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(TEACHER_COOKIE, TEACHER_ID, now + 86400000, now);

  await db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(STUDENT_COOKIE, STUDENT_ID, now + 86400000, now);

  // Create exam
  const examId = `exam_auto_${now}`;
  await db.prepare(`
    INSERT OR REPLACE INTO exams (
      id, classroom_id, title, description, duration_minutes,
      start_time, end_time, total_marks, passing_marks, attempts_allowed,
      security_level, status, shuffle_questions, shuffle_options,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'standard', 'published', 0, 0, ?, ?, ?)
  `).run(
    examId, CLASSROOM_ID, 'Autosave Stress & Ordering Exam', 'Testing all 12 ordering scenarios',
    30, now - 1000, now + 3600000, 30, 15, 1, TEACHER_ID, now, now
  );

  // Create 3 questions
  const q1 = `q_auto_1_${now}`;
  const q2 = `q_auto_2_${now}`;
  const q3 = `q_auto_3_${now}`;

  await db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, 'mcq_single', 'Question 1', ?, ?, 10, 0, 0, ?, ?)
  `).run(q1, examId, JSON.stringify([{ id: 'opt_a', text: 'Option A' }, { id: 'opt_b', text: 'Option B' }]), JSON.stringify({ selectedOptionId: 'opt_a' }), now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, 'short_answer', 'Question 2', '[]', ?, 10, 0, 1, ?, ?)
  `).run(q2, examId, JSON.stringify({ acceptedAnswers: ['Correct'] }), now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, 'numerical', 'Question 3', '[]', ?, 10, 0, 2, ?, ?)
  `).run(q3, examId, JSON.stringify({ value: 42 }), now, now);

  return { examId, q1, q2, q3 };
}

async function runAutosaveTests() {
  const { examId, q1, q2, q3 } = await setup();

  // Start exam session
  const startRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/start`, {}, STUDENT_COOKIE);
  assert(startRes.status === 200 || startRes.status === 201, 'Exam session started successfully');
  const sessionId = startRes.body.session.id;

  const basePath = `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sessions/${sessionId}`;

  // 1. Sequential Answers: Answer A then Answer B with ascending timestamps
  {
    const t1 = Date.now() - 5000;
    const t2 = Date.now() - 3000;
    await request('PUT', `${basePath}/responses`, { questionId: q1, response: { selectedOptionId: 'opt_a' }, clientTimestamp: t1 }, STUDENT_COOKIE);
    const r2 = await request('PUT', `${basePath}/responses`, { questionId: q1, response: { selectedOptionId: 'opt_b' }, clientTimestamp: t2 }, STUDENT_COOKIE);
    assert(r2.status === 200 && r2.body.response.response.selectedOptionId === 'opt_b', 'Scenario 1: Sequential answers with ascending timestamps persist latest answer');
  }

  // 2. Simultaneous Answers: Two concurrent writes at the same time
  {
    const tSim = Date.now() - 2000;
    const [p1, p2] = await Promise.all([
      request('PUT', `${basePath}/responses`, { questionId: q2, response: { text: 'Simultaneous 1' }, clientTimestamp: tSim }, STUDENT_COOKIE),
      request('PUT', `${basePath}/responses`, { questionId: q2, response: { text: 'Simultaneous 2' }, clientTimestamp: tSim }, STUDENT_COOKIE),
    ]);
    assert(p1.status === 200 && p2.status === 200, 'Scenario 2: Simultaneous concurrent writes both return HTTP 200 without lock error');
  }

  // 3. Out-of-Order Answers: Earlier packet arriving after newer packet
  {
    const tNewer = Date.now() - 1000;
    const tOlder = Date.now() - 8000; // 8 seconds older
    // Save newer answer first
    await request('PUT', `${basePath}/responses`, { questionId: q1, response: { selectedOptionId: 'opt_b' }, clientTimestamp: tNewer }, STUDENT_COOKIE);

    // Stale older answer arrives later
    const staleRes = await request('PUT', `${basePath}/responses`, { questionId: q1, response: { selectedOptionId: 'opt_a' }, clientTimestamp: tOlder }, STUDENT_COOKIE);
    assert(
      staleRes.status === 200 && staleRes.body.response.response.selectedOptionId === 'opt_b',
      'Scenario 3: Out-of-order older packet is rejected from overwriting newer answer, authoritative record returned'
    );
  }

  // 4. Duplicate Requests: Same payload and timestamp resent
  {
    const tDup = Date.now() - 1500;
    const d1 = await request('PUT', `${basePath}/responses`, { questionId: q3, response: { value: 42 }, clientTimestamp: tDup }, STUDENT_COOKIE);
    const d2 = await request('PUT', `${basePath}/responses`, { questionId: q3, response: { value: 42 }, clientTimestamp: tDup }, STUDENT_COOKIE);
    assert(d1.status === 200 && d2.status === 200 && d2.body.response.response.value === 42, 'Scenario 4: Duplicate requests execute idempotently with identical state');
  }

  // 5. Future Timestamps: Timestamp > 1000ms ahead of server clock
  {
    const tFuture = Date.now() + 500000; // 500 seconds in future
    const fRes = await request('PUT', `${basePath}/responses`, { questionId: q1, response: { selectedOptionId: 'opt_a' }, clientTimestamp: tFuture }, STUDENT_COOKIE);
    assert(fRes.status === 400 && fRes.body.error.includes('future'), 'Scenario 5: Future timestamps rejected with HTTP 400 Bad Request');
  }

  // 6. Past Timestamps: Valid historical timestamp newer than existing stored answer
  {
    const tPastValid = Date.now() - 500;
    const pRes = await request('PUT', `${basePath}/responses`, { questionId: q3, response: { value: 100 }, clientTimestamp: tPastValid }, STUDENT_COOKIE);
    assert(pRes.status === 200 && pRes.body.response.response.value === 100, 'Scenario 6: Valid past timestamp within acceptable window accepted');
  }

  // 7. Clock Drift: Client clock skewed 10 seconds behind server clock
  {
    const tDrift = Date.now() - 10000;
    // Question 2 current timestamp is ~ -2000, so -10000 is older than existing
    const driftRes = await request('PUT', `${basePath}/responses`, { questionId: q2, response: { text: 'Skewed' }, clientTimestamp: tDrift }, STUDENT_COOKIE);
    assert(
      driftRes.status === 200 && driftRes.body.response.response.text !== 'Skewed',
      'Scenario 7: Client clock drift older than existing record preserves newer server state'
    );
  }

  // 8. Browser Reconnection: Sending accumulated batch responses after offline period
  {
    const tReconn = Date.now() - 100;
    const r1 = await request('PUT', `${basePath}/responses`, { questionId: q1, response: { selectedOptionId: 'opt_a' }, clientTimestamp: tReconn }, STUDENT_COOKIE);
    const r2 = await request('PUT', `${basePath}/responses`, { questionId: q2, response: { text: 'Reconnected' }, clientTimestamp: tReconn }, STUDENT_COOKIE);
    assert(r1.status === 200 && r2.status === 200 && r2.body.response.response.text === 'Reconnected', 'Scenario 8: Reconnection after offline period successfully applies newer answers');
  }

  // 9. Multiple Browser Tabs: Tab A and Tab B interleaved saves
  {
    const tTabA = Date.now() - 80;
    const tTabB = Date.now() - 40;
    await request('PUT', `${basePath}/responses`, { questionId: q3, response: { value: 111 }, clientTimestamp: tTabA }, STUDENT_COOKIE);
    const tabBRes = await request('PUT', `${basePath}/responses`, { questionId: q3, response: { value: 222 }, clientTimestamp: tTabB }, STUDENT_COOKIE);
    assert(tabBRes.status === 200 && tabBRes.body.response.response.value === 222, 'Scenario 9: Multiple tabs interleaved saves resolve to latest chronological timestamp');
  }

  // 10. Expired Examination Sessions: Session past expiration window
  {
    const db = await classroomDb.getDb();
    const pastTime = Date.now() - 60000; // 60s ago
    await db.prepare('UPDATE exam_sessions SET expires_at = ? WHERE id = ?').run(pastTime, sessionId);

    const expRes = await request('PUT', `${basePath}/responses`, { questionId: q1, response: { selectedOptionId: 'opt_b' } }, STUDENT_COOKIE);
    assert(expRes.status === 403 && expRes.body.expired === true, 'Scenario 10: Autosaves to expired examination sessions rejected with 403 Forbidden');
  }

  // 11. 30-Second Grace Period Submission: Submissions within grace period succeed but reject answer modifications
  {
    const db = await classroomDb.getDb();
    const now = Date.now();
    // Set expiresAt to 10 seconds ago (well inside 30s grace period)
    await db.prepare("UPDATE exam_sessions SET status = 'in_progress', expires_at = ? WHERE id = ?").run(now - 10000, sessionId);

    // Attempt submission with modified answer payload
    const submitRes = await request(
      'POST',
      `${basePath}/submit`,
      {
        finalResponses: [{ questionId: q1, response: { selectedOptionId: 'injected_after_expiry' } }],
      },
      STUDENT_COOKIE
    );

    assert(
      submitRes.status === 200 && submitRes.body.session.status === 'submitted',
      'Scenario 11a: Grace period submission completes successfully without timed_out penalty'
    );

    // Verify injected answer was NOT saved
    const responses = await classroomDb.listExamResponses(sessionId);
    const q1Resp = responses.find((r) => r.questionId === q1);
    assert(
      q1Resp?.response?.selectedOptionId !== 'injected_after_expiry',
      'Scenario 11b: Answer modifications injected after expiresAt were rejected from saving'
    );
  }

  // 12. Concurrent Final Submission: Resubmission or simultaneous submit requests
  {
    const dupSubmit = await request('POST', `${basePath}/submit`, {}, STUDENT_COOKIE);
    assert(
      dupSubmit.status === 400 && (dupSubmit.body.error.includes('Cannot submit') || dupSubmit.body.error.includes('submitted')),
      'Scenario 12: Duplicate/concurrent final submission rejected with HTTP 400 Bad Request'
    );
  }

  // Cleanup test records
  const db = await classroomDb.getDb();
  await db.prepare('DELETE FROM exam_question_responses WHERE session_id = ?').run(sessionId);
  await db.prepare('DELETE FROM exam_sessions WHERE id = ?').run(sessionId);
  await db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(examId);
  await db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
  await db.prepare('DELETE FROM classroom_members WHERE classroom_id = ?').run(CLASSROOM_ID);
  await db.prepare('DELETE FROM classrooms WHERE id = ?').run(CLASSROOM_ID);
  await db.prepare('DELETE FROM sessions WHERE id IN (?, ?)').run(TEACHER_COOKIE, STUDENT_COOKIE);
  await db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(TEACHER_ID, STUDENT_ID);

  console.log('\n================================================================');
  console.log('PHASE 3.3 AUTOSAVE ORDERING SUITE SUMMARY');
  console.log('================================================================');
  console.log(`Total Scenarios: ${passedCount + failedCount}`);
  console.log(`Passed:          ${passedCount}`);
  console.log(`Failed:          ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n>>> AUTOSAVE ORDERING VERIFICATION FAILED <<<');
    process.exit(1);
  } else {
    console.log('\n>>> ALL 12 AUTOSAVE ORDERING SCENARIOS VERIFIED SUCCESSFULLY! <<<');
  }
}

runAutosaveTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
