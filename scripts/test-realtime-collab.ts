import { WebSocket } from 'ws';
import * as Y from 'yjs';
import assert from 'assert';
import { ensureNodeWsServer, getServerYDoc } from '../src/lib/classroom/node-ws-server';
import {
  parseRealtimeMessage,
  serializeRealtimeMessage,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from '../src/lib/classroom/protocol';

async function runSimulation() {
  console.log('========================================================');
  console.log('🚀 STARTING MULTI-CLIENT REAL-TIME COLLABORATION TEST');
  console.log('========================================================\n');

  // 1. Ensure server is running
  const port = await ensureNodeWsServer(3002);
  console.log(`[Server] Authoritative Node WS Server listening on port: ${port}`);
  assert(port, 'Server port must be defined');

  const wsUrl = `ws://localhost:${port}`;
  const roomId = 'TEST_ROOM_CRDT';
  const sharedDocId = 'shared_session1_main.py';

  // Helper to create a client connected to room
  async function createTestClient(clientId, name, role = 'user') {
    const ws = new WebSocket(wsUrl);
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('monaco');
    const incomingMessages = [];

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });

    ws.on('message', (data) => {
      const msg = parseRealtimeMessage(data.toString('utf-8'));
      if (!msg) return;
      incomingMessages.push(msg);

      if (msg.type === 'doc_sync_step2' && msg.payload?.update) {
        const update = base64ToUint8Array(msg.payload.update);
        Y.applyUpdate(ydoc, update, 'server_sync');
      } else if (msg.type === 'doc_update' && msg.payload?.update) {
        const update = base64ToUint8Array(msg.payload.update);
        Y.applyUpdate(ydoc, update, 'remote_peer');
      }
    });

    // Send Join
    ws.send(
      serializeRealtimeMessage({
        type: 'join',
        roomId,
        clientId,
        senderName: name,
        payload: { role, participantName: name },
        timestamp: Date.now(),
      })
    );

    // Initial Doc Sync Handshake Step 1
    const vector = Y.encodeStateVector(ydoc);
    ws.send(
      serializeRealtimeMessage({
        type: 'doc_sync_step1',
        roomId,
        documentId: sharedDocId,
        clientId,
        payload: { vector: uint8ArrayToBase64(vector) },
        timestamp: Date.now(),
      })
    );

    // Broadcast local Yjs changes as doc_update
    ydoc.on('update', (update, origin) => {
      if (origin !== 'server_sync' && origin !== 'remote_peer') {
        ws.send(
          serializeRealtimeMessage({
            type: 'doc_update',
            roomId,
            documentId: sharedDocId,
            clientId,
            senderName: name,
            payload: { update: uint8ArrayToBase64(update) },
            timestamp: Date.now(),
          })
        );
      }
    });

    return { ws, ydoc, ytext, incomingMessages, clientId, name };
  }

  // 2. Connect Client A (Alice) and Client B (Bob)
  console.log('[Test Setup] Connecting Client A (Alice) and Client B (Bob)...');
  const clientA = await createTestClient('user_alice', 'Alice', 'admin');
  const clientB = await createTestClient('user_bob', 'Bob', 'user');

  // Small delay for initial join & sync handshake
  await new Promise((r) => setTimeout(r, 200));
  console.log('✅ Both clients connected and joined room: ' + roomId);

  // ----------------------------------------------------
  // TEST 1: Unidirectional Typing Propagation
  // ----------------------------------------------------
  console.log('\n--- TEST 1: Typing Propagation from Client A -> Client B ---');
  const initialCode = 'def calculate_sum(a, b):\n    return a + b\n';
  clientA.ydoc.transact(() => {
    clientA.ytext.insert(0, initialCode);
  });

  await new Promise((r) => setTimeout(r, 150));

  console.log('[Client A Text]:\n' + clientA.ytext.toString());
  console.log('[Client B Text]:\n' + clientB.ytext.toString());
  assert.strictEqual(clientB.ytext.toString(), initialCode, 'Client B must have received Client A code');
  console.log('✅ Test 1 Passed: Client B received exact code delta without delay or data loss.');

  // ----------------------------------------------------
  // TEST 2: Rapid Concurrent Simultaneous Typing (CRDT Convergence)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Rapid Simultaneous Concurrent Typing ---');
  // Alice types at line 1, Bob types at the end simultaneously
  const aliceInsert = '# Authors: Alice & Bob\n';
  const bobInsert = '\n# Test case\nprint(calculate_sum(10, 20))\n';

  clientA.ydoc.transact(() => {
    clientA.ytext.insert(0, aliceInsert);
  });
  clientB.ydoc.transact(() => {
    clientB.ytext.insert(clientB.ytext.length, bobInsert);
  });

  await new Promise((r) => setTimeout(r, 200));

  const textA = clientA.ytext.toString();
  const textB = clientB.ytext.toString();
  const serverDoc = getServerYDoc(roomId, sharedDocId);
  const serverText = serverDoc.getText('monaco').toString();

  console.log('[Final Merged Output Client A]:\n' + textA);
  assert.strictEqual(textA, textB, 'Client A and Client B must have identical text');
  assert.strictEqual(textA, serverText, 'Server and Clients must have identical CRDT convergence');
  assert(textA.includes(aliceInsert.trim()), 'Alice typing must be preserved');
  assert(textA.includes('calculate_sum'), 'Original code must be preserved');
  assert(textA.includes(bobInsert.trim()), 'Bob typing must be preserved');
  console.log('✅ Test 2 Passed: 0 lost characters during simultaneous keystrokes. CRDT convergence verified!');

  // ----------------------------------------------------
  // TEST 3: Live Cursor & Presence
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Cursor & Presence Broadcasting ---');
  clientA.ws.send(
    serializeRealtimeMessage({
      type: 'cursor_update',
      roomId,
      documentId: sharedDocId,
      clientId: clientA.clientId,
      senderName: clientA.name,
      payload: { lineNumber: 4, column: 12 },
      timestamp: Date.now(),
    })
  );

  await new Promise((r) => setTimeout(r, 150));

  const cursorMsg = clientB.incomingMessages.find(
    (m) => m.type === 'cursor_update' && m.clientId === clientA.clientId
  );
  assert(cursorMsg, 'Client B should receive cursor_update from Client A');
  assert.strictEqual(cursorMsg.payload.lineNumber, 4);
  assert.strictEqual(cursorMsg.payload.column, 12);
  console.log('✅ Test 3 Passed: Live cursor coordinates received accurately.');

  // ----------------------------------------------------
  // TEST 4: Disconnect, Offline Edit, Reconnect & Catch-Up Resync
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Reconnect & Offline Catch-up Resync ---');
  console.log('[Client B] Simulating network drop / tab close...');
  clientB.ws.close();
  await new Promise((r) => setTimeout(r, 150));

  // Alice continues typing while Bob is disconnected
  const offlineEdit = '\n# Verified offline sync\n';
  clientA.ydoc.transact(() => {
    clientA.ytext.insert(clientA.ytext.length, offlineEdit);
  });
  console.log('[Client A] Made edits while Bob was offline.');

  // Bob reconnects as a fresh session
  console.log('[Client B] Reconnecting...');
  const reconnectedB = await createTestClient('user_bob', 'Bob', 'user');
  await new Promise((r) => setTimeout(r, 250));

  console.log('[Reconnected Client B Text]:\n' + reconnectedB.ytext.toString());
  assert.strictEqual(
    reconnectedB.ytext.toString(),
    clientA.ytext.toString(),
    'Reconnected client must catch up with all missed changes'
  );
  console.log('✅ Test 4 Passed: Bob reconnected and automatically caught up to the latest state vector.');

  // ----------------------------------------------------
  // TEST 5: Independent Workspace Isolation
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Independent Mode Workspace Isolation ---');
  const docA = 'user_alice_main.py';
  const docB = 'user_bob_main.py';

  const docAlice = getServerYDoc(roomId, docA, 'alice_private_code()');
  const docBob = getServerYDoc(roomId, docB, 'bob_private_code()');

  assert.strictEqual(docAlice.getText('monaco').toString(), 'alice_private_code()');
  assert.strictEqual(docBob.getText('monaco').toString(), 'bob_private_code()');
  console.log('✅ Test 5 Passed: Separate user workspace files are strictly isolated.');

  // Cleanup
  clientA.ws.close();
  reconnectedB.ws.close();

  console.log('\n========================================================');
  console.log('🎉 ALL 5 REAL-TIME COLLABORATION TESTS PASSED PERFECTLY!');
  console.log('========================================================');
  process.exit(0);
}

runSimulation().catch((err) => {
  console.error('❌ Simulation Test Failed:', err);
  process.exit(1);
});
