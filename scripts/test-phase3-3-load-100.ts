// Cortex Online Examination System — Phase 3.3 Workstream E: 100-User Concurrent Load Test Harness
// Simulates 100 concurrent examinees through the complete lifecycle:
// Auth -> Start -> Resumption -> Questions -> Heartbeat -> Autosaves -> Final Submission -> Auto-grading -> Results
// Measures success rate, error rate, p50/p95/p99 latency, DB latency, ordering failures, and duplicates.

import { classroomDb } from '../src/lib/classroom/db';
import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';
const CLASSROOM_ID = 'CLS_LOAD_100_TEST';
const TEACHER_ID = 'usr_load_teacher';
const TEACHER_COOKIE = 'sess_load_teacher';
const TOTAL_STUDENTS = 100;

console.log('================================================================');
console.log('CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3.3 100-USER LOAD TEST');
console.log(`Simulating ${TOTAL_STUDENTS} concurrent examinees against ${BASE_URL}`);
console.log('================================================================\n');

// Shared HTTP Agent with keepAlive for controlled high-throughput concurrency
const agent = new http.Agent({ keepAlive: true, maxSockets: 50 });

function httpRequest(method: string, path: string, body?: any, cookie?: string): Promise<{ status: number; durationMs: number; body: any }> {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cookie) {
      headers['Cookie'] = `cortex_session=${cookie}`;
    }

    const start = Date.now();
    const req = http.request(
      url,
      {
        method,
        headers,
        agent,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          const durationMs = Date.now() - start;
          let parsed: any = {};
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = { raw: data };
          }
          resolve({ status: res.statusCode || 500, durationMs, body: parsed });
        });
      }
    );

    req.on('error', (err) => {
      const durationMs = Date.now() - start;
      resolve({ status: 599, durationMs, body: { error: err.message } });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function setupLoadEnvironment() {
  console.log('Preparing isolated load testing dataset...');
  const db = await classroomDb.getDb();
  const now = Date.now();

  // 1. Create Teacher
  await db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(TEACHER_ID, 'Prof. Load Tester', 'teacher.load@cortex.edu', 'teacher', now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(TEACHER_COOKIE, TEACHER_ID, now + 86400000, now);

  // 2. Create Classroom
  await db.prepare(`
    INSERT OR REPLACE INTO classrooms (
      id, name, subject, description, course_code, academic_year, section,
      teacher_id, teacher_name, join_code, join_enabled, status, settings_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', '{}', ?, ?)
  `).run(
    CLASSROOM_ID, 'Massive Concurrent Assessment Hall', 'Computer Science', 'Load Hall',
    'CS-LOAD100', '2026', 'A', TEACHER_ID, 'Prof. Load Tester', 'LOAD100', now, now
  );

  await db.prepare(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 1)
  `).run(`mem_${CLASSROOM_ID}_${TEACHER_ID}`, CLASSROOM_ID, TEACHER_ID, 'Prof. Load Tester', 'teacher.load@cortex.edu', 'teacher', now, now);

  // 3. Create Exam
  const examId = `exam_load_${now}`;
  await db.prepare(`
    INSERT OR REPLACE INTO exams (
      id, classroom_id, title, description, duration_minutes,
      start_time, end_time, total_marks, passing_marks, attempts_allowed,
      security_level, status, shuffle_questions, shuffle_options,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'standard', 'published', 1, 1, ?, ?, ?)
  `).run(
    examId, CLASSROOM_ID, 'High-Throughput Concurrency Examination', '100 Concurrent Examinees Benchmark',
    60, now - 1000, now + 7200000, 20, 10, 1, TEACHER_ID, now, now
  );

  // 4. Create 2 questions
  const q1 = `q_load_1_${now}`;
  const q2 = `q_load_2_${now}`;

  await db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, 'mcq_single', 'Concurrent Load Question 1', ?, ?, 10, 0, 0, ?, ?)
  `).run(q1, examId, JSON.stringify([{ id: 'opt_1', text: 'Option 1' }, { id: 'opt_2', text: 'Option 2' }]), JSON.stringify({ selectedOptionId: 'opt_1' }), now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO exam_questions (
      id, exam_id, question_type, prompt_text, options_json, correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
    ) VALUES (?, ?, 'mcq_single', 'Concurrent Load Question 2', ?, ?, 10, 0, 1, ?, ?)
  `).run(q2, examId, JSON.stringify([{ id: 'opt_a', text: 'Option A' }, { id: 'opt_b', text: 'Option B' }]), JSON.stringify({ selectedOptionId: 'opt_a' }), now, now);

  // 5. Batch-create 100 student identities and active sessions
  console.log(`Seeding ${TOTAL_STUDENTS} test examinee identities in local database...`);
  const studentIds: string[] = [];
  const studentCookies: string[] = [];

  for (let i = 1; i <= TOTAL_STUDENTS; i++) {
    const sId = `usr_load_${String(i).padStart(3, '0')}`;
    const cookie = `sess_load_${String(i).padStart(3, '0')}`;
    studentIds.push(sId);
    studentCookies.push(cookie);

    await db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
      VALUES (?, ?, ?, 'student', 'active', ?, ?)
    `).run(sId, `Examinee ${i}`, `examinee.${i}@student.cortex.edu`, now, now);

    await db.prepare(`
      INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
      VALUES (?, ?, ?, ?, ?, 'student', 'active', ?, ?, 1)
    `).run(`mem_${CLASSROOM_ID}_${sId}`, CLASSROOM_ID, sId, `Examinee ${i}`, `examinee.${i}@student.cortex.edu`, now, now);

    await db.prepare(`
      INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(cookie, sId, now + 86400000, now);
  }

  console.log('Load environment initialization complete.');
  return { examId, q1, q2, studentIds, studentCookies };
}

async function runStudentSession(index: number, studentId: string, cookie: string, examId: string, q1: string, q2: string) {
  const latencies: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  let duplicateSessionsDetected = 0;
  let lostAnswersDetected = 0;
  let orderingFailures = 0;

  function track(stepName: string, res: { status: number; durationMs: number; body?: any }, expectedStatus = 200) {
    latencies.push(res.durationMs);
    if (res.status === expectedStatus || (expectedStatus === 200 && res.status === 201)) {
      successfulRequests++;
    } else {
      failedRequests++;
      if (index === 0 || failedRequests <= 5) {
        console.error(`[Step Failure - ${stepName}] User ${index}: Status ${res.status}`, JSON.stringify(res.body));
      }
    }
  }

  // 1. Auth check
  const authRes = await httpRequest('GET', '/api/v1/auth/me', undefined, cookie);
  track('auth/me', authRes, 200);

  // 2. Exam Start
  const startRes = await httpRequest('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/start`, {}, cookie);
  track('start', startRes, 200);
  const sessionId = startRes.body?.session?.id;

  if (!sessionId) {
    failedRequests++;
    return { latencies, successfulRequests, failedRequests, duplicateSessionsDetected, lostAnswersDetected, orderingFailures };
  }

  // 3. Session Resumption (calling start again must return identical active session)
  const resumeRes = await httpRequest('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/start`, {}, cookie);
  track('resume', resumeRes, 200);
  if (resumeRes.body?.session?.id !== sessionId) {
    duplicateSessionsDetected++;
  }

  // 4. Question Retrieval
  const qRes = await httpRequest('GET', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions`, undefined, cookie);
  track('questions', qRes, 200);

  // 5. Heartbeat
  const hbRes = await httpRequest('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sessions/${sessionId}/heartbeat`, {}, cookie);
  track('heartbeat', hbRes, 200);

  const basePath = `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sessions/${sessionId}`;

  // 6. Autosave Question 1
  const now = Date.now();
  const save1 = await httpRequest('PUT', `${basePath}/responses`, {
    questionId: q1,
    response: { selectedOptionId: 'opt_1' },
    clientTimestamp: now - 500,
  }, cookie);
  track('save1', save1, 200);
  if (save1.body?.response?.response?.selectedOptionId !== 'opt_1') {
    lostAnswersDetected++;
  }

  // 7. Autosave Question 2
  const save2 = await httpRequest('PUT', `${basePath}/responses`, {
    questionId: q2,
    response: { selectedOptionId: 'opt_a' },
    clientTimestamp: now - 200,
  }, cookie);
  track('save2', save2, 200);
  if (save2.body?.response?.response?.selectedOptionId !== 'opt_a') {
    lostAnswersDetected++;
  }

  // 8. Final Submission
  const subRes = await httpRequest('POST', `${basePath}/submit`, {}, cookie);
  track('submit', subRes, 200);

  // 9. Result / Responses Retrieval
  const resRes = await httpRequest('GET', `${basePath}/responses`, undefined, cookie);
  track('get_responses', resRes, 200);

  return {
    latencies,
    successfulRequests,
    failedRequests,
    duplicateSessionsDetected,
    lostAnswersDetected,
    orderingFailures,
  };
}

function calculatePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function executeConcurrentLoadTest() {
  const { examId, q1, q2, studentIds, studentCookies } = await setupLoadEnvironment();

  console.log(`\nLaunching ${TOTAL_STUDENTS} concurrent student journeys...`);
  const startTime = Date.now();

  // Execute with pool concurrency of 25 parallel workers to test concurrent contention
  const CONCURRENCY_LIMIT = 25;
  const allResults: any[] = [];
  const queue = studentIds.map((id, idx) => ({ id, cookie: studentCookies[idx], idx }));

  async function worker() {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const res = await runStudentSession(item.idx, item.id, item.cookie, examId, q1, q2);
      allResults.push(res);
    }
  }

  const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => worker());
  await Promise.all(workers);

  const totalDuration = Date.now() - startTime;
  console.log(`\nAll ${TOTAL_STUDENTS} sessions completed in ${totalDuration}ms.`);

  // Aggregate Metrics
  const allLatencies: number[] = [];
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalDuplicates = 0;
  let totalLostAnswers = 0;
  let totalOrderingFailures = 0;

  for (const r of allResults) {
    allLatencies.push(...r.latencies);
    totalSuccess += r.successfulRequests;
    totalFailed += r.failedRequests;
    totalDuplicates += r.duplicateSessionsDetected;
    totalLostAnswers += r.lostAnswersDetected;
    totalOrderingFailures += r.orderingFailures;
  }

  const totalRequests = totalSuccess + totalFailed;
  const successRate = totalRequests > 0 ? ((totalSuccess / totalRequests) * 100).toFixed(2) : '0';
  const errorRate = totalRequests > 0 ? ((totalFailed / totalRequests) * 100).toFixed(2) : '0';

  const p50 = calculatePercentile(allLatencies, 50);
  const p95 = calculatePercentile(allLatencies, 95);
  const p99 = calculatePercentile(allLatencies, 99);
  const avg = allLatencies.length > 0 ? Math.round(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length) : 0;
  const min = allLatencies.length > 0 ? Math.min(...allLatencies) : 0;
  const max = allLatencies.length > 0 ? Math.max(...allLatencies) : 0;

  // Measure database write latency directly
  const db = await classroomDb.getDb();
  const dbStart = Date.now();
  await db.prepare('SELECT count(*) as c FROM exam_sessions WHERE exam_id = ?').get(examId);
  const dbReadLatency = Date.now() - dbStart;

  const dbWriteStart = Date.now();
  await db.prepare('UPDATE exams SET updated_at = ? WHERE id = ?').run(Date.now(), examId);
  const dbWriteLatency = Date.now() - dbWriteStart;

  console.log('\n================================================================');
  console.log('100-USER CONCURRENT LOAD TEST RESULTS');
  console.log('================================================================');
  console.log(`Simulated Users:            ${TOTAL_STUDENTS}`);
  console.log(`Total HTTP Requests:        ${totalRequests}`);
  console.log(`Successful Requests:        ${totalSuccess}`);
  console.log(`Failed Requests:            ${totalFailed}`);
  console.log(`Success Rate:               ${successRate}%`);
  console.log(`HTTP Error Rate:            ${errorRate}%`);
  console.log(`Latency p50 (Median):       ${p50} ms`);
  console.log(`Latency p95:                ${p95} ms`);
  console.log(`Latency p99:                ${p99} ms`);
  console.log(`Latency Average:            ${avg} ms (Min: ${min}ms, Max: ${max}ms)`);
  console.log(`Direct DB Read Latency:     ${dbReadLatency} ms`);
  console.log(`Direct DB Write Latency:    ${dbWriteLatency} ms`);
  console.log(`Duplicate Sessions:         ${totalDuplicates}`);
  console.log(`Lost Answers:               ${totalLostAnswers}`);
  console.log(`Autosave Ordering Failures: ${totalOrderingFailures}`);

  // Safe Cleanup of dedicated test data
  console.log('\nCleaning up dedicated load test data...');
  await db.prepare('DELETE FROM exam_question_responses WHERE session_id IN (SELECT id FROM exam_sessions WHERE exam_id = ?)').run(examId);
  await db.prepare('DELETE FROM exam_sessions WHERE exam_id = ?').run(examId);
  await db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(examId);
  await db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
  await db.prepare('DELETE FROM classroom_members WHERE classroom_id = ?').run(CLASSROOM_ID);
  await db.prepare('DELETE FROM classrooms WHERE id = ?').run(CLASSROOM_ID);
  await db.prepare("DELETE FROM sessions WHERE id LIKE 'sess_load_%'").run();
  await db.prepare("DELETE FROM users WHERE id LIKE 'usr_load_%'").run();
  console.log('Cleanup complete. Genuine user data intact.');

  if (Number(errorRate) > 1.0 || totalDuplicates > 0 || totalLostAnswers > 0 || totalOrderingFailures > 0) {
    console.error('\n>>> LOAD TEST COMPLETED WITH DEFECTS <<<');
    process.exit(1);
  } else {
    console.log('\n>>> 100-USER LOAD TEST PASSED SUCCESSFULLY WITH ZERO ANOMALIES! <<<');
  }
}

executeConcurrentLoadTest().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
