import { WebSocket } from 'ws';
import { ensureNodeWsServer, getNodeWsPort } from '../src/lib/classroom/node-ws-server';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { transpileTypeScript, LANGUAGE_CONFIGS } from '../src/components/live-class/modules/codestudio/codeExecutionEngine';

interface TestClient {
  ws: WebSocket;
  messages: any[];
  waitForMessage: (predicate: (msg: any) => boolean, timeoutMs?: number) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
}

async function runWorkspaceRedesignTests() {
  console.log('================================================================');
  console.log('CORTEX LIVE CLASS — WORKSPACE REDESIGN VERIFICATION SUITE');
  console.log('Testing Teacher/Student Workspaces, Broadcast Lifecycle & Observation');
  console.log('================================================================\n');

  // 1. Ensure server is running
  const port = await ensureNodeWsServer(3002);
  const actualPort = port || getNodeWsPort() || 3002;
  console.log(`[Setup] Signaling server listening on ws://localhost:${actualPort}`);

  const wsUrl = `ws://localhost:${actualPort}`;
  const CLASSROOM_A = 'CLS-CS201-LIVE';
  const CLASSROOM_B = 'CLS-UNAUTHORIZED-ROOM';

  // Seed cryptographically signed tokens
  const teacherToken = ClassroomAuth.createLiveSessionToken({
    userId: 'usr_prof_shivam',
    classroomId: CLASSROOM_A,
    role: 'teacher',
  });

  const student1Token = ClassroomAuth.createLiveSessionToken({
    userId: 'usr_student_alex',
    classroomId: CLASSROOM_A,
    role: 'student',
  });

  const student2Token = ClassroomAuth.createLiveSessionToken({
    userId: 'usr_student_sophia',
    classroomId: CLASSROOM_A,
    role: 'student',
  });

  const classroomBToken = ClassroomAuth.createLiveSessionToken({
    userId: 'usr_student_intruder',
    classroomId: CLASSROOM_B,
    role: 'student',
  });

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

      function waitForMessage(predicate: (msg: any) => boolean, timeoutMs = 5000): Promise<any> {
        const found = messages.find(predicate);
        if (found) return Promise.resolve(found);

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
      }

      function send(msg: any) {
        ws.send(JSON.stringify(msg));
      }

      function close() {
        try { ws.close(); } catch {}
      }

      ws.on('open', () => resolve({ ws, messages, waitForMessage, send, close }));
      ws.on('error', (err) => reject(err));
    });
  }

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const clients: TestClient[] = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: Teacher Workspace Access and Server-Enforced Role
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Teacher & Student Workspace Authorization ---');
    const teacher = await createClient();
    clients.push(teacher);

    teacher.send({
      version: '1.0',
      messageId: 'join-teacher-1',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      payload: {
        requestedRole: 'teacher',
        participantName: 'Prof. Shivam Patil',
        joinToken: teacherToken,
      },
    });

    const teacherJoin = await teacher.waitForMessage(
      (m) => m.type === 'JOIN_ACCEPTED' && m.sessionId === CLASSROOM_A
    );
    assert(
      teacherJoin.payload.assignedRole === 'teacher',
      'Teacher receives server-verified instructor role',
      `Assigned: ${teacherJoin.payload.assignedRole}`
    );

    // Initial broadcast state should be stopped
    const teacherInitBroadcast = await teacher.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'BROADCAST_STATE_CHANGED'
    );
    assert(
      teacherInitBroadcast.payload.data.state === 'stopped',
      'Initial broadcast state in classroom is stopped',
      `State: ${teacherInitBroadcast.payload.data.state}`
    );

    // -------------------------------------------------------------
    // TEST 2: Student Workspace Access & Unpublished Teaching Denial
    // -------------------------------------------------------------
    const student1 = await createClient();
    clients.push(student1);

    student1.send({
      version: '1.0',
      messageId: 'join-student-1',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      payload: {
        requestedRole: 'student',
        participantName: 'Alex Chen',
        joinToken: student1Token,
      },
    });

    const studentJoin = await student1.waitForMessage(
      (m) => m.type === 'JOIN_ACCEPTED' && m.sessionId === CLASSROOM_A
    );
    assert(
      studentJoin.payload.assignedRole === 'student',
      'Student receives verified student role',
      `Assigned: ${studentJoin.payload.assignedRole}`
    );

    // Student receives broadcast state = stopped with empty files (zero leaked drafts)
    const studentInitBroadcast = await student1.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'BROADCAST_STATE_CHANGED'
    );
    assert(
      studentInitBroadcast.payload.data.state === 'stopped' &&
      Array.isArray(studentInitBroadcast.payload.data.files) &&
      studentInitBroadcast.payload.data.files.length === 0,
      'Unpublished teaching content denial: student receives zero unpublished files when broadcast is stopped'
    );

    // -------------------------------------------------------------
    // TEST 3: Student Write & Moderation Denial on Teaching Workspace
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Student Write & Moderation Denial ---');
    student1.send({
      version: '1.0',
      messageId: 'spoof-broadcast-1',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'TEACHER_START_BROADCAST',
        data: { files: [{ id: 'mal', name: 'hack.ts', content: 'malicious' }] },
      },
    });

    const studentSpoofError = await student1.waitForMessage(
      (m) => m.type === 'PROTOCOL_ERROR' && m.payload?.code === 'FORBIDDEN_EVENT'
    );
    assert(
      studentSpoofError.payload.code === 'FORBIDDEN_EVENT',
      'Student write denial on teaching broadcast: students cannot start broadcast'
    );

    student1.send({
      version: '1.0',
      messageId: 'spoof-observe-1',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'OBSERVE_STUDENT_SUBSCRIBE',
        data: { studentId: 'usr_student_sophia' },
      },
    });

    const studentObserveError = await student1.waitForMessage(
      (m) => m.type === 'PROTOCOL_ERROR' && m.payload?.code === 'FORBIDDEN_EVENT'
    );
    assert(
      studentObserveError.payload.code === 'FORBIDDEN_EVENT',
      'Unauthorized student observation denial: students cannot observe peers'
    );

    // -------------------------------------------------------------
    // TEST 4: Broadcasting Lifecycle: Start, Code Update, Pause, Resume, Stop
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Authoritative Broadcasting Lifecycle ---');
    const publishedFiles = [
      {
        id: 'tf1',
        name: 'avl_tree.ts',
        language: 'typescript',
        content: 'export class AVLNode { key: number; }',
      },
      {
        id: 'tf2',
        name: 'solution.py',
        language: 'python',
        content: 'def solve(): return 42',
      },
    ];

    // 4A: Start Broadcast
    teacher.send({
      version: '1.0',
      messageId: 'teacher-start-bcast',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'TEACHER_START_BROADCAST',
        data: {
          files: publishedFiles,
          activeFileId: 'tf1',
        },
      },
    });

    const studentBcastStart = await student1.waitForMessage(
      (m) =>
        m.type === 'CLASSROOM_EVENT' &&
        m.payload?.eventName === 'BROADCAST_STATE_CHANGED' &&
        m.payload?.data?.state === 'broadcasting'
    );
    assert(
      studentBcastStart.payload.data.state === 'broadcasting' &&
      studentBcastStart.payload.data.files.length === 2 &&
      studentBcastStart.payload.data.files[0].name === 'avl_tree.ts',
      'Broadcast Start: Published teaching code successfully received by student in Instructor Demonstration'
    );

    // 4B: Live Code Update while Broadcasting
    teacher.send({
      version: '1.0',
      messageId: 'teacher-code-update-1',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'TEACHER_CODE_BROADCAST',
        data: {
          fileId: 'tf1',
          content: 'export class AVLNode { key: number; height: number; }',
        },
      },
    });

    const studentCodeUpdate = await student1.waitForMessage(
      (m) =>
        m.type === 'CLASSROOM_EVENT' &&
        m.payload?.eventName === 'TEACHER_CODE_UPDATE' &&
        m.payload?.data?.fileId === 'tf1'
    );
    assert(
      studentCodeUpdate.payload.data.content.includes('height: number;'),
      'Live Code Streaming: Student receives teacher code edit in real time'
    );

    // 4C: Pause Broadcast (Freeze live updates; preserve snapshot)
    teacher.send({
      version: '1.0',
      messageId: 'teacher-pause-bcast',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'TEACHER_PAUSE_BROADCAST',
        data: {},
      },
    });

    const studentBcastPause = await student1.waitForMessage(
      (m) =>
        m.type === 'CLASSROOM_EVENT' &&
        m.payload?.eventName === 'BROADCAST_STATE_CHANGED' &&
        m.payload?.data?.state === 'paused'
    );
    assert(
      studentBcastPause.payload.data.state === 'paused',
      'Broadcast Pause: State transitions to paused; snapshot remains visible'
    );

    // 4D: Resume Broadcast
    teacher.send({
      version: '1.0',
      messageId: 'teacher-resume-bcast',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'TEACHER_RESUME_BROADCAST',
        data: {},
      },
    });

    const studentBcastResume = await student1.waitForMessage(
      (m) =>
        m.type === 'CLASSROOM_EVENT' &&
        m.payload?.eventName === 'BROADCAST_STATE_CHANGED' &&
        m.payload?.data?.state === 'broadcasting'
    );
    assert(
      studentBcastResume.payload.data.state === 'broadcasting',
      'Broadcast Resume: State transitions back to broadcasting'
    );

    // 4E: Stop Broadcast (Revoke student access to unpublished code)
    teacher.send({
      version: '1.0',
      messageId: 'teacher-stop-bcast',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'TEACHER_STOP_BROADCAST',
        data: {},
      },
    });

    const studentBcastStop = await student1.waitForMessage(
      (m) =>
        m.type === 'CLASSROOM_EVENT' &&
        m.payload?.eventName === 'BROADCAST_STATE_CHANGED' &&
        m.payload?.data?.state === 'stopped'
    );
    assert(
      studentBcastStop.payload.data.state === 'stopped' &&
      studentBcastStop.payload.data.files.length === 0,
      'Broadcast Stop: Revokes student access and clears unpublished files'
    );

    // -------------------------------------------------------------
    // TEST 5: Teacher Observation of Authorized Students
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Teacher Observation of Authorized Students ---');
    // Connect second student (Sophia)
    const student2 = await createClient();
    clients.push(student2);

    student2.send({
      version: '1.0',
      messageId: 'join-student-2',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      payload: {
        requestedRole: 'student',
        participantName: 'Sophia Patel',
        joinToken: student2Token,
      },
    });
    await student2.waitForMessage((m) => m.type === 'JOIN_ACCEPTED');

    // Student 1 updates their My Workspace
    const student1Files = [
      {
        id: 'sf_alex_1',
        name: 'alex_solution.ts',
        language: 'typescript',
        content: 'function testRotation() { return true; }',
      },
    ];

    student1.send({
      version: '1.0',
      messageId: 'student1-workspace-update',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'STUDENT_WORKSPACE_UPDATE',
        data: {
          files: student1Files,
          activeFileId: 'sf_alex_1',
        },
      },
    });

    // Teacher observes Student 1
    teacher.send({
      version: '1.0',
      messageId: 'teacher-observe-student1',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'OBSERVE_STUDENT_SUBSCRIBE',
        data: { studentId: 'usr_student_alex' },
      },
    });

    const teacherObsStream = await teacher.waitForMessage(
      (m) =>
        m.type === 'CLASSROOM_EVENT' &&
        m.payload?.eventName === 'STUDENT_WORKSPACE_STREAM' &&
        m.payload?.data?.studentId === 'usr_student_alex'
    );
    assert(
      teacherObsStream.payload.data.studentId === 'usr_student_alex' &&
      teacherObsStream.payload.data.files[0].name === 'alex_solution.ts',
      'Teacher Observation: Teacher receives live code stream of observed student'
    );

    // Verify Student 2 DID NOT receive Student 1's code (Strict isolation)
    const student2GotStudent1 = student2.messages.some(
      (m) =>
        m.type === 'CLASSROOM_EVENT' &&
        m.payload?.eventName === 'STUDENT_WORKSPACE_STREAM'
    );
    assert(
      !student2GotStudent1,
      'Student Workspace Isolation: Other students do not receive peer workspace streams'
    );

    // -------------------------------------------------------------
    // TEST 6: Cross-Classroom Event & Observation Denial
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Cross-Classroom Boundary Protection ---');
    const intruder = await createClient();
    clients.push(intruder);

    intruder.send({
      version: '1.0',
      messageId: 'join-intruder',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_B,
      payload: {
        requestedRole: 'student',
        participantName: 'Intruder',
        joinToken: classroomBToken,
      },
    });
    await intruder.waitForMessage((m) => m.type === 'JOIN_ACCEPTED');

    // Intruder attempts to send event into CLASSROOM_A
    intruder.send({
      version: '1.0',
      messageId: 'intruder-cross-event',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'OBSERVE_STUDENT_SUBSCRIBE',
        data: { studentId: 'usr_student_alex' },
      },
    });

    const crossError = await intruder.waitForMessage(
      (m) => m.type === 'PROTOCOL_ERROR' && m.payload?.code === 'CROSS_CLASSROOM_FORBIDDEN'
    );
    assert(
      crossError.payload.code === 'CROSS_CLASSROOM_FORBIDDEN',
      'Cross-Classroom Denial: Cross-classroom event broadcast is rejected by server'
    );

    // -------------------------------------------------------------
    // TEST 7: Code Execution Honesty Labels
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Code Execution Honesty & Status Labels ---');
    assert(
      LANGUAGE_CONFIGS.typescript.supportBadge === 'Execution Ready' &&
      LANGUAGE_CONFIGS.python.supportBadge === 'Execution Ready' &&
      LANGUAGE_CONFIGS.cpp.supportBadge === 'Execution Ready' &&
      LANGUAGE_CONFIGS.rust.supportBadge === 'Execution Ready',
      'Execution Labels: Misleading sandbox labels replaced with honest "Execution Ready" state'
    );

    const tsSource = `
      interface TestNode { val: number; }
      const n: TestNode = { val: 10 };
      console.log(n.val);
    `;
    const transpiled = transpileTypeScript(tsSource);
    assert(
      !transpiled.includes('interface TestNode') && transpiled.includes('const n = { val: 10 }'),
      'Transpilation Engine: Strips interface types cleanly for client execution'
    );

    // -------------------------------------------------------------
    // TEST 8: Whiteboard & Presentation Regression Verification
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Regression Verification ---');
    teacher.send({
      version: '1.0',
      messageId: 'wb-stroke-test',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'WHITEBOARD_STROKE_ADDED',
        data: { strokeId: 'stk_1', points: [0, 0, 10, 10] },
      },
    });

    const studentWb = await student1.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'WHITEBOARD_STROKE_ADDED'
    );
    assert(
      studentWb.payload.data.strokeId === 'stk_1',
      'Whiteboard Regression: Drawing strokes synchronize without interference'
    );

    teacher.send({
      version: '1.0',
      messageId: 'pres-slide-test',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      payload: {
        eventName: 'SLIDE_CHANGED',
        data: { slideIndex: 3 },
      },
    });

    const studentPres = await student1.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'SLIDE_CHANGED'
    );
    assert(
      studentPres.payload.data.slideIndex === 3,
      'Presentation Regression: Slide synchronization functions properly'
    );

  } finally {
    clients.forEach((c) => c.close());
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runWorkspaceRedesignTests().catch((err) => {
  console.error('[FATAL TEST SUITE ERROR]', err);
  process.exit(1);
});
