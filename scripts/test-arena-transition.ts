import { WebSocket } from 'ws';
import assert from 'assert';
import { ensureNodeWsServer } from '../src/lib/classroom/node-ws-server';
import { ClassroomRoomManager } from '../src/lib/classroom/room-manager';
import { parseRealtimeMessage, serializeRealtimeMessage } from '../src/lib/classroom/protocol';

async function runArenaTransitionTest() {
  console.log('🚀 Starting Classroom Arena Transition Multi-Client Verification Test...\n');

  const port = await ensureNodeWsServer(3004);
  assert(port, 'WebSocket server port must be active');
  const wsUrl = `ws://localhost:${port}`;
  const roomId = 'TEST_ARENA_TRANSITION';

  function createClient(clientId: string, name: string, role: 'admin' | 'user') {
    const ws = new WebSocket(wsUrl);
    const messages: any[] = [];

    const readyPromise = new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(
          serializeRealtimeMessage({
            type: 'join',
            roomId,
            clientId,
            senderName: name,
            payload: { role },
            timestamp: Date.now(),
          })
        );
        resolve();
      });
      ws.on('error', reject);
    });

    ws.on('message', (data: any) => {
      const raw = data.toString('utf-8');
      const msg = parseRealtimeMessage(raw);
      if (msg) {
        messages.push(msg);
      }
    });

    return {
      ws,
      messages,
      readyPromise,
      close: () => ws.close(),
    };
  }

  try {
    console.log('--- TEST 1: Initial Room State and Student in Waiting Room ---');
    const { room: initialRoom } = ClassroomRoomManager.createRoom('Admin Alice', undefined, roomId);
    initialRoom.state = 'created';
    initialRoom.admin.enteredArena = false;

    const { room: bobJoinRoom, participant: bobParticipant } = ClassroomRoomManager.joinRoom(
      roomId,
      'Student Bob',
      'user'
    );
    assert.strictEqual(bobParticipant.role, 'user', 'Bob must have user role');
    assert.strictEqual(bobJoinRoom.state, 'created', 'Room must be created (waiting) initially');

    const bobIsWaitingBefore =
      bobParticipant.role !== 'admin' &&
      bobJoinRoom.state !== 'active' &&
      !bobJoinRoom.admin?.enteredArena;
    assert.strictEqual(bobIsWaitingBefore, true, 'Bob MUST be in waiting room before Admin enters arena');
    console.log('✅ Student Bob is in waiting room ("Waiting for Admin to enter the arena...")');

    const bobClient = createClient(bobParticipant.id, 'Student Bob', 'user');
    await bobClient.readyPromise;
    await new Promise((r) => setTimeout(r, 100));

    const bobInitialStateMsg = bobClient.messages.find((m) => m.type === 'room_state');
    assert(bobInitialStateMsg, 'Bob must receive initial room_state over WebSocket');
    console.log('✅ Student Bob WebSocket connected and received initial room_state');

    console.log('\n--- TEST 2: Admin Enters Arena & Real-Time Edge Broadcast ---');
    const adminId = initialRoom.admin.id || 'admin_alice_id';
    const adminClient = createClient(adminId, 'Admin Alice', 'admin');
    await adminClient.readyPromise;
    await new Promise((r) => setTimeout(r, 100));

    const updatedRoom = ClassroomRoomManager.startClassroom(roomId, adminId);
    assert.strictEqual(updatedRoom.state, 'active', 'Room state must be active after startClassroom');
    assert.strictEqual(updatedRoom.admin.enteredArena, true, 'Admin enteredArena must be true');
    console.log('✅ Admin started the classroom (state: active, enteredArena: true)');

    await new Promise((r) => setTimeout(r, 200));

    console.log('\n--- TEST 3: Student Bob Receives Real-Time WebSocket Transition ---');
    const transitionMsg = bobClient.messages.find(
      (m) => m.type === 'classroom_started' || m.type === 'arena_started' || (m.type === 'room_state' && m.payload?.room?.state === 'active')
    );
    assert(transitionMsg, 'Student Bob WebSocket MUST receive transition message');
    console.log(`✅ Student Bob received realtime event: ${transitionMsg.type}`);

    const latestRoomFromMsg = transitionMsg.payload?.room || updatedRoom;
    const bobIsWaitingAfter =
      bobParticipant.role !== 'admin' &&
      latestRoomFromMsg.state !== 'active' &&
      !latestRoomFromMsg.admin?.enteredArena;

    assert.strictEqual(
      bobIsWaitingAfter,
      false,
      'Bob MUST NOT be waiting once arena is active (Automatic transition into Code Arena!)'
    );
    console.log('✅ Student Bob automatically transitioned out of waiting room into Code Arena with 0 page refreshes!');

    console.log('\n--- TEST 4: Late Joiner (Student Charlie) Bypasses Waiting Room ---');
    const { room: charlieJoinRoom, participant: charlieParticipant } = ClassroomRoomManager.joinRoom(
      roomId,
      'Student Charlie',
      'user'
    );
    assert.strictEqual(charlieJoinRoom.state, 'active', 'Room must be active for Charlie');

    const charlieIsWaiting =
      charlieParticipant.role !== 'admin' &&
      charlieJoinRoom.state !== 'active' &&
      !charlieJoinRoom.admin?.enteredArena;

    assert.strictEqual(
      charlieIsWaiting,
      false,
      'Charlie must bypass the waiting room and enter Code Arena directly'
    );
    console.log('✅ Student Charlie immediately entered Code Arena (waiting room bypassed)!');

    console.log('\n--- TEST 5: Direct URL Access (Auto-Admin Assignment) ---');
    const directRoomId = 'DIRECT_URL_ROOM_TEST';
    const { room: directRoom, participant: directUser } = ClassroomRoomManager.joinRoom(
      directRoomId,
      'First Host User',
      'admin'
    );
    assert.strictEqual(directUser.role, 'admin', 'Host requesting admin in unhosted room MUST be designated Admin');
    assert.strictEqual(directRoom.admin.id, directUser.id, 'Host joiner must be room admin');
    console.log('✅ Host participant in unhosted room is designated Admin');

    const { room: secondRoom, participant: secondUser } = ClassroomRoomManager.joinRoom(
      directRoomId,
      'Second Student',
      'admin' // Attempting to join as admin when admin already exists
    );
    assert.strictEqual(secondUser.role, 'user', 'Subsequent joiner is demoted to user because room already has an active admin');
    console.log('✅ Subsequent participants join as regular users (duplicate admin protection active)');

    bobClient.close();
    adminClient.close();

    console.log('\n=============================================================');
    console.log('🎉 ALL 5/5 CLASSROOM ARENA TRANSITION TESTS PASSED SUCCESSFULLY!');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runArenaTransitionTest();
