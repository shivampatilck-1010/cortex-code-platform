import { classroomDb } from '../src/lib/classroom/db/index.js';
import { ClassroomAuth } from '../src/lib/classroom/auth.js';

async function runAuthCheck() {
  console.log('=== CHECK 3: EMPIRICAL AUTHORIZATION VALIDATION ===\n');
  await (classroomDb as any).getDb();

  // Test 1: Legitimate teacher on own classroom
  const teacherElena = await classroomDb.getUser('usr_prof_elena');
  const studentAlex = await classroomDb.getUser('usr_alex_chen');
  const teacherShivam = await classroomDb.getUser('usr_teacher_stg2');

  console.log('Test 1: Teacher Elena accessing own classroom C1-CS201-ADV:');
  const res1 = await ClassroomAuth.verifyClassroomMembership(teacherElena!, 'C1-CS201-ADV');
  console.log(`  Authorized: ${res1.authorized}, Role: ${res1.role}`);
  if (res1.authorized && res1.role === 'teacher') {
    console.log('  [PASS] Authorized teacher has teacher role');
  } else {
    console.log('  [FAIL] Legitimate teacher was not authorized as teacher');
  }

  // Test 2: Student Alex Chen trying to get teacher privileges on C1-CS201-ADV
  console.log('\nTest 2: Student Alex Chen attempting teacher action on C1-CS201-ADV:');
  const res2 = await ClassroomAuth.verifyClassroomMembership(studentAlex!, 'C1-CS201-ADV');
  console.log(`  Authorized: ${res2.authorized}, Role: ${res2.role}`);
  if (res2.authorized && res2.role === 'student') {
    console.log('  [PASS] Student authorized only as student, NOT teacher');
  } else {
    console.log('  [FAIL] Student was granted elevated role!');
  }

  // Test 3: Unrelated Teacher (Professor Shivam) attempting to access Elena\'s classroom C1-CS201-ADV
  console.log('\nTest 3: Unrelated Teacher (Professor Shivam) accessing Elena\'s classroom C1-CS201-ADV:');
  const res3 = await ClassroomAuth.verifyClassroomMembership(teacherShivam!, 'C1-CS201-ADV');
  console.log(`  Authorized: ${res3.authorized}, Error: ${res3.error}`);
  if (!res3.authorized) {
    console.log('  [PASS] Unrelated teacher is strictly blocked from another teacher\'s classroom');
  } else {
    console.log('  [FAIL] Unrelated teacher was granted access to private classroom!');
  }

  // Test 4: Unrelated Teacher attempting to access synthetic classroom CLS-ASG-INT-TEST
  console.log('\nTest 4: Teacher Shivam accessing synthetic regression classroom CLS-ASG-INT-TEST:');
  const res4 = await ClassroomAuth.verifyClassroomMembership(teacherShivam!, 'CLS-ASG-INT-TEST');
  console.log(`  Authorized: ${res4.authorized}, Error: ${res4.error}`);
  if (!res4.authorized) {
    console.log('  [PASS] Synthetic regression classroom is strictly protected against non-member teachers');
  } else {
    console.log('  [FAIL] Teacher was granted access to synthetic regression classroom!');
  }

  // Test 5: Verify intended demonstration classroom has valid ownership path
  console.log('\nTest 5: Intended demonstration classroom CLS-DEMO-JOURNEY ownership & authorization:');
  const demoRoom = await classroomDb.getClassroom('CLS-DEMO-JOURNEY');
  const demoTeacher = await classroomDb.getUser(demoRoom!.teacherId);
  console.log(`  Classroom: ${demoRoom!.id} (${demoRoom!.name})`);
  console.log(`  Teacher: ${demoTeacher ? `${demoTeacher.name} (${demoTeacher.id})` : 'NULL'}`);
  const res5 = await ClassroomAuth.verifyClassroomMembership(demoTeacher!, 'CLS-DEMO-JOURNEY');
  console.log(`  Authorized: ${res5.authorized}, Role: ${res5.role}`);
  if (res5.authorized && res5.role === 'teacher') {
    console.log('  [PASS] Demonstration classroom has valid, predictable ownership and authorization path');
  } else {
    console.log('  [FAIL] Demonstration classroom teacher not authorized!');
  }

  console.log('\n=== CHECK 3 VALIDATION COMPLETED SUCCESSFULLY ===');
}

runAuthCheck().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
