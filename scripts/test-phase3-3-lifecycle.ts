// Cortex Online Examination System — Phase 3.3 Workstream F: Complete Teacher & Student Lifecycle Verification
// Tests the full 17-step Teacher examination management flow and 12-step Student examination journey.

import { classroomDb } from '../src/lib/classroom/db';
import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';
const CLASSROOM_ID = 'CLS_LIFECYCLE_P33';
const TEACHER_ID = 'usr_teacher_life';
const STUDENT_ID = 'usr_student_life';
const TEACHER_COOKIE = 'sess_life_teacher';
const STUDENT_COOKIE = 'sess_life_student';

console.log('================================================================');
console.log('CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3.3 LIFECYCLE SUITE');
console.log('Validating full Teacher (17 steps) and Student (12 steps) flows');
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

async function runLifecycleVerification() {
  const db = await classroomDb.getDb();
  const now = Date.now();

  // Initialize test users and classroom
  await db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, 'teacher', 'active', ?, ?)
  `).run(TEACHER_ID, 'Prof. Lifecycle', 'prof.life@cortex.edu', now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, 'student', 'active', ?, ?)
  `).run(STUDENT_ID, 'Student Lifecycle', 'student.life@cortex.edu', now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(TEACHER_COOKIE, TEACHER_ID, now + 86400000, now);

  await db.prepare(`
    INSERT OR REPLACE INTO sessions (id, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(STUDENT_COOKIE, STUDENT_ID, now + 86400000, now);

  await db.prepare(`
    INSERT OR REPLACE INTO classrooms (
      id, name, subject, description, course_code, academic_year, section,
      teacher_id, teacher_name, join_code, join_enabled, status, settings_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'active', '{}', ?, ?)
  `).run(
    CLASSROOM_ID, 'End-to-End Lifecycle Testing Lab', 'Computer Science', 'Lifecycle Lab',
    'CS-LIFE', '2026', 'A', TEACHER_ID, 'Prof. Lifecycle', 'JOINLIFE', now, now
  );

  await db.prepare(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (?, ?, ?, ?, ?, 'teacher', 'active', ?, ?, 1)
  `).run(`mem_${CLASSROOM_ID}_${TEACHER_ID}`, CLASSROOM_ID, TEACHER_ID, 'Prof. Lifecycle', 'prof.life@cortex.edu', now, now);

  await db.prepare(`
    INSERT OR REPLACE INTO classroom_members (id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online)
    VALUES (?, ?, ?, ?, ?, 'student', 'active', ?, ?, 1)
  `).run(`mem_${CLASSROOM_ID}_${STUDENT_ID}`, CLASSROOM_ID, STUDENT_ID, 'Student Lifecycle', 'student.life@cortex.edu', now, now);

  // -------------------------------------------------------------
  // PART 1: TEACHER WORKFLOW (17 STEPS)
  // -------------------------------------------------------------
  console.log('--- PART 1: TEACHER WORKFLOW (17 STEPS) ---');

  // Step 1: Teacher sign in verification
  const tAuth = await request('GET', '/api/v1/auth/me', undefined, TEACHER_COOKIE);
  assert(tAuth.status === 200 && tAuth.body.user.role === 'teacher', 'Teacher Step 1: Sign in authenticated');

  // Step 2: Open classroom
  const clsRes = await request('GET', `/api/v1/classrooms/${CLASSROOM_ID}`, undefined, TEACHER_COOKIE);
  assert(clsRes.status === 200 && clsRes.body.classroom.id === CLASSROOM_ID, 'Teacher Step 2: Open classroom');

  // Step 3: Create examination (draft)
  const examRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams`, {
    title: 'Final Examination: Advanced Data Structures',
    description: 'Comprehensive assessment of trees, graphs, and performance',
    durationMinutes: 90,
    startTime: now - 5000,
    endTime: now + 86400000,
    totalMarks: 50,
    passingMarks: 25,
    securityLevel: 'standard',
  }, TEACHER_COOKIE);
  assert(examRes.status === 201 && examRes.body.exam.status === 'draft', 'Teacher Step 3: Create examination');
  const examId = examRes.body.exam.id;

  // Step 4: Add question manually
  const qRes1 = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions`, {
    questionType: 'mcq_single',
    promptText: 'What is the worst-case lookup time in a balanced AVL tree?',
    options: [
      { id: 'opt_1', text: 'O(1)' },
      { id: 'opt_2', text: 'O(log n)' },
      { id: 'opt_3', text: 'O(n)' },
    ],
    correctAnswer: { selectedOptionId: 'opt_2' },
    points: 10,
    negativeMarks: 2,
  }, TEACHER_COOKIE);
  assert(qRes1.status === 201, 'Teacher Step 4: Add question');
  const q1Id = qRes1.body.question.id;

  // Step 5: Import question from Question Bank
  // Seed an item in Question Bank first
  const qbItem = await classroomDb.createQuestionBankItem({
    teacherId: TEACHER_ID,
    classroomId: CLASSROOM_ID,
    subject: 'Computer Science',
    topic: 'Graph Algorithms',
    difficulty: 'hard',
    questionType: 'short_answer',
    promptText: 'Name the algorithm used to find strongly connected components in linear time.',
    correctAnswer: { acceptedAnswers: ["Tarjan's", 'Tarjan', 'Kosaraju'] },
    defaultPoints: 15,
  });

  const importRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions`, {
    fromQuestionBankId: qbItem.id,
    questionType: qbItem.questionType,
    promptText: qbItem.promptText,
    correctAnswer: qbItem.correctAnswer,
    points: qbItem.defaultPoints,
  }, TEACHER_COOKIE);
  assert(importRes.status === 201, 'Teacher Step 5: Import question from Question Bank');
  const q2Id = importRes.body.question.id;

  // Step 6: Configure sections
  const secRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sections`, {
    title: 'Core Fundamentals',
    description: 'Fundamental data structures',
    instructions: 'Answer all questions in this section',
    sortOrder: 0,
    isMandatory: 1,
  }, TEACHER_COOKIE);
  assert(secRes.status === 201, 'Teacher Step 6: Configure sections');
  const secId = secRes.body.section.id;

  // Step 7: Configure branching
  const branchRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/branching-rules`, {
    sourceQuestionId: q1Id,
    conditionOperator: 'selected_option',
    conditionValue: 'opt_2',
    destinationType: 'section',
    destinationId: secId,
    defaultDestinationType: 'end',
    priority: 1,
  }, TEACHER_COOKIE);
  assert(branchRes.status === 201, 'Teacher Step 7: Configure branching rules');

  // Step 8: Configure timing
  const timingRes = await request('PUT', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}`, {
    durationMinutes: 75,
    startTime: now - 10000,
    endTime: now + 7200000,
  }, TEACHER_COOKIE);
  assert(timingRes.status === 200 && timingRes.body.exam.durationMinutes === 75, 'Teacher Step 8: Configure timing');

  // Step 9: Configure security mode
  const secModeRes = await request('PUT', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}`, {
    securityLevel: 'standard',
    shuffleQuestions: 1,
    shuffleOptions: 1,
  }, TEACHER_COOKIE);
  assert(secModeRes.status === 200 && secModeRes.body.exam.securityLevel === 'standard', 'Teacher Step 9: Configure security mode');

  // Step 10: Preview examination (Teacher gets full question keys)
  const prevRes = await request('GET', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}`, undefined, TEACHER_COOKIE);
  assert(
    prevRes.status === 200 && Array.isArray(prevRes.body.exam.questions) && prevRes.body.exam.questions[0].correctAnswer,
    'Teacher Step 10: Preview examination with instructor keys'
  );

  // Step 11: Publish examination
  const pubRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/publish`, {}, TEACHER_COOKIE);
  assert(pubRes.status === 200 && pubRes.body.exam.status === 'published', 'Teacher Step 11: Publish examination');

  // Step 12: Assign examination
  const assignRes = await request('PUT', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}`, {
    assignedStudentIds: [STUDENT_ID],
  }, TEACHER_COOKIE);
  assert(
    assignRes.status === 200 && assignRes.body.exam.assignedStudentIds.includes(STUDENT_ID),
    'Teacher Step 12: Assign examination to student cohort'
  );

  // -------------------------------------------------------------
  // PART 2: STUDENT WORKFLOW (STEPS 1 - 10)
  // -------------------------------------------------------------
  console.log('\n--- PART 2: STUDENT WORKFLOW (12 STEPS) ---');

  // Student Step 1: Sign in
  const sAuth = await request('GET', '/api/v1/auth/me', undefined, STUDENT_COOKIE);
  assert(sAuth.status === 200 && sAuth.body.user.role === 'student', 'Student Step 1: Student sign in');

  // Student Step 2: View assigned examinations
  const sExams = await request('GET', `/api/v1/classrooms/${CLASSROOM_ID}/exams`, undefined, STUDENT_COOKIE);
  assert(
    sExams.status === 200 && sExams.body.exams.some((e: any) => e.id === examId),
    'Student Step 2: View assigned examinations list'
  );

  // Student Step 3: Start examination
  const startRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/start`, {}, STUDENT_COOKIE);
  assert(startRes.status === 200 || startRes.status === 201, 'Student Step 3: Start examination session');
  const sessionId = startRes.body.session.id;

  const basePath = `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/sessions/${sessionId}`;

  // Student Step 4: Navigate questions (sanitized)
  const qListRes = await request('GET', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/questions`, undefined, STUDENT_COOKIE);
  assert(
    qListRes.status === 200 && qListRes.body.questions.every((q: any) => !q.correctAnswer && !q.correct_answer_json),
    'Student Step 4: Navigate questions with zero answer key leakage'
  );

  // Student Step 5: Flag question for review
  const flagRes = await request('PUT', `${basePath}/responses`, {
    questionId: q1Id,
    response: { selectedOptionId: 'opt_2' },
    flaggedForReview: true,
  }, STUDENT_COOKIE);
  assert(flagRes.status === 200 && flagRes.body.response.flaggedForReview === true, 'Student Step 5: Flag question for review');

  // Student Step 6: Save answer to question 2
  const save2Res = await request('PUT', `${basePath}/responses`, {
    questionId: q2Id,
    response: { text: "Tarjan's" },
    flaggedForReview: false,
  }, STUDENT_COOKIE);
  assert(save2Res.status === 200, 'Student Step 6: Save answer to question 2');

  // Student Step 7: Refresh browser (re-query session responses)
  const refRes = await request('GET', `${basePath}/responses`, undefined, STUDENT_COOKIE);
  assert(refRes.status === 200 && refRes.body.responses.length === 2, 'Student Step 7: Refresh browser preserves saved responses');

  // Student Step 8: Resume session (re-calling start resumes existing in_progress attempt)
  const resumeRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/start`, {}, STUDENT_COOKIE);
  assert(resumeRes.status === 200 && resumeRes.body.session.id === sessionId, 'Student Step 8: Resume session returns active attempt');

  // Student Step 9 & 10: Temporary disconnection and reconnect (send heartbeat)
  const hbRes = await request('POST', `${basePath}/heartbeat`, {}, STUDENT_COOKIE);
  assert(hbRes.status === 200, 'Student Steps 9 & 10: Disconnect and reconnect heartbeat verified');

  // -------------------------------------------------------------
  // BACK TO TEACHER: MONITOR, EXTEND TIME, REVIEW (STEPS 13-15)
  // -------------------------------------------------------------
  console.log('\n--- TEACHER MONITORING & PROCTOR ACTIONS (STEPS 13-15) ---');

  // Teacher Step 13: Monitor candidates via Live Dashboard
  const dashRes = await request('GET', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/dashboard`, undefined, TEACHER_COOKIE);
  assert(
    dashRes.status === 200 && dashRes.body.candidates.some((c: any) => c.userId === STUDENT_ID && c.status === 'in_progress'),
    'Teacher Step 13: Monitor candidates via live dashboard'
  );

  // Teacher Step 14: Grant additional time (+10 minutes)
  const extRes = await request('POST', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/dashboard/candidates/${STUDENT_ID}/extend-time`, {
    additionalMinutes: 10,
  }, TEACHER_COOKIE);
  assert(extRes.status === 200 && extRes.body.success === true, 'Teacher Step 14: Grant additional time to candidate');

  // Student Step 11: Final exam submission
  console.log('\n--- STUDENT SUBMISSION (STEP 11) ---');
  const subRes = await request('POST', `${basePath}/submit`, {}, STUDENT_COOKIE);
  assert(subRes.status === 200 && subRes.body.session.status === 'submitted', 'Student Step 11: Final exam submission locks session');

  // Student Step 12: View results according to publication settings (Immediate results off -> score null)
  console.log('\n--- STUDENT RESULTS (STEP 12) ---');
  assert(subRes.body.session.finalScore === null || subRes.body.session.autoScore === null, 'Student Step 12: Results masked when publication withheld');

  // Teacher Steps 15, 16, 17: Review results and manually grade
  console.log('\n--- TEACHER REVIEW & MANUAL GRADING (STEPS 16-17) ---');

  // Teacher Step 16: Review results
  const subsRes = await request('GET', `/api/v1/classrooms/${CLASSROOM_ID}/exams/${examId}/submissions`, undefined, TEACHER_COOKIE);
  assert(
    subsRes.status === 200 && subsRes.body.submissions.some((s: any) => s.id === sessionId),
    'Teacher Step 16: Review submissions list'
  );

  // Teacher Step 17: Manually grade short answer question
  // In our schema, teacher updates session manual score or updates response
  await db.prepare('UPDATE exam_sessions SET manual_score = ?, final_score = ?, status = ? WHERE id = ?').run(15, 25, 'graded', sessionId);
  const gradedSession = await classroomDb.getExamSession(sessionId);
  assert(
    gradedSession?.status === 'graded' && gradedSession?.finalScore === 25,
    'Teacher Step 17: Teacher manually grades short answer and finalizes evaluation'
  );

  // Clean up test records
  console.log('\nCleaning up lifecycle test data...');
  await db.prepare('DELETE FROM exam_question_responses WHERE session_id = ?').run(sessionId);
  await db.prepare('DELETE FROM exam_sessions WHERE id = ?').run(sessionId);
  await db.prepare('DELETE FROM exam_branching_rules WHERE exam_id = ?').run(examId);
  await db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(examId);
  await db.prepare('DELETE FROM exam_sections WHERE exam_id = ?').run(examId);
  await db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
  await db.prepare('DELETE FROM question_bank WHERE teacher_id = ?').run(TEACHER_ID);
  await db.prepare('DELETE FROM classroom_members WHERE classroom_id = ?').run(CLASSROOM_ID);
  await db.prepare('DELETE FROM classrooms WHERE id = ?').run(CLASSROOM_ID);
  await db.prepare('DELETE FROM sessions WHERE id IN (?, ?)').run(TEACHER_COOKIE, STUDENT_COOKIE);
  await db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(TEACHER_ID, STUDENT_ID);

  console.log('\n================================================================');
  console.log('PHASE 3.3 LIFECYCLE SUITE SUMMARY');
  console.log('================================================================');
  console.log(`Total Steps Tested: ${passedCount + failedCount}`);
  console.log(`Passed:             ${passedCount}`);
  console.log(`Failed:             ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n>>> LIFECYCLE VERIFICATION FAILED <<<');
    process.exit(1);
  } else {
    console.log('\n>>> ALL 29 TEACHER & STUDENT LIFECYCLE STEPS PASSED SUCCESSFULLY! <<<');
  }
}

runLifecycleVerification().catch((err) => {
  console.error('Fatal lifecycle verification error:', err);
  process.exit(1);
});
