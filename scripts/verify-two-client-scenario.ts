/**
 * CORTEX — PRODUCTION WEBSOCKET VERIFICATION
 * Section 16: Two-Client Scenario Verification
 * Client A: Teacher (usr_prof_elena)
 * Client B: Student (usr_alex_chen)
 */

// 1. Mock Cloudflare Workers WebSocketPair & Response
const OriginalResponse = globalThis.Response;
class MockResponse extends OriginalResponse {
  webSocket?: any;
  constructor(body?: any, init?: any) {
    if (init && init.status === 101) {
      super(body, { ...init, status: 200 });
      Object.defineProperty(this, 'status', { value: 101, writable: false });
      if (init.webSocket) this.webSocket = init.webSocket;
      return;
    }
    super(body, init);
    if (init?.webSocket) this.webSocket = init.webSocket;
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
      try { fn(data); } catch (e) { console.error('Listener err:', e); }
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
import { parseRealtimeMessage, serializeRealtimeMessage } from '../src/lib/classroom/protocol';

async function verifyTwoClientScenario() {
  console.log('====================================================');
  console.log('TWO-CLIENT REALTIME VERIFICATION SCENARIO (SECTION 16)');
  console.log('====================================================\n');

  const classroomId = 'C1-CS201-ADV';
  const teacherId = 'usr_prof_elena';
  const studentId = 'usr_alex_chen';

  const teacherToken = ClassroomAuth.createClientToken(teacherId);
  const studentToken = ClassroomAuth.createClientToken(studentId);

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

  async function connect(token: string) {
    const req = new Request(`https://cortex.workers.dev/api/v1/classrooms/${classroomId}/ws`, {
      method: 'GET',
      headers: {
        Upgrade: 'websocket',
        Authorization: `Bearer ${token}`,
      },
    });
    const res = await worker.fetch(req, env, {});
    // @ts-ignore
    const ws: MockWebSocket = (res as any).webSocket;
    return { res, ws };
  }

  // 1. Connect Teacher (Client A)
  console.log('1. Connecting Teacher (usr_prof_elena)...');
  const { ws: teacherWs } = await connect(teacherToken);
  const teacherAuth = teacherWs.receivedMessages.map(m => parseRealtimeMessage(m)).find(m => m?.type === 'auth_ok');
  console.log(`   Teacher authenticated with role: ${teacherAuth?.payload?.role}`);

  // 2. Connect Student (Client B)
  console.log('2. Connecting Student (usr_alex_chen)...');
  const { ws: studentWs } = await connect(studentToken);
  const studentAuth = studentWs.receivedMessages.map(m => parseRealtimeMessage(m)).find(m => m?.type === 'auth_ok');
  console.log(`   Student authenticated with role: ${studentAuth?.payload?.role}`);

  // Setup listeners
  const teacherEvents: any[] = [];
  const studentEvents: any[] = [];
  const studentErrors: any[] = [];

  teacherWs.on('message', (ev: any) => {
    const msg = parseRealtimeMessage(ev.data);
    if (msg?.type === 'event') teacherEvents.push(msg.payload?.event);
  });

  studentWs.on('message', (ev: any) => {
    const msg = parseRealtimeMessage(ev.data);
    if (msg?.type === 'event') studentEvents.push(msg.payload?.event);
    if (msg?.type === 'error') studentErrors.push(msg.payload);
  });

  // Step 1: Teacher starts live session / broadcasts event -> Student receives in realtime without refresh
  console.log('\n--- Step 1: Teacher starts live session ---');
  teacherWs.send(
    serializeRealtimeMessage({
      type: 'event',
      classroomId,
      payload: {
        id: 'evt_session_start_1',
        type: 'session.started',
        payload: { title: 'Advanced Algorithms Lecture' },
      },
      timestamp: Date.now(),
    })
  );
  await new Promise(r => setTimeout(r, 20));
  const studentReceivedStart = studentEvents.some(e => e.type === 'session.started');
  console.log(`   Student received session.started: ${studentReceivedStart ? '✅ YES' : '❌ NO'}`);

  // Step 2: Teacher updates code / cursor -> Student receives in realtime without refresh
  console.log('\n--- Step 2: Teacher updates code & cursor ---');
  teacherWs.send(
    serializeRealtimeMessage({
      type: 'event',
      classroomId,
      payload: {
        id: 'evt_code_change_1',
        type: 'teacher.code.changed',
        payload: { code: 'def binary_search(arr, x):\n    pass' },
      },
      timestamp: Date.now(),
    })
  );
  teacherWs.send(
    serializeRealtimeMessage({
      type: 'event',
      classroomId,
      payload: {
        id: 'evt_cursor_1',
        type: 'teacher.cursor.updated',
        payload: { line: 2, column: 9 },
      },
      timestamp: Date.now(),
    })
  );
  await new Promise(r => setTimeout(r, 20));
  const studentReceivedCode = studentEvents.some(e => e.type === 'teacher.code.changed');
  const studentReceivedCursor = studentEvents.some(e => e.type === 'teacher.cursor.updated');
  console.log(`   Student received teacher code change: ${studentReceivedCode ? '✅ YES' : '❌ NO'}`);
  console.log(`   Student received teacher cursor update: ${studentReceivedCursor ? '✅ YES' : '❌ NO'}`);

  // Step 3: Student attempts to publish teacher event -> server rejects, teacher does not receive unauthorized state change
  console.log('\n--- Step 3: Student attempts to publish teacher event (Privilege Escalation Test) ---');
  studentWs.send(
    serializeRealtimeMessage({
      type: 'event',
      classroomId,
      payload: {
        id: 'evt_illegal_code_change',
        type: 'teacher.code.changed',
        payload: { code: 'hacked_code_by_student' },
      },
      timestamp: Date.now(),
    })
  );
  await new Promise(r => setTimeout(r, 20));
  const studentGotForbidden = studentErrors.some(e => e.code === 'FORBIDDEN_EVENT');
  const teacherGotIllegalEvent = teacherEvents.some(e => e.id === 'evt_illegal_code_change');
  console.log(`   Student received FORBIDDEN_EVENT error: ${studentGotForbidden ? '✅ YES' : '❌ NO'}`);
  console.log(`   Teacher received illegal event: ${teacherGotIllegalEvent ? '❌ YES (INSECURE)' : '✅ NO (SECURE)'}`);

  // Step 4: Student sends allowed student event (question/chat/hand-raise) -> Teacher receives it
  console.log('\n--- Step 4: Student sends allowed event (question / raised hand / chat) ---');
  studentWs.send(
    serializeRealtimeMessage({
      type: 'event',
      classroomId,
      payload: {
        id: 'evt_hand_raise_1',
        type: 'hand.raised',
        payload: { raised: true },
      },
      timestamp: Date.now(),
    })
  );
  await new Promise(r => setTimeout(r, 20));
  const teacherReceivedHandRaise = teacherEvents.some(e => e.type === 'hand.raised');
  console.log(`   Teacher received student hand.raised: ${teacherReceivedHandRaise ? '✅ YES' : '❌ NO'}`);

  // Step 5: Disconnect and reconnect one client -> connection restores cleanly, replay sequence catches up
  console.log('\n--- Step 5: Disconnect and reconnect Student (Catch up via sequence replay) ---');
  studentWs.close(1000, 'Client simulated disconnect');
  
  // Teacher sends an announcement while student is offline
  teacherWs.send(
    serializeRealtimeMessage({
      type: 'event',
      classroomId,
      payload: {
        id: 'evt_announcement_1',
        type: 'announcement.created',
        payload: { message: 'Homework 2 is posted.' },
      },
      timestamp: Date.now(),
    })
  );
  await new Promise(r => setTimeout(r, 20));

  // Student reconnects
  const { ws: studentWs2 } = await connect(studentToken);
  let resyncEvents: any[] = [];
  studentWs2.on('message', (ev: any) => {
    const msg = parseRealtimeMessage(ev.data);
    if (msg?.type === 'resync_response') {
      resyncEvents = msg.payload?.events || [];
    }
  });

  studentWs2.send(
    serializeRealtimeMessage({
      type: 'resync_request',
      classroomId,
      payload: { sinceSequence: 0 },
      timestamp: Date.now(),
    })
  );
  await new Promise(r => setTimeout(r, 20));
  const reconnectedGotAnnouncement = resyncEvents.some(e => e.type === 'announcement.created');
  console.log(`   Reconnected student caught up via resync: ${reconnectedGotAnnouncement ? '✅ YES' : '❌ NO'}`);

  const allPassed =
    studentReceivedStart &&
    studentReceivedCode &&
    studentReceivedCursor &&
    studentGotForbidden &&
    !teacherGotIllegalEvent &&
    teacherReceivedHandRaise &&
    reconnectedGotAnnouncement;

  console.log('\n====================================================');
  console.log(`TWO-CLIENT VERIFICATION RESULT: ${allPassed ? 'ALL VERIFICATIONS PASSED ✅' : 'FAILED ❌'}`);
  console.log('====================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

verifyTwoClientScenario().catch(err => {
  console.error('Scenario failed:', err);
  process.exit(1);
});
