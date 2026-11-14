import assert from 'node:assert';
import { ClassroomRoomDO, SessionAttachment } from '../src/lib/classroom/durable-object';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { serializeRealtimeMessage, parseRealtimeMessage } from '../src/lib/classroom/protocol';

// ============================================================================
// ADVERSARIAL MOCK HARNESS (Simulates Cloudflare V8 Worker & DO Runtime)
// ============================================================================

class MockWebSocket {
  public readyState: number = 1; // 1 = OPEN, 3 = CLOSED
  public sentMessages: string[] = [];
  public attachment: any = null;
  public eventListeners: Map<string, Function[]> = new Map();
  public failDeserialization: boolean = false;
  public id: string;

  constructor(id: string = Math.random().toString(36).substring(2, 8)) {
    this.id = id;
  }

  serializeAttachment(attachment: any) {
    // Clone attachment like V8 serialization
    this.attachment = JSON.parse(JSON.stringify(attachment));
  }

  deserializeAttachment(): any {
    if (this.failDeserialization) {
      throw new Error('V8 attachment memory corruption error');
    }
    return this.attachment ? JSON.parse(JSON.stringify(this.attachment)) : null;
  }

  send(data: string) {
    if (this.readyState !== 1) {
      throw new Error(`Cannot send on closed WebSocket (readyState: ${this.readyState})`);
    }
    this.sentMessages.push(data);
  }

  close() {
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

  removeSocket(ws: MockWebSocket) {
    this.acceptedSockets = this.acceptedSockets.filter(s => s.ws !== ws);
  }
}

class MockD1Database {
  public executedQueries: Array<{ query: string; params: any[] }> = [];
  public updateCount: number = 1;
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
            return db.savedState ? { state_json: db.savedState } : null;
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

// Helper to create authenticated DO instance
function createTestHarness(classroomId: string = 'ADV-TEST-101') {
  const state = new MockDOState();
  const d1 = new MockD1Database();
  const env = { DB: d1 };
  (globalThis as any).env = env;
  const doInstance = new ClassroomRoomDO(state, env);
  return { state, d1, env, doInstance, classroomId };
}

// Helper to connect a participant to DO
async function connectParticipant(
  doInstance: ClassroomRoomDO,
  state: MockDOState,
  classroomId: string,
  userId: string,
  name: string,
  role: 'teacher' | 'student' | 'admin' = 'student'
): Promise<MockWebSocket> {
  const token = ClassroomAuth.createInternalAuthToken({
    userId,
    displayName: name,
    email: `${userId}@cortex.edu`,
    classroomId,
    role,
    authenticatedAt: Date.now(),
  });

  const req = new Request(`https://cortex.internal/ws/${classroomId}`, {
    headers: {
      Upgrade: 'websocket',
      'x-cortex-internal-auth': token,
    },
  });

  await doInstance.fetch(req);
  const accepted = state.acceptedSockets[state.acceptedSockets.length - 1].ws;
  accepted.sentMessages = []; // reset initial welcome/auth messages
  return accepted;
}

// ============================================================================
// TEST SUITE: ADVERSARIAL STRESS HARNESS
// ============================================================================

async function runAdversarialStressSuite() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (MILESTONE 1)');
  console.log('Target: src/lib/classroom/durable-object.ts');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function recordPass(testName: string) {
    passedTests++;
    totalTests++;
    console.log(`  [PASS] TC${totalTests}: ${testName}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 1: WebSocket Hibernation Sleep/Wake Cycles & Attachment Deserialization
  // --------------------------------------------------------------------------
  console.log('>>> [SUITE 1] WebSocket Hibernation Sleep/Wake Cycles & Attachment Deserialization');

  {
    const { state, doInstance, classroomId } = createTestHarness();

    const teacherWs = await connectParticipant(doInstance, state, classroomId, 'teacher_1', 'Teacher Ada', 'teacher');
    const student1Ws = await connectParticipant(doInstance, state, classroomId, 'student_1', 'Student Bob', 'student');
    const student2Ws = await connectParticipant(doInstance, state, classroomId, 'student_2', 'Student Carol', 'student');

    assert.strictEqual(doInstance.sessions.size, 3, 'Initial sessions map must have 3 entries');

    // 1.1 Simulate DO memory eviction / hibernation sleep
    doInstance.sessions.clear();
    assert.strictEqual(doInstance.sessions.size, 0, 'sessions Map must be completely empty after eviction');

    // 1.2 Verify getSessionMeta(ws) restores from attachment
    const restoredTeacherMeta = doInstance.getSessionMeta(teacherWs);
    assert.ok(restoredTeacherMeta, 'getSessionMeta must not return null');
    assert.strictEqual(restoredTeacherMeta!.participantId, 'teacher_1');
    assert.strictEqual(restoredTeacherMeta!.role, 'teacher');
    assert.strictEqual(doInstance.sessions.size, 1, 'sessions Map must restore entry on getSessionMeta call');
    recordPass('Transparent restoration of session metadata via getSessionMeta(ws)');

    // 1.3 Simulate incoming WebSocket message while in-memory sessions map is empty
    doInstance.sessions.clear();
    student1Ws.sentMessages = [];
    const pingMsg = JSON.stringify({
      version: '1.0',
      type: 'PING',
      sessionId: classroomId,
      payload: { echo: 12345 },
    });
    await doInstance.webSocketMessage(student1Ws, pingMsg);

    assert.strictEqual(student1Ws.sentMessages.length, 1, 'Student 1 must receive PONG even after cold wake-up');
    const pongResponse = JSON.parse(student1Ws.sentMessages[0]);
    assert.strictEqual(pongResponse.type, 'PONG');
    assert.strictEqual(pongResponse.payload.echo, 12345);
    assert.strictEqual(doInstance.sessions.has(student1Ws), true, 'student1Ws must be repopulated into this.sessions');
    recordPass('Cold wake-up message dispatch without in-memory state');

    // 1.4 Unicast WebRTC signaling when DO wakes from cold sleep
    doInstance.sessions.clear(); // sleep again!
    student2Ws.sentMessages = [];
    teacherWs.sentMessages = [];

    const offerMsg = JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: {
        targetUserId: 'student_2',
        sdp: 'mock-sdp-data',
        type: 'offer',
      },
    });

    // Student 1 sends offer to Student 2
    await doInstance.webSocketMessage(student1Ws, offerMsg);

    assert.strictEqual(student2Ws.sentMessages.length, 1, 'Student 2 must receive unicast offer after cold wake');
    const receivedOffer = JSON.parse(student2Ws.sentMessages[0]);
    assert.strictEqual(receivedOffer.type, 'WEBRTC_OFFER');
    assert.strictEqual(receivedOffer.payload.senderId, 'student_1');
    assert.strictEqual(teacherWs.sentMessages.length, 0, 'Teacher must receive zero signaling messages');
    recordPass('Targeted WebRTC unicast routing across DO hibernation sleep/wake boundary');

    // 1.5 Corrupted attachment resilience (deserializeAttachment throws)
    const badWs = new MockWebSocket('corrupt_ws');
    badWs.failDeserialization = true;
    const corruptMeta = doInstance.getSessionMeta(badWs);
    assert.strictEqual(corruptMeta, null, 'getSessionMeta must return null cleanly on deserialization failure');
    recordPass('Resilience against V8 attachment deserialization failure (no unhandled crash)');
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Rapid Connect/Disconnect Churn & Participant Counting (50+ Cycles)
  // --------------------------------------------------------------------------
  console.log('\n>>> [SUITE 2] Rapid Connect/Disconnect Churn & Participant Counting');

  {
    const { state, doInstance, classroomId } = createTestHarness();

    // 2.1 Sequential churn: 60 connects and disconnects sequentially
    console.log('  Testing 60 sequential connect/disconnect cycles...');
    for (let i = 0; i < 60; i++) {
      const uId = `seq_user_${i}`;
      const ws = await connectParticipant(doInstance, state, classroomId, uId, `User ${i}`);
      assert.strictEqual(doInstance.getActiveSockets().length, 1, `Sequential cycle ${i}: active sockets must be 1`);
      assert.strictEqual(doInstance.getActiveParticipants().length, 1, `Sequential cycle ${i}: active participants must be 1`);

      ws.close();
      await doInstance.webSocketClose(ws, 1000, 'done', true);
      state.removeSocket(ws);

      assert.strictEqual(doInstance.getActiveSockets().length, 0, `Sequential cycle ${i}: active sockets must be 0 after close`);
      assert.strictEqual(doInstance.getActiveParticipants().length, 0, `Sequential cycle ${i}: active participants must be 0 after close`);
      assert.strictEqual(doInstance.sessions.size, 0, `Sequential cycle ${i}: sessions Map must be empty`);
    }
    recordPass('60 sequential connect/disconnect cycles with zero descriptor/session leaks');

    // 2.2 Massive interleaved churn: 50 concurrent connects, random drop 30, verify 20 remain
    console.log('  Testing 50 concurrent connects with interleaved 30 disconnects...');
    const sockets: MockWebSocket[] = [];
    for (let i = 0; i < 50; i++) {
      const uId = `churn_user_${i}`;
      const ws = await connectParticipant(doInstance, state, classroomId, uId, `User ${i}`);
      sockets.push(ws);
    }

    assert.strictEqual(doInstance.getActiveSockets().length, 50, 'Active sockets must reach 50');
    assert.strictEqual(doInstance.getActiveParticipants().length, 50, 'Active participants must reach 50');

    // Disconnect 30 sockets randomly
    const disconnectIndices = new Set<number>();
    while (disconnectIndices.size < 30) {
      disconnectIndices.add(Math.floor(Math.random() * 50));
    }

    for (const idx of disconnectIndices) {
      const ws = sockets[idx];
      ws.close();
      await doInstance.webSocketClose(ws, 1000, 'client leave', true);
      state.removeSocket(ws);
    }

    assert.strictEqual(doInstance.getActiveSockets().length, 20, 'Remaining active sockets must be exactly 20');
    assert.strictEqual(doInstance.getActiveParticipants().length, 20, 'Remaining active participants must be exactly 20');
    assert.strictEqual(doInstance.sessions.size, 20, 'In-memory sessions map must have exactly 20 entries');

    // Disconnect remaining 20 sockets
    for (let i = 0; i < 50; i++) {
      if (!disconnectIndices.has(i)) {
        const ws = sockets[i];
        ws.close();
        await doInstance.webSocketClose(ws, 1000, 'client leave', true);
        state.removeSocket(ws);
      }
    }

    assert.strictEqual(doInstance.getActiveSockets().length, 0, 'All sockets closed: active sockets must be 0');
    assert.strictEqual(doInstance.getActiveParticipants().length, 0, 'All sockets closed: active participants must be 0');
    assert.strictEqual(doInstance.sessions.size, 0, 'sessions Map must be 0 after full teardown');
    recordPass('50 interleaved connects and 30/20 disconnects with exact participant count tracking');

    // 2.3 Multiple connections from same user ID (e.g. multi-tab)
    const wsTab1 = await connectParticipant(doInstance, state, classroomId, 'multi_user_1', 'Multi User');
    const wsTab2 = await connectParticipant(doInstance, state, classroomId, 'multi_user_1', 'Multi User');

    assert.strictEqual(doInstance.getActiveSockets().length, 2, '2 sockets must be active for multi-tab user');
    // Active participants deduplicates by participantId
    assert.strictEqual(doInstance.getActiveParticipants().length, 1, 'Active participants roster must deduplicate multi-tab user to 1');

    // Close tab 1
    wsTab1.close();
    await doInstance.webSocketClose(wsTab1, 1000, 'tab closed', true);
    state.removeSocket(wsTab1);

    assert.strictEqual(doInstance.getActiveSockets().length, 1, '1 socket remains after closing tab 1');
    assert.strictEqual(doInstance.getActiveParticipants().length, 1, 'User still present via tab 2');

    // Close tab 2
    wsTab2.close();
    await doInstance.webSocketClose(wsTab2, 1000, 'tab closed', true);
    state.removeSocket(wsTab2);

    assert.strictEqual(doInstance.getActiveSockets().length, 0, '0 sockets remain after closing tab 2');
    assert.strictEqual(doInstance.getActiveParticipants().length, 0, '0 participants remain');
    recordPass('Multi-connection per user ID handling with correct deduplication and teardown');
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Malformed & Oversized Payloads (>512KB) & Binary Frame Handling
  // --------------------------------------------------------------------------
  console.log('\n>>> [SUITE 3] Malformed & Oversized Payloads (>512KB)');

  {
    const { state, doInstance, classroomId } = createTestHarness();
    const ws = await connectParticipant(doInstance, state, classroomId, 'stress_user', 'Stress User');

    // 3.1 Normal payload (100KB)
    const normalPayload = JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEST_EVENT',
        data: 'A'.repeat(100 * 1024),
      },
    });
    await doInstance.webSocketMessage(ws, normalPayload);
    // Should NOT receive error
    const normalErrors = ws.sentMessages.filter(m => m.includes('PAYLOAD_TOO_LARGE'));
    assert.strictEqual(normalErrors.length, 0, 'Normal 100KB payload must not trigger PAYLOAD_TOO_LARGE');
    recordPass('Valid 100KB payload accepted without error');

    // 3.2 Exact boundary (512 * 1024 = 524,288 bytes)
    ws.sentMessages = [];
    const exact512KBPadded = 'B'.repeat(524288);
    // When sent as raw non-JSON of 524288 bytes:
    await doInstance.webSocketMessage(ws, exact512KBPadded);
    // Should trigger MALFORMED_EVENT or parse error, but NOT PAYLOAD_TOO_LARGE (boundary is > 512KB)
    const exactBoundaryErrors = ws.sentMessages.filter(m => m.includes('PAYLOAD_TOO_LARGE'));
    assert.strictEqual(exactBoundaryErrors.length, 0, 'Exact 524,288 bytes must not trigger PAYLOAD_TOO_LARGE');
    recordPass('Exact 512KB boundary does not trigger false-positive size rejection');

    // 3.3 Oversized payload (512KB + 1 byte = 524,289 bytes)
    ws.sentMessages = [];
    const oversizedPayload = 'X'.repeat(524289);
    await doInstance.webSocketMessage(ws, oversizedPayload);
    assert.strictEqual(ws.sentMessages.length, 1, 'Oversized payload must trigger immediate rejection error');
    const oversizeErr = JSON.parse(ws.sentMessages[0]);
    assert.strictEqual(oversizeErr.type, 'error');
    assert.strictEqual(oversizeErr.payload.code, 'PAYLOAD_TOO_LARGE');
    recordPass('Oversized payload (512KB + 1B) rejected with PAYLOAD_TOO_LARGE');

    // 3.4 Massive payload (1.5 MB)
    ws.sentMessages = [];
    const massivePayload = 'M'.repeat(1500 * 1024);
    await doInstance.webSocketMessage(ws, massivePayload);
    assert.strictEqual(ws.sentMessages.length, 1);
    const massiveErr = JSON.parse(ws.sentMessages[0]);
    assert.strictEqual(massiveErr.payload.code, 'PAYLOAD_TOO_LARGE');
    recordPass('Massive 1.5MB payload safely rejected without OOM or unhandled exception');

    // 3.5 Malformed JSON strings
    ws.sentMessages = [];
    await doInstance.webSocketMessage(ws, '{ bad json: true');
    assert.strictEqual(ws.sentMessages.length, 1);
    const malformedErr = JSON.parse(ws.sentMessages[0]);
    assert.strictEqual(malformedErr.payload.code, 'MALFORMED_EVENT');
    recordPass('Malformed JSON string rejected with MALFORMED_EVENT');

    // 3.6 Binary ArrayBuffer payload decoding
    ws.sentMessages = [];
    const pingObj = { version: '1.0', type: 'PING', sessionId: classroomId, payload: { echo: 999 } };
    const binaryPing = new TextEncoder().encode(JSON.stringify(pingObj)).buffer;
    await doInstance.webSocketMessage(ws, binaryPing);
    assert.strictEqual(ws.sentMessages.length, 1);
    const pongFromBinary = JSON.parse(ws.sentMessages[0]);
    assert.strictEqual(pongFromBinary.type, 'PONG');
    assert.strictEqual(pongFromBinary.payload.echo, 999);
    recordPass('Binary ArrayBuffer message transparently decoded and handled');
  }

  // --------------------------------------------------------------------------
  // SUITE 4: Rate Limit Triggering (>5000 events/window)
  // --------------------------------------------------------------------------
  console.log('\n>>> [SUITE 4] Rate Limit Triggering (>5000 events per 10s Window)');

  {
    const { state, doInstance, classroomId } = createTestHarness();
    const ws1 = await connectParticipant(doInstance, state, classroomId, 'rate_user_1', 'Rate User 1');
    const ws2 = await connectParticipant(doInstance, state, classroomId, 'rate_user_2', 'Rate User 2');

    const validMsg = JSON.stringify({
      version: '1.0',
      type: 'PING',
      sessionId: classroomId,
      payload: { echo: 1 },
    });

    console.log('  Sending 5,000 rapid events from User 1...');
    ws1.sentMessages = [];

    // Send 5,000 events (allowed)
    for (let i = 0; i < 5000; i++) {
      await doInstance.webSocketMessage(ws1, validMsg);
    }

    // Verify all 5000 were PONGs, no RATE_LIMITED error
    assert.strictEqual(ws1.sentMessages.length, 5000, 'All 5,000 messages must be answered with PONG');
    const rateLimitErrorsUnderLimit = ws1.sentMessages.filter(m => m.includes('RATE_LIMITED'));
    assert.strictEqual(rateLimitErrorsUnderLimit.length, 0, 'Zero rate limit errors under 5,000 events');
    recordPass('5,000 events within window processed without triggering rate limit');

    // Send 5001st event (must be rejected with RATE_LIMITED)
    ws1.sentMessages = [];
    await doInstance.webSocketMessage(ws1, validMsg);

    assert.strictEqual(ws1.sentMessages.length, 1, '5001st event must receive 1 rejection frame');
    const rateLimitErr = JSON.parse(ws1.sentMessages[0]);
    assert.strictEqual(rateLimitErr.type, 'error');
    assert.strictEqual(rateLimitErr.payload.code, 'RATE_LIMITED');
    recordPass('5001st event triggers RATE_LIMITED error');

    // Subsequent events in same window continue to be rate limited
    ws1.sentMessages = [];
    await doInstance.webSocketMessage(ws1, validMsg);
    const followUpErr = JSON.parse(ws1.sentMessages[0]);
    assert.strictEqual(followUpErr.payload.code, 'RATE_LIMITED');
    recordPass('Subsequent events continue to be throttled within active window');

    // Verify rate limit isolation: User 2 is NOT rate limited
    ws2.sentMessages = [];
    await doInstance.webSocketMessage(ws2, validMsg);
    assert.strictEqual(ws2.sentMessages.length, 1);
    const u2Pong = JSON.parse(ws2.sentMessages[0]);
    assert.strictEqual(u2Pong.type, 'PONG', 'User 2 must receive PONG (rate limits are per-user/socket)');
    recordPass('Per-session rate limit isolation verified (User 2 unaffected by User 1 rate limit)');

    // Reset window: simulate 10.1 seconds passing
    const meta1 = doInstance.getSessionMeta(ws1)!;
    meta1.eventRateWindowStart = Date.now() - 11000;
    doInstance.updateSessionMeta(ws1, meta1);

    ws1.sentMessages = [];
    await doInstance.webSocketMessage(ws1, validMsg);
    assert.strictEqual(ws1.sentMessages.length, 1);
    const resetPong = JSON.parse(ws1.sentMessages[0]);
    assert.strictEqual(resetPong.type, 'PONG', 'User 1 rate limit resets after window expiry');
    recordPass('Rate limit window expiration and counter reset verified');
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Security Boundary Enforcement & WebRTC Signaling Spoofing
  // --------------------------------------------------------------------------
  console.log('\n>>> [SUITE 5] Security Boundary Enforcement & WebRTC Signaling Spoofing');

  {
    const { state, doInstance, classroomId } = createTestHarness();
    const teacherWs = await connectParticipant(doInstance, state, classroomId, 'teacher_id', 'Teacher', 'teacher');
    const studentWs = await connectParticipant(doInstance, state, classroomId, 'student_id', 'Student', 'student');
    const victimWs = await connectParticipant(doInstance, state, classroomId, 'victim_id', 'Victim', 'student');

    // 5.1 Student tries to emit moderation / teacher-only event
    studentWs.sentMessages = [];
    const forbiddenBroadcastMsg = JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEACHER_START_BROADCAST',
        requiresTeacher: true,
        data: {},
      },
    });
    await doInstance.webSocketMessage(studentWs, forbiddenBroadcastMsg);
    assert.strictEqual(studentWs.sentMessages.length, 1);
    const forbiddenErr = JSON.parse(studentWs.sentMessages[0]);
    assert.strictEqual(forbiddenErr.type, 'PROTOCOL_ERROR');
    assert.strictEqual(forbiddenErr.payload.code, 'FORBIDDEN_EVENT');
    recordPass('Student prevented from emitting teacher moderation event (FORBIDDEN_EVENT)');

    // 5.2 WebRTC SenderId Spoofing Prevention
    // Student tries to send WEBRTC_OFFER pretending to be Teacher ('teacher_id')
    victimWs.sentMessages = [];
    const spoofedOffer = JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: {
        targetUserId: 'victim_id',
        senderId: 'teacher_id', // Spoofed!
        sdp: 'malicious-sdp',
        type: 'offer',
      },
    });

    await doInstance.webSocketMessage(studentWs, spoofedOffer);

    assert.strictEqual(victimWs.sentMessages.length, 1);
    const deliveredToVictim = JSON.parse(victimWs.sentMessages[0]);
    assert.strictEqual(
      deliveredToVictim.payload.senderId,
      'student_id',
      'Durable Object MUST overwrite spoofed senderId with authenticated participant ID'
    );
    assert.strictEqual(
      deliveredToVictim.senderId,
      'student_id',
      'Top-level senderId must also be authentic'
    );
    recordPass('Authoritative overwrite of spoofed WebRTC senderId in signaling packet');

    // 5.3 WebRTC Self-signaling prevention
    victimWs.sentMessages = [];
    studentWs.sentMessages = [];
    const selfOffer = JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: {
        targetUserId: 'student_id', // Self!
        sdp: 'self-sdp',
        type: 'offer',
      },
    });
    await doInstance.webSocketMessage(studentWs, selfOffer);
    assert.strictEqual(studentWs.sentMessages.length, 0, 'Self-targeted signaling must be dropped');
    recordPass('Self-targeted WebRTC signaling packet safely discarded');
  }

  // --------------------------------------------------------------------------
  // SUITE 6: Concurrency, WebRTC Burst Mesh Signaling & Edge Robustness
  // --------------------------------------------------------------------------
  console.log('\n>>> [SUITE 6] Concurrency, WebRTC Burst Mesh Signaling & Edge Robustness');

  {
    const { state, doInstance, classroomId } = createTestHarness();

    // 6.1 Full-Mesh Burst Signaling with 6 peers (30 directed pairs x 3 packets = 90 signals)
    console.log('  Testing 6-peer WebRTC full-mesh burst signaling (90 total packets)...');
    const peers: Array<{ id: string; ws: MockWebSocket }> = [];
    for (let i = 0; i < 6; i++) {
      const pId = `peer_mesh_${i}`;
      const ws = await connectParticipant(doInstance, state, classroomId, pId, `Peer ${i}`, 'student');
      peers.push({ id: pId, ws });
    }
    // Reset all message buffers after initial connection join broadcasts
    for (const p of peers) {
      p.ws.sentMessages = [];
    }

    let totalDispatched = 0;
    for (let i = 0; i < peers.length; i++) {
      for (let j = 0; j < peers.length; j++) {
        if (i === j) continue;
        const sender = peers[i];
        const recipient = peers[j];

        // 1. Offer
        await doInstance.webSocketMessage(sender.ws, JSON.stringify({
          version: '1.0',
          type: 'WEBRTC_OFFER',
          sessionId: classroomId,
          payload: { targetUserId: recipient.id, sdp: `sdp-offer-${i}->${j}`, type: 'offer' },
        }));
        // 2. Answer
        await doInstance.webSocketMessage(recipient.ws, JSON.stringify({
          version: '1.0',
          type: 'WEBRTC_ANSWER',
          sessionId: classroomId,
          payload: { targetUserId: sender.id, sdp: `sdp-answer-${j}->${i}`, type: 'answer' },
        }));
        // 3. ICE Candidate
        await doInstance.webSocketMessage(sender.ws, JSON.stringify({
          version: '1.0',
          type: 'WEBRTC_ICE_CANDIDATE',
          sessionId: classroomId,
          payload: { targetUserId: recipient.id, candidate: { candidate: `cand-${i}->${j}` } },
        }));

        totalDispatched += 3;
      }
    }

    assert.strictEqual(totalDispatched, 90, 'Must have dispatched 90 signals');
    // Each peer was a recipient of 5 offers, 5 answers, and 5 ICE candidates = 15 messages total
    for (const peer of peers) {
      assert.strictEqual(
        peer.ws.sentMessages.length,
        15,
        `Peer ${peer.id} must receive exactly 15 directed signaling packets, got ${peer.ws.sentMessages.length}`
      );
      // Verify every message received was actually addressed to this peer
      for (const rawMsg of peer.ws.sentMessages) {
        const msg = JSON.parse(rawMsg);
        assert.strictEqual(msg.payload.targetUserId, peer.id, 'Target user ID must match recipient');
      }
    }
    recordPass('6-peer full mesh WebRTC burst signaling (90 packets) delivered with zero leakage');

    // 6.2 Offline / Non-existent recipient handling
    const senderWs = peers[0].ws;
    senderWs.sentMessages = [];
    const offlineSignal = JSON.stringify({
      version: '1.0',
      type: 'WEBRTC_OFFER',
      sessionId: classroomId,
      payload: { targetUserId: 'non_existent_peer_999', sdp: 'fake-sdp', type: 'offer' },
    });
    await doInstance.webSocketMessage(senderWs, offlineSignal);
    assert.strictEqual(senderWs.sentMessages.length, 0, 'No error or echo sent back to sender on offline peer');
    recordPass('Offline recipient packet dropped safely without throwing');

    // 6.3 Corrupted Yjs CRDT binary updates resilience
    senderWs.sentMessages = [];
    const corruptedCrdtMsg = JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'MONACO_CRDT_UPDATE',
        data: {
          fileId: 'main.ts',
          update: 'NOT_A_VALID_BASE64_STRING!#@%',
        },
      },
    });
    await doInstance.webSocketMessage(senderWs, corruptedCrdtMsg);
    // Should not throw unhandled exception or crash the DO
    recordPass('Corrupted Monaco CRDT binary payload safely quarantined without crashing DO');

    // 6.4 Rapid duplicate event deduplication
    const dupEventId = 'dup_test_event_999';
    const otherPeerWs = peers[1].ws;
    senderWs.sentMessages = [];
    otherPeerWs.sentMessages = [];

    for (let k = 0; k < 20; k++) {
      const dupEnvelope = serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: {
          id: dupEventId,
          type: 'chat.message',
          payload: { text: 'Hello spam' },
        },
        timestamp: Date.now(),
      });
      await doInstance.webSocketMessage(senderWs, dupEnvelope);
    }

    // Sender should receive 20 acks and 1 broadcast event (total 21 frames)
    const acks = senderWs.sentMessages.map(m => parseRealtimeMessage(m)).filter(m => m?.type === 'ack');
    assert.strictEqual(acks.length, 20, 'Sender must receive exactly 20 ack frames for 20 submissions');
    for (const ackMsg of acks) {
      assert.strictEqual(ackMsg?.eventId, dupEventId);
    }
    const senderEvents = senderWs.sentMessages.map(m => parseRealtimeMessage(m)).filter(m => m?.type === 'event');
    assert.strictEqual(senderEvents.length, 1, 'Sender must receive exactly 1 broadcast event (at first submission)');

    // Room peer should receive ONLY 1 broadcast event!
    assert.strictEqual(otherPeerWs.sentMessages.length, 1, 'Room peer must receive exactly 1 broadcast (19 deduplicated)');
    recordPass('Rapid duplicate event deduplication (20 burst replays deduplicated to 1 broadcast)');

    // 6.5 Cold Wake-up Hydration Snapshot Fidelity
    const teacherWs = await connectParticipant(doInstance, state, classroomId, 'teacher_lead', 'Prof Turing', 'teacher');

    // Teacher publishes state
    await doInstance.webSocketMessage(teacherWs, JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEACHER_START_BROADCAST',
        requiresTeacher: true,
        data: {},
      },
    }));

    await doInstance.webSocketMessage(teacherWs, JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'TEACHER_CODE_BROADCAST',
        requiresTeacher: true,
        data: {
          activeFileId: 'app.ts',
          files: [{ id: 'app.ts', name: 'app.ts', content: 'console.log("Cortex Rocks");' }],
        },
      },
    }));

    await doInstance.webSocketMessage(teacherWs, JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'WHITEBOARD_STROKE_END',
        data: {
          pageIndex: 0,
          element: { id: 'stroke_1', type: 'pen', points: [{ x: 10, y: 20 }] },
        },
      },
    }));

    await doInstance.webSocketMessage(teacherWs, JSON.stringify({
      version: '1.0',
      type: 'CLASSROOM_EVENT',
      sessionId: classroomId,
      payload: {
        eventName: 'SLIDE_CHANGED',
        data: { slideIndex: 4 },
      },
    }));

    // Cold sleep: clear in-memory sessions
    doInstance.sessions.clear();

    // Late joiner connects
    const lateJoinerWs = await connectParticipant(doInstance, state, classroomId, 'late_joiner_1', 'Late Student');
    lateJoinerWs.sentMessages = [];

    await doInstance.webSocketMessage(lateJoinerWs, JSON.stringify({
      version: '1.0',
      type: 'JOIN_CLASSROOM',
      sessionId: classroomId,
      payload: { participantName: 'Late Student', requestedRole: 'student' },
    }));

    assert.ok(lateJoinerWs.sentMessages.length >= 4, 'Late joiner must receive at least 4 hydration frames');
    const hydrationFrame = JSON.parse(lateJoinerWs.sentMessages[1]);
    assert.strictEqual(hydrationFrame.type, 'SESSION_HYDRATION_SNAPSHOT');
    assert.strictEqual(hydrationFrame.payload.code.broadcastState, 'broadcasting');
    assert.strictEqual(hydrationFrame.payload.code.activeFileId, 'app.ts');
    assert.strictEqual(hydrationFrame.payload.presentation.activeSlideIndex, 4);
    assert.strictEqual(hydrationFrame.payload.whiteboard.pages[0].elements.length, 1);
    recordPass('Cold wake-up atomic hydration snapshot fidelity verified across all state modules');
  }

  console.log('\n================================================================');
  console.log(`EMPIRICAL ADVERSARIAL STRESS TEST RESULTS:`);
  console.log(`Total Test Cases Executed: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Overall Adversarial Status: ${passedTests === totalTests ? 'ALL PASSED [APPROVED]' : 'FAILED [REJECTED]'}`);
  console.log('================================================================\n');
}

runAdversarialStressSuite().catch((err) => {
  console.error('[FATAL ERROR in Adversarial Test Suite]:', err);
  process.exit(1);
});
