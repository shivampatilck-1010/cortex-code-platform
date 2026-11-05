import { ClassroomIdentity, CORTEX_VIRTUAL_DOMAIN } from '../src/lib/classroom/identity';
import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomAuth } from '../src/lib/classroom/auth';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName}`, details ? details : '');
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('CORTEX PROFESSIONAL IDENTITY SYSTEM - TEST SUITE (PHASE J)');
  console.log('====================================================\n');

  // Test 1: Handle Normalization
  console.log('--- Suite 1: Handle Normalization ---');
  assert(ClassroomIdentity.normalizeHandle('John.Doe@example.com') === 'john.doe', 'Strips email domain and lowercases');
  assert(ClassroomIdentity.normalizeHandle('  Alice__Smith!!  ') === 'alice.smith', 'Replaces invalid characters and collapses dots');
  assert(ClassroomIdentity.normalizeHandle('...bob.marley...') === 'bob.marley', 'Trims leading and trailing dots');
  assert(ClassroomIdentity.normalizeHandle('') === 'user', 'Handles empty string with default fallback');
  assert(ClassroomIdentity.normalizeHandle('a'.repeat(50)).length <= 30, 'Enforces maximum handle length of 30');

  // Test 2: Virtual Domain Checking
  console.log('\n--- Suite 2: Virtual Namespace Validation ---');
  assert(ClassroomIdentity.isVirtualCortexIdentity('shivampatilcka@cortex.com'), 'Recognizes @cortex.com as virtual identity');
  assert(!ClassroomIdentity.isVirtualCortexIdentity('shivampatilcka@gmail.com'), 'Identifies personal email as non-virtual');
  assert(!ClassroomIdentity.isVirtualCortexIdentity('user@cortex.edu'), 'Differentiates .edu institutional domain from .com virtual platform');

  // Test 3: Explicit Owner Mapping Guarantee
  console.log('\n--- Suite 3: Owner Mapping Guarantee ---');
  const ownerUser = {
    id: 'usr_mtzi89o7f737v',
    email: 'shivampatilcka@gmail.com',
    name: 'Shivam Patil',
    cortex_id: 'SHIVAM_1010',
  };
  const ownerGenerated = ClassroomIdentity.generateProfessionalIdentity(ownerUser);
  assert(ownerGenerated === 'shivampatilcka@cortex.com', 'Owner maps strictly to shivampatilcka@cortex.com');

  // Test 4: Collision Handling with Deterministic Suffix
  console.log('\n--- Suite 4: Collision Resolution ---');
  const claimedIdentities = new Map<string, string>();
  const user1 = { id: 'usr_abc0001', email: 'john.smith@gmail.com', name: 'John Smith' };
  const user2 = { id: 'usr_def0002', email: 'john.smith@yahoo.com', name: 'John Smith' };
  const user3 = { id: 'usr_ghi0003', email: 'john.smith@cortex.edu', name: 'John Smith' };

  const id1 = ClassroomIdentity.generateProfessionalIdentity(user1, claimedIdentities);
  const id2 = ClassroomIdentity.generateProfessionalIdentity(user2, claimedIdentities);
  const id3 = ClassroomIdentity.generateProfessionalIdentity(user3, claimedIdentities);

  assert(id1 === 'john.smith@cortex.com', 'First claimant receives base handle');
  assert(id2 === 'john.smith.0002@cortex.com', 'Second claimant receives deterministic ID suffix');
  assert(id3 === 'john.smith.0003@cortex.com', 'Third claimant receives deterministic ID suffix');
  assert(id1 !== id2 && id2 !== id3 && id1 !== id3, 'All three identities are strictly unique');

  // Test 5: Email Masking for Safe Logging
  console.log('\n--- Suite 5: Email Masking ---');
  assert(ClassroomIdentity.maskEmail('shivampatilcka@gmail.com') === 'sh**********ka@gmail.com', 'Masks middle characters of email local-part');
  assert(ClassroomIdentity.maskEmail('ab@domain.com') === 'a*@domain.com', 'Handles short email local-part safely');

  // Test 6: Database State & Owner Persistence
  console.log('\n--- Suite 6: Database State & Resolution ---');
  const dbOwner = await classroomDb.getUserByEmail('shivampatilcka@gmail.com');
  assert(dbOwner !== null, 'Owner user found by authentication email');
  assert(dbOwner?.id === 'usr_mtzi89o7f737v', 'Owner has expected stable user ID');
  assert(dbOwner?.role === 'student', 'Owner role remains student (no unwarranted elevation)');
  assert(dbOwner?.professional_email === 'shivampatilcka@cortex.com', 'Owner professional_email is persisted as shivampatilcka@cortex.com');

  const resolvedByProfEmail = await classroomDb.getUserByProfessionalEmail('shivampatilcka@cortex.com');
  assert(resolvedByProfEmail !== null, 'User resolved by virtual identity shivampatilcka@cortex.com');
  assert(resolvedByProfEmail?.id === 'usr_mtzi89o7f737v', 'Virtual identity resolves to correct user record');

  // Test 7: Public Profile Protection
  console.log('\n--- Suite 7: Public Profile Privacy Protection ---');
  const publicProfile = ClassroomIdentity.getPublicProfile(dbOwner);
  assert(publicProfile.professionalEmail === 'shivampatilcka@cortex.com', 'Public profile includes professional identity');
  assert(!('email' in publicProfile), 'Public profile does NOT leak raw authentication email');

  // Test 8: Live Session Token Privacy
  console.log('\n--- Suite 8: Live Session Token Privacy ---');
  const token = ClassroomAuth.createLiveSessionToken({
    userId: dbOwner.id,
    userName: dbOwner.name,
    userEmail: dbOwner.professional_email,
    classroomId: 'TEST_ROOM_101',
    role: dbOwner.role,
    durationMs: 3600000,
  });

  const verifiedToken = ClassroomAuth.verifyLiveSessionToken(token, { expectedClassroomId: 'TEST_ROOM_101' });
  assert(verifiedToken !== null, 'Live session token verifies cleanly');
  assert(verifiedToken?.userEmail === 'shivampatilcka@cortex.com', 'Token payload contains professional identity instead of personal email');
  assert(!token.includes('gmail.com'), 'Raw personal email is completely absent from signed token string');

  // Test 9: Migration Idempotency
  console.log('\n--- Suite 9: Migration Idempotency ---');
  const idempotencyRun = await classroomDb.migrateProfessionalIdentities();
  assert(idempotencyRun.migratedCount === 0, 'Subsequent migration run migrates 0 records (idempotent)');
  assert(idempotencyRun.alreadyMigratedCount === idempotencyRun.totalInventoried, 'All inventoried records are marked already_migrated');
  assert(idempotencyRun.failures.length === 0, 'Zero failures encountered during migration');

  // Test 10: Classroom Member Privacy Mapping
  console.log('\n--- Suite 10: Classroom Member Privacy Mapping ---');
  const members = await classroomDb.listMembers('C1-CS201-ADV');
  assert(members.length > 0, 'Classroom members found for privacy verification');
  if (members.length > 0) {
    const sample = members[0];
    assert(sample.userEmail.includes('@cortex.com'), 'Member email mapped to virtual @cortex.com domain');
    console.log(`  Sample member mapped: ${sample.userName} -> ${sample.userEmail}`);
  }

  // Summary
  console.log('\n====================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('[TestSuite] FATAL:', err);
  process.exit(1);
});
