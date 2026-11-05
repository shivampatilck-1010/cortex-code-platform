const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { DatabaseSync } = require('node:sqlite');

console.log('===============================================================');
console.log('CORTEX PHASE 2 & DEFECT FIXES INTEGRATION TEST SUITE');
console.log('===============================================================\n');

const dbPath = path.resolve(__dirname, '..', 'data', 'cortex_classroom.db');
if (!fs.existsSync(dbPath)) {
  console.error('FATAL: Database not found at', dbPath);
  process.exit(1);
}

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
    console.error('  Error:', err.message);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(0, 4).join('\n'));
    }
    totalFailed++;
  }
}

// -------------------------------------------------------------
// STAGE 4 VERIFICATION: DEFECT FIXES
// -------------------------------------------------------------
console.log('--- STAGE 4: DEFECT FIXES VERIFICATION ---');

// Import exam-grader module
const { gradeQuestionResponse } = require('../src/lib/classroom/exam-grader');

runTest('Defect 1: Programming question score forgery is strictly blocked in grader', () => {
  // Directly test grader function logic
  // We recreate question and malicious student response
  const progQuestion = {
    id: 'q_prog_test',
    examId: 'exam_1',
    questionType: 'programming',
    promptText: 'Write a function to return fibonacci',
    options: [],
    points: 10,
    negativeMarks: 0,
    numericalTolerance: 0,
    sortOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Malicious response attempting to claim 10 points
  const forgedResponse = {
    code: 'def fib(n): return n',
    earnedPoints: 10,
    gradingStatus: 'auto_graded',
  };

  // Grader without trusted execution must return pending and 0 earned points
  // Even if forgedResponse has earnedPoints: 10
  const result = gradeQuestionResponse(progQuestion, forgedResponse);
  assert.strictEqual(result.earnedPoints, 0, 'Grader must award 0 points when execution is not verified');
  assert.strictEqual(result.status, 'pending', 'Grading status must remain pending');
  assert.strictEqual(result.isCorrect, false, 'Question must not be marked correct');
});

runTest('Defect 1: Programming question awards points ONLY with trusted server execution', () => {
  const progQuestion = {
    id: 'q_prog_test_2',
    examId: 'exam_1',
    questionType: 'programming',
    promptText: 'Implement binary search',
    options: [],
    points: 20,
    negativeMarks: 0,
    numericalTolerance: 0,
    sortOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const studentCode = 'def search(): pass';

  // 1. Partial pass (3 out of 4 tests passed)
  const partialResult = gradeQuestionResponse(progQuestion, studentCode, {
    trustedExecution: { passedTests: 3, totalTests: 4 },
  });
  assert.strictEqual(partialResult.earnedPoints, 15, 'Should calculate 75% of 20 = 15 points');
  assert.strictEqual(partialResult.status, 'auto_graded');
  assert.strictEqual(partialResult.isCorrect, false);

  // 2. Full pass (4 out of 4 tests passed)
  const fullResult = gradeQuestionResponse(progQuestion, studentCode, {
    trustedExecution: { passedTests: 4, totalTests: 4 },
  });
  assert.strictEqual(fullResult.earnedPoints, 20, 'Should calculate 100% of 20 = 20 points');
  assert.strictEqual(fullResult.status, 'auto_graded');
  assert.strictEqual(fullResult.isCorrect, true);
});

runTest('Defect 2: Responses cannot be saved past session.expiresAt', () => {
  // Check the code in responses/route.ts
  const responsesRoutePath = path.resolve(__dirname, '..', 'src', 'app', 'api', 'v1', 'classrooms', '[id]', 'exams', '[examId]', 'sessions', '[sessionId]', 'responses', 'route.ts');
  const code = fs.readFileSync(responsesRoutePath, 'utf8');

  assert.ok(code.includes('if (now > session.expiresAt)'), 'responses/route.ts must check now > session.expiresAt');
  assert.ok(code.includes('Examination duration has ended'), 'responses/route.ts must return duration ended message');
});

runTest('Defect 3: Concurrent start race safety in start/route.ts', () => {
  const startRoutePath = path.resolve(__dirname, '..', 'src', 'app', 'api', 'v1', 'classrooms', '[id]', 'exams', '[examId]', 'start', 'route.ts');
  const code = fs.readFileSync(startRoutePath, 'utf8');

  assert.ok(code.includes('createErr'), 'start/route.ts must catch createErr');
  assert.ok(code.includes('resumed: true'), 'start/route.ts must recover active session and return resumed: true');
});

runTest('Defect 4: Teacher manual grading endpoints exist and have valid structure', () => {
  const gradeRoutePath = path.resolve(__dirname, '..', 'src', 'app', 'api', 'v1', 'classrooms', '[id]', 'exams', '[examId]', 'submissions', '[sessionId]', 'grade', 'route.ts');
  assert.ok(fs.existsSync(gradeRoutePath), 'grade/route.ts must exist');
  const code = fs.readFileSync(gradeRoutePath, 'utf8');

  assert.ok(code.includes('PUT('), 'grade/route.ts must export PUT handler');
  assert.ok(code.includes('questionGrades'), 'grade/route.ts must process questionGrades');
  assert.ok(code.includes('teacherFeedback'), 'grade/route.ts must support teacherFeedback');
});

// -------------------------------------------------------------
// STAGE 3 VERIFICATION: CODE ARENA REMOVAL
// -------------------------------------------------------------
console.log('\n--- STAGE 3: CODE ARENA REMOVAL VERIFICATION ---');

runTest('Code Arena: activeTab no longer includes arena', () => {
  const classroomPagePath = path.resolve(__dirname, '..', 'src', 'app', 'classroom', 'page.tsx');
  const code = fs.readFileSync(classroomPagePath, 'utf8');

  // Verify 'arena' is not in activeTab union
  assert.ok(!code.includes("'arena' | 'grades'"), "'arena' must be removed from activeTab union");
  assert.ok(!code.includes("aria-selected={activeTab === 'arena'}"), "Arena tab button must be removed from tablist");
  assert.ok(!code.includes("activeTab === 'arena' &&"), "Arena landing page block must be removed");
});

runTest('Code Arena: Direct Live Classroom routes remain functional and accessible', () => {
  const classroomPagePath = path.resolve(__dirname, '..', 'src', 'app', 'classroom', 'page.tsx');
  const code = fs.readFileSync(classroomPagePath, 'utf8');

  assert.ok(code.includes('/live/session_main'), 'Direct Live Class button must route to /live/session_main');
  assert.ok(code.includes('Live Class'), 'Header has a direct Live Class action button');
});

// -------------------------------------------------------------
// STAGE 5 VERIFICATION: REUSABLE QUESTION BANK (PHASE 2)
// -------------------------------------------------------------
console.log('\n--- STAGE 5: QUESTION BANK VERIFICATION ---');

const testTeacherId = 'usr_prof_elena';
const testClassroomId = 'C1-CS201-ADV';
let createdBankQuestionId = '';

runTest('Question Bank Schema: Table and indices exist in local database', () => {
  const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='question_bank'").get();
  assert.ok(tableCheck, 'question_bank table must exist');

  const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='question_bank'").all();
  const indexNames = indices.map((i) => i.name);
  assert.ok(indexNames.includes('idx_question_bank_teacher'), 'idx_question_bank_teacher must exist');
  assert.ok(indexNames.includes('idx_question_bank_subject_topic'), 'idx_question_bank_subject_topic must exist');
});

runTest('Question Bank CRUD: Create item with tagging and difficulty', () => {
  const id = `qb_test_${Date.now()}`;
  createdBankQuestionId = id;
  const now = Date.now();

  const optionsJson = JSON.stringify([
    { id: 'opt_1', text: 'O(log n)' },
    { id: 'opt_2', text: 'O(n)' },
    { id: 'opt_3', text: 'O(n log n)' },
    { id: 'opt_4', text: 'O(n^2)' },
  ]);
  const correctAnswerJson = JSON.stringify({ correctOptionId: 'opt_3' });
  const tagsJson = JSON.stringify(['algorithms', 'sorting', 'divide-and-conquer']);

  db.prepare(`
    INSERT INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty,
      question_type, prompt_text, prompt_media_url, options_json,
      correct_answer_json, test_cases_json, initial_code, language,
      default_points, negative_marks, numerical_tolerance, tags_json,
      is_archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    testTeacherId,
    testClassroomId,
    'Computer Science',
    'Algorithms',
    'medium',
    'mcq_single',
    'What is the worst-case time complexity of Merge Sort on an array of length n?',
    null,
    optionsJson,
    correctAnswerJson,
    '[]',
    null,
    null,
    2.5,
    0.5,
    0.0,
    tagsJson,
    0,
    now,
    now
  );

  const row = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(id);
  assert.ok(row, 'Inserted row must exist');
  assert.strictEqual(row.subject, 'Computer Science');
  assert.strictEqual(row.topic, 'Algorithms');
  assert.strictEqual(row.difficulty, 'medium');
  assert.strictEqual(row.default_points, 2.5);
  assert.strictEqual(row.is_archived, 0);
});

runTest('Question Bank Query & Filter: Search by subject, topic, and tags', () => {
  const rows = db.prepare(`
    SELECT * FROM question_bank
    WHERE teacher_id = ? AND subject = ? AND topic = ? AND is_archived = 0
  `).all(testTeacherId, 'Computer Science', 'Algorithms');

  assert.ok(rows.length >= 1, 'Should find at least 1 question for teacher');
  const item = rows[0];
  const tags = JSON.parse(item.tags_json);
  assert.ok(tags.includes('sorting'), 'Tags must contain sorting');
});

runTest('Question Bank Duplication: Cloning creates a new independent copy', () => {
  const orig = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(createdBankQuestionId);
  assert.ok(orig, 'Original item must exist');

  const dupId = `qb_dup_${Date.now()}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO question_bank (
      id, teacher_id, classroom_id, subject, topic, difficulty,
      question_type, prompt_text, prompt_media_url, options_json,
      correct_answer_json, test_cases_json, initial_code, language,
      default_points, negative_marks, numerical_tolerance, tags_json,
      is_archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dupId,
    testTeacherId,
    orig.classroom_id,
    orig.subject,
    orig.topic,
    orig.difficulty,
    orig.question_type,
    `${orig.prompt_text} (Copy)`,
    orig.prompt_media_url,
    orig.options_json,
    orig.correct_answer_json,
    orig.test_cases_json,
    orig.initial_code,
    orig.language,
    orig.default_points,
    orig.negative_marks,
    orig.numerical_tolerance,
    orig.tags_json,
    0,
    now,
    now
  );

  const dupRow = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(dupId);
  assert.ok(dupRow, 'Duplicated item must exist in DB');
  assert.ok(dupRow.prompt_text.endsWith('(Copy)'), 'Prompt text must indicate copy');
  assert.notStrictEqual(dupRow.id, orig.id, 'IDs must be distinct');

  // Clean up duplicate
  db.prepare('DELETE FROM question_bank WHERE id = ?').run(dupId);
});

runTest('Question Bank Archiving: Soft delete marks is_archived = 1 without destroying data', () => {
  const now = Date.now();
  db.prepare('UPDATE question_bank SET is_archived = 1, updated_at = ? WHERE id = ?').run(now, createdBankQuestionId);

  const row = db.prepare('SELECT is_archived FROM question_bank WHERE id = ?').get(createdBankQuestionId);
  assert.strictEqual(row.is_archived, 1, 'Question must be archived');

  // Active query should exclude it
  const activeList = db.prepare('SELECT * FROM question_bank WHERE teacher_id = ? AND is_archived = 0').all(testTeacherId);
  assert.ok(!activeList.some((q) => q.id === createdBankQuestionId), 'Archived item must not appear in active list');

  // Unarchive for next tests
  db.prepare('UPDATE question_bank SET is_archived = 0 WHERE id = ?').run(createdBankQuestionId);
});

let importedExamQuestionId = '';
const testExamId = 'exam_snapshot_test';

runTest('Question Bank to Exam Import: Immutable Snapshotting', () => {
  // 1. Create a dummy test exam
  const now = Date.now();
  db.prepare(`
    INSERT OR REPLACE INTO exams (
      id, classroom_id, title, duration_minutes, start_time, end_time,
      total_marks, passing_marks, attempts_allowed, security_level,
      status, assigned_student_ids_json, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testExamId,
    testClassroomId,
    'Snapshot Test Exam',
    30,
    now,
    now + 7200000,
    50,
    20,
    1,
    'standard',
    'draft',
    '[]',
    testTeacherId,
    now,
    now
  );

  // 2. Fetch original question bank item
  const bankItem = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(createdBankQuestionId);
  assert.ok(bankItem, 'Bank item must exist');

  // 3. Snapshot import into exam_questions
  importedExamQuestionId = `eq_imported_${Date.now()}`;
  db.prepare(`
    INSERT INTO exam_questions (
      id, exam_id, section_id, question_type, prompt_text,
      prompt_media_url, options_json, correct_answer_json, test_cases_json,
      initial_code, language, points, negative_marks, numerical_tolerance,
      sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    importedExamQuestionId,
    testExamId,
    null,
    bankItem.question_type,
    bankItem.prompt_text,
    bankItem.prompt_media_url,
    bankItem.options_json,
    bankItem.correct_answer_json,
    bankItem.test_cases_json,
    bankItem.initial_code,
    bankItem.language,
    5.0, // Points override
    bankItem.negative_marks,
    bankItem.numerical_tolerance,
    1,
    now,
    now
  );

  const imported = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(importedExamQuestionId);
  assert.ok(imported, 'Imported exam question must exist');
  assert.strictEqual(imported.points, 5.0, 'Points override must take effect');
  assert.strictEqual(imported.prompt_text, bankItem.prompt_text);
});

runTest('Immutability Guarantee: Modifying Bank Question NEVER alters Exam Question', () => {
  // Mutate the original item in the question_bank
  const now = Date.now();
  db.prepare(`
    UPDATE question_bank
    SET prompt_text = 'MODIFIED QUESTION PROMPT IN BANK',
        default_points = 100.0,
        difficulty = 'hard',
        updated_at = ?
    WHERE id = ?
  `).run(now, createdBankQuestionId);

  // Verify the exam question remains completely untouched
  const examQuestion = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(importedExamQuestionId);
  assert.notStrictEqual(examQuestion.prompt_text, 'MODIFIED QUESTION PROMPT IN BANK', 'Exam question prompt must NOT change when bank item is updated');
  assert.strictEqual(examQuestion.points, 5.0, 'Exam question points must NOT change');
  assert.ok(examQuestion.prompt_text.includes('Merge Sort'), 'Original prompt must be preserved immutably');
});

runTest('Immutability Guarantee: Deleting Bank Question preserves Exam Question', () => {
  // Delete the bank question completely
  db.prepare('DELETE FROM question_bank WHERE id = ?').run(createdBankQuestionId);

  // Verify exam question still exists and is 100% intact
  const examQuestion = db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(importedExamQuestionId);
  assert.ok(examQuestion, 'Exam question must remain intact even if source bank question is deleted');

  // Clean up test exam and exam question
  db.prepare('DELETE FROM exam_questions WHERE id = ?').run(importedExamQuestionId);
  db.prepare('DELETE FROM exams WHERE id = ?').run(testExamId);
});

console.log('\n===============================================================');
console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
console.log('===============================================================\n');

if (totalFailed > 0) {
  process.exit(1);
}
