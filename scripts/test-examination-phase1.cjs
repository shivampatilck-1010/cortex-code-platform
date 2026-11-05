// Cortex Online Examination System — Phase 1 Verification Suite
// Comprehensive local tests covering schema, database CRUD, state transitions,
// auto-grading algorithms, privacy sanitization, and regression protection.

const path = require('path');
const assert = require('assert');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(__dirname, '..', 'data', 'cortex_classroom.db');
console.log('Connecting to local test database:', dbPath);
const db = new DatabaseSync(dbPath);

let totalPassed = 0;
let totalFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    totalFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(`  Error: ${err.message}`);
    totalFailed++;
  }
}

async function main() {
  console.log('\n=== TEST SUITE 1: RELATIONAL SCHEMA INTEGRITY ===');

  runTest('Table exams exists with required columns', () => {
    const cols = db.prepare("PRAGMA table_info('exams')").all().map((c) => c.name);
    const required = [
      'id', 'classroom_id', 'title', 'description', 'duration_minutes',
      'start_time', 'end_time', 'total_marks', 'passing_marks', 'attempts_allowed',
      'security_level', 'status', 'shuffle_questions', 'shuffle_options',
      'show_results_immediately', 'assigned_student_ids_json', 'created_by', 'created_at', 'updated_at'
    ];
    for (const r of required) {
      assert(cols.includes(r), `Missing column in exams: ${r}`);
    }
  });

  runTest('Table exam_questions exists with required columns', () => {
    const cols = db.prepare("PRAGMA table_info('exam_questions')").all().map((c) => c.name);
    const required = [
      'id', 'exam_id', 'section_id', 'question_type', 'prompt_text',
      'options_json', 'correct_answer_json', 'test_cases_json',
      'points', 'negative_marks', 'numerical_tolerance', 'sort_order'
    ];
    for (const r of required) {
      assert(cols.includes(r), `Missing column in exam_questions: ${r}`);
    }
  });

  runTest('Table exam_sessions exists with required columns', () => {
    const cols = db.prepare("PRAGMA table_info('exam_sessions')").all().map((c) => c.name);
    const required = [
      'id', 'exam_id', 'user_id', 'attempt_number', 'status',
      'started_at', 'expires_at', 'submitted_at', 'auto_score', 'final_score'
    ];
    for (const r of required) {
      assert(cols.includes(r), `Missing column in exam_sessions: ${r}`);
    }
  });

  runTest('Table exam_question_responses exists with required columns', () => {
    const cols = db.prepare("PRAGMA table_info('exam_question_responses')").all().map((c) => c.name);
    const required = ['id', 'session_id', 'question_id', 'response_json', 'earned_points', 'grading_status'];
    for (const r of required) {
      assert(cols.includes(r), `Missing column in exam_question_responses: ${r}`);
    }
  });

  runTest('Table exam_integrity_events exists with required columns', () => {
    const cols = db.prepare("PRAGMA table_info('exam_integrity_events')").all().map((c) => c.name);
    const required = ['id', 'session_id', 'event_type', 'timestamp', 'details_json'];
    for (const r of required) {
      assert(cols.includes(r), `Missing column in exam_integrity_events: ${r}`);
    }
  });

  console.log('\n=== TEST SUITE 2: EXAMINATION CRUD & DATABASE LAYER ===');

  const testExamId = `exam_test_${Date.now()}`;
  const testClassroomId = 'C1-CS201-ADV';
  const testTeacherId = 'usr_prof_elena';

  runTest('Create exam record in database', () => {
    const now = Date.now();
    db.prepare(`
      INSERT INTO exams (
        id, classroom_id, title, description, duration_minutes,
        start_time, end_time, total_marks, passing_marks, attempts_allowed,
        security_level, status, shuffle_questions, shuffle_options, show_results_immediately,
        assigned_student_ids_json, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testExamId, testClassroomId, 'Algorithms Midterm Exam', 'Exam description',
      90, now, now + 7200000, 100, 50, 2, 'restricted', 'draft', 1, 1, 0, '[]', testTeacherId, now, now
    );

    const row = db.prepare('SELECT * FROM exams WHERE id = ?').get(testExamId);
    assert.strictEqual(row.title, 'Algorithms Midterm Exam');
    assert.strictEqual(row.duration_minutes, 90);
    assert.strictEqual(row.security_level, 'restricted');
    assert.strictEqual(row.status, 'draft');
  });

  runTest('Update exam status and settings', () => {
    db.prepare("UPDATE exams SET status = 'published', passing_marks = 55 WHERE id = ?").run(testExamId);
    const row = db.prepare('SELECT status, passing_marks FROM exams WHERE id = ?').get(testExamId);
    assert.strictEqual(row.status, 'published');
    assert.strictEqual(row.passing_marks, 55);
  });

  const testQ1Id = `q_mcq1_${Date.now()}`;
  const testQ2Id = `q_num1_${Date.now()}`;
  const testQ3Id = `q_prog1_${Date.now()}`;

  runTest('Insert diverse question types into exam', () => {
    const now = Date.now();
    // Q1: MCQ Single
    db.prepare(`
      INSERT INTO exam_questions (
        id, exam_id, question_type, prompt_text, options_json,
        correct_answer_json, points, negative_marks, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testQ1Id, testExamId, 'mcq_single', 'What is the time complexity of binary search?',
      JSON.stringify([{ id: 'opt_1', text: 'O(log n)' }, { id: 'opt_2', text: 'O(n)' }]),
      JSON.stringify({ optionId: 'opt_1' }), 2.0, 0.5, 0, now, now
    );

    // Q2: Numerical
    db.prepare(`
      INSERT INTO exam_questions (
        id, exam_id, question_type, prompt_text, options_json,
        correct_answer_json, points, numerical_tolerance, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testQ2Id, testExamId, 'numerical', 'Calculate log2(1024)', '[]',
      JSON.stringify({ value: 10 }), 3.0, 0.01, 1, now, now
    );

    // Q3: Programming
    db.prepare(`
      INSERT INTO exam_questions (
        id, exam_id, question_type, prompt_text, options_json,
        correct_answer_json, test_cases_json, initial_code, language, points, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testQ3Id, testExamId, 'programming', 'Write a function returning double of n', '[]', '{}',
      JSON.stringify([
        { id: 'tc_1', input: '5', expectedOutput: '10', isHidden: false, points: 2 },
        { id: 'tc_2', input: '25', expectedOutput: '50', isHidden: true, points: 3 },
      ]),
      'def solve(n):\n    return n * 2\n', 'python', 5.0, 2, now, now
    );

    const count = db.prepare('SELECT COUNT(*) as count FROM exam_questions WHERE exam_id = ?').get(testExamId).count;
    assert.strictEqual(count, 3);
  });

  console.log('\n=== TEST SUITE 3: STUDENT SESSIONS, RESPONSES & INTEGRITY ===');

  const testStudentId = 'usr_alex_chen';
  const testSessionId = `sess_test_${Date.now()}`;

  runTest('Create student examination session', () => {
    const now = Date.now();
    const expiresAt = now + 90 * 60 * 1000;

    db.prepare(`
      INSERT INTO exam_sessions (
        id, exam_id, user_id, attempt_number, status,
        started_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testSessionId, testExamId, testStudentId, 1, 'in_progress', now, expiresAt, now, now);

    const sess = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(testSessionId);
    assert.strictEqual(sess.user_id, testStudentId);
    assert.strictEqual(sess.status, 'in_progress');
  });

  runTest('Record responses and integrity event in session', () => {
    const now = Date.now();
    // Save response
    db.prepare(`
      INSERT INTO exam_question_responses (
        id, session_id, question_id, response_json, earned_points, grading_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(`resp_1_${now}`, testSessionId, testQ1Id, JSON.stringify({ optionId: 'opt_1' }), 2.0, 'auto_graded', now);

    // Save integrity event
    db.prepare(`
      INSERT INTO exam_integrity_events (
        id, session_id, event_type, timestamp, details_json
      ) VALUES (?, ?, ?, ?, ?)
    `).run(`ievt_1_${now}`, testSessionId, 'fullscreen_exit', now, JSON.stringify({ reason: 'Esc key' }));

    const respRow = db.prepare('SELECT * FROM exam_question_responses WHERE session_id = ?').get(testSessionId);
    assert.strictEqual(respRow.question_id, testQ1Id);

    const eventRow = db.prepare('SELECT * FROM exam_integrity_events WHERE session_id = ?').get(testSessionId);
    assert.strictEqual(eventRow.event_type, 'fullscreen_exit');
  });

  runTest('Submit and finalize examination session', () => {
    const now = Date.now();
    db.prepare(`
      UPDATE exam_sessions
      SET status = 'submitted', submitted_at = ?, auto_score = 10, final_score = 10
      WHERE id = ?
    `).run(now, testSessionId);

    const sess = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(testSessionId);
    assert.strictEqual(sess.status, 'submitted');
    assert.strictEqual(sess.final_score, 10);
  });

  console.log('\n=== TEST SUITE 4: STATE TRANSITION LOGIC ===');

  const { VALID_EXAM_TRANSITIONS } = require('../src/lib/classroom/models');

  runTest('Validate valid examination state transitions', () => {
    assert(VALID_EXAM_TRANSITIONS.draft.includes('published'), 'draft must be allowed to transition to published');
    assert(VALID_EXAM_TRANSITIONS.draft.includes('scheduled'), 'draft must be allowed to transition to scheduled');
    assert(VALID_EXAM_TRANSITIONS.published.includes('ended'), 'published must be allowed to transition to ended');
    assert(VALID_EXAM_TRANSITIONS.ended.includes('results_published'), 'ended must be allowed to transition to results_published');
  });

  runTest('Reject invalid examination state transitions', () => {
    assert(!VALID_EXAM_TRANSITIONS.ended.includes('draft'), 'ended must NOT be allowed to transition to draft');
    assert(!VALID_EXAM_TRANSITIONS.results_published.includes('draft'), 'results_published must NOT transition to draft');
    assert(!VALID_EXAM_TRANSITIONS.draft.includes('results_published'), 'draft must NOT jump directly to results_published');
  });

  console.log('\n=== TEST SUITE 5: PRIVACY & DATA SANITIZATION ===');

  const { sanitizeQuestionForStudent, sanitizeExamForStudent } = require('../src/lib/classroom/exam-sanitizer');

  runTest('Sanitize question strips correct answers and hides test cases', () => {
    const rawQuestion = {
      id: 'q_test_privacy',
      examId: 'exam_1',
      questionType: 'mcq_single',
      promptText: 'What is 2+2?',
      options: [
        { id: 'opt_1', text: '4', isCorrect: true },
        { id: 'opt_2', text: '5', isCorrect: false }
      ],
      correctAnswer: { optionId: 'opt_1' },
      testCases: [
        { id: 'tc_pub', input: '2 2', expectedOutput: '4', isHidden: false },
        { id: 'tc_priv', input: '100 200', expectedOutput: '300', isHidden: true }
      ],
      points: 2,
      negativeMarks: 0,
      numericalTolerance: 0,
      sortOrder: 0,
      createdAt: 1000,
      updatedAt: 1000
    };

    const sanitized = sanitizeQuestionForStudent(rawQuestion);

    // 1. correctAnswer must be strictly undefined
    assert.strictEqual(sanitized.correctAnswer, undefined, 'correctAnswer must be stripped for students');

    // 2. isCorrect flag must be stripped from options
    sanitized.options.forEach((opt) => {
      assert.strictEqual(opt.isCorrect, undefined, 'isCorrect must be stripped from student options');
    });

    // 3. Hidden test cases must have input and expectedOutput redacted
    const pubTc = sanitized.testCases.find((tc) => tc.id === 'tc_pub');
    assert.strictEqual(pubTc.input, '2 2');
    assert.strictEqual(pubTc.expectedOutput, '4');

    const privTc = sanitized.testCases.find((tc) => tc.id === 'tc_priv');
    assert.strictEqual(privTc.input, '[HIDDEN TEST CASE]');
    assert.strictEqual(privTc.expectedOutput, '[HIDDEN TEST CASE]');
  });

  console.log('\n=== TEST SUITE 6: AUTO-GRADING ENGINE ===');

  const { gradeQuestionResponse } = require('../src/lib/classroom/exam-grader');

  runTest('Grade MCQ single: correct choice awards full points', () => {
    const q = { questionType: 'mcq_single', points: 3, negativeMarks: 1, correctAnswer: { optionId: 'opt_a' } };
    const res = gradeQuestionResponse(q, 'opt_a');
    assert.strictEqual(res.earnedPoints, 3);
    assert.strictEqual(res.isCorrect, true);
  });

  runTest('Grade MCQ single: incorrect choice awards negative penalty', () => {
    const q = { questionType: 'mcq_single', points: 3, negativeMarks: 1, correctAnswer: { optionId: 'opt_a' } };
    const res = gradeQuestionResponse(q, 'opt_b');
    assert.strictEqual(res.earnedPoints, -1);
    assert.strictEqual(res.isCorrect, false);
  });

  runTest('Grade MCQ multiple: exact match awards full points', () => {
    const q = { questionType: 'mcq_multiple', points: 4, correctAnswer: { optionIds: ['opt_a', 'opt_c'], partialCredit: true } };
    const res = gradeQuestionResponse(q, ['opt_a', 'opt_c']);
    assert.strictEqual(res.earnedPoints, 4);
    assert.strictEqual(res.isCorrect, true);
  });

  runTest('Grade MCQ multiple: partial match awards partial credit', () => {
    const q = { questionType: 'mcq_multiple', points: 4, correctAnswer: { optionIds: ['opt_a', 'opt_c'], partialCredit: true } };
    const res = gradeQuestionResponse(q, ['opt_a']);
    assert.strictEqual(res.earnedPoints, 2);
    assert.strictEqual(res.isCorrect, false);
  });

  runTest('Grade Numerical: exact and within tolerance awards full points', () => {
    const q = { questionType: 'numerical', points: 5, numericalTolerance: 0.05, correctAnswer: { value: 3.14 } };
    const res1 = gradeQuestionResponse(q, 3.14);
    assert.strictEqual(res1.earnedPoints, 5);

    const res2 = gradeQuestionResponse(q, 3.17);
    assert.strictEqual(res2.earnedPoints, 5);

    const res3 = gradeQuestionResponse(q, 3.25);
    assert.strictEqual(res3.earnedPoints, 0);
  });

  runTest('Grade Short Answer: case insensitive matching', () => {
    const q = { questionType: 'short_answer', points: 2, correctAnswer: { acceptedAnswers: ['Binary Search Tree', 'BST'], caseSensitive: false } };
    const res1 = gradeQuestionResponse(q, 'binary search tree');
    assert.strictEqual(res1.earnedPoints, 2);
    assert.strictEqual(res1.isCorrect, true);

    const res2 = gradeQuestionResponse(q, 'Linked List');
    assert.strictEqual(res2.earnedPoints, 0);
    assert.strictEqual(res2.isCorrect, false);
  });

  console.log('\n=== TEST SUITE 7: CLEANUP & REGRESSION VERIFICATION ===');

  runTest('Clean up temporary test records', () => {
    db.prepare('DELETE FROM exams WHERE id = ?').run(testExamId);
    const count = db.prepare('SELECT COUNT(*) as count FROM exams WHERE id = ?').get(testExamId).count;
    assert.strictEqual(count, 0);

    // Verify cascade deleted questions
    const qCount = db.prepare('SELECT COUNT(*) as count FROM exam_questions WHERE exam_id = ?').get(testExamId).count;
    assert.strictEqual(qCount, 0);
  });

  runTest('Regression: existing classrooms and assignments intact', () => {
    const classCount = db.prepare('SELECT COUNT(*) as count FROM classrooms').get().count;
    assert(classCount > 0, 'Classrooms table must have existing records');

    const asgCount = db.prepare('SELECT COUNT(*) as count FROM assignments').get().count;
    assert(asgCount > 0, 'Assignments table must have existing records');

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    assert(userCount > 0, 'Users table must have existing records');
  });

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS: ${totalPassed + totalFailed}`);
  console.log(`PASSED: ${totalPassed}`);
  console.log(`FAILED: ${totalFailed}`);
  console.log(`========================================\n`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled fatal test exception:', err);
  process.exit(1);
});
