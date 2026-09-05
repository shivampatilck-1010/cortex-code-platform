import { ClassroomRoomManager } from '../src/lib/classroom/room-manager';

async function runTwoUserVerification() {
  console.log('--- TEST: Two User Classroom Synchronization & Isolation ---');

  const testRoomId = 'test-room-' + Date.now();

  // 1. User 1 ("ad") joins
  console.log('\n1. User "ad" joins room as Admin...');
  const user1Join = ClassroomRoomManager.joinRoom(testRoomId, 'ad', 'admin');
  console.log(`User 1 joined: ID=${user1Join.participant.id}, Name=${user1Join.participant.name}, Role=${user1Join.participant.role}`);
  
  if (user1Join.participant.role !== 'admin') {
    throw new Error(`Expected "ad" to be admin, got ${user1Join.participant.role}`);
  }

  // Check room state with only 1 user
  let room = ClassroomRoomManager.getRoom(testRoomId);
  if (!room) throw new Error('Room not found');

  const getParticipantList = () => Object.values(room!.participants || {});
  const getParticipantCount = () => Object.keys(room!.participants || {}).length;

  console.log(`Active participants count: ${getParticipantCount()}`);
  if (getParticipantCount() !== 1) {
    throw new Error(`Expected 1 participant, got ${getParticipantCount()}`);
  }

  // Simulate Slot A & Slot B logic for 1 user
  let activeSlotA = room.admin.id;
  let others = getParticipantList().filter(p => p.id !== activeSlotA);
  let activeSlotB = others.length > 0 ? others[0].id : undefined;

  console.log(`When only "ad" is online: Slot A = ${activeSlotA}, Slot B = ${activeSlotB}`);
  if (activeSlotB !== undefined) {
    throw new Error(`Slot B should be undefined (empty) when only 1 user is present, but got ${activeSlotB}`);
  }
  if (activeSlotA === activeSlotB) {
    throw new Error(`Slot A and Slot B must never be the same user!`);
  }
  console.log('✅ PASS: Workspace B is empty when only 1 user is present (no self-duplication)');

  // 2. User 2 ("usp") joins the SAME room
  console.log('\n2. User "usp" joins the room in a separate tab/session...');
  // Notice: even if Tab 2 claims 'admin', the server must enforce single admin rule!
  const user2Join = ClassroomRoomManager.joinRoom(testRoomId, 'usp', 'admin');
  console.log(`User 2 joined: ID=${user2Join.participant.id}, Name=${user2Join.participant.name}, Role=${user2Join.participant.role}`);

  if (user2Join.participant.role === 'admin') {
    throw new Error(`User "usp" must NOT be granted admin role when "ad" is already admin!`);
  }
  console.log('✅ PASS: Single Admin Enforced — user "usp" joined as regular user, "ad" remains admin');

  // Check room state with 2 users
  room = ClassroomRoomManager.getRoom(testRoomId)!;
  console.log(`Active participants count: ${getParticipantCount()}`);
  if (getParticipantCount() !== 2) {
    throw new Error(`Expected exactly 2 participants, got ${getParticipantCount()}`);
  }

  const participants = getParticipantList();
  const adminCount = participants.filter(p => p.role === 'admin').length;
  console.log(`Admin count in room: ${adminCount}`);
  if (adminCount !== 1) {
    throw new Error(`Expected exactly 1 admin, found ${adminCount}`);
  }
  console.log('✅ PASS: Exactly 1 Admin in the room roster');

  // Check Slot A & Slot B assignment for 2 users
  activeSlotA = room.admin.id; // Slot A is admin
  others = getParticipantList().filter(p => p.id !== activeSlotA);
  activeSlotB = others.length > 0 ? others[0].id : undefined;

  console.log(`When both are online: Slot A = ${activeSlotA} ("ad"), Slot B = ${activeSlotB} ("usp")`);
  if (!activeSlotB || activeSlotA === activeSlotB) {
    throw new Error(`Slot B must be assigned to "usp" and must differ from Slot A!`);
  }
  console.log('✅ PASS: Slot A ("ad") and Slot B ("usp") are properly separated into distinct workspaces');

  // 3. User "ad" refreshes or reconnects without existingId
  console.log('\n3. User "ad" reconnects with same name (simulating tab refresh/reconnect)...');
  const user1Reconnect = ClassroomRoomManager.joinRoom(testRoomId, 'ad', 'admin');
  room = ClassroomRoomManager.getRoom(testRoomId)!;
  console.log(`Active participants after reconnect: ${getParticipantCount()}`);
  if (getParticipantCount() !== 2) {
    throw new Error(`Participant count increased to ${getParticipantCount()} after reconnect! Duplicate phantom created.`);
  }
  console.log('✅ PASS: No phantom duplicates created on reconnect. Reused existing participant record.');

  // 4. Test UserListPanel (You) logic simulation
  console.log('\n4. Simulating (You) badge matching on Tab 1 and Tab 2...');
  
  // Tab 1: Current user is "ad"
  const tab1Participants = Object.values(room.participants).map(p => ({
    name: p.name,
    role: p.role,
    isSelf: p.name.toLowerCase() === 'ad'
  }));
  console.log('Tab 1 View:', tab1Participants);
  const tab1Self = tab1Participants.find(p => p.isSelf);
  if (!tab1Self || tab1Self.name !== 'ad' || tab1Self.role !== 'admin') {
    throw new Error('Tab 1 failed to identify "ad" as (You) [Admin]');
  }

  // Tab 2: Current user is "usp"
  const tab2Participants = Object.values(room.participants).map(p => ({
    name: p.name,
    role: p.role,
    isSelf: p.name.toLowerCase() === 'usp'
  }));
  console.log('Tab 2 View:', tab2Participants);
  const tab2Self = tab2Participants.find(p => p.isSelf);
  if (!tab2Self || tab2Self.name !== 'usp' || tab2Self.role !== 'user') {
    throw new Error('Tab 2 failed to identify "usp" as (You) [User]');
  }
  console.log('✅ PASS: (You) label correctly resolves to each respective browser tab session');

  console.log('\n=============================================================');
  console.log('🎉 ALL TWO-USER ISOLATION & SYNCHRONIZATION TESTS PASSED!');
  console.log('=============================================================');
}

runTwoUserVerification().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
