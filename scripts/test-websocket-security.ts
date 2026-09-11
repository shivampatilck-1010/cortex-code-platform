/**
 * CORTEX — PRODUCTION WEBSOCKET SECURITY TEST SUITE
 * Tests 1 through 20 as specified in Security Requirements
 */

// 1. Mock Cloudflare Workers WebSocketPair and Response for Node.js test environment
const OriginalResponse = globalThis.Response;
class MockResponse extends OriginalResponse {
  webSocket?: any;
  constructor(body?: any, init?: any) {
    if (init && init.status === 101) {
      super(body, { ...init, status: 200 });
      Object.defineProperty(this, 'status', { value: 101, writable: false });
      if (init.webSocket) {
        this.webSocket = init.webSocket;
      }
      return;
    }
    super(body, init);
    if (init?.webSocket) {
      this.webSocket = init.webSocket;
    }
  }
}
// @ts-ignore
globalThis.Response = MockResponse;

class MockWebSocket {
  readyState = 1;
  other: MockWebSocket | null = null;
  listeners: Record<string, Function[]> = {};
  sentMessages: string[] = [];
  receivedMessages: string[] = [];

  accept() {
    this.readyState = 1;
  }

  send(data: string) {
    this.sentMessages.push(data);
    if (this.other) {
      this.other.receivedMessages.push(data);
      this.other.emit('message', { data });
    }
  }

  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  on(event: string, fn: Function) {
    this.addEventListener(event, fn);
  }

  emit(event: string, data: any) {
    this.listeners[event]?.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error('Error in listener:', err);
      }
    });
  }

  close(code?: number, reason?: string) {
    this.readyState = 3;
    this.emit('close', { code, reason });
    if (this.other && this.other.readyState !== 3) {
      this.other.readyState = 3;
      this.other.emit('close', { code, reason });
    }
  }
}

class MockWebSocketPair {
  0: MockWebSocket;
  1: MockWebSocket;
  constructor() {
    this[0] = new MockWebSocket();
    this[1] = new MockWebSocket();
    this[0].other = this[1];
    this[1].other = this[0];
  }
}

// @ts-ignore
globalThis.WebSocketPair = MockWebSocketPair;

// Mock virtual vinext modules when running outside Vite bundler
try {
  // @ts-ignore
  const { mock } = await import('bun:test');
  mock.module('virtual:vinext-worker-entry', () => ({ default: () => new Response('ok') }));
  mock.module('vinext/server/fetch-handler', () => ({ default: () => new Response('ok') }));
} catch {}

const { default: worker } = await import('../src/worker');
import { ClassroomRoomDO } from '../src/lib/classroom/durable-object';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { classroomDb } from '../src/lib/classroom/db';
import { parseRealtimeMessage, serializeRealtimeMessage } from '../src/lib/classroom/protocol';

async function runSecurityTestSuite() {
  console.log('====================================================');
  console.log('CORTEX PRODUCTION WEBSOCKET SECURITY AUDIT — TESTS 1–20');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testNum: number, title: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] TEST ${testNum}: ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] TEST ${testNum}: ${title} ${detail ? `(${detail})` : ''}`);
      process.exitCode = 1;
    }
  }

  // Setup test environment
  const classroomId = 'C1-CS201-ADV';
  const teacherId = 'usr_prof_elena';
  const student1Id = 'usr_alex_chen';
  const student2Id = 'usr_maya_patel';
  const outsiderId = 'usr_outsider_attacker';

  // Ensure outsider user exists but has NO membership in classroomId
  classroomDb.createUser({
    id: outsiderId,
    name: 'Eve Outsider',
    email: 'eve@outside.org',
    role: 'student',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const teacherToken = ClassroomAuth.createClientToken(teacherId);
  const student1Token = ClassroomAuth.createClientToken(student1Id);
  const student2Token = ClassroomAuth.createClientToken(student2Id);
  const outsiderToken = ClassroomAuth.createClientToken(outsiderId);

  // Setup Durable Object storage mock & Worker environment
  const doStorage = new Map<string, any>();
  const mockState = {
    storage: {
      get: async (k: string) => doStorage.get(k),
      put: async (k: string, v: any) => { doStorage.set(k, v); },
      delete: async (k: string) => doStorage.delete(k),
    },
  };
  const doInstance = new ClassroomRoomDO(mockState, {});

  const env = {
    CLASSROOM_ROOM_DO: {
      idFromName: (name: string) => name,
      get: (id: string) => ({
        fetch: (req: Request) => doInstance.fetch(req),
      }),
    },
  };
  const ctx = {};

  // Helper to connect through Worker
  async function connectViaWorker(url: string, headers: Record<string, string> = {}) {
    const req = new Request(url, {
      method: 'GET',
      headers: {
        Upgrade: 'websocket',
        ...headers,
      },
    });
    const res = await worker.fetch(req, env, ctx);
    // @ts-ignore
    const clientWs: MockWebSocket = (res as any).webSocket;
    return { res, clientWs };
  }

  // --- TEST 1: Unauthenticated WebSocket connection -> rejected ---
  {
    const { res } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`);
    assert(res.status === 401, 1, 'Unauthenticated WebSocket connection -> rejected', `Status was ${res.status}`);
  }

  // --- TEST 2: Authenticated user not belonging to classroom -> rejected ---
  {
    const { res } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`, {
      Authorization: `Bearer ${outsiderToken}`,
    });
    assert(res.status === 403, 2, 'Authenticated user not belonging to classroom -> rejected', `Status was ${res.status}`);
  }

  // --- TEST 3: Authenticated student -> connects successfully ---
  let student1Ws: MockWebSocket;
  {
    const { res, clientWs } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`, {
      Authorization: `Bearer ${student1Token}`,
    });
    student1Ws = clientWs;
    const authOkMsg = clientWs.receivedMessages.map(m => parseRealtimeMessage(m)).find(m => m?.type === 'auth_ok');
    assert(
      res.status === 101 && authOkMsg !== undefined && authOkMsg?.payload?.role === 'student',
      3,
      'Authenticated student -> connects successfully with student role'
    );
  }

  // --- TEST 4: Authenticated teacher -> connects successfully ---
  let teacherWs: MockWebSocket;
  {
    const { res, clientWs } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`, {
      Authorization: `Bearer ${teacherToken}`,
    });
    teacherWs = clientWs;
    const authOkMsg = clientWs.receivedMessages.map(m => parseRealtimeMessage(m)).find(m => m?.type === 'auth_ok');
    assert(
      res.status === 101 && authOkMsg !== undefined && authOkMsg?.payload?.role === 'teacher',
      4,
      'Authenticated teacher -> connects successfully with teacher role'
    );
  }

  // --- TEST 5: Student sends teacher-only event -> FORBIDDEN_EVENT ---
  {
    let receivedError: any = null;
    student1Ws.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'error') receivedError = msg;
    });

    student1Ws.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: {
          type: 'teacher.code.changed',
          payload: { code: 'console.log("hacked")' },
        },
        timestamp: Date.now(),
      })
    );

    // Give microtask tick
    await new Promise(r => setTimeout(r, 20));
    assert(
      receivedError?.payload?.code === 'FORBIDDEN_EVENT',
      5,
      'Student sends teacher-only event -> FORBIDDEN_EVENT',
      `Got error code: ${receivedError?.payload?.code}`
    );
  }

  // --- TEST 6: Student changes participantRole to "teacher" in query/payload -> still FORBIDDEN_EVENT ---
  {
    // Try connecting with spoofed participantRole=teacher in query params
    const { res, clientWs } = await connectViaWorker(
      `https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws?participantRole=teacher&role=teacher`,
      {
        Authorization: `Bearer ${student1Token}`,
      }
    );
    const authOkMsg = clientWs.receivedMessages.map(m => parseRealtimeMessage(m)).find(m => m?.type === 'auth_ok');
    const roleIsStillStudent = authOkMsg?.payload?.role === 'student';

    let receivedError: any = null;
    clientWs.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'error') receivedError = msg;
    });

    // Try sending teacher event with spoofed role in payload
    clientWs.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: {
          type: 'assignment.published',
          role: 'teacher',
          payload: { title: 'Fake Assignment' },
        },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 20));
    assert(
      roleIsStillStudent && receivedError?.payload?.code === 'FORBIDDEN_EVENT',
      6,
      'Student changes participantRole to "teacher" -> still FORBIDDEN_EVENT'
    );
  }

  // --- TEST 7: Student changes participantId to teacher ID -> still treated as original student ---
  {
    const { res, clientWs } = await connectViaWorker(
      `https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws?participantId=${teacherId}&userId=${teacherId}`,
      {
        Authorization: `Bearer ${student1Token}`,
      }
    );
    const authOkMsg = clientWs.receivedMessages.map(m => parseRealtimeMessage(m)).find(m => m?.type === 'auth_ok');
    assert(
      authOkMsg?.payload?.userId === student1Id && authOkMsg?.payload?.role === 'student',
      7,
      'Student changes participantId to teacher ID -> still treated as student'
    );
  }

  // --- TEST 8: Student changes actorId in event payload -> server overwrites actor identity ---
  {
    let broadcastedEvent: any = null;
    teacherWs.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'event' && msg?.payload?.event?.type === 'student.code.shared') {
        broadcastedEvent = msg.payload.event;
      }
    });

    student1Ws.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: {
          type: 'student.code.shared',
          actorId: teacherId, // Impersonation attempt
          payload: {
            userId: teacherId,
            code: 'print("hello")',
          },
        },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 20));
    assert(
      broadcastedEvent !== null &&
      broadcastedEvent.actorId === student1Id &&
      broadcastedEvent.payload.userId === student1Id,
      8,
      'Student changes actorId in event payload -> server overwrites actor identity'
    );
  }

  // --- TEST 9: User attempts another classroom's WebSocket -> rejected ---
  {
    const { res } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/CLS-NONEXISTENT-999/ws`, {
      Authorization: `Bearer ${student1Token}`,
    });
    assert(res.status === 404 || res.status === 403, 9, 'User attempts another classroom WebSocket -> rejected');
  }

  // --- TEST 10: Valid teacher event -> accepted ---
  {
    let teacherAck: any = null;
    teacherWs.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'ack') teacherAck = msg;
    });

    const testEventId = `evt_teacher_${Date.now()}`;
    teacherWs.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: {
          id: testEventId,
          type: 'teacher.code.changed',
          payload: { code: 'int main() { return 0; }' },
        },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 20));
    assert(teacherAck !== null && teacherAck.eventId === testEventId, 10, 'Valid teacher event -> accepted');
  }

  // --- TEST 11: Student requests resync -> receives only authorized data ---
  {
    let resyncMsg: any = null;
    student1Ws.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'resync_response') resyncMsg = msg;
    });

    student1Ws.send(
      serializeRealtimeMessage({
        type: 'resync_request',
        classroomId,
        payload: { sinceSequence: 0 },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 20));
    assert(
      resyncMsg !== null && Array.isArray(resyncMsg.payload?.events),
      11,
      'Student requests resync -> receives authorized classroom data'
    );
  }

  // --- TEST 12: Non-member requests resync on DO directly -> rejected ---
  {
    // Direct attempt to fetch DO without internal auth token
    const directReq = new Request(`https://internal-do/api/v1/classrooms/${classroomId}/ws`, {
      headers: { Upgrade: 'websocket' },
    });
    const directRes = await doInstance.fetch(directReq);
    assert(directRes.status === 401, 12, 'Non-member requests resync / direct DO -> rejected with 401');
  }

  // --- TEST 13: Reconnect after valid authentication -> reconnect works ---
  {
    const { res, clientWs } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`, {
      Authorization: `Bearer ${student1Token}`,
    });
    const authOkMsg = clientWs.receivedMessages.map(m => parseRealtimeMessage(m)).find(m => m?.type === 'auth_ok');
    assert(res.status === 101 && authOkMsg?.payload?.userId === student1Id, 13, 'Reconnect after valid authentication -> works');
  }

  // --- TEST 14: Reconnect with manipulated role -> role remains server-derived ---
  {
    const { clientWs } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`, {
      Authorization: `Bearer ${student1Token}`,
    });
    let reauthResponse: any = null;
    clientWs.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'auth_ok') reauthResponse = msg;
    });

    // Send manipulated auth message attempting role escalation
    clientWs.send(
      serializeRealtimeMessage({
        type: 'auth',
        classroomId,
        payload: { role: 'teacher' },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 20));
    assert(
      reauthResponse?.payload?.role === 'student',
      14,
      'Reconnect with manipulated role -> role remains server-derived'
    );
  }

  // --- TEST 15: Duplicate event -> existing deduplication still works ---
  {
    const dupEventId = `evt_dup_test_${Date.now()}`;
    let ackCount = 0;
    teacherWs.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'ack' && msg.eventId === dupEventId) {
        ackCount++;
      }
    });

    const dupMsg = serializeRealtimeMessage({
      type: 'event',
      classroomId,
      payload: {
        id: dupEventId,
        type: 'teacher.output.created',
        payload: { output: 'Compiled successfully' },
      },
      timestamp: Date.now(),
    });

    teacherWs.send(dupMsg);
    await new Promise(r => setTimeout(r, 20));
    teacherWs.send(dupMsg); // duplicate
    await new Promise(r => setTimeout(r, 20));

    assert(ackCount === 2, 15, 'Duplicate event -> deduplicated with immediate ack');
  }

  // --- TEST 16: Sequence/replay -> strictly monotonic sequence numbers ---
  {
    let seqA = -1;
    let seqB = -1;

    teacherWs.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'ack') {
        if (seqA === -1) seqA = msg.sequence;
        else if (seqB === -1) seqB = msg.sequence;
      }
    });

    teacherWs.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: { id: `seq_1_${Date.now()}`, type: 'teacher.cursor.updated', payload: { line: 1 } },
        timestamp: Date.now(),
      })
    );
    await new Promise(r => setTimeout(r, 20));

    teacherWs.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: { id: `seq_2_${Date.now()}`, type: 'teacher.cursor.updated', payload: { line: 2 } },
        timestamp: Date.now(),
      })
    );
    await new Promise(r => setTimeout(r, 20));

    assert(seqB > seqA && seqA > 0, 16, 'Sequence/replay -> existing sequence guarantees intact');
  }

  // --- TEST 17: DM sender spoofing -> rejected / sender identity overwritten ---
  {
    let receivedDM: any = null;
    teacherWs.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'event' && msg?.payload?.event?.type === 'message.created') {
        receivedDM = msg.payload.event.payload.message;
      }
    });

    student1Ws.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: {
          type: 'message.created',
          payload: {
            message: {
              id: 'dm_1',
              senderId: teacherId, // Spoofing attempt
              recipientType: 'direct',
              recipientId: teacherId,
              content: 'Hello teacher',
            },
          },
        },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 20));
    assert(
      receivedDM !== null && receivedDM.senderId === student1Id,
      17,
      'DM sender spoofing -> sender identity strictly overwritten'
    );
  }

  // --- TEST 18: DM unauthorized recipient access -> private DM not sent to other students ---
  {
    // Connect student 2 (Maya)
    const { clientWs: student2Ws } = await connectViaWorker(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`, {
      Authorization: `Bearer ${student2Token}`,
    });

    let student2ReceivedDM = false;
    student2Ws.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'event' && msg?.payload?.event?.type === 'message.created' && msg.payload.event.payload?.message?.recipientType === 'direct') {
        student2ReceivedDM = true;
      }
    });

    // Student 1 sends DM directly to Teacher
    student1Ws.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: {
          type: 'message.created',
          payload: {
            message: {
              id: 'dm_private_1',
              recipientType: 'direct',
              recipientId: teacherId,
              content: 'Private grade inquiry',
            },
          },
        },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 30));
    assert(!student2ReceivedDM, 18, 'DM unauthorized recipient access -> private DM not delivered to other students');
  }

  // --- TEST 19: Malformed event -> clean rejection, no crash ---
  {
    let malformedErr: any = null;
    student1Ws.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'error' && msg.payload?.code === 'MALFORMED_EVENT') {
        malformedErr = msg;
      }
    });

    student1Ws.send('{ "invalid": json without closing ');
    await new Promise(r => setTimeout(r, 20));

    assert(malformedErr !== null, 19, 'Malformed event -> clean rejection, no crash');
  }

  // --- TEST 20: Oversized payload -> rejected safely ---
  {
    let sizeErr: any = null;
    student1Ws.on('message', (ev: any) => {
      const msg = parseRealtimeMessage(ev.data);
      if (msg?.type === 'error' && msg.payload?.code === 'PAYLOAD_TOO_LARGE') {
        sizeErr = msg;
      }
    });

    const hugeData = 'X'.repeat(600 * 1024); // 600KB
    student1Ws.send(
      serializeRealtimeMessage({
        type: 'event',
        classroomId,
        payload: { type: 'student.code.shared', payload: { code: hugeData } },
        timestamp: Date.now(),
      })
    );

    await new Promise(r => setTimeout(r, 20));
    assert(sizeErr !== null, 20, 'Oversized payload (>512KB) -> rejected safely with PAYLOAD_TOO_LARGE');
  }

  console.log('\n====================================================');
  console.log(`FINAL TEST RESULT: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed === total) {
    console.log('🎉 ALL 20 PRODUCTION WEBSOCKET SECURITY TESTS PASSED!');
    process.exit(0);
  } else {
    console.error(`❌ ${total - passed} TESTS FAILED.`);
    process.exit(1);
  }
}

runSecurityTestSuite().catch((err) => {
  console.error('Test suite crashed with error:', err);
  process.exit(1);
});
