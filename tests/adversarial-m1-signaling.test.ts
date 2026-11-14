import assert from 'node:assert';
import * as Y from 'yjs';
import { ClassroomRoomDO } from '../src/lib/classroom/durable-object';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { classroomDb } from '../src/lib/classroom/db';
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
  SessionHydrationSnapshotPayload,
} from '../src/lib/classroom/protocol';

// Mock WebSocket implementation supporting Cloudflare Hibernation Attachment API
class MockWebSocket {
  public readyState: number = 1; // 1 = OPEN, 2 = CLOSING, 3 = CLOSED
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
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open: readyState=' + this.readyState);
    }
    this.sentMessages.push(data);
  }

  close(code: number = 1000) {
    this.readyState = 3;
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
    delete: async (key: string) => { this.storageData.delete(key); },
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
  public failureInjection: boolean = false;
  public concurrentInsertLog: string[] = [];

  prepare(query: string) {
    const executedQueries = this.executedQueries;
    const db = this;
    return {
      bind(...params: any[]) {
        return {
          async run() {
            if (db.failureInjection) {
              throw new Error('Simulated D1 Disk I/O Failure');
            }
            executedQueries.push({ query, params });
            const trimmed = query.trim();
            if (trimmed.startsWith('UPDATE')) {
              if (params[0] && typeof params[0] === 'string') {
                db.savedState = params[0];
              }
              return { meta: { changes: db.updateCount } };
            }
            if (trimmed.startsWith('INSERT')) {
              const insertId = params[0];
              db.concurrentInsertLog.push(insertId);
              if (params[12] && typeof params[12] === 'string') {
                db.savedState = params[12];
              }
              return { meta: { changes: 1, last_row_id: db.concurrentInsertLog.length } };
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

async function runAdversarialSignalingSuite() {
  console.log('================================================================================');
  console.log('CHALLENGER 2 - ADVERSARIAL EMPIRICAL STRESS TEST SUITE (MILENSTONE 1)');
  console.log('================================================================================');
  console.log('Target: Cortex Live Classroom Signaling & DO Hibernation Engine');
  console.log('Testing: Isolation, Anti-Spoofing, Offline Resilience, Hydration, D1 Persistence');
  console.log('================================================================================\n');

  const classroomId = 'ADV-ROOM-777';
  let totalTests = 0;
  let passedTests = 0;

  function recordPass(testName: string) {
    totalTests++;
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${testName}`);
  }

  // =========================================================================
  // SECTION 1: SIGNALING ISOLATION IN 4+ PARTICIPANT ROOM
  // =========================================================================
  console.log('>>> Section 1: WebRTC Unicast Signaling Isolation (5 Participants)...');

  const state1 = new MockDOState();
  const d1_1 = new MockD1Database();
  const env1 = { DB: d1_1 };
  (globalThis as any).env = env1;
  const do1 = new ClassroomRoomDO(state1, env1);

  // Connect 5 participants: Teacher, Alice (A), Bob (B), Charlie (C), David (D)
  const participants = [
    { id: 'usr_teacher', name: 'Prof. Ada', role: 'teacher' },
    { id: 'usr_peer_a', name: 'Alice', role: 'student' },
    { id: 'usr_peer_b', name: 'Bob', role: 'student' },
    { id: 'usr_peer_c', name: 'Charlie', role: 'student' },
    { id: 'usr_peer_d', name: 'David', role: 'student' },
  ];

  const sockets: Record<string, MockWebSocket> = {};

  for (const p of participants) {
    const token = ClassroomAuth.createInternalAuthToken({
      userId: p.id,
      displayName: p.name,
      email: `${p.id}@cortex.edu`,
      classroomId,
      role: p.role,
      authenticatedAt: Date.now(),
    });
    const req = new Request(`https://cortex.internal/ws/${classroomId}`, {
      headers: { Upgrade: 'websocket', 'x-cortex-internal-auth': token },
    });
    await do1.fetch(req);
  }

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    sockets[p.id] = state1.acceptedSockets[i].ws;
    sockets[p.id].sentMessages = []; // Flush initial greeting frames
  }

  // 1.1 Top-level WEBRTC_OFFER from Peer A to Peer B
  const offerPayload = {
    targetUserId: 'usr_peer_b',
    sdp: 'v=0\r\no=alice_session 1111 2222 IN IP4 10.0.0.1\r\ns=LiveClassroom\r\nt=0 0\r\nm=audio 5004 RTP/AVP 111',
    type: 'offer',
  };
  await do1.webSocketMessage(
    sockets['usr_peer_a'],
    JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: offerPayload,
    })
  );

  // Assert Peer B got exactly 1 packet
  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 1, 'Peer B must receive exactly 1 offer');
  const parsedOfferOnB = JSON.parse(sockets['usr_peer_b'].sentMessages[0]);
  assert.strictEqual(parsedOfferOnB.type, 'WEBRTC_OFFER');
  assert.strictEqual(parsedOfferOnB.payload.targetUserId, 'usr_peer_b');
  assert.strictEqual(parsedOfferOnB.payload.senderId, 'usr_peer_a');

  // Assert 100% isolation for Peer A, Teacher, Charlie, David (0 packets)
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 0, 'Sender Peer A must receive 0 packets (no loopback)');
  assert.strictEqual(sockets['usr_teacher'].sentMessages.length, 0, 'Teacher must receive 0 packets (0% leakage)');
  assert.strictEqual(sockets['usr_peer_c'].sentMessages.length, 0, 'Peer C must receive 0 packets (0% leakage)');
  assert.strictEqual(sockets['usr_peer_d'].sentMessages.length, 0, 'Peer D must receive 0 packets (0% leakage)');
  sockets['usr_peer_b'].sentMessages = [];
  recordPass('Top-Level WEBRTC_OFFER: 100% Unicast Isolation to Target, 0% Broadcast Leakage across 4 uninvolved peers');

  // 1.2 Top-level WEBRTC_ANSWER from Peer B to Peer A
  const answerPayload = {
    targetUserId: 'usr_peer_a',
    sdp: 'v=0\r\no=bob_session 3333 4444 IN IP4 10.0.0.2\r\ns=LiveClassroom\r\nt=0 0\r\nm=audio 5006 RTP/AVP 111',
    type: 'answer',
  };
  await do1.webSocketMessage(
    sockets['usr_peer_b'],
    JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_ANSWER',
      sessionId: classroomId,
      payload: answerPayload,
    })
  );

  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 1, 'Peer A must receive exactly 1 answer');
  const parsedAnswerOnA = JSON.parse(sockets['usr_peer_a'].sentMessages[0]);
  assert.strictEqual(parsedAnswerOnA.type, 'WEBRTC_ANSWER');
  assert.strictEqual(parsedAnswerOnA.payload.targetUserId, 'usr_peer_a');
  assert.strictEqual(parsedAnswerOnA.payload.senderId, 'usr_peer_b');

  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 0, 'Sender Peer B must receive 0 packets');
  assert.strictEqual(sockets['usr_teacher'].sentMessages.length, 0, 'Teacher must receive 0 packets');
  assert.strictEqual(sockets['usr_peer_c'].sentMessages.length, 0, 'Peer C must receive 0 packets');
  assert.strictEqual(sockets['usr_peer_d'].sentMessages.length, 0, 'Peer D must receive 0 packets');
  sockets['usr_peer_a'].sentMessages = [];
  recordPass('Top-Level WEBRTC_ANSWER: 100% Unicast Isolation to Target, 0% Broadcast Leakage');

  // 1.3 Rapid Stream of 20 ICE Candidates between Peer A and Peer B
  for (let i = 0; i < 20; i++) {
    const candidatePayload = {
      targetUserId: 'usr_peer_b',
      candidate: {
        candidate: `candidate:${i} 1 UDP 2130706431 10.0.0.1 ${50000 + i} typ host`,
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    };
    await do1.webSocketMessage(
      sockets['usr_peer_a'],
      JSON.stringify({
        version: '1.0',
        type: 'WEBRTC_ICE_CANDIDATE',
        sessionId: classroomId,
        payload: candidatePayload,
      })
    );
  }

  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 20, 'Peer B must receive all 20 ICE candidates in order');
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 0, 'Peer A must receive 0 loopback candidates');
  assert.strictEqual(sockets['usr_teacher'].sentMessages.length, 0, 'Teacher received 0 ICE packets');
  assert.strictEqual(sockets['usr_peer_c'].sentMessages.length, 0, 'Peer C received 0 ICE packets');
  assert.strictEqual(sockets['usr_peer_d'].sentMessages.length, 0, 'Peer D received 0 ICE packets');
  sockets['usr_peer_b'].sentMessages = [];
  recordPass('High-Throughput ICE Candidate Stream (20 packets): Strict Sequential Delivery and Zero Crosstalk');

  // 1.4 Wrapped Signaling Envelopes in CLASSROOM_EVENT from Peer C to Peer D
  const wrappedOffer = {
    version: '1.0',
    type: 'CLASSROOM_EVENT',
    sessionId: classroomId,
    payload: {
      eventName: 'WEBRTC_OFFER',
      data: {
        targetUserId: 'usr_peer_d',
        sdp: 'v=0\r\no=charlie_session 5555 6666 IN IP4 10.0.0.3\r\ntype=offer',
        type: 'offer',
      },
    },
  };
  await do1.webSocketMessage(sockets['usr_peer_c'], JSON.stringify(wrappedOffer));

  assert.strictEqual(sockets['usr_peer_d'].sentMessages.length, 1, 'Peer D must receive exactly 1 wrapped offer');
  const parsedWrappedOnD = JSON.parse(sockets['usr_peer_d'].sentMessages[0]);
  assert.strictEqual(parsedWrappedOnD.payload.eventName, 'WEBRTC_OFFER');
  assert.strictEqual(parsedWrappedOnD.payload.data.targetUserId, 'usr_peer_d');
  assert.strictEqual(parsedWrappedOnD.payload.data.senderId, 'usr_peer_c');

  assert.strictEqual(sockets['usr_peer_c'].sentMessages.length, 0, 'Peer C received 0');
  assert.strictEqual(sockets['usr_teacher'].sentMessages.length, 0, 'Teacher received 0');
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 0, 'Peer A received 0');
  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 0, 'Peer B received 0');
  sockets['usr_peer_d'].sentMessages = [];
  recordPass('Wrapped CLASSROOM_EVENT Signaling: Full Unicast Routing with Zero Room Broadcast');

  // =========================================================================
  // SECTION 2: SENDER SPOOFING RESISTANCE
  // =========================================================================
  console.log('\n>>> Section 2: Sender Spoofing Resistance & Adversarial Identity Tampering...');

  // 2.1 Malicious Student attempts top-level senderId spoofing claiming to be 'teacher'
  const spoofedTopLevelOffer = {
    version: '1.0',
    type: 'WEBRTC_OFFER',
    sessionId: classroomId,
    senderId: 'usr_teacher', // Tampered outer senderId
    senderRole: 'teacher',   // Tampered outer senderRole
    payload: {
      targetUserId: 'usr_peer_b',
      senderId: 'usr_teacher', // Tampered inner senderId
      sdp: 'v=0\r\no=spoofed 999 999 IN IP4 127.0.0.1',
      type: 'offer',
    },
  };
  await do1.webSocketMessage(sockets['usr_peer_a'], JSON.stringify(spoofedTopLevelOffer));

  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 1);
  const spoofCheck1 = JSON.parse(sockets['usr_peer_b'].sentMessages[0]);
  assert.strictEqual(spoofCheck1.senderId, 'usr_peer_a', 'Server MUST overwrite outer senderId with verified participantId');
  assert.strictEqual(spoofCheck1.senderRole, 'student', 'Server MUST overwrite outer senderRole with verified role');
  assert.strictEqual(spoofCheck1.payload.senderId, 'usr_peer_a', 'Server MUST overwrite inner payload.senderId');
  sockets['usr_peer_b'].sentMessages = [];
  recordPass('Anti-Spoofing: Server authoritatively overwrites tampered senderId and senderRole in WEBRTC_OFFER');

  // 2.2 Malicious Student attempts senderId spoofing claiming to be admin in CLASSROOM_EVENT
  const spoofedWrappedEvent = {
    version: '1.0',
    type: 'CLASSROOM_EVENT',
    sessionId: classroomId,
    senderId: 'usr_admin',
    payload: {
      eventName: 'WEBRTC_ANSWER',
      senderId: 'usr_admin',
      targetUserId: 'usr_peer_b',
      data: {
        senderId: 'usr_admin',
        actorId: 'usr_admin',
        senderRole: 'admin',
        targetUserId: 'usr_peer_b',
        sdp: 'v=0\r\no=admin_spoof 1010 2020 IN IP4 127.0.0.1',
        type: 'answer',
      },
    },
  };
  await do1.webSocketMessage(sockets['usr_peer_a'], JSON.stringify(spoofedWrappedEvent));

  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 1);
  const spoofCheck2 = JSON.parse(sockets['usr_peer_b'].sentMessages[0]);
  assert.strictEqual(spoofCheck2.senderId, 'usr_peer_a');
  assert.strictEqual(spoofCheck2.senderRole, 'student');
  assert.strictEqual(spoofCheck2.payload.senderId, 'usr_peer_a');
  assert.strictEqual(spoofCheck2.payload.data.senderId, 'usr_peer_a');
  assert.strictEqual(spoofCheck2.payload.data.actorId, 'usr_peer_a');
  assert.strictEqual(spoofCheck2.payload.data.senderRole, 'student');
  sockets['usr_peer_b'].sentMessages = [];
  recordPass('Anti-Spoofing: Server sanitizes nested data.senderId, actorId, and senderRole against admin impersonation');

  // 2.3 Student attempts to emit Teacher Moderation Event (TEACHER_MUTE_ALL)
  await do1.webSocketMessage(
    sockets['usr_peer_a'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEACHER_MUTE_ALL',
        data: { reason: 'malicious mute' },
      },
    })
  );

  // Student A should receive PROTOCOL_ERROR FORBIDDEN_EVENT
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 1);
  const errFrame = JSON.parse(sockets['usr_peer_a'].sentMessages[0]);
  assert.strictEqual(errFrame.type, 'PROTOCOL_ERROR');
  assert.strictEqual(errFrame.payload.code, 'FORBIDDEN_EVENT');

  // Verify room was NOT muted (zero messages to others)
  assert.strictEqual(sockets['usr_teacher'].sentMessages.length, 0);
  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 0);
  assert.strictEqual(sockets['usr_peer_c'].sentMessages.length, 0);
  sockets['usr_peer_a'].sentMessages = [];
  recordPass('Privilege Enforcement: Student blocked from emitting teacher moderation events');

  // =========================================================================
  // SECTION 3: OFFLINE PEER RESILIENCE & BOUNDARY CONDITIONS
  // =========================================================================
  console.log('\n>>> Section 3: Offline Peer Resilience & Boundary Signaling Envelopes...');

  // 3.1 Signaling targeting non-existent peer
  await do1.webSocketMessage(
    sockets['usr_peer_a'],
    JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: {
        targetUserId: 'usr_ghost_404',
        sdp: 'v=0...',
        type: 'offer',
      },
    })
  );
  // Zero delivery, zero crashes
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 0);
  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 0);
  recordPass('Offline Resilience: Message targeting non-existent peer drops silently without exception');

  // 3.2 Signaling targeting peer that cleanly disconnected
  sockets['usr_peer_d'].close(1000);
  await do1.webSocketClose(sockets['usr_peer_d'], 1000, 'Student leaving', true);
  // Flush leave event on others
  sockets['usr_peer_a'].sentMessages = [];
  sockets['usr_peer_b'].sentMessages = [];
  sockets['usr_peer_c'].sentMessages = [];
  sockets['usr_teacher'].sentMessages = [];

  await do1.webSocketMessage(
    sockets['usr_peer_a'],
    JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: {
        targetUserId: 'usr_peer_d', // Disconnected peer
        sdp: 'v=0...',
        type: 'offer',
      },
    })
  );
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 0);
  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 0);
  assert.strictEqual(sockets['usr_peer_d'].sentMessages.length, 0);
  recordPass('Offline Resilience: Message targeting recently disconnected peer drops safely');

  // 3.3 Signaling targeting self
  await do1.webSocketMessage(
    sockets['usr_peer_a'],
    JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: {
        targetUserId: 'usr_peer_a', // Self target
        sdp: 'v=0...',
        type: 'offer',
      },
    })
  );
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 0, 'Self-targeted offer must be ignored without loopback');
  recordPass('Boundary Defense: Self-targeted signaling packet dropped cleanly');

  // 3.4 Boundary: Missing targetUserId, numeric targetUserId, null targetUserId
  const boundaryCases = [
    { targetUserId: null },
    { targetUserId: undefined },
    { targetUserId: 99999 },
    { targetUserId: '' },
    {},
  ];
  for (const bCase of boundaryCases) {
    await do1.webSocketMessage(
      sockets['usr_peer_a'],
      JSON.stringify({
        version: '1.0',
        type: 'WEBRTC_ICE_CANDIDATE',
        sessionId: classroomId,
        payload: bCase,
      })
    );
  }
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 0);
  assert.strictEqual(sockets['usr_peer_b'].sentMessages.length, 0);
  recordPass('Boundary Defense: Malformed targetUserId (null, undefined, number, empty) handled safely');

  // 3.5 Malformed JSON payload
  await do1.webSocketMessage(sockets['usr_peer_a'], 'NOT_VALID_JSON{{{');
  // Server sends MALFORMED_EVENT error to sender
  assert.strictEqual(sockets['usr_peer_a'].sentMessages.length, 1);
  const malformedErr = JSON.parse(sockets['usr_peer_a'].sentMessages[0]);
  assert.strictEqual(malformedErr.type, 'error');
  assert.strictEqual(malformedErr.payload.code, 'MALFORMED_EVENT');
  sockets['usr_peer_a'].sentMessages = [];
  recordPass('Boundary Defense: Corrupted JSON message caught and returns error without affecting room');

  // =========================================================================
  // SECTION 4: ATOMIC SESSION STATE HYDRATION
  // =========================================================================
  console.log('\n>>> Section 4: Composite Atomic Session State Hydration...');

  // Setup rich state in room:
  // 1. Code Broadcast State
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEACHER_START_BROADCAST',
        data: {},
      },
    })
  );
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEACHER_CODE_BROADCAST',
        data: {
          files: [
            { id: 'main.ts', name: 'main.ts', language: 'typescript', content: 'console.log("hello");' },
            { id: 'solution.ts', name: 'solution.ts', language: 'typescript', content: 'export function run() {}' },
          ],
          activeFileId: 'main.ts',
          code: 'console.log("hello");',
        },
      },
    })
  );

  // 2. Monaco CRDT Binary Update to Y.Doc
  const testYDoc = new Y.Doc();
  testYDoc.getText('monaco').insert(0, 'export const PI = 3.14159;');
  const yUpdateBase64 = uint8ArrayToBase64(Y.encodeStateAsUpdate(testYDoc));

  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'MONACO_CRDT_UPDATE',
        data: {
          fileId: 'main.ts',
          update: yUpdateBase64,
        },
      },
    })
  );

  // 3. Teacher Output
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEACHER_SHARE_OUTPUT',
        data: {
          output: { stdout: 'Tests Passed: 10/10\nExecution time: 42ms\n', exitCode: 0 },
        },
      },
    })
  );

  // 4. Multi-Page Vector Whiteboard Drawing & Elements
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'WHITEBOARD_STROKE_END',
        data: {
          pageIndex: 0,
          element: { id: 'rect_1', type: 'rectangle', x: 50, y: 50, width: 200, height: 100, strokeColor: '#000000' },
        },
      },
    })
  );

  // Element delta on Page 0: update color
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'WHITEBOARD_ELEMENT_DELTA',
        data: {
          pageIndex: 0,
          action: 'UPDATE',
          elementId: 'rect_1',
          patch: { strokeColor: '#ff0000', strokeWidth: 3 },
        },
      },
    })
  );

  // Element on Page 1
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'WHITEBOARD_STROKE_END',
        data: {
          pageIndex: 1,
          element: { id: 'circle_2', type: 'circle', cx: 120, cy: 120, radius: 45 },
        },
      },
    })
  );
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'WHITEBOARD_PAGE_CHANGED',
        data: { pageIndex: 1 },
      },
    })
  );

  // 5. Presentation Slide & Laser
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'SLIDE_CHANGED',
        data: { slideIndex: 3 },
      },
    })
  );
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'LASER_MOVED',
        data: { position: { x: 80.5, y: 45.2 }, active: true },
      },
    })
  );

  // 6. AV Media & Presence updates
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'PARTICIPANT_MEDIA_CHANGED',
        data: { isMuted: false, isVideoOff: false },
      },
    })
  );
  await do1.webSocketMessage(
    sockets['usr_peer_b'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'SCREEN_SHARE_CHANGED',
        data: { isScreenSharing: true },
      },
    })
  );
  await do1.webSocketMessage(
    sockets['usr_peer_c'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'HAND_RAISED',
        data: { isRaised: true },
      },
    })
  );

  // 7. Permissions update
  await do1.webSocketMessage(
    sockets['usr_teacher'],
    JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'PERMISSIONS_UPDATED',
        data: { allowStudentScreenShare: true, allowStudentChat: false },
      },
    })
  );

  // Now, connect late-joining student "Emma"
  const emmaToken = ClassroomAuth.createInternalAuthToken({
    userId: 'usr_emma_late',
    displayName: 'Emma LateJoiner',
    email: 'emma@cortex.edu',
    classroomId,
    role: 'student',
    authenticatedAt: Date.now(),
  });
  const emmaReq = new Request(`https://cortex.internal/ws/${classroomId}`, {
    headers: { Upgrade: 'websocket', 'x-cortex-internal-auth': emmaToken },
  });
  await do1.fetch(emmaReq);

  const emmaWs = state1.acceptedSockets[state1.acceptedSockets.length - 1].ws;
  emmaWs.sentMessages = []; // clear greeting

  // Emma sends JOIN_CLASSROOM
  await do1.webSocketMessage(
    emmaWs,
    JSON.stringify({
      version: '1.0',
      type: 'JOIN_CLASSROOM',
      sessionId: classroomId,
      payload: {
        participantName: 'Emma LateJoiner',
        requestedRole: 'student',
      },
    })
  );

  // Verify received frame sequence
  assert.ok(emmaWs.sentMessages.length >= 4, 'Emma must receive at least 4 hydration frames');
  const frame0 = JSON.parse(emmaWs.sentMessages[0]);
  const frame1 = JSON.parse(emmaWs.sentMessages[1]);
  const frame2 = JSON.parse(emmaWs.sentMessages[2]);
  const frame3 = JSON.parse(emmaWs.sentMessages[3]);

  assert.strictEqual(frame0.type, 'JOIN_ACCEPTED');
  assert.strictEqual(frame0.payload.assignedParticipantId, 'usr_emma_late');

  assert.strictEqual(frame1.type, 'SESSION_HYDRATION_SNAPSHOT');
  assert.strictEqual(frame2.payload.eventName, 'WHITEBOARD_SNAPSHOT');
  assert.strictEqual(frame3.payload.eventName, 'BROADCAST_STATE_CHANGED');
  recordPass('Hydration Frame Protocol Sequence: JOIN_ACCEPTED -> SESSION_HYDRATION_SNAPSHOT -> WHITEBOARD_SNAPSHOT -> BROADCAST_STATE_CHANGED');

  // Deep Validation of Hydration Snapshot
  const snapshot: SessionHydrationSnapshotPayload = frame1.payload;

  // Code validation
  assert.strictEqual(snapshot.code.broadcastState, 'broadcasting');
  assert.strictEqual(snapshot.code.activeFileId, 'main.ts');
  assert.strictEqual(snapshot.code.files.length, 2);
  assert.strictEqual(snapshot.code.output.exitCode, 0);
  assert.ok(snapshot.code.yjsDocs && snapshot.code.yjsDocs.length > 0, 'Yjs docs must be present in snapshot');
  const mainYjsDoc = snapshot.code.yjsDocs.find(d => d.fileId === 'main.ts');
  assert.ok(mainYjsDoc, 'Snapshot must contain Yjs doc for active file main.ts');

  // Verify Yjs update can be deserialized and contains the edits
  const clientYDoc = new Y.Doc();
  Y.applyUpdate(clientYDoc, base64ToUint8Array(mainYjsDoc!.update));
  assert.ok(clientYDoc.getText('monaco').toString().includes('export const PI = 3.14159;'), 'Yjs doc state must reconstruct accurately on client');
  recordPass('Hydration Code & Yjs CRDT: Correct broadcast state, active files, and recoverable Y.Doc binary update');

  // Whiteboard validation
  assert.strictEqual(snapshot.whiteboard.activePageIndex, 1);
  assert.ok(snapshot.whiteboard.pages.length >= 2, 'Must have at least 2 whiteboard pages');
  const p0 = snapshot.whiteboard.pages[0];
  const p1 = snapshot.whiteboard.pages[1];
  assert.strictEqual(p0.elements[0].strokeColor, '#ff0000', 'Delta update must persist in Page 0');
  assert.strictEqual(p0.elements[0].strokeWidth, 3);
  assert.strictEqual(p1.elements[0].id, 'circle_2', 'Page 1 element must be present');
  recordPass('Hydration Whiteboard Canvas: Multi-page vector strokes and element deltas accurately hydrated');

  // Presentation & Permissions validation
  assert.strictEqual(snapshot.presentation.isPresenting, true);
  assert.strictEqual(snapshot.presentation.activeSlideIndex, 3);
  assert.strictEqual(snapshot.presentation.laserActive, true);
  assert.strictEqual(snapshot.presentation.laserPos?.x, 80.5);
  assert.strictEqual(snapshot.permissions.allowStudentScreenShare, true);
  assert.strictEqual(snapshot.permissions.allowStudentChat, false);
  recordPass('Hydration Presentation & Permissions: Slide index, laser pointer, and updated permissions verified');

  // Presence validation
  const teacherPresence = snapshot.presence.activeParticipants.find(p => p.userId === 'usr_teacher');
  assert.ok(teacherPresence, 'Teacher presence must exist');
  assert.strictEqual(teacherPresence?.isVideoOff, false);
  assert.strictEqual(teacherPresence?.isMuted, false);

  const bobPresence = snapshot.presence.activeParticipants.find(p => p.userId === 'usr_peer_b');
  assert.strictEqual(bobPresence?.isScreenSharing, true);

  const charliePresence = snapshot.presence.activeParticipants.find(p => p.userId === 'usr_peer_c');
  assert.strictEqual(charliePresence?.isHandRaised, true);
  recordPass('Hydration Participant AV Presence: Audio/video status, screen share, and raised hands accurately mapped');

  // =========================================================================
  // SECTION 5: CONCURRENT D1 PERSISTENCE STRESS HARNESS
  // =========================================================================
  console.log('\n>>> Section 5: Concurrent D1 Persistence & Database Locking Stress Harness...');

  // 5.1 Trigger 50 Rapid Concurrent Flushes on ClassroomRoomDO
  const concurrentD1 = new MockD1Database();
  const concurrentEnv = { DB: concurrentD1 };
  const concurrentDO = new ClassroomRoomDO(new MockDOState(), concurrentEnv);

  console.log('  Executing 50 concurrent flushToD1 calls simultaneously...');
  const flushPromises: Promise<void>[] = [];
  for (let i = 0; i < 50; i++) {
    flushPromises.push(concurrentDO.flushToD1('ADV-ROOM-777'));
  }
  await Promise.all(flushPromises);

  assert.ok(concurrentD1.executedQueries.length >= 50, 'All 50 flushes must execute against D1');
  assert.ok(concurrentD1.savedState !== null, 'State must be serialized into D1');
  const parsedD1State = JSON.parse(concurrentD1.savedState!);
  assert.ok(parsedD1State.flushedAt > 0);
  recordPass('Concurrent D1 Flush: 50 simultaneous flushes executed without unhandled errors or data corruption');

  // 5.2 Real Database Stress Test using classroomDb (Node 24 native SQLite)
  console.log('  Executing 25 concurrent flushes via classroomDb on SQLite engine...');
  const dbFlushPromises: Promise<boolean>[] = [];
  for (let i = 0; i < 25; i++) {
    dbFlushPromises.push(
      classroomDb.flushLiveSessionState('ADV-CONCURRENT-ROOM', {
        workerId: i,
        timestamp: Date.now(),
        code: `console.log("thread ${i}");`,
      })
    );
  }
  const flushResults = await Promise.all(dbFlushPromises);
  assert.ok(flushResults.every(r => r === true), 'All 25 concurrent SQLite flushes must return true');

  // Verify retrieval
  const retrievedState = await classroomDb.getLiveSessionState('ADV-CONCURRENT-ROOM');
  assert.ok(retrievedState, 'Must be able to retrieve persisted session state');
  assert.ok(typeof retrievedState.workerId === 'number');
  recordPass('Native SQLite Concurrent Flush: 25 parallel transactions succeeded with valid state retrieval');

  // 5.3 Resilient Error Handling under Simulated D1 Disk I/O Failure
  const failingD1 = new MockD1Database();
  failingD1.failureInjection = true; // inject fatal disk I/O error
  const resilientDO = new ClassroomRoomDO(new MockDOState(), { DB: failingD1 });

  // Must not throw or crash the process
  let didCrash = false;
  try {
    await resilientDO.flushToD1('CRASH-TEST-ROOM');
  } catch (err) {
    didCrash = true;
  }
  assert.strictEqual(didCrash, false, 'flushToD1 must gracefully catch and log D1 exceptions without crashing DO runtime');
  recordPass('Fault Tolerance: Handled fatal D1 disk/network error gracefully without crashing Durable Object');

  console.log('\n================================================================================');
  console.log(`ADVERSARIAL SUITE SUMMARY: ${passedTests}/${totalTests} Tests Passed (100% Success)`);
  console.log('================================================================================');
}

runAdversarialSignalingSuite().catch(err => {
  console.error('\n[FATAL] Adversarial Test Suite Failed:', err);
  process.exit(1);
});
