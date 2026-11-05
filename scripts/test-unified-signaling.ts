import { WebSocket } from 'ws';
import { ensureNodeWsServer, getNodeWsPort } from '../src/lib/classroom/node-ws-server';
import { ClassroomAuth } from '../src/lib/classroom/auth';

interface TestClient {
  ws: WebSocket;
  messages: any[];
  waitForMessage: (predicate: (msg: any) => boolean, timeoutMs?: number) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
}

async function runSignalingTests() {
  console.log('================================================================');
  console.log('TASK 1 — UNIFIED WEBSOCKET SIGNALING TEST SUITE');
  console.log('Testing authoritative signaling on port 3002 with Live Class protocol');
  console.log('================================================================\n');

  // 1. Ensure server is running
  const port = await ensureNodeWsServer(3002);
  const actualPort = port || getNodeWsPort() || 3002;
  console.log(`[Setup] Signaling server listening on ws://localhost:${actualPort}`);

  const wsUrl = `ws://localhost:${actualPort}`;
  const CLASSROOM_A = 'CLS-CS201-LIVE';
  const CLASSROOM_B = 'CLS-MATH301';

  // Seed sample signed tokens
  const teacherToken = ClassroomAuth.createLiveSessionToken({
    userId: 'usr_teacher_shivam',
    classroomId: CLASSROOM_A,
    role: 'teacher',
  });

  const studentToken = ClassroomAuth.createLiveSessionToken({
    userId: 'usr_student_alex',
    classroomId: CLASSROOM_A,
    role: 'student',
  });

  const classroomBToken = ClassroomAuth.createLiveSessionToken({
    userId: 'usr_student_bob',
    classroomId: CLASSROOM_B,
    role: 'student',
  });

  // Helper to connect with incoming message buffering
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

      function waitForMessage(predicate: (msg: any) => boolean, timeoutMs = 4000): Promise<any> {
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
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failed++;
    }
  }

  try {
    // Test 1: Initial SERVER_HELLO handshake on connect
    const c1 = await createClient();
    const hello = await c1.waitForMessage((m) => m.type === 'SERVER_HELLO');
    assert(
      hello.version === '1.0' && hello.payload?.serverVersion === '1.0',
      'Test 1: Server emits standard SERVER_HELLO handshake upon connection'
    );

    // Test 2: Valid teacher join with signed session token
    c1.send({
      version: '1.0',
      messageId: 'join-teacher-1',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        requestedRole: 'teacher',
        participantName: 'Prof. Shivam Patil',
        joinToken: teacherToken,
      },
    });

    const joinAcceptedTeacher = await c1.waitForMessage((m) => m.type === 'JOIN_ACCEPTED');
    assert(
      joinAcceptedTeacher.payload?.assignedParticipantId === 'usr_teacher_shivam' &&
        joinAcceptedTeacher.payload?.assignedRole === 'teacher' &&
        joinAcceptedTeacher.payload?.sessionId === CLASSROOM_A,
      'Test 2: Valid teacher joins with signed session token and receives JOIN_ACCEPTED'
    );

    // Test 3 & 4: Valid student join with signed session token & teacher notification
    const cStudent = await createClient();
    await cStudent.waitForMessage((m) => m.type === 'SERVER_HELLO');

    cStudent.send({
      version: '1.0',
      messageId: 'join-student-1',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        requestedRole: 'student',
        participantName: 'Alex Chen',
        joinToken: studentToken,
      },
    });

    const joinAcceptedStudent = await cStudent.waitForMessage((m) => m.type === 'JOIN_ACCEPTED');
    const participantJoinedNotice = await c1.waitForMessage((m) => m.type === 'PARTICIPANT_JOINED');

    assert(
      joinAcceptedStudent.payload?.assignedParticipantId === 'usr_student_alex' &&
        joinAcceptedStudent.payload?.assignedRole === 'student',
      'Test 3: Valid student joins and receives JOIN_ACCEPTED with role "student"'
    );

    assert(
      participantJoinedNotice.payload?.participant?.id === 'usr_student_alex' &&
        participantJoinedNotice.payload?.participant?.role === 'student',
      'Test 4: Teacher receives PARTICIPANT_JOINED broadcast with accurate participant metadata'
    );

    // Test 5: Rejection of connection without token
    const cNoToken = await createClient();
    await cNoToken.waitForMessage((m) => m.type === 'SERVER_HELLO');

    cNoToken.send({
      version: '1.0',
      messageId: 'join-no-token',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        requestedRole: 'student',
        participantName: 'Hacker',
      },
    });

    const rejectedNoToken = await cNoToken.waitForMessage((m) => m.type === 'JOIN_REJECTED');
    assert(
      rejectedNoToken.payload?.code === 'UNAUTHORIZED',
      'Test 5: Join attempt without liveSessionToken is strictly rejected with UNAUTHORIZED'
    );
    cNoToken.close();

    // Test 6: Rejection of invalid / tampered token
    const cTampered = await createClient();
    await cTampered.waitForMessage((m) => m.type === 'SERVER_HELLO');

    cTampered.send({
      version: '1.0',
      messageId: 'join-tampered',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        requestedRole: 'teacher',
        participantName: 'Fake Teacher',
        joinToken: teacherToken.substring(0, teacherToken.length - 6) + 'xxxxxx',
      },
    });

    const rejectedTampered = await cTampered.waitForMessage((m) => m.type === 'JOIN_REJECTED');
    assert(
      rejectedTampered.payload?.code === 'INVALID_TOKEN',
      'Test 6: Join attempt with tampered signature is strictly rejected'
    );
    cTampered.close();

    // Test 7: Rejection of cross-classroom token reuse
    const cCrossClass = await createClient();
    await cCrossClass.waitForMessage((m) => m.type === 'SERVER_HELLO');

    cCrossClass.send({
      version: '1.0',
      messageId: 'join-cross',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        requestedRole: 'student',
        participantName: 'Bob Cross',
        joinToken: classroomBToken, // Bound to CLASSROOM_B
      },
    });

    const rejectedCross = await cCrossClass.waitForMessage((m) => m.type === 'JOIN_REJECTED');
    assert(
      rejectedCross.payload?.code === 'INVALID_TOKEN',
      'Test 7: Cross-classroom token reuse is strictly rejected'
    );
    cCrossClass.close();

    // Test 8: Student attempt at teacher-only moderation event
    cStudent.send({
      version: '1.0',
      messageId: 'evt-student-mute-all',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        eventName: 'TEACHER_MUTE_ALL',
        requiresTeacher: true,
        data: {},
      },
    });

    const studentMuteRejected = await cStudent.waitForMessage((m) => m.type === 'PROTOCOL_ERROR');
    assert(
      studentMuteRejected.payload?.code === 'FORBIDDEN_EVENT',
      'Test 8: Student attempt to emit TEACHER_MUTE_ALL is strictly rejected with FORBIDDEN_EVENT'
    );

    // Test 9: Teacher allowed to emit moderation event
    c1.send({
      version: '1.0',
      messageId: 'evt-teacher-mute-all',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        eventName: 'TEACHER_MUTE_ALL',
        requiresTeacher: true,
        data: {},
      },
    });

    const studentReceivedMute = await cStudent.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'TEACHER_MUTE_ALL'
    );
    assert(
      studentReceivedMute.payload?.eventName === 'TEACHER_MUTE_ALL' &&
        studentReceivedMute.payload?.senderId === 'usr_teacher_shivam',
      'Test 9: Teacher is authorized to emit TEACHER_MUTE_ALL, broadcast to students with authoritative senderId'
    );

    // Test 10: Forged sender identity is authoritatively overwritten
    cStudent.send({
      version: '1.0',
      messageId: 'evt-student-forged-identity',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        eventName: 'WEBRTC_ICE_CANDIDATE',
        data: {
          senderId: 'usr_spoofed_victim', // Spoofed sender
          candidate: { candidate: 'candidate:1 1 UDP ...' },
        },
      },
    });

    const receivedIceEvent = await c1.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'WEBRTC_ICE_CANDIDATE'
    );
    assert(
      receivedIceEvent.payload?.data?.senderId === 'usr_student_alex' &&
        receivedIceEvent.payload?.senderId === 'usr_student_alex',
      'Test 10: Server authoritatively overwrites spoofed senderId with authenticated user ID'
    );

    // Test 11: Cross-classroom isolation (events in Room A do NOT leak to Room B)
    const cRoomB = await createClient();
    await cRoomB.waitForMessage((m) => m.type === 'SERVER_HELLO');

    cRoomB.send({
      version: '1.0',
      messageId: 'join-room-b',
      type: 'JOIN_CLASSROOM',
      sessionId: CLASSROOM_B,
      timestamp: Date.now(),
      payload: {
        requestedRole: 'student',
        participantName: 'Bob in Room B',
        joinToken: classroomBToken,
      },
    });
    await cRoomB.waitForMessage((m) => m.type === 'JOIN_ACCEPTED');

    // Broadcast secret event in Room A
    c1.send({
      version: '1.0',
      messageId: 'evt-room-a-private',
      type: 'CLASSROOM_EVENT',
      sessionId: CLASSROOM_A,
      timestamp: Date.now(),
      payload: {
        eventName: 'SECRET_ROOM_A_EVENT',
        data: { secret: 'room_a_only' },
      },
    });

    // Confirm cStudent gets it
    const studentGotSecret = await cStudent.waitForMessage(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'SECRET_ROOM_A_EVENT'
    );

    // Wait 400ms to verify Room B does NOT get it
    await new Promise((r) => setTimeout(r, 400));
    const leakedToRoomB = cRoomB.messages.some(
      (m) => m.type === 'CLASSROOM_EVENT' && m.payload?.eventName === 'SECRET_ROOM_A_EVENT'
    );

    assert(
      studentGotSecret && !leakedToRoomB,
      'Test 11: Cross-classroom isolation verified: events in Room A never reach Room B'
    );

    // Test 12: Disconnect cleanup triggers PARTICIPANT_LEFT
    cStudent.close();
    const participantLeftNotice = await c1.waitForMessage((m) => m.type === 'PARTICIPANT_LEFT');
    assert(
      participantLeftNotice.payload?.participantId === 'usr_student_alex',
      'Test 12: Disconnect cleanup triggers PARTICIPANT_LEFT broadcast to remaining room peers'
    );

    // Clean up
    c1.close();
    cRoomB.close();
  } catch (err: any) {
    console.error('[FATAL] Test execution error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSignalingTests();
