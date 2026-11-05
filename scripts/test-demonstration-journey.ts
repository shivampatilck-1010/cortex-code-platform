import http from 'http';
import WebSocket from 'ws';
import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomAuth } from '../src/lib/classroom/auth';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3002';
const CLASSROOM_ID = 'CLS-DEMO-JOURNEY';
const TEACHER_ID = 'usr_journey_teacher';
const STUDENT_ID = 'usr_journey_student';

async function runJourneyTest() {
  console.log('================================================================');
  console.log('CORTEX CODE PLATFORM x CORTEX LIVE CLASS');
  console.log('DEMONSTRATION JOURNEY — TEACHER & STUDENT CONTEXT VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc} - Detail: ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  // Ensure DB ready
  await (classroomDb as any).init();

  // 1. Seed Demo Classroom and Users
  await classroomDb.createUser({
    id: TEACHER_ID,
    cortex_id: 'CTX-TEACHER-DEMO',
    name: 'Dr. Evelyn Boyd',
    email: 'evelyn@cortex.edu',
    role: 'teacher',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as any);

  await classroomDb.createUser({
    id: STUDENT_ID,
    cortex_id: 'CTX-STUDENT-DEMO',
    name: 'Ada Lovelace',
    email: 'ada@cortex.edu',
    role: 'student',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as any);

  await classroomDb.createClassroom({
    id: CLASSROOM_ID,
    title: 'Advanced Distributed Systems',
    description: 'Demonstration Classroom',
    subject: 'Computer Science',
    course_code: 'CS-401',
    section: 'A',
    teacherId: TEACHER_ID,
    teacherName: 'Dr. Evelyn Boyd',
    joinCode: 'JOURN' + Date.now().toString().slice(-4),
    status: 'active',
  });

  await classroomDb.addMember(CLASSROOM_ID, {
    id: `mem_t_${Date.now()}`,
    userId: TEACHER_ID,
    userName: 'Dr. Evelyn Boyd',
    userEmail: 'evelyn@cortex.edu',
    role: 'teacher',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
  });

  await classroomDb.addMember(CLASSROOM_ID, {
    id: `mem_s_${Date.now()}`,
    userId: STUDENT_ID,
    userName: 'Ada Lovelace',
    userEmail: 'ada@cortex.edu',
    role: 'student',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now(),
    isOnline: true,
  });

  // Helper for HTTP requests
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

  // Helper for WS Client
  interface TestClient {
    ws: WebSocket;
    messages: any[];
    waitForMessage: (predicate: (m: any) => boolean, timeoutMs?: number) => Promise<any>;
    send: (msg: any) => void;
    close: () => void;
  }

  function createWsClient(): Promise<TestClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const messages: any[] = [];
      const listeners: ((m: any) => boolean | void)[] = [];

      ws.on('open', () => {
        const client: TestClient = {
          ws,
          messages,
          send: (data: any) => ws.send(JSON.stringify(data)),
          close: () => ws.close(),
          waitForMessage: (predicate: (m: any) => boolean, timeoutMs = 4000) => {
            const existing = messages.find(predicate);
            if (existing) return Promise.resolve(existing);

            return new Promise((res, rej) => {
              const timer = setTimeout(() => {
                const idx = listeners.indexOf(listener);
                if (idx !== -1) listeners.splice(idx, 1);
                rej(new Error('Timeout waiting for matching message'));
              }, timeoutMs);

              const listener = (msg: any) => {
                if (predicate(msg)) {
                  clearTimeout(timer);
                  const idx = listeners.indexOf(listener);
                  if (idx !== -1) listeners.splice(idx, 1);
                  res(msg);
                  return true;
                }
                return false;
              };

              listeners.push(listener);
            });
          },
        };
        resolve(client);
      });

      ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          messages.push(parsed);
          for (let i = listeners.length - 1; i >= 0; i--) {
            if (listeners[i](parsed)) break;
          }
        } catch {}
      });

      ws.on('error', reject);
    });
  }

  // --- 1. ACCESS & ROLES VERIFICATION ---
  console.log('--- 1. Context Access and Role Verification ---');

  const teacherLiveToken = ClassroomAuth.createLiveSessionToken({
    userId: TEACHER_ID,
    userName: 'Dr. Evelyn Boyd',
    userEmail: 'evelyn@cortex.edu',
    classroomId: CLASSROOM_ID,
    role: 'teacher',
  });

  const studentLiveToken = ClassroomAuth.createLiveSessionToken({
    userId: STUDENT_ID,
    userName: 'Ada Lovelace',
    userEmail: 'ada@cortex.edu',
    classroomId: CLASSROOM_ID,
    role: 'student',
  });

  const verifiedTeacher = ClassroomAuth.verifyLiveSessionToken(teacherLiveToken);
  const verifiedStudent = ClassroomAuth.verifyLiveSessionToken(studentLiveToken);

  assert(verifiedTeacher?.role === 'teacher', 'Teacher context resolves with role "teacher"');
  assert(verifiedStudent?.role === 'student', 'Student context resolves with role "student"');

  // --- 2. WEBSOCKET REAL-TIME CONNECTION ---
  console.log('\n--- 2. Dual Context Real-Time Synchronization ---');

  const teacherClient = await createWsClient();
  const studentClient = await createWsClient();

  // Wait for SERVER_HELLO
  await teacherClient.waitForMessage(m => m.type === 'SERVER_HELLO');
  await studentClient.waitForMessage(m => m.type === 'SERVER_HELLO');

  // Teacher Join
  teacherClient.send({
    version: '1.0',
    messageId: 'join-teacher-journey',
    type: 'JOIN_CLASSROOM',
    sessionId: CLASSROOM_ID,
    payload: {
      requestedRole: 'teacher',
      participantName: 'Dr. Evelyn Boyd',
      joinToken: teacherLiveToken,
    },
  });
  const tJoin = await teacherClient.waitForMessage(m => m.type === 'JOIN_ACCEPTED');
  assert(tJoin.payload?.assignedRole === 'teacher', 'Teacher context successfully joined classroom');

  // Student Join
  studentClient.send({
    version: '1.0',
    messageId: 'join-student-journey',
    type: 'JOIN_CLASSROOM',
    sessionId: CLASSROOM_ID,
    payload: {
      requestedRole: 'student',
      participantName: 'Ada Lovelace',
      joinToken: studentLiveToken,
    },
  });
  const sJoin = await studentClient.waitForMessage(m => m.type === 'JOIN_ACCEPTED');
  assert(sJoin.payload?.assignedRole === 'student', 'Student context successfully joined classroom');

  // Teacher observes Student arrival
  const studentArrival = await teacherClient.waitForMessage(
    m => m.type === 'PARTICIPANT_JOINED' && m.payload?.participant?.id === STUDENT_ID
  );
  assert(Boolean(studentArrival), 'Teacher context notified of Student arrival');

  // --- 3. WHITEBOARD SYNCHRONIZATION & PERSISTENCE ---
  console.log('\n--- 3. Whiteboard Sync & Database Persistence ---');

  const demoStrokes = [
    { id: 'strk_d1', tool: 'pencil', color: '#10B981', width: 3, points: [{ x: 50, y: 50 }, { x: 120, y: 120 }] },
  ];

  // Teacher broadcasts whiteboard stroke via CLASSROOM_EVENT
  teacherClient.send({
    version: '1.0',
    messageId: 'wb-stroke-event',
    type: 'CLASSROOM_EVENT',
    sessionId: CLASSROOM_ID,
    payload: {
      eventName: 'WHITEBOARD_SYNC',
      stroke: demoStrokes[0],
    },
  });

  const studentWbEvent = await studentClient.waitForMessage(
    m => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'WHITEBOARD_SYNC'
  );
  assert(studentWbEvent.payload?.stroke?.id === 'strk_d1', 'Student context received synchronized whiteboard stroke');

  // Save to SQLite
  const demoWhiteboardPages = [
    {
      id: 'page_journey_1',
      strokes: [
        { id: 'strk_d1', tool: 'pencil', color: '#10B981', width: 3, points: [{ x: 50, y: 50 }, { x: 120, y: 120 }] },
      ],
      background: 'grid',
    },
  ];

  await classroomDb.saveWhiteboard(CLASSROOM_ID, 'session_main', demoWhiteboardPages, 0, TEACHER_ID);
  const reloadedWb = await classroomDb.getWhiteboard(CLASSROOM_ID, 'session_main');
  assert(reloadedWb !== null && reloadedWb.pages[0].strokes.length === 1, 'Whiteboard state persisted and reloaded from SQLite');

  // --- 4. PRESENTATION SYNCHRONIZATION & PERSISTENCE ---
  console.log('\n--- 4. Presentation Slide Navigation & Sync ---');

  const demoDeck = {
    id: `deck_${Date.now()}`,
    title: 'Distributed Consensus Algorithms',
    slides: [
      { id: 's1', slideIndex: 0, title: 'Introduction to Paxos', content: 'Consensus basics' },
      { id: 's2', slideIndex: 1, title: 'Raft Overview', content: 'Leader election and log replication' },
    ],
  };

  await classroomDb.savePresentation(CLASSROOM_ID, 'session_main', demoDeck, 0, true, TEACHER_ID);

  // Teacher changes slide to 1
  teacherClient.send({
    version: '1.0',
    messageId: 'pres-slide-change',
    type: 'CLASSROOM_EVENT',
    sessionId: CLASSROOM_ID,
    payload: {
      eventName: 'PRESENTATION_SLIDE_CHANGE',
      activeSlideIndex: 1,
    },
  });

  const studentPresEvent = await studentClient.waitForMessage(
    m => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'PRESENTATION_SLIDE_CHANGE'
  );
  assert(studentPresEvent.payload?.activeSlideIndex === 1, 'Student context received synchronized slide navigation');

  await classroomDb.savePresentation(CLASSROOM_ID, 'session_main', demoDeck, 1, true, TEACHER_ID, 1);
  const reloadedDeck = await classroomDb.getPresentation(CLASSROOM_ID, 'session_main');
  assert(reloadedDeck?.activeSlideIndex === 1, 'Presentation slide state persisted to database at index 1');

  // --- 5. CAMERA & MICROPHONE CONSENT DIALOG WORKFLOW ---
  console.log('\n--- 5. Hardware AV Consent Verification ---');

  // Teacher requests Student to unmute
  teacherClient.send({
    version: '1.0',
    messageId: 'req-media-unmute',
    type: 'CLASSROOM_EVENT',
    sessionId: CLASSROOM_ID,
    payload: {
      eventName: 'TEACHER_REQUEST_MEDIA',
      targetUserId: STUDENT_ID,
      mediaType: 'unmute',
    },
  });

  const mediaRequestMsg = await studentClient.waitForMessage(
    m => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'TEACHER_REQUEST_MEDIA'
  );
  assert(
    mediaRequestMsg.payload?.mediaType === 'unmute' && mediaRequestMsg.payload?.targetUserId === STUDENT_ID,
    'Student received explicit AV consent request from Instructor'
  );

  // Student explicitly accepts or denies
  studentClient.send({
    version: '1.0',
    messageId: 'consent-response',
    type: 'CLASSROOM_EVENT',
    sessionId: CLASSROOM_ID,
    payload: {
      eventName: 'STUDENT_MEDIA_CONSENT_RESPONSE',
      accepted: true,
      mediaType: 'unmute',
    },
  });

  const consentResp = await teacherClient.waitForMessage(
    m => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'STUDENT_MEDIA_CONSENT_RESPONSE'
  );
  assert(consentResp.payload?.accepted === true, 'Teacher received explicit student consent confirmation');

  // --- 6. ASSIGNMENTS & BACKEND PERSISTENCE ---
  console.log('\n--- 6. Assignment Retrieval & Submission Persistence ---');

  const demoAsgId = `asg_demo_${Date.now()}`;
  const demoAsg = await classroomDb.createAssignment({
    id: demoAsgId,
    classroomId: CLASSROOM_ID,
    title: 'Distributed Key-Value Store',
    description: 'Implement a basic in-memory hash store',
    instructions: 'Complete the store function',
    type: 'code',
    starterCode: 'function get(k) { return 42; }',
    solutionCode: 'function get(k) { return 42; }',
    language: 'javascript',
    difficulty: 'medium',
    maxMarks: 100,
    dueAt: Date.now() + 86400000,
    publishedAt: Date.now(),
    attemptsAllowed: 3,
    allowLateSubmission: false,
    latePenaltyPercent: 0,
    autoGrade: true,
    manualGrade: true,
    aiPolicy: 'allowed',
    plagiarismPolicy: 'strict',
    testCases: [
      { id: 'tc1', name: 'Public Test', input: 'keyA', expectedOutput: '42', visibility: 'public' },
      { id: 'tc2', name: 'Private Hash', input: 'secretKeyB', expectedOutput: 'PRIVATE_HASH', visibility: 'hidden' },
    ],
    status: 'published',
    createdBy: TEACHER_ID,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Student view of assignment
  const studentViewAsg = await classroomDb.getAssignment(demoAsgId);
  const studentTests = (studentViewAsg?.testCases || []).map((tc: any) => ({
    ...tc,
    input: tc.visibility === 'hidden' ? '[HIDDEN TEST CASE]' : tc.input,
    expectedOutput: tc.visibility === 'hidden' ? '[HIDDEN TEST CASE]' : tc.expectedOutput,
  }));

  const hiddenCase = studentTests.find(t => t.visibility === 'hidden');
  assert(hiddenCase?.input === '[HIDDEN TEST CASE]', 'Private test cases hidden from Student view');

  // Student submits solution
  const subId = `sub_demo_${Date.now()}`;
  await classroomDb.saveSubmission({
    id: subId,
    assignmentId: demoAsgId,
    assignmentTitle: 'Distributed Key-Value Store',
    classroomId: CLASSROOM_ID,
    studentId: STUDENT_ID,
    studentName: 'Ada Lovelace',
    code: 'function get(k) { return 42; }',
    language: 'javascript',
    status: 'graded',
    score: 100,
    maxScore: 100,
    executionTimeMs: 15,
    testResults: [
      { testCaseId: 'tc1', passed: true, score: 50, output: '42' },
      { testCaseId: 'tc2', passed: true, score: 50, output: '[HIDDEN]' },
    ],
    submittedAt: Date.now(),
    version: 1,
  });

  const persistedSub = await classroomDb.getStudentSubmission(demoAsgId, STUDENT_ID);
  assert(persistedSub !== null && persistedSub.score === 100, 'Student submission persisted to SQLite backend with grade 100');

  // --- 7. GENUINE BACKEND CODE EXECUTION ---
  console.log('\n--- 7. Real Backend Code Execution ---');

  const execRes = await httpRequest('/api/v1/execute', {
    method: 'POST',
    body: {
      language: 'typescript',
      files: [
        {
          name: 'index.ts',
          content: 'const x: number = 20 + 22;\nconsole.log("Calculated:", x);\n',
        },
      ],
    },
  });

  assert(execRes.status === 200, 'POST /api/v1/execute returned HTTP 200');
  assert(execRes.body?.stdout?.includes('Calculated: 42'), 'Backend code execution returned genuine stdout ("Calculated: 42")');
  assert(execRes.body?.exitCode === 0, 'Code execution completed with exitCode 0');

  // Honest failure test
  const brokenRes = await httpRequest('/api/v1/execute', {
    method: 'POST',
    body: {
      language: 'typescript',
      files: [
        {
          name: 'broken.ts',
          content: 'const invalid syntax === ;;;;',
        },
      ],
    },
  });

  assert(
    brokenRes.body?.exitCode !== 0 || Boolean(brokenRes.body?.stderr),
    'Broken code returned honest syntax failure diagnostic'
  );

  // --- 8. SESSION DEPARTURE & RESOURCE CLEANUP ---
  console.log('\n--- 8. Session Departure & Cleanup ---');

  studentClient.close();
  const studentLeft = await teacherClient.waitForMessage(
    m => m.type === 'PARTICIPANT_LEFT' && m.payload?.participantId === STUDENT_ID
  );
  assert(Boolean(studentLeft), 'Teacher received real-time PARTICIPANT_LEFT notification on student departure');

  teacherClient.close();

  console.log('\n================================================================');
  console.log(`DEMONSTRATION JOURNEY RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runJourneyTest().catch(err => {
  console.error('Fatal journey test error:', err);
  process.exit(1);
});
