import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/v1/classrooms/[id]/live/session/route';
import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomAuth } from '../src/lib/classroom/auth';

async function runStage2Tests() {
  console.log('================================================================');
  console.log('CORTEX CODE PLATFORM x CORTEX LIVE CLASS');
  console.log('EXPANDED STAGE 2 — HARDENED SECURITY & AUTH BRIDGE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} - Detail: ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  // 1. Setup Test Fixtures in SQLite
  const now = Date.now();
  const testClassroomId = 'CLS-STAGE2-SEC';
  const archivedClassroomId = 'CLS-STAGE2-ARCH';
  const altClassroomId = 'CLS-STAGE2-ALT';

  const teacherId = 'usr_teacher_stg2';
  const studentId = 'usr_student_stg2';
  const outsiderId = 'usr_outsider_stg2';
  const suspendedId = 'usr_suspended_stg2';
  const permSuspendedId = 'usr_perm_suspended_stg2';
  const expiredSuspendedId = 'usr_expired_suspended_stg2';

  const teacherSession = 'sess_teacher_valid_token_32chars_ok';
  const studentSession = 'sess_student_valid_token_32chars_ok';
  const outsiderSession = 'sess_outsider_valid_token_32chars_ok';
  const suspendedSession = 'sess_suspended_valid_token_32char';
  const permSuspendedSession = 'sess_permsuspended_valid_token_32';
  const expiredSuspendedSession = 'sess_expsuspended_valid_token_32';
  const expiredSession = 'sess_expired_valid_token_32chars_';

  // Seed Users
  const seedUser = async (id: string, name: string, email: string, role: string) => {
    await classroomDb.createUser({
      id,
      cortex_id: `CTX-${id.toUpperCase()}`,
      name,
      email,
      role,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
  };

  await seedUser(teacherId, 'Professor Shivam', 'shivam@cortex.edu', 'teacher');
  await seedUser(studentId, 'Alex Chen', 'alex@student.cortex.edu', 'student');
  await seedUser(outsiderId, 'Unenrolled User', 'outsider@cortex.edu', 'student');
  await seedUser(suspendedId, 'Suspended Student', 'suspended@student.cortex.edu', 'student');
  await seedUser(permSuspendedId, 'Permanent Suspended Student', 'permsuspended@student.cortex.edu', 'student');
  await seedUser(expiredSuspendedId, 'Expired Suspended Student', 'expsuspended@student.cortex.edu', 'student');

  // Seed Sessions
  await classroomDb.createSession(teacherSession, teacherId, now + 1000 * 60 * 60 * 24);
  await classroomDb.createSession(studentSession, studentId, now + 1000 * 60 * 60 * 24);
  await classroomDb.createSession(outsiderSession, outsiderId, now + 1000 * 60 * 60 * 24);
  await classroomDb.createSession(suspendedSession, suspendedId, now + 1000 * 60 * 60 * 24);
  await classroomDb.createSession(permSuspendedSession, permSuspendedId, now + 1000 * 60 * 60 * 24);
  await classroomDb.createSession(expiredSuspendedSession, expiredSuspendedId, now + 1000 * 60 * 60 * 24);
  await classroomDb.createSession(expiredSession, studentId, now - 1000 * 60 * 60); // 1 hour expired

  // Seed Active Classroom
  await classroomDb.createClassroom({
    id: testClassroomId,
    name: 'CS401 Distributed Systems Live',
    subject: 'Computer Science',
    description: 'Real-time distributed systems engineering',
    coursecode: 'CS401-LIVE',
    academicYear: '2026',
    section: 'A',
    teacherId: teacherId,
    teacherName: 'Professor Shivam',
    joinCode: 'LIVE2026',
    joinEnabled: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    settings: {
      allowStudentPosting: true,
      allowStudentMessaging: true,
      allowCodeSharing: true,
      leaderboardEnabled: true,
      defaultAIPolicy: 'hints_only',
    },
  } as any);

  // Seed Alternate Classroom (for cross-classroom reuse check)
  await classroomDb.createClassroom({
    id: altClassroomId,
    name: 'CS502 Advanced Networks',
    subject: 'Computer Science',
    description: 'Advanced networking',
    coursecode: 'CS502-NET',
    academicYear: '2026',
    section: 'B',
    teacherId: teacherId,
    teacherName: 'Professor Shivam',
    joinCode: 'NET2026',
    joinEnabled: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    settings: {},
  } as any);

  // Seed Archived Classroom
  await classroomDb.createClassroom({
    id: archivedClassroomId,
    name: 'CS100 Archived Lab',
    subject: 'Computer Science',
    description: 'Archived class',
    coursecode: 'CS100-ARCH',
    academicYear: '2025',
    section: 'A',
    teacherId: teacherId,
    teacherName: 'Professor Shivam',
    joinCode: 'ARCH2025',
    joinEnabled: false,
    status: 'archived',
    createdAt: now - 1000 * 60 * 60 * 24 * 30,
    updatedAt: now - 1000 * 60 * 60 * 24 * 10,
    settings: {},
  } as any);

  // Seed Memberships
  await classroomDb.addMember(testClassroomId, {
    id: `mem_${studentId}`,
    classroomId: testClassroomId,
    userId: studentId,
    userName: 'Alex Chen',
    userEmail: 'alex@student.cortex.edu',
    role: 'student',
    status: 'active',
    joinedAt: now,
    lastActiveAt: now,
  });

  await classroomDb.addMember(testClassroomId, {
    id: `mem_${suspendedId}`,
    classroomId: testClassroomId,
    userId: suspendedId,
    userName: 'Suspended Student',
    userEmail: 'suspended@student.cortex.edu',
    role: 'student',
    status: 'suspended',
    suspendedAt: now,
    suspensionExpiresAt: now + 1000 * 60 * 60 * 24, // Suspended for 24h
    joinedAt: now,
    lastActiveAt: now,
  });

  await classroomDb.addMember(testClassroomId, {
    id: `mem_${permSuspendedId}`,
    classroomId: testClassroomId,
    userId: permSuspendedId,
    userName: 'Permanent Suspended Student',
    userEmail: 'permsuspended@student.cortex.edu',
    role: 'student',
    status: 'suspended',
    suspendedAt: now,
    suspensionExpiresAt: null as any, // Indefinite / permanent suspension
    joinedAt: now,
    lastActiveAt: now,
  });

  await classroomDb.addMember(testClassroomId, {
    id: `mem_${expiredSuspendedId}`,
    classroomId: testClassroomId,
    userId: expiredSuspendedId,
    userName: 'Expired Suspended Student',
    userEmail: 'expsuspended@student.cortex.edu',
    role: 'student',
    status: 'suspended',
    suspendedAt: now - 1000 * 60 * 60 * 48,
    suspensionExpiresAt: now - 1000 * 60 * 60 * 24, // Expired 24 hours ago
    joinedAt: now - 1000 * 60 * 60 * 48,
    lastActiveAt: now,
  });

  console.log('[Setup] Test database fixtures seeded successfully.\n');

  // TEST 1: Unauthenticated request without session cookie -> returns 401
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`)
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 1: Unauthenticated request without cookie returns 401 Unauthorized',
      res.status === 401 && data.authorized === false && data.error.includes('Authentication required'),
      `Status: ${res.status}`
    );
  }

  // TEST 2: Expired session token -> returns 401
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${expiredSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 2: Expired session cookie is rejected with 401 Unauthorized',
      res.status === 401 && data.authorized === false,
      `Status: ${res.status}`
    );
  }

  // TEST 3: Invalid/nonexistent session token -> returns 401
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: 'cortex_session=invalid_fake_session_token_123' } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 3: Nonexistent session cookie is rejected with 401 Unauthorized',
      res.status === 401 && data.authorized === false,
      `Status: ${res.status}`
    );
  }

  // TEST 4: Authenticated teacher -> returns 200 with role: 'teacher' and full session context
  let teacherLiveToken = '';
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${teacherSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    teacherLiveToken = data.liveSessionToken;
    assert(
      'Test 4: Authenticated teacher returns 200 with role "teacher"',
      res.status === 200 &&
        data.authorized === true &&
        data.role === 'teacher' &&
        data.user.id === teacherId &&
        data.user.role === 'teacher' &&
        data.classroomId === testClassroomId &&
        data.session.title === 'CS401 Distributed Systems Live' &&
        typeof data.liveSessionToken === 'string' &&
        data.liveSessionToken.includes('.'),
      `Status: ${res.status}, role: ${data.role}`
    );
  }

  // TEST 5: Authenticated student -> returns 200 with role: 'student'
  let studentLiveToken = '';
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${studentSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    studentLiveToken = data.liveSessionToken;
    assert(
      'Test 5: Authenticated enrolled student returns 200 with role "student"',
      res.status === 200 &&
        data.authorized === true &&
        data.role === 'student' &&
        data.user.id === studentId &&
        data.user.role === 'student',
      `Status: ${res.status}, role: ${data.role}`
    );
  }

  // TEST 6: Student query param spoofing (?role=teacher) -> still returns role: 'student'
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session?role=teacher&admin=true`),
      { headers: { cookie: `cortex_session=${studentSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 6: Student query param spoofing (?role=teacher) is strictly ignored; returns "student"',
      res.status === 200 && data.role === 'student' && data.user.role === 'student',
      `Role returned: ${data.role}`
    );
  }

  // TEST 7: Student header spoofing (x-user-role: teacher, x-override-role: teacher)
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      {
        headers: {
          cookie: `cortex_session=${studentSession}`,
          'x-user-role': 'teacher',
          'x-override-role': 'admin',
          'x-user-id': teacherId,
        },
      }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 7: Student header spoofing (x-user-role, x-user-id) is strictly ignored; returns "student"',
      res.status === 200 && data.role === 'student' && data.user.id === studentId,
      `User ID: ${data.user.id}, Role: ${data.role}`
    );
  }

  // TEST 8: Authenticated user with no membership in the classroom -> returns 403 Forbidden
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${outsiderSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 8: Authenticated user without classroom membership returns 403 Forbidden',
      res.status === 403 && data.authorized === false && data.error.includes('not a member'),
      `Status: ${res.status}`
    );
  }

  // TEST 9: Authenticated temporarily suspended student -> returns 403 Forbidden
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${suspendedSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 9: Authenticated temporary suspended student returns 403 Forbidden',
      res.status === 403 && data.authorized === false && data.error.includes('suspended'),
      `Status: ${res.status}`
    );
  }

  // TEST 10: Authenticated indefinitely suspended student -> returns 403 Forbidden
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${permSuspendedSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 10: Authenticated indefinitely suspended student returns 403 Forbidden',
      res.status === 403 && data.authorized === false && data.error.includes('suspended'),
      `Status: ${res.status}`
    );
  }

  // TEST 11: Expired suspension is automatically restored -> returns 200 OK
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${expiredSuspendedSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const data = await res.json();
    assert(
      'Test 11: Expired suspension is restored and returns 200 OK',
      res.status === 200 && data.authorized === true && data.role === 'student',
      `Status: ${res.status}`
    );
  }

  // TEST 12: Archived classroom cannot be entered -> returns 403 Forbidden
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${archivedClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${teacherSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: archivedClassroomId }) });
    const data = await res.json();
    assert(
      'Test 12: Archived classroom is rejected with 403 Forbidden',
      res.status === 403 && data.authorized === false && data.error.includes('archived'),
      `Status: ${res.status}`
    );
  }

  // TEST 13: Request for nonexistent classroom ID -> returns 404
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/NONEXISTENT-CLS-999/live/session`),
      { headers: { cookie: `cortex_session=${teacherSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: 'NONEXISTENT-CLS-999' }) });
    const data = await res.json();
    assert(
      'Test 13: Nonexistent classroom ID returns 404 Not Found',
      res.status === 404 && data.authorized === false && data.error.includes('not found'),
      `Status: ${res.status}`
    );
  }

  // TEST 14: Security leakage check -> zero password_hash or session cookie exposure
  {
    const req = new NextRequest(
      new URL(`http://localhost:3000/api/v1/classrooms/${testClassroomId}/live/session`),
      { headers: { cookie: `cortex_session=${teacherSession}` } }
    );
    const res = await GET(req, { params: Promise.resolve({ id: testClassroomId }) });
    const text = await res.text();
    const leakedPassword = text.includes('password_hash') || text.includes('password');
    const leakedSessionCookie = text.includes(teacherSession);
    assert(
      'Test 14: Security leakage check — zero password_hash or session cookie exposure',
      !leakedPassword && !leakedSessionCookie,
      `Contains password: ${leakedPassword}, Contains session token: ${leakedSessionCookie}`
    );
  }

  // TEST 15: Valid live token verifies with HMAC-SHA256
  {
    const verified = ClassroomAuth.verifyLiveSessionToken(teacherLiveToken);
    assert(
      'Test 15: Ephemeral liveSessionToken verifies successfully with HMAC-SHA256',
      verified !== null &&
        verified.userId === teacherId &&
        verified.classroomId === testClassroomId &&
        verified.role === 'teacher',
      `Payload: ${JSON.stringify(verified)}`
    );
  }

  // TEST 16: Tampered live token signature is rejected
  {
    const sParts = studentLiveToken.split('.');
    const tamperedStudentData = JSON.parse(Buffer.from(sParts[0], 'base64url').toString('utf8'));
    tamperedStudentData.role = 'teacher'; // Tamper role
    const forgedToken = `${Buffer.from(JSON.stringify(tamperedStudentData)).toString('base64url')}.${sParts[1]}`;

    const forgedVerification = ClassroomAuth.verifyLiveSessionToken(forgedToken);
    assert(
      'Test 16: Tampered ephemeral liveSessionToken signature is strictly rejected',
      forgedVerification === null,
      `Result: ${JSON.stringify(forgedVerification)}`
    );
  }

  // TEST 17: Expired live token is strictly rejected
  {
    const pastIssuedAt = Date.now() - 1000 * 60 * 120; // 2 hours ago
    const pastExpiredAt = Date.now() - 1000 * 60 * 60; // 1 hour ago
    const expiredData = {
      sub: studentId,
      name: 'Alex Chen',
      email: 'alex@student.cortex.edu',
      cid: testClassroomId,
      role: 'student',
      iat: pastIssuedAt,
      exp: pastExpiredAt,
    };
    const encoded = Buffer.from(JSON.stringify(expiredData)).toString('base64url');
    const secret = ClassroomAuth.getLiveSessionSigningSecret();
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
    const expiredToken = `${encoded}.${sig}`;

    const result = ClassroomAuth.verifyLiveSessionToken(expiredToken);
    assert(
      'Test 17: Expired liveSessionToken is strictly rejected',
      result === null,
      `Result: ${JSON.stringify(result)}`
    );
  }

  // TEST 18: Malformed token inputs (non-string, missing parts, bad JSON) safely return null
  {
    const nonString = ClassroomAuth.verifyLiveSessionToken(12345 as any);
    const noDot = ClassroomAuth.verifyLiveSessionToken('just-a-plain-string-no-dot');
    const threeDots = ClassroomAuth.verifyLiveSessionToken('part1.part2.part3');
    const invalidBase64 = ClassroomAuth.verifyLiveSessionToken('!!!invalid-base64!!!.sig');
    assert(
      'Test 18: Malformed token inputs return null without throwing unhandled exceptions',
      nonString === null && noDot === null && threeDots === null && invalidBase64 === null,
      'Malformed tokens handled safely'
    );
  }

  // TEST 19: Future issuance timestamp (iat far in future) is rejected
  {
    const futureData = {
      sub: studentId,
      name: 'Alex Chen',
      email: 'alex@student.cortex.edu',
      cid: testClassroomId,
      role: 'student',
      iat: Date.now() + 1000 * 60 * 10, // 10 minutes in future
      exp: Date.now() + 1000 * 60 * 70,
    };
    const encoded = Buffer.from(JSON.stringify(futureData)).toString('base64url');
    const secret = ClassroomAuth.getLiveSessionSigningSecret();
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
    const token = `${encoded}.${sig}`;

    const verified = ClassroomAuth.verifyLiveSessionToken(token);
    assert(
      'Test 19: Future-issued live token (iat > now + 60s) is strictly rejected',
      verified === null,
      `Result: ${JSON.stringify(verified)}`
    );
  }

  // TEST 20: Invalid expiration ordering (exp <= iat) is rejected
  {
    const badOrderData = {
      sub: studentId,
      name: 'Alex Chen',
      email: 'alex@student.cortex.edu',
      cid: testClassroomId,
      role: 'student',
      iat: Date.now() - 10000,
      exp: Date.now() - 20000, // exp before iat
    };
    const encoded = Buffer.from(JSON.stringify(badOrderData)).toString('base64url');
    const secret = ClassroomAuth.getLiveSessionSigningSecret();
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
    const token = `${encoded}.${sig}`;

    const verified = ClassroomAuth.verifyLiveSessionToken(token);
    assert(
      'Test 20: Inverted timestamp token (exp <= iat) is strictly rejected',
      verified === null,
      `Result: ${JSON.stringify(verified)}`
    );
  }

  // TEST 21: Invalid claim types / invalid role are rejected
  {
    const invalidRoleData = {
      sub: studentId,
      name: 'Alex Chen',
      email: 'alex@student.cortex.edu',
      cid: testClassroomId,
      role: 'superadmin', // Invalid role
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60,
    };
    const encoded = Buffer.from(JSON.stringify(invalidRoleData)).toString('base64url');
    const secret = ClassroomAuth.getLiveSessionSigningSecret();
    const { createHmac } = await import('crypto');
    const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
    const token = `${encoded}.${sig}`;

    const verified = ClassroomAuth.verifyLiveSessionToken(token);
    assert(
      'Test 21: Invalid role claim (role: "superadmin") is strictly rejected',
      verified === null,
      `Result: ${JSON.stringify(verified)}`
    );
  }

  // TEST 22: Context binding & Cross-classroom token reuse prevention
  {
    // Token issued for testClassroomId, but verified against altClassroomId
    const crossClassroom = ClassroomAuth.verifyLiveSessionToken(studentLiveToken, {
      expectedClassroomId: altClassroomId,
    });
    // Token issued for studentId, but verified against teacherId
    const crossUser = ClassroomAuth.verifyLiveSessionToken(studentLiveToken, {
      expectedUserId: teacherId,
    });
    // Token matched with correct classroom
    const matchClassroom = ClassroomAuth.verifyLiveSessionToken(studentLiveToken, {
      expectedClassroomId: testClassroomId,
      expectedUserId: studentId,
    });

    assert(
      'Test 22: Cross-classroom and cross-user token reuse is strictly prevented',
      crossClassroom === null && crossUser === null && matchClassroom !== null,
      `Cross-room: ${crossClassroom}, Cross-user: ${crossUser}, Valid match: ${matchClassroom !== null}`
    );
  }

  // TEST 23: Production secret enforcement (fail closed if secret missing or weak in production)
  {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevSecret = process.env.CORTEX_SESSION_SECRET;

    process.env.NODE_ENV = 'production';
    delete process.env.CORTEX_SESSION_SECRET;

    let threwMissing = false;
    try {
      ClassroomAuth.getLiveSessionSigningSecret();
    } catch {
      threwMissing = true;
    }

    process.env.CORTEX_SESSION_SECRET = 'short-secret'; // < 32 chars
    let threwWeak = false;
    try {
      ClassroomAuth.getLiveSessionSigningSecret();
    } catch {
      threwWeak = true;
    }

    // Restore env
    process.env.NODE_ENV = prevNodeEnv;
    if (prevSecret) process.env.CORTEX_SESSION_SECRET = prevSecret;
    else delete process.env.CORTEX_SESSION_SECRET;

    assert(
      'Test 23: Production environment strictly fails closed if CORTEX_SESSION_SECRET is missing or < 32 chars',
      threwMissing && threwWeak,
      `Threw on missing: ${threwMissing}, Threw on weak: ${threwWeak}`
    );
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage2Tests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
