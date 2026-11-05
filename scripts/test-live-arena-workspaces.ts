import { RoomManager } from '../src/lib/classroom/room-manager';
import { ClassroomRoom } from '../src/lib/classroom/types';

async function testLiveArenaWorkspaces() {
  console.log('--- STARTING LIVE ARENA WORKSPACE A/B ISOLATION TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: any, message: string) {
    if (condition) {
      console.log(\✅ PASS: \\);
      passed++;
    } else {
      console.error(\❌ FAIL: \\);
      failed++;
    }
  }

  // 1. Create Room
  const roomInfo = RoomManager.createRoom('ARENA_TEST_1', 'user_1', 'Admin User');
  const room = roomInfo.room;
  assert(room.arenaWorkspaces !== undefined, 'ClassroomRoom initializes arenaWorkspaces');
  assert(room.arenaWorkspaces?.A.workspaceId === 'A', 'Workspace A is initialized');
  assert(room.arenaWorkspaces?.B.workspaceId === 'B', 'Workspace B is initialized');

  // 2. State Independence
  room.arenaWorkspaces!.A.activeCode = 'print("A")';
  room.arenaWorkspaces!.B.activeCode = 'print("B")';
  assert(room.arenaWorkspaces!.A.activeCode !== room.arenaWorkspaces!.B.activeCode, 'Workspace A and B have independent code states');

  room.arenaWorkspaces!.A.currentLanguage = 'python';
  room.arenaWorkspaces!.B.currentLanguage = 'cpp';
  assert(room.arenaWorkspaces!.A.currentLanguage !== room.arenaWorkspaces!.B.currentLanguage, 'Workspace A and B have independent language states');

  // 3. Sync update
  const payloadA = { workspaceId: 'A', activeCode: 'print("Hello A")' };
  room.arenaWorkspaces!['A'].activeCode = payloadA.activeCode;
  assert(room.arenaWorkspaces!.A.activeCode === 'print("Hello A")', 'Workspace A updates correctly');
  assert(room.arenaWorkspaces!.B.activeCode === 'print("B")', 'Workspace B remains unchanged after A updates');

  console.log(\\\n--- TEST RESULTS: \ PASSED, \ FAILED ---\);
  if (failed > 0) process.exit(1);
}

testLiveArenaWorkspaces();
