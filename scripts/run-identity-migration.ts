import { classroomDb } from '../src/lib/classroom/db';
import { ClassroomIdentity } from '../src/lib/classroom/identity';

async function main() {
  console.log('[Migration] Starting Cortex Professional Identity Migration...');
  
  const result = await classroomDb.migrateProfessionalIdentities();
  
  console.log('[Migration] Result Summary:');
  console.log(`  Total Inventoried: ${result.totalInventoried}`);
  console.log(`  Migrated: ${result.migratedCount}`);
  console.log(`  Already Migrated: ${result.alreadyMigratedCount}`);
  console.log(`  Failures: ${result.failures.length}`);

  if (result.failures.length > 0) {
    console.error('[Migration] Failures:', result.failures);
  }

  // Verify the target owner account
  const owner = await classroomDb.getUserByEmail('shivampatilcka@gmail.com');
  console.log('\n[Verification] Owner Account:');
  if (owner) {
    console.log(`  User ID: ${owner.id}`);
    console.log(`  Name: ${owner.name}`);
    console.log(`  Auth Email: ${owner.email}`);
    console.log(`  Professional Email: ${owner.professional_email || owner.professionalEmail}`);
    console.log(`  Role: ${owner.role}`);
    console.log(`  Status: ${owner.status}`);
    console.log(`  Cortex ID: ${owner.cortex_id}`);
  } else {
    console.error('  ERROR: Owner account not found!');
  }

  // Verify institutional accounts
  const institutionalEmails = [
    'elena.rostova@cortex.edu',
    'sarah@cortex.edu',
    'alex.chen@student.cortex.edu',
    'maya.patel@student.cortex.edu',
    'jordan.lee@student.cortex.edu',
  ];

  console.log('\n[Verification] Sample Institutional Accounts:');
  for (const email of institutionalEmails) {
    const user = await classroomDb.getUserByEmail(email);
    if (user) {
      console.log(`  ${user.name} (${user.role}): ${user.email} -> ${user.professional_email}`);
    }
  }

  // Verify virtual identity lookup
  console.log('\n[Verification] Lookup by Virtual Identity shivampatilcka@cortex.com:');
  const lookedUp = await classroomDb.getUserByProfessionalEmail('shivampatilcka@cortex.com');
  if (lookedUp) {
    console.log(`  Successfully resolved: ${lookedUp.id} (${lookedUp.name})`);
  } else {
    console.error('  ERROR: Failed to resolve user by professional email');
  }

  console.log('\n[Migration] Execution completed successfully.');
}

main().catch((err) => {
  console.error('[Migration] FATAL:', err);
  process.exit(1);
});
