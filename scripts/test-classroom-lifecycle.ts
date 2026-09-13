import { classroomDb } from '../src/lib/classroom/db/index.js';
import { ClassroomAuth } from '../src/lib/classroom/auth/index.js';
import { realtimeCoordinator } from '../src/lib/classroom/realtime/index.js';
import { LiveClassSession } from '../src/lib/classroom/models.js';

// Setup Mock Auth
const teacherId = 'teacher_1';
const studentId = 'student_1';

function log(msg: string) {
  console.log(`[TEST] ${msg}`);
}

async function run() {
  log('Starting Classroom Lifecycle Test');

  // 1 & 2. Teacher creates classroom, gets unique join code
  const classroomId = `C_${Date.now()}`;
  const joinCode = `CLS-TEST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  classroomDb.createClassroom({
    id: classroomId,
    name: 'Lifecycle Test Class',
    subject: 'CS',
    description: 'Test',
    courseCode: 'CS101',
    academicYear: '2026',
    section: 'A',
    teacherId: teacherId,
    teacherName: 'Teacher',
    joinCode: joinCode,
    joinEnabled: true,
    status: 'active',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: {
      allowStudentPosting: true,
      allowStudentMessaging: true,
      allowCodeSharing: true,
      leaderboardEnabled: true,
      defaultAIPolicy: 'hints_only'
    }
  });

  // 3. Teacher membership created
  classroomDb.addMember({
    id: `mem_${classroomId}_${teacherId}`,
    classroomId,
    userId: teacherId,
    userName: 'Teacher',
    userEmail: 'teacher@test.com',
    role: 'teacher',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now()
  });

  log(`Created classroom ${classroomId} with join code ${joinCode}`);

  // 4 & 6. Student joins (role forced to student)
  const studentMember = classroomDb.addMember({
    id: `mem_${classroomId}_${studentId}`,
    classroomId,
    userId: studentId,
    userName: 'Student',
    userEmail: 'student@test.com',
    role: 'student',
    status: 'active',
    joinedAt: Date.now(),
    lastActiveAt: Date.now()
  });
  log(`Student joined. Role: ${studentMember.role}`);

  // Add some fake data
  classroomDb.createAnnouncement({
    id: 'ann_1',
    classroomId,
    authorId: teacherId,
    authorName: 'Teacher',
    authorRole: 'teacher',
    title: 'Test',
    content: 'Test content',
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  // 8. Teacher archives classroom
  classroomDb.archiveClassroom(classroomId);
  let c = classroomDb.getClassroom(classroomId);
  if (c?.status === 'archived' && !c.joinEnabled) {
    log('Archive successful.');
  } else {
    throw new Error('Archive failed.');
  }

  // 10. Restore classroom
  const restoreCode = `RESTORE-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  classroomDb.restoreClassroom(classroomId, restoreCode);
  c = classroomDb.getClassroom(classroomId);
  if (c?.status === 'active' && c.joinEnabled && c.joinCode === restoreCode) {
    log('Restore successful.');
  } else {
    throw new Error('Restore failed.');
  }

  // 17. Start Live Session
  const session: LiveClassSession = {
    id: `sess_${Date.now()}`,
    classroomId,
    teacherId,
    teacherName: 'Teacher',
    title: 'Live',
    topic: 'Live',
    language: 'cpp',
    starterCode: '',
    sharedCode: '',
    isBroadcastingCode: true,
    startedAt: Date.now(),
    durationMinutes: 90,
    status: 'active',
    activeStudentCount: 1
  };
  classroomDb.createLiveSession(session);
  log('Live session started.');

  // 24. Cascade Deletion Verification
  const preAnnouncements = classroomDb.listAnnouncements(classroomId);
  if (preAnnouncements.length !== 1) throw new Error('Data not present before delete');

  log('Triggering permanent deletion...');
  classroomDb.deleteClassroom(classroomId);

  const postC = classroomDb.getClassroom(classroomId);
  const postMembers = classroomDb.listMembers(classroomId);
  const postAnnouncements = classroomDb.listAnnouncements(classroomId);
  const postLiveSession = classroomDb.getActiveLiveSession(classroomId);

  if (!postC && postMembers.length === 0 && postAnnouncements.length === 0 && !postLiveSession) {
    log('Permanent deletion and cascade cleanup successful.');
  } else {
    throw new Error('Cascade deletion failed! Data left behind.');
  }

  log('ALL TESTS PASSED');
}

run().catch(console.error);
