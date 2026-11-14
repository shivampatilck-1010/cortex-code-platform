import assert from 'node:assert';
import { ClassroomRoomDO } from '../src/lib/classroom/durable-object';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { classroomDb } from '../src/lib/classroom/db';

// Mock WebSocket implementation supporting Cloudflare Hibernation Attachment API
class MockWebSocket {
  public readyState: number = 1; // OPEN
  public sentMessages: string[] = [];
  public attachment: any = null;
  public eventListeners: Map<string, Function[]> = new Map();

  serializeAttachment(attachment: any) {
    this.attachment = JSON.parse(JSON.stringify(attachment));
  }

  deserializeAttachment(): any {
    return this.attachment ? JSON.parse(JSON.stringify(this.attachment)) : null;
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
  }

  addEventListener(event: string, handler: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }
}

// Global WebSocketPair for mock Cloudflare environment
(globalThis as any).WebSocketPair = class {
  0: MockWebSocket;
  1: MockWebSocket;
  constructor() {
    this[0] = new MockWebSocket();
    this[1] = new MockWebSocket();
  }
};

// Mock DurableObjectState with getWebSockets and acceptWebSocket
class MockDOState {
  public acceptedSockets: Array<{ ws: MockWebSocket; tags: string[] }> = [];
  public storageData: Map<string, any> = new Map();

  public storage = {
    get: async (key: string) => this.storageData.get(key),
    put: async (key: string, val: any) => { this.storageData.set(key, val); },
  };

  acceptWebSocket(ws: MockWebSocket, tags: string[] = []) {
    this.acceptedSockets.push({ ws, tags });
  }

  getWebSockets(tag?: string): MockWebSocket[] {
    if (!tag) {
      return this.acceptedSockets.map(s => s.ws).filter(ws => ws.readyState === 1);
    }
    return this.acceptedSockets
      .filter(s => s.tags.includes(tag) && s.ws.readyState === 1)
      .map(s => s.ws);
  }
}

// Mock D1 Database Binding
class MockD1Database {
  public executedQueries: Array<{ query: string; params: any[] }> = [];
  public updateCount: number = 0;
  public savedState: string | null = null;

  prepare(query: string) {
    const executedQueries = this.executedQueries;
    const db = this;
    return {
      bind(...params: any[]) {
        return {
          async run() {
            executedQueries.push({ query, params });
            if (query.trim().startsWith('UPDATE')) {
              if (params[0] && typeof params[0] === 'string') {
                db.savedState = params[0];
              }
              return { meta: { changes: db.updateCount } };
            }
            if (query.trim().startsWith('INSERT')) {
              if (params[12] && typeof params[12] === 'string') {
                db.savedState = params[12];
              }
              return { meta: { changes: 1, last_row_id: 1 } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            executedQueries.push({ query, params });
            if (query.includes('FROM live_sessions')) {
              return db.savedState ? { state_json: db.savedState } : null;
            }
            return null;
          },
          async all() {
            executedQueries.push({ query, params });
            return { results: [] };
          },
        };
      },
    };
  }
}

async function runMilestone1Verification() {
  console.log('>>> [START] Milestone 1 DO Hibernation, Unicast & Persistence Verification');

  const classroomId = 'CS-101';
  const state = new MockDOState();
  const d1 = new MockD1Database();
  const env = { DB: d1 };
  (globalThis as any).env = env;

  const doInstance = new ClassroomRoomDO(state, env);

  // -------------------------------------------------------------------------
  // Test 1: Cloudflare Hibernation Socket Acceptance and Tags
  // -------------------------------------------------------------------------
  console.log('Testing: WebSocket Hibernation & Tagging...');

  const tokenTeacher = ClassroomAuth.createInternalAuthToken({
    userId: 'usr_teacher_1',
    displayName: 'Prof. Turing',
    email: 'turing@cortex.edu',
    classroomId,
    role: 'teacher',
    authenticatedAt: Date.now(),
  });

  const tokenStudentA = ClassroomAuth.createInternalAuthToken({
    userId: 'usr_student_a',
    displayName: 'Alice Student',
    email: 'alice@cortex.edu',
    classroomId,
    role: 'student',
    authenticatedAt: Date.now(),
  });

  const tokenStudentB = ClassroomAuth.createInternalAuthToken({
    userId: 'usr_student_b',
    displayName: 'Bob Student',
    email: 'bob@cortex.edu',
    classroomId,
    role: 'student',
    authenticatedAt: Date.now(),
  });

  // Connect Teacher
  const reqTeacher = new Request(`https://cortex.internal/ws/${classroomId}`, {
    headers: {
      Upgrade: 'websocket',
      'x-cortex-internal-auth': tokenTeacher,
    },
  });
  await doInstance.fetch(reqTeacher);

  // Connect Student A
  const reqStudentA = new Request(`https://cortex.internal/ws/${classroomId}`, {
    headers: {
      Upgrade: 'websocket',
      'x-cortex-internal-auth': tokenStudentA,
    },
  });
  await doInstance.fetch(reqStudentA);

  // Connect Student B
  const reqStudentB = new Request(`https://cortex.internal/ws/${classroomId}`, {
    headers: {
      Upgrade: 'websocket',
      'x-cortex-internal-auth': tokenStudentB,
    },
  });
  await doInstance.fetch(reqStudentB);

  assert.strictEqual(state.acceptedSockets.length, 3, 'DO must accept 3 WebSockets');

  // Verify tags on teacher
  const teacherTags = state.acceptedSockets[0].tags;
  assert.ok(teacherTags.includes('usr_teacher_1'), 'Must include participantId in tags');
  assert.ok(teacherTags.includes('user:usr_teacher_1'), 'Must include user:prefix in tags');
  assert.ok(teacherTags.includes('role:teacher'), 'Must include role:tag in tags');

  // Verify attachment serialization
  const teacherWs = state.acceptedSockets[0].ws;
  assert.ok(teacherWs.attachment, 'Attachment must be serialized on WebSocket');
  assert.strictEqual(teacherWs.attachment.participantId, 'usr_teacher_1');
  assert.strictEqual(teacherWs.attachment.role, 'teacher');

  const studentAWs = state.acceptedSockets[1].ws;
  const studentBWs = state.acceptedSockets[2].ws;

  // Clear initial messages
  teacherWs.sentMessages = [];
  studentAWs.sentMessages = [];
  studentBWs.sentMessages = [];

  console.log('  [PASS] WebSocket Hibernation Acceptance, Tagging, and Attachment verified');

  // -------------------------------------------------------------------------
  // Test 2: Targeted WebRTC Unicast Signaling Brokerage
  // -------------------------------------------------------------------------
  console.log('Testing: Targeted WebRTC Unicast Signaling...');

  // Student A sends WEBRTC_OFFER targeting Student B
  const webrtcOfferMsg = JSON.stringify({
    version: '1.0',
    type: 'WEBRTC_OFFER',
    sessionId: classroomId,
    payload: {
      targetUserId: 'usr_student_b',
      sdp: 'v=0\r\no=alice 1234 5678 IN IP4 127.0.0.1...',
      type: 'offer',
    },
  });

  await doInstance.webSocketMessage(studentAWs, webrtcOfferMsg);

  // Verify: Student B received the offer
  assert.strictEqual(studentBWs.sentMessages.length, 1, 'Target student B must receive exactly 1 message');
  const receivedByB = JSON.parse(studentBWs.sentMessages[0]);
  assert.strictEqual(receivedByB.type, 'WEBRTC_OFFER');
  assert.strictEqual(receivedByB.payload.targetUserId, 'usr_student_b');
  assert.strictEqual(receivedByB.payload.senderId, 'usr_student_a', 'DO must authoritatively stamp senderId');

  // Verify: Teacher and Student A received NOTHING (strict unicast)
  assert.strictEqual(teacherWs.sentMessages.length, 0, 'Teacher must receive 0 messages (no broadcast leakage)');
  assert.strictEqual(studentAWs.sentMessages.length, 0, 'Sender student A must receive 0 messages');

  studentBWs.sentMessages = [];

  // Student B sends WEBRTC_ANSWER targeting Student A wrapped in CLASSROOM_EVENT
  const webrtcAnswerEnvelope = JSON.stringify({
    version: '1.0',
    type: 'CLASSROOM_EVENT',
    sessionId: classroomId,
    payload: {
      eventName: 'WEBRTC_ANSWER',
      data: {
        targetUserId: 'usr_student_a',
        sdp: 'v=0\r\no=bob 8765 4321 IN IP4 127.0.0.1...',
        type: 'answer',
      },
    },
  });

  await doInstance.webSocketMessage(studentBWs, webrtcAnswerEnvelope);

  assert.strictEqual(studentAWs.sentMessages.length, 1, 'Student A must receive exactly 1 message');
  const receivedByA = JSON.parse(studentAWs.sentMessages[0]);
  assert.strictEqual(receivedByA.payload.eventName, 'WEBRTC_ANSWER');
  assert.strictEqual(receivedByA.payload.data.targetUserId, 'usr_student_a');
  assert.strictEqual(receivedByA.payload.data.senderId, 'usr_student_b', 'DO must authoritatively stamp senderId in event data');
  assert.strictEqual(teacherWs.sentMessages.length, 0, 'Teacher must receive 0 messages for wrapped WebRTC unicast');

  studentAWs.sentMessages = [];

  // Offline recipient test: Candidate targeting offline user should be dropped cleanly
  const webrtcIceOffline = JSON.stringify({
    version: '1.0',
    type: 'WEBRTC_ICE_CANDIDATE',
    sessionId: classroomId,
    payload: {
      targetUserId: 'usr_nonexistent',
      candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host' },
    },
  });
  await doInstance.webSocketMessage(studentAWs, webrtcIceOffline);
  // Must not throw or deliver to anyone
  assert.strictEqual(teacherWs.sentMessages.length, 0);
  assert.strictEqual(studentBWs.sentMessages.length, 0);

  console.log('  [PASS] Targeted WebRTC Unicast Signaling strictly verified (zero room broadcast leakage)');

  // -------------------------------------------------------------------------
  // Test 3: Atomic Session State Hydration on JOIN_CLASSROOM
  // -------------------------------------------------------------------------
  console.log('Testing: Atomic Session State Hydration...');

  // Connect Late Joiner Student C
  const tokenStudentC = ClassroomAuth.createInternalAuthToken({
    userId: 'usr_student_c',
    displayName: 'Charlie Student',
    email: 'charlie@cortex.edu',
    classroomId,
    role: 'student',
    authenticatedAt: Date.now(),
  });

  const reqStudentC = new Request(`https://cortex.internal/ws/${classroomId}`, {
    headers: {
      Upgrade: 'websocket',
      'x-cortex-internal-auth': tokenStudentC,
    },
  });
  await doInstance.fetch(reqStudentC);
  const studentCWs = state.acceptedSockets[3].ws;
  studentCWs.sentMessages = [];

  // Student C sends JOIN_CLASSROOM
  const joinMsg = JSON.stringify({
    version: '1.0',
    type: 'JOIN_CLASSROOM',
    sessionId: classroomId,
    payload: {
      participantName: 'Charlie Student',
      requestedRole: 'student',
    },
  });

  await doInstance.webSocketMessage(studentCWs, joinMsg);

  // Student C should receive:
  // 1. JOIN_ACCEPTED
  // 2. SESSION_HYDRATION_SNAPSHOT
  // 3. WHITEBOARD_SNAPSHOT
  // 4. BROADCAST_STATE_CHANGED
  assert.ok(studentCWs.sentMessages.length >= 4, 'Joining student must receive at least 4 hydration frames');

  const joinAccepted = JSON.parse(studentCWs.sentMessages[0]);
  assert.strictEqual(joinAccepted.type, 'JOIN_ACCEPTED');
  assert.strictEqual(joinAccepted.payload.assignedParticipantId, 'usr_student_c');

  const hydrationSnapshot = JSON.parse(studentCWs.sentMessages[1]);
  assert.strictEqual(hydrationSnapshot.type, 'SESSION_HYDRATION_SNAPSHOT');
  assert.ok(hydrationSnapshot.payload.code, 'Must contain code state');
  assert.ok(hydrationSnapshot.payload.whiteboard, 'Must contain whiteboard state');
  assert.ok(hydrationSnapshot.payload.presentation, 'Must contain presentation state');
  assert.ok(hydrationSnapshot.payload.presence, 'Must contain active AV presence state');
  assert.ok(hydrationSnapshot.payload.permissions, 'Must contain permissions state');

  const wbSnapshot = JSON.parse(studentCWs.sentMessages[2]);
  assert.strictEqual(wbSnapshot.payload.eventName, 'WHITEBOARD_SNAPSHOT');

  console.log('  [PASS] Atomic Session State Hydration snapshot verified');

  // -------------------------------------------------------------------------
  // Test 4: D1 Schema, Resilience & flushToD1 Fallback Insert
  // -------------------------------------------------------------------------
  console.log('Testing: D1 Persistence & Schema Resilience...');

  // Disconnect all sockets to trigger flushToD1
  d1.executedQueries = [];
  d1.updateCount = 0; // 0 rows updated -> must trigger INSERT fallback

  teacherWs.close();
  await doInstance.webSocketClose(teacherWs, 1000, 'done', true);
  studentAWs.close();
  await doInstance.webSocketClose(studentAWs, 1000, 'done', true);
  studentBWs.close();
  await doInstance.webSocketClose(studentBWs, 1000, 'done', true);
  studentCWs.close();
  await doInstance.webSocketClose(studentCWs, 1000, 'done', true);

  assert.ok(d1.executedQueries.length >= 2, 'flushToD1 must run UPDATE followed by fallback INSERT');
  const updateQuery = d1.executedQueries[0];
  assert.ok(updateQuery.query.includes('UPDATE live_sessions SET state_json = ?, updated_at = ?'));
  assert.strictEqual(updateQuery.params[2], 'CS-101', 'Classroom ID must be normalized uppercase');

  const insertQuery = d1.executedQueries[1];
  assert.ok(insertQuery.query.includes('INSERT INTO live_sessions'));
  assert.ok(insertQuery.query.includes('state_json, updated_at'));

  // Test ClassroomDatabase helper methods
  const flushedOk = await classroomDb.flushLiveSessionState('CS-101', {
    testPersistence: true,
    latestTeacherCode: 'console.log("hello persistent cortex");',
  });
  assert.strictEqual(flushedOk, true, 'classroomDb.flushLiveSessionState must succeed');

  const fetchedState = await classroomDb.getLiveSessionState('CS-101');
  assert.ok(fetchedState, 'classroomDb.getLiveSessionState must retrieve saved state');
  assert.strictEqual(fetchedState.testPersistence, true);

  console.log('  [PASS] D1 Persistence & Schema Resilience verified');

  console.log('>>> [SUCCESS] All Milestone 1 Verification Checks Passed!');
}

runMilestone1Verification().catch((err) => {
  console.error('Milestone 1 Verification Failed:', err);
  process.exit(1);
});
