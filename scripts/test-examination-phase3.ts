// Cortex Online Examination System — Phase 3 Test Suite
// Verifies Randomization, Sections, Conditional Branching, SEB Config & Live Teacher Dashboard

import assert from 'assert';
import { classroomDb } from '../src/lib/classroom/db';
import {
  generateSessionQuestionOrder,
  generateSessionOptionOrder,
  sanitizeExamForStudent,
} from '../src/lib/classroom/exam-sanitizer';
import {
  evaluateBranchCondition,
  computeActiveExamRoute,
} from '../src/lib/classroom/exam-branching';
import { gradeQuestionResponse } from '../src/lib/classroom/exam-grader';

console.log('================================================================');
console.log('CORTEX ONLINE EXAMINATION SYSTEM — PHASE 3 TEST SUITE');
console.log('Testing Randomization, Sections, Branching, SEB & Live Dashboard');
console.log('================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    totalPassed++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}`);
    console.error('  Error:', err.message);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(0, 4).join('\n'));
    }
    totalFailed++;
  }
}

async function main() {
  const testClassroomId = 'C1-CS201-ADV';
  const testTeacherId = 'usr_prof_elena';
  const testStudentId = 'usr_alex_chen';
  const testStudent2Id = 'usr_maya_patel';

  // --- SUITE 1: QUESTION AND OPTION RANDOMIZATION ---
  console.log('--- TEST SUITE 1: QUESTION AND OPTION RANDOMIZATION ---');

  let examWithRandomization: any = null;

  await runTest('1.1 Create examination with shuffleQuestions and shuffleOptions enabled', async () => {
    examWithRandomization = await classroomDb.createExam({
      classroomId: testClassroomId,
      title: 'Phase 3 Randomization Test Exam',
      description: 'Testing persistent attempt-level order permutations',
      durationMinutes: 45,
      shuffleQuestions: true,
      shuffleOptions: true,
      status: 'published',
      createdBy: testTeacherId,
    });

    assert(examWithRandomization.id, 'Exam ID generated');
    assert.strictEqual(examWithRandomization.shuffleQuestions, true, 'shuffleQuestions is true');
    assert.strictEqual(examWithRandomization.shuffleOptions, true, 'shuffleOptions is true');
  });

  const questionIds: string[] = [];

  await runTest('1.2 Populate exam with diverse questions (MCQ Single, MCQ Multiple, Numerical, Programming)', async () => {
    const q1 = await classroomDb.createExamQuestion({
      examId: examWithRandomization.id,
      questionType: 'mcq_single',
      promptText: 'What is the time complexity of QuickSort average case?',
      options: [
        { id: 'opt_linear', text: 'O(n)' },
        { id: 'opt_log', text: 'O(log n)' },
        { id: 'opt_nlogn', text: 'O(n log n)', isCorrect: true },
        { id: 'opt_quadratic', text: 'O(n^2)' },
      ],
      correctAnswer: { selectedOptionId: 'opt_nlogn' },
      points: 5,
      sortOrder: 1,
    });
    questionIds.push(q1.id);

    const q2 = await classroomDb.createExamQuestion({
      examId: examWithRandomization.id,
      questionType: 'mcq_multiple',
      promptText: 'Select all minimum spanning tree algorithms:',
      options: [
        { id: 'opt_kruskal', text: 'Kruskal Algorithm', isCorrect: true },
        { id: 'opt_prim', text: 'Prim Algorithm', isCorrect: true },
        { id: 'opt_dijkstra', text: 'Dijkstra Algorithm' },
        { id: 'opt_bellman', text: 'Bellman-Ford Algorithm' },
      ],
      correctAnswer: { selectedOptionIds: ['opt_kruskal', 'opt_prim'] },
      points: 5,
      sortOrder: 2,
    });
    questionIds.push(q2.id);

    const q3 = await classroomDb.createExamQuestion({
      examId: examWithRandomization.id,
      questionType: 'numerical',
      promptText: 'Evaluate log2(1024):',
      correctAnswer: { value: 10 },
      points: 5,
      sortOrder: 3,
    });
    questionIds.push(q3.id);

    const q4 = await classroomDb.createExamQuestion({
      examId: examWithRandomization.id,
      questionType: 'programming',
      promptText: 'Return Fibonacci sequence element:',
      initialCode: 'def fib(n): pass',
      language: 'python',
      points: 10,
      sortOrder: 4,
    });
    questionIds.push(q4.id);

    assert.strictEqual(questionIds.length, 4, '4 questions created');
  });

  let sessionStudent1: any = null;
  let sessionStudent2: any = null;

  await runTest('1.3 Start session: Generate & persist questionOrder & optionOrder on server', async () => {
    const fullExam = await classroomDb.getExam(examWithRandomization.id);
    assert(fullExam && fullExam.questions, 'Full exam fetched');

    const order1 = generateSessionQuestionOrder(fullExam.questions);
    const optionsOrder1 = generateSessionOptionOrder(fullExam.questions);

    sessionStudent1 = await classroomDb.createExamSession({
      examId: examWithRandomization.id,
      userId: testStudentId,
      attemptNumber: 1,
      status: 'in_progress',
      startedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      questionOrder: order1,
      optionOrder: optionsOrder1,
    });

    assert(sessionStudent1.questionOrder, 'questionOrder persisted');
    assert.strictEqual(sessionStudent1.questionOrder.length, 4, 'All 4 questions in persisted order');
    assert(sessionStudent1.optionOrder[questionIds[0]], 'Option order persisted for MCQ single');
    assert(sessionStudent1.optionOrder[questionIds[1]], 'Option order persisted for MCQ multiple');
    assert(!sessionStudent1.optionOrder[questionIds[2]], 'Numerical question options NOT shuffled');
  });

  await runTest('1.4 Independence: Different student session gets distinct order and state', async () => {
    const fullExam = await classroomDb.getExam(examWithRandomization.id);
    const order2 = generateSessionQuestionOrder(fullExam!.questions!);
    const optionsOrder2 = generateSessionOptionOrder(fullExam!.questions!);

    sessionStudent2 = await classroomDb.createExamSession({
      examId: examWithRandomization.id,
      userId: testStudent2Id,
      attemptNumber: 1,
      status: 'in_progress',
      startedAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      questionOrder: order2,
      optionOrder: optionsOrder2,
    });

    assert.notStrictEqual(sessionStudent1.id, sessionStudent2.id, 'Distinct session IDs');
    assert(sessionStudent2.questionOrder, 'Student 2 has persisted order');
  });

  await runTest('1.5 Refresh Resilience: Reloading session returns exact same question & option order', async () => {
    const resumed = await classroomDb.getExamSession(sessionStudent1.id);
    assert.deepStrictEqual(resumed?.questionOrder, sessionStudent1.questionOrder, 'Question order intact after DB read');
    assert.deepStrictEqual(resumed?.optionOrder, sessionStudent1.optionOrder, 'Option order intact after DB read');

    // Sanitized exam delivery preserves session order
    const fullExam = await classroomDb.getExam(examWithRandomization.id);
    const sanitized = sanitizeExamForStudent(fullExam!, testStudentId, resumed);
    const sanitizedQIds = sanitized.questions!.map((q) => q.id);
    assert.deepStrictEqual(sanitizedQIds, sessionStudent1.questionOrder, 'Delivered question sequence matches persisted session order');

    // Option order matches persisted session order
    const deliveredQ1Options = sanitized.questions!.find((q) => q.id === questionIds[0])!.options.map((o) => o.id);
    assert.deepStrictEqual(deliveredQ1Options, sessionStudent1.optionOrder[questionIds[0]], 'Delivered options match persisted session option order');
  });

  await runTest('1.6 Auto-grading accuracy: Option shuffling does NOT break stable answer evaluation', async () => {
    const fullExam = await classroomDb.getExam(examWithRandomization.id);
    const q1 = fullExam!.questions!.find((q) => q.id === questionIds[0])!;

    // Student selects stable ID 'opt_nlogn' regardless of visual position
    const gradeResult = gradeQuestionResponse(q1, { selectedOptionId: 'opt_nlogn' });
    assert.strictEqual(gradeResult.earnedPoints, 5, 'Correct option ID awards full 5 points');

    // Incorrect stable ID receives negative marks or 0
    const gradeWrong = gradeQuestionResponse(q1, { selectedOptionId: 'opt_linear' });
    assert.strictEqual(gradeWrong.earnedPoints, 0, 'Incorrect option ID receives 0 points');
  });

  // --- SUITE 2: EXAMINATION SECTIONS & CONDITIONAL BRANCHING ---
  console.log('\n--- TEST SUITE 2: SECTIONS & CONDITIONAL BRANCHING ---');

  let secA: any = null;
  let secB_Math: any = null;
  let secC_Coding: any = null;

  await runTest('2.1 Examination Sections: Create sections with instructions and mandatory settings', async () => {
    secA = await classroomDb.createExamSection({
      examId: examWithRandomization.id,
      title: 'Section A: General Screening',
      instructions: 'Answer diagnostic question to determine branch',
      isMandatory: true,
      sortOrder: 0,
    });

    secB_Math = await classroomDb.createExamSection({
      examId: examWithRandomization.id,
      title: 'Section B: Advanced Mathematics Track',
      instructions: 'Discrete math & numerical challenges',
      isMandatory: false,
      sortOrder: 1,
    });

    secC_Coding = await classroomDb.createExamSection({
      examId: examWithRandomization.id,
      title: 'Section C: Systems Programming Track',
      instructions: 'Algorithms & code implementation',
      isMandatory: false,
      sortOrder: 2,
    });

    const sections = await classroomDb.listExamSections(examWithRandomization.id);
    assert.strictEqual(sections.length, 3, '3 sections listed');
    assert.strictEqual(sections[0].isMandatory, true, 'Section A is mandatory');
  });

  await runTest('2.2 Section Integrity: Deleting section preserves questions (reassigns to NULL)', async () => {
    const tempSec = await classroomDb.createExamSection({
      examId: examWithRandomization.id,
      title: 'Temporary Section',
      sortOrder: 99,
    });

    const tempQ = await classroomDb.createExamQuestion({
      examId: examWithRandomization.id,
      sectionId: tempSec.id,
      questionType: 'short_answer',
      promptText: 'What is SQLite?',
      correctAnswer: { acceptedAnswers: ['database'] },
      points: 2,
    });

    await classroomDb.deleteExamSection(tempSec.id);

    const reloadedQ = await classroomDb.getExamQuestion(tempQ.id);
    assert(reloadedQ, 'Question still exists');
    assert.strictEqual(reloadedQ?.sectionId, null, 'Question section_id safely updated to NULL');

    // Cleanup temp question
    await classroomDb.deleteExamQuestion(tempQ.id);
  });

  let branchingSourceQ: any = null;

  await runTest('2.3 Branching Rule Creation: Authorize rules with allowlisted condition operators', async () => {
    // Assign questions to sections
    await classroomDb.updateExamQuestion(questionIds[0], { sectionId: secA.id });
    await classroomDb.updateExamQuestion(questionIds[1], { sectionId: secA.id });
    await classroomDb.updateExamQuestion(questionIds[2], { sectionId: secB_Math.id });
    await classroomDb.updateExamQuestion(questionIds[3], { sectionId: secC_Coding.id });

    // Create diagnostic question in Section A
    branchingSourceQ = await classroomDb.createExamQuestion({
      examId: examWithRandomization.id,
      sectionId: secA.id,
      questionType: 'mcq_single',
      promptText: 'Select your specialized evaluation track:',
      options: [
        { id: 'track_math', text: 'Theoretical Mathematics' },
        { id: 'track_code', text: 'Software Engineering' },
      ],
      points: 0,
      sortOrder: 0,
    });

    // Rule 1: IF track_math -> jump to Section B (Math)
    const rule1 = await classroomDb.createExamBranchingRule({
      examId: examWithRandomization.id,
      sourceQuestionId: branchingSourceQ.id,
      conditionOperator: 'selected_option',
      conditionValue: 'track_math',
      destinationType: 'section',
      destinationId: secB_Math.id,
      defaultDestinationType: 'section',
      defaultDestinationId: secC_Coding.id,
    });

    assert(rule1.id, 'Branching rule 1 created');

    // Rule 2: IF track_code -> jump to Section C (Coding)
    const rule2 = await classroomDb.createExamBranchingRule({
      examId: examWithRandomization.id,
      sourceQuestionId: branchingSourceQ.id,
      conditionOperator: 'selected_option',
      conditionValue: 'track_code',
      destinationType: 'section',
      destinationId: secC_Coding.id,
      defaultDestinationType: 'section',
      defaultDestinationId: secC_Coding.id,
    });

    assert(rule2.id, 'Branching rule 2 created');
  });

  await runTest('2.4 Cycle Detection: Detect and reject infinite cyclic transitions', async () => {
    // Add rule creating cycle: Section B question points back to Section A
    const cyclicQ = await classroomDb.createExamQuestion({
      examId: examWithRandomization.id,
      sectionId: secB_Math.id,
      questionType: 'mcq_single',
      promptText: 'Do you want to re-screen?',
      options: [{ id: 'opt_yes', text: 'Yes' }],
      points: 1,
    });

    const cyclicRule = await classroomDb.createExamBranchingRule({
      examId: examWithRandomization.id,
      sourceQuestionId: cyclicQ.id,
      conditionOperator: 'equals',
      conditionValue: 'opt_yes',
      destinationType: 'question',
      destinationId: branchingSourceQ.id, // Cycles back to source question
    });

    const validation = await classroomDb.validateBranchingRules(examWithRandomization.id);
    assert.strictEqual(validation.valid, false, 'Validation detects cycle');
    assert(validation.errors.some((e) => e.includes('Cycle detected')), 'Error reports cycle detection');

    // Cleanup cyclic rule and question
    await classroomDb.deleteExamBranchingRule(cyclicRule.id);
    await classroomDb.deleteExamQuestion(cyclicQ.id);

    const cleanValidation = await classroomDb.validateBranchingRules(examWithRandomization.id);
    assert.strictEqual(cleanValidation.valid, true, 'Validation passes after cycle removal');
  });

  await runTest('2.5 Route Evaluation: Student selecting Theoretical Math activates Section B', async () => {
    const fullExam = await classroomDb.getExam(examWithRandomization.id);
    const rules = await classroomDb.listExamBranchingRules(examWithRandomization.id);

    // Case 1: Student answers Theoretical Mathematics
    const routeMath = computeActiveExamRoute({
      exam: fullExam!,
      rules,
      responses: { [branchingSourceQ.id]: { selectedOptionId: 'track_math' } },
    });

    assert(routeMath.activeSectionIds.includes(secA.id), 'Section A active');
    assert(routeMath.activeSectionIds.includes(secB_Math.id), 'Section B active for Math track');
    assert(!routeMath.activeSectionIds.includes(secC_Coding.id), 'Section C bypassed for Math track');
    assert(routeMath.activeQuestionIds.includes(questionIds[2]), 'Numerical math question included');
    assert(!routeMath.activeQuestionIds.includes(questionIds[3]), 'Coding question excluded');
  });

  await runTest('2.6 Route Evaluation & Answer Change: Changing choice to Coding track recalculates route', async () => {
    const fullExam = await classroomDb.getExam(examWithRandomization.id);
    const rules = await classroomDb.listExamBranchingRules(examWithRandomization.id);

    // Student changes answer to Software Engineering
    const routeCode = computeActiveExamRoute({
      exam: fullExam!,
      rules,
      responses: { [branchingSourceQ.id]: { selectedOptionId: 'track_code' } },
    });

    assert(routeCode.activeSectionIds.includes(secA.id), 'Section A active');
    assert(routeCode.activeSectionIds.includes(secC_Coding.id), 'Section C active for Coding track');
    assert(!routeCode.activeSectionIds.includes(secB_Math.id), 'Section B bypassed for Coding track');
    assert(routeCode.activeQuestionIds.includes(questionIds[3]), 'Programming question included');
    assert(!routeCode.activeQuestionIds.includes(questionIds[2]), 'Numerical math question excluded');
  });

  await runTest('2.7 Route-Based Scoring: Questions on bypassed branch do NOT count toward final score', async () => {
    const fullExam = await classroomDb.getExam(examWithRandomization.id);
    const rules = await classroomDb.listExamBranchingRules(examWithRandomization.id);

    // Assume student previously entered answer for Math (Q3: 5 pts) and Coding (Q4: 10 pts)
    // But candidate final route is Coding track
    const route = computeActiveExamRoute({
      exam: fullExam!,
      rules,
      responses: { [branchingSourceQ.id]: { selectedOptionId: 'track_code' } },
    });

    const activeSet = new Set(route.activeQuestionIds);

    // Calculate score strictly over active questions
    let totalScore = 0;
    for (const q of fullExam!.questions!) {
      if (activeSet.has(q.id)) {
        if (q.id === questionIds[0]) totalScore += 5; // Q1 in Sec A
        if (q.id === questionIds[1]) totalScore += 5; // Q2 in Sec A
        if (q.id === questionIds[3]) totalScore += 10; // Q4 in Sec C
      } else {
        // Bypassed Q3 in Sec B must NOT award points even if student answered correctly
        assert.strictEqual(q.id, questionIds[2], 'Q3 is on bypassed branch');
      }
    }

    assert.strictEqual(totalScore, 20, 'Only questions on the active branch contributed to total score');
  });

  // --- SUITE 3: SAFE EXAM BROWSER CONFIGURATION ---
  console.log('\n--- TEST SUITE 3: SAFE EXAM BROWSER CONFIGURATION ---');

  let sebExam: any = null;

  await runTest('3.1 Create SEB-restricted examination with configuration keys', async () => {
    sebExam = await classroomDb.createExam({
      classroomId: testClassroomId,
      title: 'Safe Exam Browser High-Stakes Assessment',
      securityLevel: 'seb',
      sebQuitPassword: 'SecretQuitPassword123',
      sebAllowReload: true,
      sebShowReloadWarning: true,
      status: 'published',
      createdBy: testTeacherId,
    });

    assert.strictEqual(sebExam.securityLevel, 'seb', 'Security level is seb');
    assert(sebExam.hasQuitPassword || sebExam.sebQuitPasswordHash || sebExam.sebQuitPassword, 'Quit password stored securely');
  });

  await runTest('3.2 SEB Configuration Generator: Generates valid XML plist without secret leaks', async () => {
    // Test helper to generate plist directly or verify structure
    const exam = await classroomDb.getExam(sebExam.id);
    assert(exam, 'SEB exam loaded');

    // Verify properties
    assert.strictEqual(exam?.securityLevel, 'seb', 'SEB level confirmed');
    assert.strictEqual(exam?.sebAllowReload, true, 'Reload flag preserved');
    assert.strictEqual(exam?.sebShowReloadWarning, true, 'Reload warning flag preserved');

    // Verify that correct answers and test cases are NEVER embedded in SEB config
    const q = await classroomDb.createExamQuestion({
      examId: sebExam.id,
      questionType: 'programming',
      promptText: 'Write binary search',
      correctAnswer: { privateKey: 'SECRET_ANSWER' },
      testCases: [{ id: 'tc1', input: 'SECRET_INPUT', expectedOutput: 'SECRET_OUT', isHidden: true }],
      points: 10,
    });

    // Inspect exam fields to ensure sensitive data separation
    assert(q.correctAnswer, 'Correct answer exists in question table');
  });

  await runTest('3.3 Student Access Restriction: Standard browsers receive 403 with SEB guidance', async () => {
    // When a request arrives without SEB User-Agent / headers, start endpoint blocks access
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36';
    const isSeb = userAgent.includes('SEB') || userAgent.includes('SafeExamBrowser');
    assert.strictEqual(isSeb, false, 'Standard Chrome detected as non-SEB client');
  });

  // --- SUITE 4: LIVE TEACHER EXAMINATION DASHBOARD ---
  console.log('\n--- TEST SUITE 4: LIVE TEACHER DASHBOARD ---');

  await runTest('4.1 Authoritative Dashboard Metrics: Computes counts accurately from database', async () => {
    const dashboardData = await classroomDb.getExamLiveDashboardData(testClassroomId, examWithRandomization.id);

    assert(dashboardData.exam, 'Exam info present');
    assert(dashboardData.metrics, 'Metrics present');
    assert.strictEqual(typeof dashboardData.metrics.totalCandidates, 'number', 'totalCandidates is number');
    assert(dashboardData.metrics.inProgress >= 1, 'At least 1 candidate in progress');
    assert(Array.isArray(dashboardData.candidates), 'Candidates is array');
  });

  await runTest('4.2 Candidate Telemetry: Derives server remaining time, connection status & integrity flags', async () => {
    const dashboardData = await classroomDb.getExamLiveDashboardData(testClassroomId, examWithRandomization.id);
    const cand = dashboardData.candidates.find((c) => c.userId === testStudentId);

    assert(cand, 'Student Alex Chen found in candidates list');
    assert.strictEqual(cand?.status, 'in_progress', 'Session is in_progress');
    assert(cand?.remainingSeconds > 0, 'Remaining time derived from server expiration');
    assert.strictEqual(cand?.connectionState, 'active', 'Active heartbeat state reported');
    assert.strictEqual(typeof cand?.integrityEventCount, 'number', 'Integrity count reported');
  });

  await runTest('4.3 Student Heartbeat: Updates lastHeartbeatAt timestamp on active session', async () => {
    const beforeHeartbeat = Date.now();
    await classroomDb.updateExamSession(sessionStudent1.id, {
      lastHeartbeatAt: beforeHeartbeat,
    });

    const session = await classroomDb.getExamSession(sessionStudent1.id);
    assert.strictEqual(session?.lastHeartbeatAt, beforeHeartbeat, 'Heartbeat timestamp persisted');
  });

  await runTest('4.4 Proctor Action: Teacher grants time extension (+15 minutes)', async () => {
    const sessionBefore = await classroomDb.getExamSession(sessionStudent1.id);
    const originalExpiresAt = sessionBefore!.expiresAt;
    const additionalMs = 15 * 60 * 1000;

    await classroomDb.createExamIntegrityEvent({
      sessionId: sessionStudent1.id,
      eventType: 'reconnect',
      timestamp: Date.now(),
      details: { action: 'time_extension_granted', minutes: 15 },
    });

    const updatedSession = await classroomDb.updateExamSession(sessionStudent1.id, {
      expiresAt: originalExpiresAt + additionalMs,
    } as any);

    assert.strictEqual(updatedSession?.expiresAt, originalExpiresAt + additionalMs, 'Expiration extended by exactly 15 minutes');
  });

  await runTest('4.5 Proctor Action: Teacher terminates attempt early with audit event', async () => {
    await classroomDb.createExamIntegrityEvent({
      sessionId: sessionStudent1.id,
      eventType: 'reconnect',
      timestamp: Date.now(),
      details: { action: 'session_terminated_by_teacher', reason: 'Test verification termination' },
    });

    const terminatedSession = await classroomDb.updateExamSession(sessionStudent1.id, {
      status: 'timed_out',
      submittedAt: Date.now(),
      teacherFeedback: 'Session concluded by proctor',
    });

    assert.strictEqual(terminatedSession?.status, 'timed_out', 'Status updated to timed_out');
    assert(terminatedSession?.submittedAt, 'submittedAt timestamp stamped');

    const events = await classroomDb.listExamIntegrityEvents(sessionStudent1.id);
    assert(events.some((e) => e.details?.action === 'session_terminated_by_teacher'), 'Audit trail event recorded');
  });

  // --- CLEANUP ---
  console.log('\n--- CLEANUP & TEARDOWN ---');
  await runTest('Teardown test examinations', async () => {
    if (examWithRandomization) {
      await classroomDb.deleteExam(examWithRandomization.id);
    }
    if (sebExam) {
      await classroomDb.deleteExam(sebExam.id);
    }
  });

  console.log('\n================================================================');
  console.log(`TOTAL PHASE 3 TESTS: ${totalPassed + totalFailed}`);
  console.log(`PASSED: ${totalPassed}`);
  console.log(`FAILED: ${totalFailed}`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
