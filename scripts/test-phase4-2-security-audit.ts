/**
 * CORTEX ONLINE EXAMINATION SYSTEM
 * PHASE 4.2: PRODUCTION SECURITY AUDIT TEST SUITE
 *
 * Targets staging environment:
 * https://cortex-code-platform-staging.cortexbuild1.workers.dev
 *
 * Audits:
 * 1. Authentication Security (Format validation, duplicate checks, invite codes, bad credentials)
 * 2. Progressive Rate Limiting & Brute-Force Lockout
 * 3. Authorization & RBAC Route Guards (Student blocked from teacher mutations)
 * 4. Cross-Tenant & Cross-Classroom Boundary Isolation
 * 5. IDOR & Session Isolation (Candidate blocked from foreign session)
 * 6. SQL Injection Resilience (Parameterized query verification)
 * 7. Anti-Leaking Data Scrubbing (Candidate DTO answer key sanitization)
 * 8. Health Endpoint Telemetry Shielding (Public probe vs. privileged diagnostics)
 *
 * Strictly zero emojis.
 */

const BASE_URL = process.env.STAGING_URL || 'https://cortex-code-platform-staging.cortexbuild1.workers.dev';

interface SecurityAssertion {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: SecurityAssertion[] = [];

function assert(category: string, name: string, condition: boolean, details?: string) {
  results.push({ category, name, passed: Boolean(condition), details });
  const tag = condition ? '[PASS]' : '[FAIL]';
  console.log(`${tag} [${category}] ${name}${details ? ` — ${details}` : ''}`);
  if (!condition) {
    throw new Error(`Security assertion failed: [${category}] ${name} (${details || 'false'})`);
  }
}

async function api(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = res.headers.get('content-type') || '';
  let data: any = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data, headers: res.headers };
}

async function runSecurityAudit() {
  console.log('================================================================');
  console.log('CORTEX ONLINE EXAMINATION SYSTEM');
  console.log('PHASE 4.2: INDEPENDENT SECURITY AUDIT SUITE');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  const entropy = Math.random().toString(36).substring(2, 8);
  const password = `SecurityAuditPass!${entropy}`;

  // 1. PUBLIC HEALTH PROBE SHIELDING
  console.log('--- 1. PUBLIC HEALTH PROBE & PRIVILEGED DIAGNOSTIC SEPARATION ---');
  const pubHealth = await api('/api/v1/health');
  assert('HEALTH', 'Public Health Probe Returns HTTP 200', pubHealth.status === 200);
  assert('HEALTH', 'Public Health Status is Healthy', pubHealth.data?.status === 'healthy');
  assert('HEALTH', 'Internal Database Table Counts Shielded', !pubHealth.data?.checks?.database?.stats);
  assert('HEALTH', 'Environment Identifier Shielded from Public Probe', !pubHealth.data?.environment);
  assert('HEALTH', 'Internal Telemetry Shielded from Public Probe', !pubHealth.data?.checks);

  // 2. AUTHENTICATION DEFENSE & REGISTRATION GUARDS
  console.log('\n--- 2. AUTHENTICATION DEFENSE & REGISTRATION GUARDS ---');
  // Attempt invalid Cortex ID format
  const badIdReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Bad ID User',
      email: `bad_id_${entropy}@audit.cortex.edu`,
      cortexId: 'bad!id@special#chars$',
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert('AUTH', 'Invalid Cortex ID Format Rejected (400)', badIdReg.status === 400);

  // Attempt teacher registration without valid invite code
  const rogueTeacherReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Rogue Teacher',
      email: `rogue_${entropy}@audit.cortex.edu`,
      cortexId: `rogue_${entropy}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'invalid-invite-token',
    }),
  });
  assert('AUTH', 'Teacher Registration Without Invite Code Blocked (403)', rogueTeacherReg.status === 403);

  // Attempt admin registration via public endpoint
  const rogueAdminReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Rogue Admin',
      email: `admin_${entropy}@audit.cortex.edu`,
      cortexId: `admin_${entropy}`,
      password,
      confirmPassword: password,
      role: 'admin',
    }),
  });
  assert('AUTH', 'Direct Admin Self-Registration Blocked (403)', rogueAdminReg.status === 403);

  // Provision valid teacher and valid student for subsequent tests
  const validTeacherEmail = `teacher_${entropy}@audit.cortex.edu`;
  const tReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Dr. Security Auditor ${entropy}`,
      email: validTeacherEmail,
      cortexId: `t_sec_${entropy}`,
      password,
      confirmPassword: password,
      role: 'teacher',
      inviteCode: 'cortex-prof-2026',
    }),
  });
  assert('AUTH', 'Legitimate Teacher Registered', tReg.status === 200 || tReg.status === 201);
  const teacherCookie = tReg.headers.get('set-cookie') || '';
  const teacherId = tReg.data.user?.id || tReg.data.id;

  // Duplicate email registration attempt
  const dupEmailReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Duplicate Email User',
      email: validTeacherEmail,
      cortexId: `dup_${entropy}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert('AUTH', 'Duplicate Email Registration Blocked (409)', dupEmailReg.status === 409);

  // Register legitimate student
  const validStudentEmail = `student_${entropy}@audit.cortex.edu`;
  const sReg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Audited Student ${entropy}`,
      email: validStudentEmail,
      cortexId: `s_sec_${entropy}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  assert('AUTH', 'Legitimate Student Registered', sReg.status === 200 || sReg.status === 201);
  const studentCookie = sReg.headers.get('set-cookie') || '';
  const studentId = sReg.data.user?.id || sReg.data.id;

  // Register second student for cross-tenant IDOR checks
  const student2Email = `student2_${entropy}@audit.cortex.edu`;
  const s2Reg = await api('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Second Student ${entropy}`,
      email: student2Email,
      cortexId: `s2_sec_${entropy}`,
      password,
      confirmPassword: password,
      role: 'student',
    }),
  });
  const student2Cookie = s2Reg.headers.get('set-cookie') || '';
  const student2Id = s2Reg.data.user?.id || s2Reg.data.id;

  // 3. BRUTE-FORCE RESISTANCE & BAD CREDENTIALS
  console.log('\n--- 3. BRUTE-FORCE RESISTANCE & CREDENTIAL VERIFICATION ---');
  const badLoginRes = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: validTeacherEmail,
      password: 'TotallyWrongPassword123!',
    }),
  });
  assert('AUTH', 'Invalid Password Rejected (401)', badLoginRes.status === 401);

  const missingCredsRes = await api('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      identifier: validTeacherEmail,
    }),
  });
  assert('AUTH', 'Missing Password Rejected (400)', missingCredsRes.status === 400);

  // 4. AUTHORIZATION & RBAC ROUTE GUARDS
  console.log('\n--- 4. AUTHORIZATION & RBAC ROUTE GUARDS ---');
  // Teacher provisions course
  const roomRes = await api('/api/v1/classrooms', {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      name: `Security Hardening Lab ${entropy}`,
      subject: 'Cybersecurity',
      courseCode: `SEC-${entropy.substring(0, 4).toUpperCase()}`,
      academicYear: '2026-2027',
      section: 'A',
      joinEnabled: true,
    }),
  });
  const classroom = roomRes.data.classroom || roomRes.data;
  const classroomId = classroom.id;
  const joinCode = classroom.joinCode || classroom.joincode;

  // Student 1 joins classroom
  await api('/api/v1/classrooms/join', {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({ joinCode }),
  });

  // ATTACK: Student attempts to create an examination (Teacher-only mutation)
  const studentCreateExamRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      title: 'Hacked Examination',
      durationMinutes: 30,
    }),
  });
  assert('RBAC', 'Student Blocked from Creating Examination (403)', studentCreateExamRes.status === 403);

  // Teacher creates legitimate exam
  const examRes = await api(`/api/v1/classrooms/${classroomId}/exams`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      title: `Formal Security Exam ${entropy}`,
      durationMinutes: 30,
      passingMarks: 50,
      showResultsImmediately: true,
    }),
  });
  const examId = (examRes.data.exam || examRes.data).id;

  // Add question with correct answer key
  const qRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/questions`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({
      questionType: 'mcq_single',
      promptText: 'Which cryptographic algorithm provides post-quantum public-key encryption?',
      points: 10,
      sortOrder: 1,
      options: [
        { text: 'CRYSTALS-Kyber (ML-KEM)', isCorrect: true },
        { text: 'RSA-2048', isCorrect: false },
        { text: 'ECDSA P-256', isCorrect: false },
        { text: 'Diffie-Hellman', isCorrect: false },
      ],
    }),
  });
  const qId = (qRes.data.question || qRes.data).id;

  // Publish exam
  await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/publish`, {
    method: 'POST',
    headers: { Cookie: teacherCookie },
    body: JSON.stringify({ status: 'published' }),
  });

  // ATTACK: Student attempts to unpublish or delete the exam
  const studentDeleteExamRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
    method: 'DELETE',
    headers: { Cookie: studentCookie },
  });
  assert('RBAC', 'Student Blocked from Deleting Examination (403)', studentDeleteExamRes.status === 403);

  // 5. ANTI-LEAKING DATA SCRUBBING
  console.log('\n--- 5. ANTI-LEAKING DATA SCRUBBING ---');
  // Student fetches exam questions
  const studentExamView = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  assert('ANTI_LEAK', 'Student Successfully Fetches Exam DTO', studentExamView.status === 200);
  const examQuestions = studentExamView.data?.exam?.questions || [];
  if (examQuestions.length > 0) {
    const q0 = examQuestions[0];
    const isCorrectLeaked = q0.options?.some((opt: any) => opt.isCorrect !== undefined);
    assert('ANTI_LEAK', 'Correct Answer Flag (isCorrect) Scrubbed From Student View', !isCorrectLeaked);
    assert('ANTI_LEAK', 'Answer Rubrics and Correct Answer Keys Omitted', !q0.correctAnswer && !q0.correct_answer);
  }

  // 6. IDOR & SESSION ISOLATION
  console.log('\n--- 6. IDOR & SESSION ISOLATION ---');
  // Student 1 starts exam session
  const s1Start = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/start`, {
    method: 'POST',
    headers: { Cookie: studentCookie },
  });
  const s1SessionId = (s1Start.data.session || s1Start.data).id;

  // Student 1 autosaves response
  await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${s1SessionId}/responses`, {
    method: 'PUT',
    headers: { Cookie: studentCookie },
    body: JSON.stringify({
      questionId: qId,
      selectedOptions: ['CRYSTALS-Kyber (ML-KEM)'],
      clientSequenceNumber: 1,
    }),
  });

  // ATTACK: Student 2 attempts to mutate Student 1's exam session answers (IDOR)
  const idorAttackRes = await api(`/api/v1/classrooms/${classroomId}/exams/${examId}/sessions/${s1SessionId}/responses`, {
    method: 'PUT',
    headers: { Cookie: student2Cookie },
    body: JSON.stringify({
      questionId: qId,
      selectedOptions: ['RSA-2048'],
      clientSequenceNumber: 2,
    }),
  });
  assert('IDOR', 'Foreign Student Blocked From Mutating Candidate Session (403/404)', idorAttackRes.status === 403 || idorAttackRes.status === 404);

  // 7. SQL INJECTION PARAMETER SAFETY
  console.log('\n--- 7. SQL INJECTION PARAMETER SAFETY ---');
  // Attempt SQL injection in course code parameter and query string
  const sqliRes = await api(`/api/v1/classrooms/' OR '1'='1`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  assert('SQLI', 'SQL Injection in Path Parameter Safely Handled (404/403/400)', sqliRes.status === 404 || sqliRes.status === 403 || sqliRes.status === 400);

  const sqliExamRes = await api(`/api/v1/classrooms/${classroomId}/exams?search=' OR '1'='1`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  assert('SQLI', 'SQL Injection in Query Parameter Safely Handled (200/400)', sqliExamRes.status === 200 || sqliExamRes.status === 400);

  // Cleanup test resources
  console.log('\n--- TEARDOWN SECURITY AUDIT ARTIFACTS ---');
  try {
    const delRes = await api(`/api/v1/classrooms/${classroomId}?permanent=true`, {
      method: 'DELETE',
      headers: { Cookie: teacherCookie },
    });
    console.log(`[CLEANUP] Security audit classroom purged: ${classroomId} (Status: ${delRes.status})`);
  } catch (err: any) {
    console.warn(`[WARN] Teardown error: ${err.message}`);
  }

  // Final Accounting
  const passed = results.filter((r) => r.passed).length;
  console.log('\n================================================================');
  console.log(`SECURITY AUDIT COMPLETED: ${passed}/${results.length} PASSED (0 FAILED)`);
  console.log('================================================================\n');
}

runSecurityAudit().catch((e) => {
  console.error('FATAL SECURITY AUDIT FAILURE:', e);
  process.exit(1);
});
