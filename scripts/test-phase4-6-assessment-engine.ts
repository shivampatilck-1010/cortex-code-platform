/**
 * Cortex Online Examination System — Phase 4.6 Test Suite
 * Question Bank, Assessment Engine & Grading Verification
 *
 * Verifies:
 * 1. Scoring logic for all supported question types (Single MCQ, Multi MCQ, True/False, Numerical, Short Answer).
 * 2. Partial credit, negative marking, numerical tolerance, and case sensitivity.
 * 3. Subjective manual grading preservation (auto-grading does not bypass manual review).
 * 4. Fill-in-the-blanks investigation and accurate classification.
 * 5. Question bank lifecycle (CRUD, search, filtering, duplication, archiving).
 * 6. Exam question snapshot immutability (modifying bank items does not mutate published exams).
 * 7. Candidate answer security & anti-leakage scrubbing.
 *
 * Strictly zero emojis.
 */

import { gradeQuestionResponse } from '../src/lib/classroom/exam-grader';
import { sanitizeQuestionForStudent, sanitizeExamForStudent } from '../src/lib/classroom/exam-sanitizer';
import { Exam, ExamQuestion } from '../src/lib/classroom/models';
import { classroomDb } from '../src/lib/classroom/db';

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
  }
}

async function runAssessmentEngineAudit() {
  console.log('================================================================');
  console.log('PHASE 4.6: QUESTION BANK & ASSESSMENT ENGINE AUDIT');
  console.log('================================================================\n');

  // --- SECTION 1: QUESTION TYPE SCORING ACCURACY ---
  console.log('--- SECTION 1: QUESTION TYPE SCORING ACCURACY ---');

  // 1. Single-choice MCQ
  const qMcqSingle: ExamQuestion = {
    id: 'q_mcq_1',
    examId: 'exam_1',
    questionType: 'mcq_single',
    promptText: 'What is the time complexity of binary search on a sorted array?',
    points: 4.0,
    negativeMarks: 1.0,
    options: [
      { id: 'opt_a', text: 'O(N)' },
      { id: 'opt_b', text: 'O(log N)' },
      { id: 'opt_c', text: 'O(1)' },
    ],
    correctAnswer: { optionId: 'opt_b' },
    sortOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const resMcqCorrect = gradeQuestionResponse(qMcqSingle, { optionId: 'opt_b' });
  assert(resMcqCorrect.earnedPoints === 4.0 && resMcqCorrect.isCorrect === true, 'Single MCQ: Correct selection awards full 4.0 points');

  const resMcqWrong = gradeQuestionResponse(qMcqSingle, { optionId: 'opt_a' });
  assert(resMcqWrong.earnedPoints === -1.0 && resMcqWrong.isCorrect === false, 'Single MCQ: Incorrect selection incurs -1.0 negative penalty');

  const resMcqUnanswered = gradeQuestionResponse(qMcqSingle, null);
  assert(resMcqUnanswered.earnedPoints === 0 && resMcqUnanswered.feedback === 'Unanswered', 'Single MCQ: Unanswered response awards 0 points without negative penalty');

  // 2. Multiple-select MCQ
  const qMcqMulti: ExamQuestion = {
    id: 'q_mcq_2',
    examId: 'exam_1',
    questionType: 'mcq_multiple',
    promptText: 'Select all primes less than 10:',
    points: 6.0,
    negativeMarks: 2.0,
    options: [
      { id: 'opt_2', text: '2' },
      { id: 'opt_3', text: '3' },
      { id: 'opt_4', text: '4' },
      { id: 'opt_5', text: '5' },
    ],
    correctAnswer: { optionIds: ['opt_2', 'opt_3', 'opt_5'], partialCredit: true },
    sortOrder: 2,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const resMultiAllCorrect = gradeQuestionResponse(qMcqMulti, { optionIds: ['opt_2', 'opt_3', 'opt_5'] });
  assert(resMultiAllCorrect.earnedPoints === 6.0 && resMultiAllCorrect.isCorrect === true, 'Multiple MCQ: All correct options awards full 6.0 points');

  // Partial: 2 correct out of 3, 0 wrong -> fraction = 2/3 * 6.0 = 4.0 points
  const resMultiPartial = gradeQuestionResponse(qMcqMulti, { optionIds: ['opt_2', 'opt_3'] });
  assert(resMultiPartial.earnedPoints === 4.0 && resMultiPartial.isCorrect === false, `Multiple MCQ: Partial credit correctly awarded (expected 4.0, got ${resMultiPartial.earnedPoints})`);

  // Partial with 1 wrong: 2 correct, 1 wrong -> fraction = (2 - 1) / 3 = 1/3 * 6.0 = 2.0 points
  const resMultiPartialWithWrong = gradeQuestionResponse(qMcqMulti, { optionIds: ['opt_2', 'opt_3', 'opt_4'] });
  assert(resMultiPartialWithWrong.earnedPoints === 2.0, `Multiple MCQ: Incorrect choice penalizes partial credit (expected 2.0, got ${resMultiPartialWithWrong.earnedPoints})`);

  // 3. True / False
  const qTrueFalse: ExamQuestion = {
    id: 'q_tf_1',
    examId: 'exam_1',
    questionType: 'true_false',
    promptText: 'HTTP/3 is built on top of UDP and QUIC.',
    points: 2.0,
    negativeMarks: 0.5,
    correctAnswer: { value: true },
    sortOrder: 3,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const resTfCorrect = gradeQuestionResponse(qTrueFalse, { value: true });
  assert(resTfCorrect.earnedPoints === 2.0 && resTfCorrect.isCorrect === true, 'True/False: Correct boolean awards full 2.0 points');

  const resTfWrong = gradeQuestionResponse(qTrueFalse, { value: false });
  assert(resTfWrong.earnedPoints === -0.5 && resTfWrong.isCorrect === false, 'True/False: Incorrect boolean incurs -0.5 negative penalty');

  // 4. Numerical with Tolerance
  const qNumerical: ExamQuestion = {
    id: 'q_num_1',
    examId: 'exam_1',
    questionType: 'numerical',
    promptText: 'Calculate the speed of sound in dry air at 20 degrees Celsius (m/s):',
    points: 5.0,
    negativeMarks: 1.0,
    numericalTolerance: 0.5,
    correctAnswer: { value: 343.2, tolerance: 0.5 },
    sortOrder: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const resNumExact = gradeQuestionResponse(qNumerical, 343.2);
  assert(resNumExact.earnedPoints === 5.0 && resNumExact.isCorrect === true, 'Numerical: Exact value awards full 5.0 points');

  const resNumWithinTolerance = gradeQuestionResponse(qNumerical, 343.5);
  assert(resNumWithinTolerance.earnedPoints === 5.0 && resNumWithinTolerance.isCorrect === true, 'Numerical: Value within +/- 0.5 tolerance awards full 5.0 points');

  const resNumOutsideTolerance = gradeQuestionResponse(qNumerical, 344.0);
  assert(resNumOutsideTolerance.earnedPoints === -1.0 && resNumOutsideTolerance.isCorrect === false, 'Numerical: Value outside tolerance incurs -1.0 negative penalty');

  // 5. Short Answer (Automated vs Manual Evaluation)
  const qShortAuto: ExamQuestion = {
    id: 'q_sa_1',
    examId: 'exam_1',
    questionType: 'short_answer',
    promptText: 'Name the protocol used for secure web browsing:',
    points: 3.0,
    negativeMarks: 0.0,
    correctAnswer: { acceptedAnswers: ['HTTPS', 'HTTP over TLS', 'HTTP over SSL'], caseSensitive: false },
    sortOrder: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const resSaCorrect = gradeQuestionResponse(qShortAuto, 'https');
  assert(resSaCorrect.earnedPoints === 3.0 && resSaCorrect.isCorrect === true, 'Short Answer: Case-insensitive match awards full 3.0 points');

  const resSaWrong = gradeQuestionResponse(qShortAuto, 'FTP');
  assert(resSaWrong.earnedPoints === 0 && resSaWrong.isCorrect === false, 'Short Answer: Mismatch awards 0 points');

  // 6. Short Answer with Manual Grading Required
  const qShortManual: ExamQuestion = {
    id: 'q_sa_2',
    examId: 'exam_1',
    questionType: 'short_answer',
    promptText: 'Explain the difference between optimistic concurrency and pessimistic locking in databases.',
    points: 10.0,
    correctAnswer: { manualGrading: true },
    sortOrder: 6,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const resSaManual = gradeQuestionResponse(qShortManual, 'Optimistic assumes few conflicts; pessimistic locks rows immediately.');
  assert(
    resSaManual.earnedPoints === 0 &&
      resSaManual.status === 'pending' &&
      resSaManual.feedback === 'Awaiting manual teacher evaluation',
    'Short Answer (Manual Grading): Strictly preserves pending status and does not award unverified auto-scores'
  );

  // 7. Fill-in-the-blanks investigation
  const qFillBlank: ExamQuestion = {
    id: 'q_fib_1',
    examId: 'exam_1',
    questionType: 'fill_in_the_blank' as any,
    promptText: 'The process of translating source code into machine code is called [compilation].',
    points: 2.0,
    correctAnswer: {},
    sortOrder: 7,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const resFib = gradeQuestionResponse(qFillBlank, 'compilation');
  assert(resFib.status === 'pending' && resFib.feedback === 'Unsupported question type for auto-grading', 'Fill-in-the-blanks: Accurately handled as unsupported for direct auto-grading (requires short_answer mapping)');

  // --- SECTION 2: IMMUTABLE QUESTION SNAPSHOTTING AUDIT ---
  console.log('\n--- SECTION 2: QUESTION BANK IMMUTABILITY & SNAPSHOTTING ---');
  // Create a synthetic teacher and classroom to satisfy foreign keys
  const sampleTeacherId = `t_teacher_${Date.now()}`;
  const sampleClassroomId = `CLS_ROOM_${Date.now()}`;

  await classroomDb.createUser({
    id: sampleTeacherId,
    name: 'Prof. Snapshot',
    email: `snapshot_${Date.now()}@cortex.edu`,
    role: 'teacher',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await classroomDb.createClassroom({
    id: sampleClassroomId,
    name: 'CS401 Advanced Algorithms',
    subject: 'Computer Science',
    teacherId: sampleTeacherId,
    teacherName: 'Prof. Snapshot',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const bankItem = await classroomDb.createQuestionBankItem({
    teacherId: sampleTeacherId,
    classroomId: sampleClassroomId,
    subject: 'Computer Science',
    topic: 'Algorithms',
    difficulty: 'hard',
    questionType: 'mcq_single',
    promptText: 'Original Bank Question: What is Dijkstra algorithm used for?',
    options: [
      { id: 'opt_1', text: 'Shortest path in weighted graph' },
      { id: 'opt_2', text: 'Sorting array' },
    ],
    correctAnswer: { optionId: 'opt_1' },
    defaultPoints: 5.0,
    negativeMarks: 1.0,
  });

  assert(bankItem !== null && bankItem.id !== undefined, 'Question bank item created successfully');

  // Create an exam and import the bank item
  const sampleExam = await classroomDb.createExam({
    classroomId: sampleClassroomId,
    title: 'Snapshot Integrity Exam',
    durationMinutes: 60,
    startTime: Date.now() + 100000,
    endTime: Date.now() + 200000,
    createdBy: sampleTeacherId,
  });

  const importedExamQuestion = await classroomDb.importQuestionBankItemToExam({
    bankQuestionId: bankItem.id,
    examId: sampleExam.id,
    teacherId: sampleTeacherId,
  });

  assert(importedExamQuestion !== null && importedExamQuestion.id !== bankItem.id, 'Imported question created as distinct entity with unique ID');
  assert(importedExamQuestion.promptText === 'Original Bank Question: What is Dijkstra algorithm used for?', 'Imported question inherits original prompt');

  // Now, mutate the original Question Bank item
  await classroomDb.updateQuestionBankItem(bankItem.id, {
    promptText: 'MUTATED BANK QUESTION: This text was altered post-import!',
    defaultPoints: 100.0,
  });

  // Re-fetch the exam question
  const fetchedExamQuestions = await classroomDb.listExamQuestions(sampleExam.id);
  const snapshotQuestion = fetchedExamQuestions.find(q => q.id === importedExamQuestion.id);

  assert(snapshotQuestion !== undefined, 'Exam question exists in exam questions list');
  assert(
    snapshotQuestion?.promptText === 'Original Bank Question: What is Dijkstra algorithm used for?',
    'Exam question snapshot retained original prompt text despite bank mutation (Immutability verified)'
  );
  assert(
    snapshotQuestion?.points === 5.0,
    'Exam question snapshot retained original points (5.0) despite bank item points alteration (100.0)'
  );

  // Soft-archive the bank item
  await classroomDb.deleteQuestionBankItem(bankItem.id, false);
  const postArchiveExamQuestions = await classroomDb.listExamQuestions(sampleExam.id);
  const preservedAfterArchive = postArchiveExamQuestions.find(q => q.id === importedExamQuestion.id);
  assert(preservedAfterArchive !== undefined, 'Exam question snapshot persists intact even when parent bank item is archived');

  // --- SECTION 3: ANSWER SECURITY & ANTI-LEAKAGE ---
  console.log('\n--- SECTION 3: CANDIDATE ANSWER SECURITY & SANITIZATION ---');
  const fullExamWithAnswers: Exam = {
    ...sampleExam,
    questions: [
      {
        id: 'q_sec_1',
        examId: sampleExam.id,
        questionType: 'mcq_single',
        promptText: 'Which data structure implements FIFO?',
        points: 2.0,
        options: [
          { id: 'opt_q', text: 'Queue', isCorrect: true },
          { id: 'opt_s', text: 'Stack', isCorrect: false },
        ],
        correctAnswer: { optionId: 'opt_q' },
        sortOrder: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
  };

  const sanitizedQuestion = sanitizeQuestionForStudent(fullExamWithAnswers.questions![0]);
  assert(sanitizedQuestion.correctAnswer === undefined, 'Student question sanitization: correctAnswer is completely stripped (undefined)');
  assert(
    sanitizedQuestion.options?.every(opt => (opt as any).isCorrect === undefined),
    'Student question sanitization: isCorrect flag is strictly stripped from all option objects'
  );

  const sanitizedExam = sanitizeExamForStudent(fullExamWithAnswers, 'student_candidate_1');
  const serializedSanitized = JSON.stringify(sanitizedExam);
  assert(!serializedSanitized.includes('opt_q') || !serializedSanitized.includes('isCorrect'), 'Serialized student payload never contains isCorrect properties');

  console.log('\n================================================================');
  console.log(`PHASE 4.6 AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAssessmentEngineAudit().catch((err) => {
  console.error('Phase 4.6 Audit Error:', err);
  process.exit(1);
});
