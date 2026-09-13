import { classroomDb } from '../src/lib/classroom/db';
import { arenaDb } from '../src/lib/arena/db';
import { NextRequest } from 'next/server';
import { GET as getDashboard } from '../src/app/api/v1/auth/me/dashboard/route';
import { POST as postGrade } from '../src/app/api/v1/classrooms/[id]/submissions/[subId]/grade/route';

async function mockReq(method: string, url: string, headers: Record<string, string>, body?: any) {
  const reqHeaders = new Headers(headers);
  if (headers["x-user-id"]) {
    const uId = headers["x-user-id"];
    const sessId = "sess-" + uId;
    try {
      await classroomDb.createSession(sessId, uId, Date.now() + 1000000);
    } catch(e) {}
    reqHeaders.set('cookie', `cortex_session=${sessId}`);
  }
  return new NextRequest(new URL(url), {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runTests() {
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      passed++;
      console.log("PASS: " + msg);
    } else {
      console.error("FAIL: " + msg);
    }
  }

  console.log("\n=== PHASE 2F: GRADES AND ANALYTICS ===\n");

  const tId = "p2f-teacher-" + Date.now();
  const sId = "p2f-student-" + Date.now();
  const cId = "p2f-class-" + Date.now();
  await classroomDb.createUser({ id: tId, name: "Teacher", email: "t@t.com", password: "", role: "teacher", status: "active", createdAt: Date.now(), updatedAt: Date.now() });
  await classroomDb.createUser({ id: sId, name: "Student", email: "s@s.com", password: "", role: "student", status: "active", createdAt: Date.now(), updatedAt: Date.now() });

  await classroomDb.createClassroom({
    id: cId,
    name: "P2F Class",
    teacherId: tId,
    teacherName: "Teacher"
  });
  await classroomDb.addMember({
    id: "mem-test-" + Date.now(),
    classroomId: cId,
    userId: sId,
    name: "Student",
    role: "student",
    status: "active",
    joinedAt: Date.now(),
    isOnline: true
  });
  const aId = "p2f-asg-" + Date.now();
  await classroomDb.createAssignment({
    id: aId,
    classroomId: cId,
    title: "Test",
    description: "",
    instructions: "",
    type: "coding",
    language: "python",
    startercode: "",
    difficulty: "Beginner",
    testCases: [],
    maxMarks: 100,
    dueAt: Date.now() + 100000,
    publishedAt: Date.now(),
    scheduledAt: null,
    attemptsAllowed: 1,
    allowLateSubmission: false,
    latePenaltyPercent: 0,
    autoGrade: false,
    manualGrade: true,
    aiPolicy: "full",
    plagiarismPolicy: "disabled",
    status: "published",
    createdBy: tId,
    createdAt: Date.now(),
    updatedAt: Date.now()
  } as any);

  const subId = "p2f-sub-" + Date.now();
  await classroomDb.saveSubmission({
    id: subId,
    assignmentId: aId,
    assignmentTitle: "Test",
    classroomId: cId,
    studentId: sId,
    studentName: "Student",
    projectId: "",
    language: "python",
    code: "",
    version: 1,
    status: "completed",
    score: 50,
    maxScore: 100,
    isLate: false,
    submittedAt: Date.now(),
  } as any);

  const analytics = await classroomDb.getClassroomAnalytics(cId);
  assert(analytics.averageScore === 50, "Analytics: averageScore includes completed submissions");
  assert(analytics.completionRate === 100, "Analytics: completionRate is 100%");
  assert(Array.isArray(analytics.recentTrend) && analytics.recentTrend.length === 12, "Analytics: recentTrend is 12 elements");
  assert(analytics.recentTrend![11] === 100, "Analytics: recentTrend[11] is 100");

  const reqStudentGrade = await mockReq("POST", `http://localhost/api/v1/classrooms/${cId}/submissions/${subId}/grade`, {
    "x-user-id": sId,
    "x-user-name": "Student",
  }, {
    finalScore: 99,
    feedback: "Good job me",
  });
  const resStudentGrade = await postGrade(reqStudentGrade, { params: { id: cId, subId } } as any);
  console.log("Student Grade Status:", resStudentGrade.status);
  assert(resStudentGrade.status === 403, "Student cannot grade their own submission");

  const reqTeacherGrade = await mockReq("POST", `http://localhost/api/v1/classrooms/${cId}/submissions/${subId}/grade`, {
    "x-user-id": tId,
    "x-user-name": "Teacher",
  }, {
    finalScore: 95,
    feedback: "Excellent",
  });
  const resTeacherGrade = await postGrade(reqTeacherGrade, { params: { id: cId, subId } } as any);
  console.log("Teacher Grade Status:", resTeacherGrade.status);
  assert(resTeacherGrade.status === 200, "Teacher can grade submission");

  const gradedSub = await classroomDb.getSubmission(subId);
  assert(gradedSub?.grade?.finalScore === 95, "Grade was saved to DB");

  const chId = "p2f-chall-" + Date.now();
  await arenaDb.createSubmission({
    id: "p2f-arenasub-" + Date.now(),
    challengeId: chId,
    userId: sId,
    language: "python",
    sourceCode: "",
    status: "PASSED",
    score: 100,
    executionTimeMs: 10,
    memoryUsageMb: 5,
    error: "",
    testSummary: "{}",
    createdAt: Date.now(),
  } as any);

  const reqDash = await mockReq("GET", "http://localhost/api/v1/auth/me/dashboard", {
    "x-user-id": sId,
    "x-user-name": "Student",
  });
  const resDash = await getDashboard(reqDash);
  const dashData = await resDash.json();
  assert(resDash.status === 200, "Dashboard API returns 200 OK");
  assert(dashData.stats.challengesSolved === 1, "Dashboard stats: challengesSolved is 1");
  assert(dashData.stats.classroomsEnrolled === 1, "Dashboard stats: classroomsEnrolled is 1");
  assert(dashData.recentExecutions.length === 1, "Dashboard stats: recentExecutions has 1 element");
  assert(dashData.stats.solvedChallengeIds.includes(chId), "Dashboard stats: solvedChallengeIds includes the solved challenge");

  console.log("\nPhase 2F Results: " + passed + " / " + total + " PASS\n");
  if (passed < total) process.exit(1);
}

runTests().catch(console.error);
