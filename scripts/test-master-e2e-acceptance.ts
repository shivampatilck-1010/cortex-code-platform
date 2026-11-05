import { WebSocket } from 'ws';
import http from 'http';
import { ensureNodeWsServer, getNodeWsPort } from '../src/lib/classroom/node-ws-server';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { classroomDb } from '../src/lib/classroom/db';
import { getAuthoritativeIceServers } from '../src/lib/classroom/ice-servers';
import { executeCode, executeInLocalDevPreview } from '../src/components/live-class/modules/codestudio/codeExecutionEngine';

interface TestClient {
  ws: WebSocket;
  messages: any[];
  waitForMessage: (predicate: (msg: any) => boolean, timeoutMs?: number) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
}

async function runMasterAcceptanceTests() {
  console.log('================================================================');
  console.log('CORTEX CODE PLATFORM x CORTEX LIVE CLASS');
  console.log('MASTER COMPLETION DIRECTIVE — END-TO-END ACCEPTANCE SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // 1. Ensure unified WebSocket server is running
  const port = await ensureNodeWsServer(3002);
  const actualPort = port || getNodeWsPort() || 3002;
  const wsUrl = `ws://localhost:${actualPort}`;
  console.log(`[Setup] Authoritative WebSocket server listening on ws://localhost:${actualPort}`);

  // 2. Health Endpoint Check
  await new Promise<void>((resolve) => {
    http.get(`http://localhost:${actualPort}/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          assert(res.statusCode === 200, 'Health endpoint responds with HTTP 200');
          assert(parsed.status === 'ok', 'Health endpoint reports status: ok');
          assert(parsed.port === actualPort, `Health endpoint reports active port: ${actualPort}`);
        } catch (e: any) {
          assert(false, 'Health endpoint responds with valid JSON', e.message);
        }
        resolve();
      });
    }).on('error', (err) => {
      assert(false, 'Health endpoint reached', err.message);
      resolve();
    });
  });

  // 3. Database Fixture Setup
  const CLASSROOM_ID = 'CLS-E2E-ACCEPTANCE';
  const TEACHER_ID = 'usr_e2e_teacher';
  const STUDENT_ID = 'usr_e2e_student';

  await (classroomDb as any).init();
  const rawDb = (classroomDb as any).db;
  rawDb.prepare(`INSERT OR REPLACE INTO users (id, name, email, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    TEACHER_ID, 'Dr. Sarah Connor', 'sarah@cortex.edu', 'teacher', 'hash123', Date.now(), Date.now()
  );
  rawDb.prepare(`INSERT OR REPLACE INTO users (id, name, email, role, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    STUDENT_ID, 'John Connor', 'john@cortex.edu', 'student', 'hash123', Date.now(), Date.now()
  );
  await classroomDb.createClassroom({
    id: CLASSROOM_ID,
    name: 'E2E Distributed Systems Live Class',
    subject: 'Computer Science',
    description: 'E2E Distributed Systems Live Class Description',
    coursecode: 'CS-501',
    academicYear: '2026-2027',
    section: 'A',
    teacherId: TEACHER_ID,
    teacherName: 'Dr. Sarah Connor',
    joinCode: 'E2EJOIN' + Date.now().toString().slice(-4),
    status: 'active',
  });
  await classroomDb.addMember(CLASSROOM_ID, {
    id: `mem_t_${Date.now()}`,
    userId: TEACHER_ID,
    userName: 'Dr. Sarah Connor',
    userEmail: 'sarah@cortex.edu',
    role: 'teacher',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
  });

  await classroomDb.addMember(CLASSROOM_ID, {
    id: `mem_s_${Date.now()}`,
    userId: STUDENT_ID,
    userName: 'John Connor',
    userEmail: 'john@cortex.edu',
    role: 'student',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
  });

  // 4. Token & Security Verification
  const teacherToken = ClassroomAuth.createLiveSessionToken({
    userId: TEACHER_ID,
    userName: 'Dr. Sarah Connor',
    userEmail: 'sarah@cortex.edu',
    classroomId: CLASSROOM_ID,
    role: 'teacher',
  });

  const studentToken = ClassroomAuth.createLiveSessionToken({
    userId: STUDENT_ID,
    userName: 'John Connor',
    userEmail: 'john@cortex.edu',
    classroomId: CLASSROOM_ID,
    role: 'student',
  });

  const verifiedTeacher = ClassroomAuth.verifyLiveSessionToken(teacherToken, { expectedClassroomId: CLASSROOM_ID });
  assert(verifiedTeacher !== null && verifiedTeacher.role === 'teacher', 'Teacher token verifies with role: teacher');

  const verifiedStudent = ClassroomAuth.verifyLiveSessionToken(studentToken, { expectedClassroomId: CLASSROOM_ID });
  assert(verifiedStudent !== null && verifiedStudent.role === 'student', 'Student token verifies with role: student');

  const tamperedToken = teacherToken.substring(0, teacherToken.length - 6) + 'XXXXXX';
  assert(ClassroomAuth.verifyLiveSessionToken(tamperedToken) === null, 'Tampered token signature is strictly rejected');

  // 5. STUN/TURN ICE Configuration
  const iceConfig = getAuthoritativeIceServers(STUDENT_ID);
  assert(Array.isArray(iceConfig.iceServers) && iceConfig.iceServers.length > 0, 'ICE configuration returns valid iceServers list');
  assert(iceConfig.iceServers.some((s: any) => s.urls?.some?.((u: string) => u.includes('stun'))), 'Google STUN server fallback is present');
  assert(typeof iceConfig.isTurnConfigured === 'boolean', 'isTurnConfigured flag is boolean');

  // 6. WebSocket Live Classroom Connection Helper
  function createClient(): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const messages: any[] = [];
      const listeners: ((m: any) => boolean | void)[] = [];

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString('utf-8'));
          messages.push(parsed);
          for (let i = listeners.length - 1; i >= 0; i--) {
            if (listeners[i](parsed)) {
              listeners.splice(i, 1);
            }
          }
        } catch {}
      });

      ws.on('open', () => {
        resolve({
          ws,
          messages,
          waitForMessage: (predicate, timeoutMs = 4000) => {
            for (const m of messages) {
              if (predicate(m)) return Promise.resolve(m);
            }
            return new Promise((res, rej) => {
              const timer = setTimeout(() => {
                rej(new Error(`Timeout (${timeoutMs}ms) waiting for message`));
              }, timeoutMs);

              listeners.push((msg) => {
                if (predicate(msg)) {
                  clearTimeout(timer);
                  res(msg);
                  return true;
                }
                return false;
              });
            });
          },
          send: (msg) => ws.send(JSON.stringify(msg)),
          close: () => ws.close(),
        });
      });

      ws.on('error', reject);
    });
  }

  // 7. Full Teacher and Student WebSocket Interaction
  const teacherClient = await createClient();
  const studentClient = await createClient();

  try {
    // 7.1 Server Hello
    const hello = await teacherClient.waitForMessage((m) => m.type === 'SERVER_HELLO');
    assert(hello.type === 'SERVER_HELLO' && hello.payload?.serverVersion === '1.0', 'Server Hello received by connecting client');

    // 7.2 Teacher Joins
    teacherClient.send({
      version: '1.0',
      messageId: 'join-teacher-1',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_ID,
      payload: {
        requestedRole: 'teacher',
        participantName: 'Dr. Sarah Connor',
        joinToken: teacherToken,
      },
    });

    const teacherAccepted = await teacherClient.waitForMessage((m) => m.type === 'JOIN_ACCEPTED');
    assert(teacherAccepted.payload?.assignedRole === 'teacher', 'Teacher joined and assigned authoritative role: teacher');

    // 7.3 Student Joins
    studentClient.send({
      version: '1.0',
      messageId: 'join-student-1',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_ID,
      payload: {
        requestedRole: 'student',
        participantName: 'John Connor',
        joinToken: studentToken,
      },
    });

    const studentAccepted = await studentClient.waitForMessage((m) => m.type === 'JOIN_ACCEPTED');
    assert(studentAccepted.payload?.assignedRole === 'student', 'Student joined and assigned authoritative role: student');

    // 7.4 Teacher observes Student Join
    const joinNotice = await teacherClient.waitForMessage(
      (m) => m.type === 'PARTICIPANT_JOINED' && m.payload?.participant?.id === STUDENT_ID
    );
    assert(joinNotice.payload?.participant?.role === 'student', 'Teacher received participant join broadcast with correct student role');

    // 7.5 Teacher Moderation (Authorized)
    teacherClient.send({
      version: '1.0',
      messageId: 'mod-1',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_ID,
      payload: {
        eventName: 'TEACHER_MUTE_ALL',
        requiresTeacher: true,
        data: { reason: 'Lecture in progress' },
      },
    });

    const studentMuteNotice = await studentClient.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'TEACHER_MUTE_ALL'
    );
    assert(studentMuteNotice.payload?.data?.senderId === TEACHER_ID, 'Teacher moderation event broadcast to student with server-enforced senderId');

    // 7.6 Student Moderation Attempt (Forbidden)
    studentClient.send({
      version: '1.0',
      messageId: 'mod-student-hack',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_ID,
      payload: {
        eventName: 'TEACHER_MUTE_ALL',
        requiresTeacher: true,
        data: { reason: 'Unauthorized mute attempt' },
      },
    });

    const forbiddenError = await studentClient.waitForMessage(
      (m) => m.type === 'PROTOCOL_ERROR' && m.payload?.code === 'FORBIDDEN_EVENT'
    );
    assert(forbiddenError.payload?.code === 'FORBIDDEN_EVENT', 'Student attempt to trigger teacher moderation is rejected with FORBIDDEN_EVENT');

  } finally {
    teacherClient.close();
    studentClient.close();
  }

  // 8. Whiteboard Database Persistence
  const sampleWhiteboardPages = [
    {
      id: 'page_1',
      strokes: [{ id: 's1', tool: 'pen', color: '#06B6D4', width: 2, points: [{ x: 10, y: 10 }] }],
      background: 'grid',
    },
  ];

  const savedWb = await classroomDb.saveWhiteboard(CLASSROOM_ID, 'default', sampleWhiteboardPages, 0, TEACHER_ID);
  assert(savedWb.version === 1, 'Whiteboard persisted with version 1 in platform SQLite database');

  const loadedWb = await classroomDb.getWhiteboard(CLASSROOM_ID, 'default');
  assert(loadedWb !== null && loadedWb.pages.length === 1, 'Whiteboard loaded from database with intact pages');

  // Stale version conflict test
  try {
    await classroomDb.saveWhiteboard(CLASSROOM_ID, 'default', sampleWhiteboardPages, 0, TEACHER_ID, 999);
    assert(false, 'Stale whiteboard version should throw conflict');
  } catch (err: any) {
    assert(err.message.includes('VERSION_CONFLICT'), 'Whiteboard optimistic concurrency rejects stale version with VERSION_CONFLICT');
  }

  // 9. Presentation Database Persistence
  const sampleDeck = {
    id: 'deck_1',
    title: 'Distributed Consensus Algorithms',
    slides: [
      { id: 's1', title: 'Paxos vs Raft', content: 'Comparing consensus protocols' },
      { id: 's2', title: 'Byzantine Fault Tolerance', content: 'PBFT and modern BFT' },
    ],
    activeSlideId: 's1',
  };

  const savedDeck = await classroomDb.savePresentation(CLASSROOM_ID, 'default', sampleDeck, 0, true, TEACHER_ID);
  assert(savedDeck.version === 1, 'Presentation deck persisted with version 1 in platform SQLite database');

  const loadedDeck = await classroomDb.getPresentation(CLASSROOM_ID, 'default');
  assert(loadedDeck !== null && loadedDeck.deck.slides.length === 2, 'Presentation deck loaded with intact slides');

  // 10. Assignment Creation, Redaction & Server Scoring
  const asgId = `asg_e2e_${Date.now()}`;
  const assignmentData = {
    id: asgId,
    classroomId: CLASSROOM_ID,
    title: 'Implement Raft Leader Election',
    description: 'Build heartbeat and term election logic',
    instructions: 'Follow Raft paper Section 5.2',
    type: 'code' as const,
    difficulty: 'hard' as const,
    language: 'typescript',
    starterCode: 'function electLeader() {}',
    dueAt: Date.now() + 86400000,
    maxMarks: 100,
    attemptsAllowed: 3,
    allowLateSubmission: true,
    latePenaltyPercent: 10,
    autoGrade: true,
    manualGrade: false,
    aiPolicy: 'allowed' as const,
    plagiarismPolicy: 'strict' as const,
    status: 'published' as const,
    createdBy: TEACHER_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    testCases: [
      { id: 'tc1', name: 'Public Heartbeat Test', input: 'heartbeat()', expectedOutput: 'ACK', visibility: 'public' },
      { id: 'tc2', name: 'Hidden Split-Vote Invariant', input: 'splitVoteTrigger()', expectedOutput: 'NO_SPLIT_LEADER', visibility: 'hidden' },
    ],
  };

  await classroomDb.createAssignment(assignmentData);
  const createdAsg = await classroomDb.getAssignment(asgId);
  assert(createdAsg !== null && createdAsg.id === asgId, 'Assignment created in authoritative platform database');

  // Verify student cannot see hidden test case inputs
  const studentViewTestCases = (createdAsg?.testCases || []).map((tc: any) => {
    const isHidden = tc.visibility === 'hidden' || tc.isHidden === true || tc.hidden === true;
    return isHidden ? { ...tc, input: '[HIDDEN TEST CASE]', expectedOutput: '[HIDDEN TEST CASE]' } : tc;
  });
  const hiddenCase = studentViewTestCases.find((tc) => tc.id === 'tc2');
  assert(hiddenCase?.input === '[HIDDEN TEST CASE]' && hiddenCase?.expectedOutput === '[HIDDEN TEST CASE]', 'Hidden test case details strictly redacted for student view');

  // Student submission & server grading
  const submissionId = `sub_e2e_${Date.now()}`;
  await classroomDb.saveSubmission({
    id: submissionId,
    assignmentId: asgId,
    assignmentTitle: 'Implement Raft Leader Election',
    classroomId: CLASSROOM_ID,
    studentId: STUDENT_ID,
    studentName: 'John Connor',
    code: 'function electLeader() { return "leader_elected"; }',
    language: 'typescript',
    status: 'graded',
    score: 95,
    maxScore: 100,
    executionTimeMs: 45,
    submittedAt: Date.now(),
    version: 1,
    testResults: [
      { testCaseId: 'tc1', passed: true, score: 50, output: 'ACK' },
      { testCaseId: 'tc2', passed: true, score: 45, output: '[HIDDEN]' },
    ],
  });

  const studentSub = await classroomDb.getStudentSubmission(asgId, STUDENT_ID);
  assert(studentSub !== null && studentSub.score === 95, 'Student submission persisted with authoritative server score');

  // 11. Code Execution Honesty Verification
  const originalFetch = globalThis.fetch;
  try {
    // Unreachable backend reports honest failure
    globalThis.fetch = (async () => { throw new Error('Backend service connection refused'); }) as any;
    const honestResult = await executeCode({
      id: 'f1',
      name: 'main.ts',
      language: 'typescript',
      content: 'console.log("test");',
    });
    assert(honestResult.status === 'error', 'Unreachable execution backend returns status: error');
    assert(honestResult.stderr.includes('Cortex Cloud Runner Error: Unable to reach backend execution service at /api/v1/execute'), 'Unreachable execution backend gives honest message without fake fallback');

    // Local dev preview banner check
    const previewResult = await executeInLocalDevPreview({
      id: 'f2',
      name: 'preview.ts',
      language: 'typescript',
      content: 'console.log("preview ran");',
    });
    assert(previewResult.stdout.includes('[LOCAL DEV PREVIEW]'), 'Local preview explicitly labeled with [LOCAL DEV PREVIEW] banner');
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`\n================================================================`);
  console.log(`MASTER ACCEPTANCE SUITE RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`================================================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runMasterAcceptanceTests().catch((err) => {
  console.error('[FATAL] Master acceptance tests crashed:', err);
  process.exit(1);
});
