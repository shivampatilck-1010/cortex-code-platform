import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomAuth } from '../src/lib/classroom/auth';

async function main() {
  console.log('=== SECTION 2: CLASSROOM OWNERSHIP & AUTHORIZATION AUDIT ===\n');

  const db = await (classroomDb as any).getDb();
  const allClassrooms = await db.prepare('SELECT * FROM classrooms').all();
  console.log(`Total classrooms in DB: ${allClassrooms.length}`);

  const targetClassroomIds = [
    'CLS-ASG-INT-TEST',
    'CLS-TEST-WB-A',
    'CLS-TEST-WB-B',
    'CLS-LIVE-DEMO-01',
    // also inspect the protected classrooms
    'C1-CS201-ADV',
    'CLS-E2E-ACCEPTANCE',
    'CLS-DEMO-JOURNEY',
    'CLS-STAGE2-SEC'
  ];

  for (const cid of targetClassroomIds) {
    const cls = await classroomDb.getClassroom(cid);
    if (!cls) {
      console.log(`[FAIL] Classroom ${cid} NOT FOUND!`);
      continue;
    }

    console.log(`\n----------------------------------------------------`);
    console.log(`Classroom: "${cls.name}" (ID: ${cls.id})`);
    console.log(`  Teacher ID: ${cls.teacherId}`);
    console.log(`  Teacher Name: ${cls.teacherName}`);

    // Check if teacher ID resolves to a valid user in users table
    const teacherUser = await classroomDb.getUser(cls.teacherId);
    if (teacherUser) {
      console.log(`  Owner Resolution: VALID USER -> ${teacherUser.id} (${teacherUser.name}, ${teacherUser.email}, role: ${teacherUser.role})`);
    } else {
      console.log(`  Owner Resolution: UNLINKED / LEGACY TEST HARNESS ID -> "${cls.teacherId}" (Not in users table)`);
    }

    // Inspect child entities
    const members = await classroomDb.listMembers(cls.id);
    const assignments = await db.prepare('SELECT count(*) as c FROM assignments WHERE classroom_id = ?').get(cls.id);
    const submissions = await db.prepare('SELECT count(*) as c FROM submissions WHERE classroom_id = ?').get(cls.id);
    const whiteboards = await db.prepare('SELECT count(*) as c FROM classroom_whiteboards WHERE classroom_id = ?').get(cls.id);
    const presentations = await db.prepare('SELECT count(*) as c FROM classroom_presentations WHERE classroom_id = ?').get(cls.id);

    console.log(`  Memberships: ${members.length}`);
    if (members.length > 0) {
      console.log(`    ${members.map((m: any) => `${m.userName} (${m.role})`).join(', ')}`);
    }
    console.log(`  Assignments: ${assignments.c} | Submissions: ${submissions.c} | Whiteboards: ${whiteboards.c} | Presentations: ${presentations.c}`);

    // Authorization checks
    // 1. Teacher authorization check
    if (teacherUser) {
      const teacherAuth = await ClassroomAuth.verifyClassroomMembership(teacherUser, cls.id);
      console.log(`  Teacher Authorization (${teacherUser.name}): ${teacherAuth.authorized ? 'AUTHORIZED [PASS]' : 'DENIED [FAIL]'} (role: ${teacherAuth.role})`);
    }

    // 2. Student authorization check (attempting teacher action)
    const studentUser = await classroomDb.getUser('usr_alex_chen');
    if (studentUser) {
      const studentAuth = await ClassroomAuth.verifyClassroomMembership(studentUser, cls.id);
      if (studentAuth.authorized) {
        console.log(`  Student Membership (${studentUser.name}): role = ${studentAuth.role}`);
        const canTeacherAction = studentAuth.role === 'teacher' || studentAuth.role === 'admin';
        console.log(`  Student Teacher-Action Privilege: ${canTeacherAction ? 'ILLEGALLY ALLOWED [FAIL]' : 'STRICTLY PREVENTED [PASS]'}`);
      } else {
        console.log(`  Student Access (${studentUser.name}): Access denied [PASS] (Non-member cannot access)`);
      }
    }
  }

  console.log('\n====================================================');
}

main().catch(console.error);
