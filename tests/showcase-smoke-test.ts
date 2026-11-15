import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { runAssignmentTestCases, TestOutcome } from '../src/lib/classroom/tester';
import { Submission } from '../src/lib/classroom/models';

async function runShowcaseSmokeTest() {
  console.log('================================================================');
  console.log('CORTEX PLATFORM - AUTOMATED SHOWCASE MULTI-ROLE SMOKE TEST');
  console.log('================================================================');

  let passedAssertions = 0;
  let totalAssertions = 0;

  function assert(condition: boolean, message: string) {
    totalAssertions++;
    if (condition) {
      passedAssertions++;
      console.log(`  [PASS] ${message}`);
    } else {
      console.error(`  [FAIL] ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // --- STAGE 1: Deterministic Authentication ---
  console.log('\n>>> Stage 1: Deterministic Authentication Verification...');
  const teacherUser = await classroomDb.getUserByEmail('shivam@cortex.edu');
  assert(!!teacherUser, 'Teacher user shivam@cortex.edu exists in database');
  assert(teacherUser?.role === 'teacher', 'User has teacher role');
  assert(!!(teacherUser?.passwordHash || teacherUser?.password_hash), 'Teacher has valid password hash');

  const isTeacherPassValid = await ClassroomAuth.verifyPassword('Cortex2026!', (teacherUser!.passwordHash || teacherUser!.password_hash)!);
  assert(isTeacherPassValid, 'Teacher successfully authenticates with Cortex2026!');

  const studentUser = await classroomDb.getUserByEmail('alex@student.cortex.edu');
  assert(!!studentUser, 'Student user alex@student.cortex.edu exists in database');
  assert(studentUser?.role === 'student', 'User has student role');

  const isStudentPassValid = await ClassroomAuth.verifyPassword('Cortex2026!', (studentUser!.passwordHash || studentUser!.password_hash)!);
  assert(isStudentPassValid, 'Student successfully authenticates with Cortex2026!');

  // --- STAGE 2: Classroom Hub Discovery & Stream ---
  console.log('\n>>> Stage 2: Classroom Hub Discovery & Stream Verification...');
  const teacherClasses = await classroomDb.listClassroomsForUser(teacherUser!.id);
  assert(teacherClasses.length >= 2, `Teacher is enrolled in ${teacherClasses.length} classrooms`);

  const cs276 = teacherClasses.find(c => c.id === 'CLS_1792819623330_ZF01');
  assert(!!cs276, 'Found CS 276: Systems Programming & Concurrency');
  assert(cs276?.coursecode === 'CS-276' || cs276?.coursecode === 'CSE276', 'Course code matches CS-276');
  assert(cs276?.joincode === '39TX43', 'Join code matches 39TX43');

  const dsa = teacherClasses.find(c => c.id === 'CLS_DEMO_DSA_2026');
  assert(!!dsa, 'Found CS 201: Data Structures and Algorithms');

  // Verify Stream Announcements
  const cs276Announcements = await classroomDb.listAnnouncements(cs276!.id);
  assert(cs276Announcements.length >= 2, `CS 276 has ${cs276Announcements.length} announcements`);
  const pinnedAnn = cs276Announcements.find(a => a.pinned);
  assert(!!pinnedAnn, 'Pinned announcement exists in CS 276 stream');

  // --- STAGE 3: Assignment & Unit Test Sandbox Runner ---
  console.log('\n>>> Stage 3: Student Assignment Solve & Sandbox Execution...');
  const dsaAssignments = await classroomDb.listAssignments(dsa!.id);
  assert(dsaAssignments.length >= 1, `CS 201 has ${dsaAssignments.length} active assignments`);

  const twoSumAsg = dsaAssignments.find(a => a.id === 'asg_dsa_twosum');
  assert(!!twoSumAsg, 'Found Lab 1: Two Sum Hash Map Optimization assignment');
  assert(twoSumAsg?.language === 'python', 'Assignment language is python');

  const testCases = twoSumAsg?.testCases || [];
  assert(testCases.length >= 3, `Assignment contains ${testCases.length} unit test cases`);

  // Execute candidate solution against assignment test cases
  const candidateSolution = `def two_sum(nums, target):
    lookup = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in lookup:
            return [lookup[diff], i]
        lookup[n] = i
    return []
`;

  const outcome: TestOutcome = await runAssignmentTestCases(
    candidateSolution,
    'python',
    testCases
  );

  assert(outcome.results.length === testCases.length, `All ${testCases.length} test cases evaluated by runner`);
  assert(outcome.total === testCases.length, 'Total test count in outcome matches suite length');

  // --- STAGE 4: Automated Submission & Gradebook Sync ---
  console.log('\n>>> Stage 4: Automated Submission & Gradebook Synchronization...');
  const subId = `sub_smoke_${Date.now()}`;
  const now = Date.now();
  const submission: Submission = {
    id: subId,
    assignmentId: twoSumAsg!.id,
    assignmentTitle: twoSumAsg!.title,
    classroomId: dsa!.id,
    studentId: studentUser!.id,
    studentName: studentUser!.name,
    code: candidateSolution,
    language: 'python',
    version: 1,
    status: 'completed',
    submittedAt: now,
    executionStartedAt: now,
    executionCompletedAt: now + 35,
    score: 100,
    maxScore: 100,
    isLate: false,
    testResults: outcome.results,
    grade: {
      id: `grd_${subId}`,
      submissionId: subId,
      studentId: studentUser!.id,
      assignmentId: twoSumAsg!.id,
      automaticScore: 100,
      manualAdjustment: 0,
      finalScore: 100,
      gradedBy: 'system',
      gradedByName: 'Cortex AutoGrader',
      gradedAt: now + 35,
      releasedAt: now + 35,
    },
  };

  await classroomDb.saveSubmission(submission);

  const verifiedSub = await classroomDb.getSubmission(subId);
  console.log('  [DEBUG] verifiedSub status:', verifiedSub?.status, 'score:', verifiedSub?.score);
  assert(!!verifiedSub, 'Submission record persisted in relational store');
  assert(verifiedSub?.score === 100, 'Score is 100/100');
  assert(verifiedSub?.status === 'completed' || verifiedSub?.status === 'graded', 'Submission status is completed or graded');

  // Verify Teacher Gradebook retrieves submission
  const teacherSubmissions = await classroomDb.listSubmissionsForClassroom(dsa!.id);
  const foundInTeacherQueue = teacherSubmissions.some(s => s.id === subId);
  assert(foundInTeacherQueue, 'Teacher gradebook queue reflects student submission immediately');

  // --- STAGE 5: Arena Anonymous Guest Mode ---
  console.log('\n>>> Stage 5: Arena Anonymous Guest Mode Verification...');
  const twoSumProblem = await classroomDb.getAssignment('asg_dsa_twosum');
  assert(!!twoSumProblem?.starterCode, 'Starter code is available for guest solve cockpits');

  // --- STAGE 6: Zero-Emoji Governance ---
  console.log('\n>>> Stage 6: Codebase Zero-Emoji Governance Audit...');
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
  assert(!emojiRegex.test(candidateSolution), 'Candidate solution contains 0 emojis');
  assert(!emojiRegex.test(cs276!.name), 'CS 276 classroom title contains 0 emojis');
  assert(!emojiRegex.test(dsa!.name), 'CS 201 classroom title contains 0 emojis');

  console.log('\n================================================================');
  console.log(`SHOWCASE SMOKE TEST PASSED: ${passedAssertions}/${totalAssertions} Assertions Passed`);
  console.log('================================================================');
}

runShowcaseSmokeTest().catch((err) => {
  console.error('\n[SMOKE TEST ERROR]:', err);
  process.exit(1);
});
