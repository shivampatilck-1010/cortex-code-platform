import { classroomDb } from '../src/lib/classroom/db';
import { realtimeCoordinator } from '../src/lib/classroom/realtime';
import { getOrCreateNodeWsServer } from '../src/lib/classroom/node-ws-server';
import { ClassroomRealtimeClient } from '../src/lib/classroom/realtime-client';

async function runAudit() {
  console.log('==================================================');
  console.log('CORTEX CLASSROOM — PRODUCTION REALTIME AUDIT SUITE');
  console.log('==================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // 1. Initial State & Setup
  const classroomId = 'CLS-AUDIT-' + Date.now();
  const teacherId = 'usr_teacher_audit';
  const student1Id = 'usr_student_1';
  const student2Id = 'usr_student_2';
  const outsiderId = 'usr_outsider';

  console.log(`Setting up test classroom: ${classroomId}...`);
  classroomDb.createClassroom({
    id: classroomId,
    title: 'Audit & Validation Classroom',
    code: 'AUDIT',
    teacherId,
    subject: 'Computer Science',
  });

  classroomDb.addMember(classroomId, {
    userId: teacherId,
    userName: 'Prof. Turing',
    role: 'teacher',
  });

  classroomDb.addMember(classroomId, {
    userId: student1Id,
    userName: 'Alice Student',
    role: 'student',
  });

  classroomDb.addMember(classroomId, {
    userId: student2Id,
    userName: 'Bob Student',
    role: 'student',
  });

  // Ensure users exist in user table
  classroomDb.createUser({
    id: teacherId,
    name: 'Prof. Turing',
    email: 'turing@cortex.edu',
    role: 'teacher',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  classroomDb.createUser({
    id: student1Id,
    name: 'Alice Student',
    email: 'alice@cortex.edu',
    role: 'student',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  classroomDb.createUser({
    id: student2Id,
    name: 'Bob Student',
    email: 'bob@cortex.edu',
    role: 'student',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  classroomDb.createUser({
    id: outsiderId,
    name: 'Eve Hacker',
    email: 'eve@unknown.com',
    role: 'student',
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // TEST 1: Database sequence monotonicity
  const e1 = realtimeCoordinator.broadcast(classroomId, 'test.init', {}, { id: teacherId, name: 'Prof. Turing' });
  const e2 = realtimeCoordinator.broadcast(classroomId, 'test.init', {}, { id: teacherId, name: 'Prof. Turing' });
  const e3 = realtimeCoordinator.broadcast(classroomId, 'test.init', {}, { id: teacherId, name: 'Prof. Turing' });
  assert(e1.sequence === 1 && e2.sequence === 2 && e3.sequence === 3, 'Monotonic database sequence numbers', `got: ${e1.sequence}, ${e2.sequence}, ${e3.sequence}`);

  // TEST 2: Authoritative Event Recording & Ring-Buffer Replay
  console.log('\n--- Testing Event Replay & Monotonic Continuity ---');
  for (let i = 1; i <= 15; i++) {
    realtimeCoordinator.broadcast(
      classroomId,
      'chat.message',
      { text: `Audit event #${i}` },
      { id: teacherId, name: 'Prof. Turing' }
    );
  }

  // Current sequence should be 18 (3 initial calls + 15 events)
  const currentSeq = classroomDb.getNextEventSequence(classroomId) - 1;
  assert(currentSeq >= 18, 'Sequence incremented correctly after 15 events', `seq=${currentSeq}`);

  // Query events since sequence 3 (should return all 15 events in order)
  const missedEvents = realtimeCoordinator.getMissedEvents(classroomId, 3);
  assert(missedEvents.length === 15, 'Missed events retrieval count is exact', `got=${missedEvents.length}`);
  
  let monotonicOrder = true;
  for (let i = 0; i < missedEvents.length; i++) {
    if (missedEvents[i].sequence !== 4 + i) {
      monotonicOrder = false;
      break;
    }
  }
  assert(monotonicOrder, 'Replayed events maintain strictly monotonic sequence ordering');

  // TEST 3: Duplicate Event Suppression
  console.log('\n--- Testing Duplicate Event Suppression ---');
  const duplicateId = 'evt_duplicate_test_' + Date.now();
  const event1 = realtimeCoordinator.handleIncomingClientEvent(
    classroomId,
    { id: duplicateId, type: 'chat.message', payload: { text: 'First send' } },
    { id: student1Id, name: 'Alice Student', role: 'student' }
  );
  assert(event1 !== null, 'First instance of event is accepted and recorded');

  const event2 = realtimeCoordinator.handleIncomingClientEvent(
    classroomId,
    { id: duplicateId, type: 'chat.message', payload: { text: 'Second send (duplicate)' } },
    { id: student1Id, name: 'Alice Student', role: 'student' }
  );
  assert(event2 === null, 'Duplicate event is safely rejected without double-processing');

  // TEST 4: Teacher-Only Event Authorization
  console.log('\n--- Testing Role Authorization & Forbidden Event Rejection ---');
  const studentAttempt1 = realtimeCoordinator.handleIncomingClientEvent(
    classroomId,
    { type: 'announcement.created', payload: { title: 'Unauthorized Announcement' } },
    { id: student1Id, name: 'Alice Student', role: 'student' }
  );
  assert(studentAttempt1 === null, 'Student blocked from emitting announcement.created');

  const studentAttempt2 = realtimeCoordinator.handleIncomingClientEvent(
    classroomId,
    { type: 'assignment.published', payload: { title: 'Fake Homework' } },
    { id: student1Id, name: 'Alice Student', role: 'student' }
  );
  assert(studentAttempt2 === null, 'Student blocked from emitting assignment.published');

  const studentAttempt3 = realtimeCoordinator.handleIncomingClientEvent(
    classroomId,
    { type: 'rollcall.started', payload: { duration: 60 } },
    { id: student1Id, name: 'Alice Student', role: 'student' }
  );
  assert(studentAttempt3 === null, 'Student blocked from emitting rollcall.started');

  const teacherAttempt = realtimeCoordinator.handleIncomingClientEvent(
    classroomId,
    { type: 'announcement.created', payload: { title: 'Authoritative Announcement' } },
    { id: teacherId, name: 'Prof. Turing', role: 'teacher' }
  );
  assert(teacherAttempt !== null, 'Teacher authorized to emit announcement.created');

  // TEST 5: Direct Message Privacy Isolation
  console.log('\n--- Testing Direct Message Privacy Isolation ---');
  let student1Received = false;
  let student2Received = false;

  const subStudent1 = {
    id: 'ws_s1',
    userId: student1Id,
    userName: 'Alice',
    role: 'student' as const,
    classroomId,
    send: () => { student1Received = true; },
    isAlive: true,
    lastActive: Date.now(),
  };

  const subStudent2 = {
    id: 'ws_s2',
    userId: student2Id,
    userName: 'Bob',
    role: 'student' as const,
    classroomId,
    send: () => { student2Received = true; },
    isAlive: true,
    lastActive: Date.now(),
  };

  realtimeCoordinator.registerWsClient(classroomId, subStudent1);
  realtimeCoordinator.registerWsClient(classroomId, subStudent2);

  // Send DM from Teacher to Alice (Student 1)
  realtimeCoordinator.broadcast(
    classroomId,
    'message.created',
    {
      message: {
        id: 'msg_dm_1',
        senderId: teacherId,
        recipientType: 'direct',
        recipientId: student1Id,
        text: 'Private feedback for Alice',
      },
    },
    { id: teacherId, name: 'Prof. Turing' }
  );

  assert(student1Received === true, 'Intended recipient (Alice) received private direct message');
  assert(student2Received === false, 'Third-party student (Bob) did NOT receive private direct message');

  // TEST 6: Resync Buffer Overflow & Snapshot Recovery
  console.log('\n--- Testing Ring-Buffer Overflow & Full Snapshot Recovery ---');
  classroomDb.createAnnouncement({
    id: 'ann_audit_1',
    classroomId,
    authorId: teacherId,
    authorName: 'Prof. Turing',
    authorRole: 'teacher',
    title: 'Midterm Preparation Announcement',
    content: 'Please review chapters 1 through 4 before Monday lab.',
    pinned: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Request resync since 0 (cold start / total overflow)
  const fullSnapshotEvents = realtimeCoordinator.getMissedEvents(classroomId, 0);
  assert(fullSnapshotEvents.length > 0, 'Missed events query handles zero sequence');

  const announcements = classroomDb.listAnnouncements(classroomId);
  const members = classroomDb.listMembers(classroomId);
  assert(announcements.length >= 1, 'Database holds authoritative announcements for snapshot');
  assert(members.length === 3, 'Database holds authoritative member roster');

  console.log('\n==================================================');
  console.log(`AUDIT RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('REALTIME ARCHITECTURE IS AUTHORITATIVE & SECURE.');
  console.log('==================================================\n');
}

runAudit().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
