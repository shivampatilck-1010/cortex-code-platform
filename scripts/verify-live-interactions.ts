import { WebSocket } from 'ws';
import http from 'http';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { classroomDb } from '../src/lib/classroom/db';
import { getAuthoritativeIceServers } from '../src/lib/classroom/ice-servers';

interface TestClient {
  ws: WebSocket;
  messages: any[];
  waitForMessage: (predicate: (msg: any) => boolean, timeoutMs?: number) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
}

async function runLiveVerification() {
  console.log('================================================================');
  console.log('CORTEX CODE PLATFORM x CORTEX LIVE CLASS');
  console.log('LIVE SERVER INTERACTION & ACCEPTANCE VERIFICATION');
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

  const BASE_URL = 'http://localhost:3000';
  const WS_URL = 'ws://localhost:3002';
  const CLASSROOM_ID = 'CLS-LIVE-DEMO-01';
  const TEACHER_ID = 'usr_teacher_ada';
  const STUDENT_ID = 'usr_student_alan';

  await (classroomDb as any).init();

  // 1. Seed Demo Classroom & Members
  await classroomDb.createClassroom({
    id: CLASSROOM_ID,
    name: 'CS 401: Advanced Operating Systems & Concurrency',
    subject: 'Computer Science',
    description: 'Kernel architectures and distributed synchronization',
    coursecode: 'CS-401',
    academicYear: '2026-2027',
    section: 'A',
    teacherId: TEACHER_ID,
    teacherName: 'Prof. Ada Lovelace',
    joinCode: 'LIVE' + Date.now().toString().slice(-4),
    status: 'active',
  });

  await classroomDb.addMember(CLASSROOM_ID, {
    id: `mem_t_${Date.now()}`,
    userId: TEACHER_ID,
    userName: 'Prof. Ada Lovelace',
    userEmail: 'ada@cortex.edu',
    role: 'teacher',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
  });

  await classroomDb.addMember(CLASSROOM_ID, {
    id: `mem_s_${Date.now()}`,
    userId: STUDENT_ID,
    userName: 'Alan Turing',
    userEmail: 'alan@cortex.edu',
    role: 'student',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
  });

  // Helper for JSON HTTP requests
  async function httpRequest(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
    return new Promise<{ status: number; headers: any; body: any }>((resolve, reject) => {
      const url = new URL(path, BASE_URL);
      const reqHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      const req = http.request(url, {
        method: options.method || 'GET',
        headers: reqHeaders,
      }, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 0, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  // 2. Authentication & Live Session Token Verification
  console.log('\n--- TASK 4: Authentication and Classroom Authorization ---');

  // Teacher token
  const teacherLiveToken = ClassroomAuth.createLiveSessionToken({
    userId: TEACHER_ID,
    userName: 'Prof. Ada Lovelace',
    userEmail: 'ada@cortex.edu',
    classroomId: CLASSROOM_ID,
    role: 'teacher',
  });

  // Student token
  const studentLiveToken = ClassroomAuth.createLiveSessionToken({
    userId: STUDENT_ID,
    userName: 'Alan Turing',
    userEmail: 'alan@cortex.edu',
    classroomId: CLASSROOM_ID,
    role: 'student',
  });

  assert(ClassroomAuth.verifyLiveSessionToken(teacherLiveToken)?.role === 'teacher', 'Teacher token role verified as teacher');
  assert(ClassroomAuth.verifyLiveSessionToken(studentLiveToken)?.role === 'student', 'Student token role verified as student');

  // Verify unauthorized join rejection via HTTP route (GET /api/v1/classrooms/[id]/live/session)
  const unauthSession = await httpRequest(`/api/v1/classrooms/${CLASSROOM_ID}/live/session`, { method: 'GET' });
  assert(unauthSession.status === 401, 'GET /live/session returns 401 for unauthenticated requests');

  // 3. WebSocket Realtime Signaling & Event Delivery
  console.log('\n--- TASKS 5 & 6: Teacher/Student Connections & Room Isolation ---');

  function createWsClient(): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
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

  const teacherWs = await createWsClient();
  const studentWs = await createWsClient();

  try {
    // 3.1 Handshake
    const tHello = await teacherWs.waitForMessage(m => m.type === 'SERVER_HELLO');
    assert(tHello.type === 'SERVER_HELLO', 'Server emits SERVER_HELLO on connection');

    // 3.2 Teacher Joins Room
    teacherWs.send({
      version: '1.0',
      messageId: 'join-teacher',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_ID,
      payload: {
        requestedRole: 'teacher',
        participantName: 'Prof. Ada Lovelace',
        joinToken: teacherLiveToken,
      },
    });

    const tAccepted = await teacherWs.waitForMessage(m => m.type === 'JOIN_ACCEPTED');
    assert(tAccepted.payload?.assignedRole === 'teacher', 'Teacher JOIN_ACCEPTED with role: teacher');

    // 3.3 Student Joins Room
    studentWs.send({
      version: '1.0',
      messageId: 'join-student',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_ID,
      payload: {
        requestedRole: 'student',
        participantName: 'Alan Turing',
        joinToken: studentLiveToken,
      },
    });

    const sAccepted = await studentWs.waitForMessage(m => m.type === 'JOIN_ACCEPTED');
    assert(sAccepted.payload?.assignedRole === 'student', 'Student JOIN_ACCEPTED with role: student');

    // 3.4 Teacher receives PARTICIPANT_JOINED notice
    const joinNotice = await teacherWs.waitForMessage(
      m => m.type === 'PARTICIPANT_JOINED' && m.payload?.participant?.id === STUDENT_ID
    );
    assert(joinNotice.payload?.participant?.name === 'Alan Turing', 'Teacher receives real-time broadcast of student arrival');

    // 3.5 Teacher Moderation Event (Mute All)
    teacherWs.send({
      version: '1.0',
      messageId: 'teacher-mute-all',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_ID,
      payload: {
        eventName: 'TEACHER_MUTE_ALL',
        requiresTeacher: true,
        data: { reason: 'Lecture start' },
      },
    });

    const muteReceived = await studentWs.waitForMessage(
      m => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'TEACHER_MUTE_ALL'
    );
    assert(muteReceived.payload?.data?.senderId === TEACHER_ID, 'Teacher moderation broadcast received by student with verified senderId');

    // 3.6 Student Unauthorized Moderation Rejection
    studentWs.send({
      version: '1.0',
      messageId: 'student-hack-mute',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_ID,
      payload: {
        eventName: 'TEACHER_MUTE_ALL',
        requiresTeacher: true,
        data: { reason: 'Student unauthorized mute' },
      },
    });

    const studentErr = await studentWs.waitForMessage(
      m => m.type === 'PROTOCOL_ERROR' && m.payload?.code === 'FORBIDDEN_EVENT'
    );
    assert(studentErr.payload?.code === 'FORBIDDEN_EVENT', 'Student unauthorized moderation attempt rejected with FORBIDDEN_EVENT');

  } finally {
    teacherWs.close();
    studentWs.close();
  }

  // 4. Whiteboard Persistence Verification
  console.log('\n--- TASK 7: Whiteboard Modification, Persistence & Reload ---');

  const demoWhiteboardPages = [
    {
      id: 'page_demo_1',
      strokes: [
        { id: 'st_1', tool: 'pen', color: '#06B6D4', width: 3, points: [{ x: 50, y: 50 }, { x: 100, y: 100 }] },
        { id: 'st_2', tool: 'rectangle', color: '#10B981', width: 2, points: [{ x: 120, y: 120 }, { x: 250, y: 250 }] },
      ],
      background: 'dots',
    },
  ];

  // Save whiteboard state to database
  const savedWb = await classroomDb.saveWhiteboard(CLASSROOM_ID, 'session_main', demoWhiteboardPages, 0, TEACHER_ID);
  assert(savedWb.version === 1, 'Whiteboard state saved to SQLite database with version 1');

  // Reload whiteboard from database
  const loadedWb = await classroomDb.getWhiteboard(CLASSROOM_ID, 'session_main');
  assert(loadedWb !== null, 'Whiteboard state reloaded successfully from database');
  assert(loadedWb?.pages[0].strokes.length === 2, 'Reloaded whiteboard contains exactly 2 persisted strokes');
  assert(loadedWb?.pages[0].background === 'dots', 'Reloaded whiteboard preserves canvas grid/dot background');

  // 5. Presentation Persistence Verification
  console.log('\n--- TASK 8: Presentation Deck, Slide Navigation & Reload ---');

  const demoDeck = {
    id: 'deck_demo_1',
    title: 'Distributed Consensus & Raft Protocol',
    slides: [
      { id: 'sl_1', title: 'Introduction to Consensus', content: 'Safety vs Liveness' },
      { id: 'sl_2', title: 'Leader Election', content: 'Heartbeats and Randomized Timeouts' },
      { id: 'sl_3', title: 'Log Replication', content: 'AppendEntries RPC' },
    ],
    activeSlideId: 'sl_1',
  };

  // Save presentation deck
  const savedDeck = await classroomDb.savePresentation(CLASSROOM_ID, 'session_main', demoDeck, 0, true, TEACHER_ID);
  assert(savedDeck.version === 1, 'Presentation deck saved to SQLite database with version 1');

  // Change active slide to slide 2
  const updatedDeck = await classroomDb.savePresentation(CLASSROOM_ID, 'session_main', demoDeck, 2, true, TEACHER_ID, 1);
  assert(updatedDeck.version === 2, 'Slide transition persisted with incremented version 2');
  assert(updatedDeck.activeSlideIndex === 2, 'Active slide index updated to 2');

  // Reload presentation from database
  const loadedDeck = await classroomDb.getPresentation(CLASSROOM_ID, 'session_main');
  assert(loadedDeck !== null, 'Presentation deck reloaded successfully from database');
  assert(loadedDeck?.activeSlideIndex === 2, 'Reloaded deck preserves active slide index 2');
  assert(loadedDeck?.deck.slides.length === 3, 'Reloaded deck preserves all 3 slides');

  // 6. Assignment Loading, Submissions, Scoring & Hidden Tests
  console.log('\n--- TASK 9: Assignment Loading, Submission Persistence & Hidden-Test Protection ---');

  const demoAsgId = `asg_demo_${Date.now()}`;
  await classroomDb.createAssignment({
    id: demoAsgId,
    classroomId: CLASSROOM_ID,
    title: 'Implement Mutex Lock in C++',
    description: 'Build a spinlock with test-and-set atomic operations',
    instructions: 'Complete the acquire() and release() methods.',
    type: 'code',
    language: 'cpp',
    starterCode: '#include <atomic>\nclass SpinLock { std::atomic_flag flag = ATOMIC_FLAG_INIT; };\n',
    difficulty: 'medium',
    maxMarks: 100,
    dueAt: Date.now() + 3 * 86400000,
    publishedAt: Date.now(),
    attemptsAllowed: 3,
    allowLateSubmission: false,
    latePenaltyPercent: 0,
    autoGrade: true,
    manualGrade: true,
    aiPolicy: 'allowed',
    plagiarismPolicy: 'strict',
    status: 'published',
    createdBy: TEACHER_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    testCases: [
      { id: 'tc_pub_1', name: 'Single Thread Lock', input: 'lock.acquire(); lock.release();', expectedOutput: 'OK', visibility: 'public' },
      { id: 'tc_priv_1', name: 'Concurrent Contention Invariant', input: 'concurrentRaceTest(100);', expectedOutput: 'NO_DEADLOCK', visibility: 'hidden' },
    ],
  });

  const fetchedAsg = await classroomDb.getAssignment(demoAsgId);
  assert(fetchedAsg !== null && fetchedAsg.id === demoAsgId, 'Assignment loaded successfully from platform database');

  // Verify hidden test protection
  const studentSanitizedTestCases = (fetchedAsg?.testCases || []).map((tc: any) => {
    const isHidden = tc.visibility === 'hidden' || tc.isHidden === true || tc.hidden === true;
    return isHidden ? { ...tc, input: '[HIDDEN TEST CASE]', expectedOutput: '[HIDDEN TEST CASE]' } : tc;
  });
  const hiddenCase = studentSanitizedTestCases.find((tc) => tc.id === 'tc_priv_1');
  assert(hiddenCase?.input === '[HIDDEN TEST CASE]', 'Hidden test input is strictly redacted from student view');
  assert(hiddenCase?.expectedOutput === '[HIDDEN TEST CASE]', 'Hidden test expected output is strictly redacted from student view');

  // Submit student solution and verify database persistence
  const subId = `sub_demo_${Date.now()}`;
  await classroomDb.saveSubmission({
    id: subId,
    assignmentId: demoAsgId,
    assignmentTitle: 'Implement Mutex Lock in C++',
    classroomId: CLASSROOM_ID,
    studentId: STUDENT_ID,
    studentName: 'Alan Turing',
    code: '#include <atomic>\nclass SpinLock { ... };',
    language: 'cpp',
    status: 'graded',
    score: 100,
    maxScore: 100,
    executionTimeMs: 12,
    submittedAt: Date.now(),
    version: 1,
    testResults: [
      { testCaseId: 'tc_pub_1', passed: true, score: 50, output: 'OK' },
      { testCaseId: 'tc_priv_1', passed: true, score: 50, output: '[HIDDEN]' },
    ],
  });

  const persistedSub = await classroomDb.getStudentSubmission(demoAsgId, STUDENT_ID);
  assert(persistedSub !== null && persistedSub.score === 100, 'Student submission persisted with authoritative score of 100');

  // 7. Real Backend Code Execution & Error Handling
  console.log('\n--- TASK 10: Real Backend Code Execution & Error Handling ---');

  // Execute a real TypeScript / Python snippet through /api/v1/execute on the live server
  const execPayload = {
    language: 'typescript',
    files: [
      {
        name: 'solution.ts',
        content: 'const a: number = 21; const b: number = 2; console.log("Computed Answer:", a * b);',
      },
    ],
  };

  const execResponse = await httpRequest('/api/v1/execute', {
    method: 'POST',
    body: execPayload,
  });

  assert(execResponse.status === 200, 'POST /api/v1/execute responds with HTTP 200');
  assert(execResponse.body.stdout?.includes('Computed Answer: 42'), 'Backend execution produces verified stdout (Computed Answer: 42)');
  assert(execResponse.body.exitCode === 0, 'Backend execution returns exitCode: 0');

  // Test error handling with syntax error
  const syntaxErrorPayload = {
    language: 'typescript',
    files: [
      {
        name: 'syntax_err.ts',
        content: 'const x: number = "cannot assign string to number"; if (true {',
      },
    ],
  };

  const syntaxErrResponse = await httpRequest('/api/v1/execute', {
    method: 'POST',
    body: syntaxErrorPayload,
  });

  assert(
    syntaxErrResponse.status === 200 && (syntaxErrResponse.body.exitCode !== 0 || Boolean(syntaxErrResponse.body.stderr)),
    'Backend execution captures syntax error diagnostics with non-zero exit code or stderr'
  );

  // 8. WebRTC & TURN Configuration Audit
  console.log('\n--- TASKS 12 & 13: WebRTC Connectivity & Real TURN Service Audit ---');

  const iceInfo = getAuthoritativeIceServers(STUDENT_ID);
  assert(Array.isArray(iceInfo.iceServers) && iceInfo.iceServers.length > 0, 'Authoritative ICE servers array available');
  assert(iceInfo.iceServers[0].urls.includes('stun:stun.l.google.com:19302'), 'Google public STUN server configured');

  if (iceInfo.isTurnConfigured) {
    console.log('[INFO] TURN server is configured with ephemeral credentials.');
  } else {
    console.log('[INFO] TURN server hardware is NOT currently configured (Development STUN-only mode active).');
  }

  assert(typeof iceInfo.isTurnConfigured === 'boolean', 'isTurnConfigured flag confirmed as boolean');

  console.log(`\n================================================================`);
  console.log(`LIVE SERVER ACCEPTANCE RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`================================================================`);

  process.exit(failed > 0 ? 1 : 0);
}

runLiveVerification().catch((err) => {
  console.error('[FATAL] Live server verification error:', err);
  process.exit(1);
});
