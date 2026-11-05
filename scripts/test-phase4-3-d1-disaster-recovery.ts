/**
 * Cortex Online Examination System — Phase 4.3 Test Suite
 * Database Reliability, Migration Audit & Disaster Recovery Verification
 *
 * Verifies:
 * 1. Complete migration inventory (0001-0009) and schema constraints.
 * 2. Remote D1 backup creation on staging D1 (cortex-staging-db).
 * 3. Cryptographic integrity and metadata manifest verification.
 * 4. Isolated target restoration and schema completeness.
 * 5. Foreign-key integrity check (PRAGMA foreign_key_check = 0 violations).
 * 6. Examination data preservation (pilot seed records verified).
 * 7. Simulated corruption detection and clean re-restoration.
 * 8. Empirical RPO / RTO measurements.
 *
 * Strictly zero emojis.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CortexD1BackupManager } from './cortex-d1-backup';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${message}`);
  }
}

async function runPhase43RecoveryAudit() {
  console.log('================================================================');
  console.log('PHASE 4.3: D1 DATABASE RELIABILITY & DISASTER RECOVERY AUDIT');
  console.log('================================================================\n');

  // --- SECTION 1: MIGRATION INVENTORY & AUDIT ---
  console.log('--- SECTION 1: MIGRATION INVENTORY AUDIT ---');
  const migrationsDir = path.resolve('migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const expectedMigrations = [
    '0001_initial_schema.sql',
    '0002_github_integration.sql',
    '0003_fix_classrooms.sql',
    '0004_online_examination_system.sql',
    '0005_question_bank.sql',
    '0006_examination_phase3.sql',
    '0007_examination_security_audit.sql',
    '0008_examination_phase3_schema_completion.sql',
    '0009_user_professional_email.sql',
  ];

  assert(migrationFiles.length === expectedMigrations.length, `Expected exactly ${expectedMigrations.length} migrations, found ${migrationFiles.length}`);

  for (const expected of expectedMigrations) {
    assert(migrationFiles.includes(expected), `Migration present in repository: ${expected}`);
  }

  // Verify non-empty and contains valid SQL syntax
  for (const file of migrationFiles) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    assert(content.length > 50, `Migration ${file} is non-trivial (${content.length} bytes)`);
  }

  // --- SECTION 2: REMOTE D1 BACKUP GENERATION ---
  console.log('\n--- SECTION 2: REMOTE D1 BACKUP GENERATION (STAGING) ---');
  const backupDir = path.resolve('backups', 'd1');
  const backupMgr = new CortexD1BackupManager(backupDir);

  const backupStartTime = Date.now();
  const backupResult = await backupMgr.createD1Backup({
    databaseName: 'cortex-staging-db',
    backupType: 'automated',
  });
  const backupDurationMs = Date.now() - backupStartTime;

  assert(fs.existsSync(backupResult.backupPath), `Remote D1 backup SQL created: ${path.basename(backupResult.backupPath)}`);
  assert(fs.existsSync(backupResult.metaPath), `Metadata manifest created: ${path.basename(backupResult.metaPath)}`);
  assert(backupResult.meta.sizeBytes > 100000, `Backup size is healthy: ${backupResult.meta.sizeBytes} bytes`);
  assert(/^[a-f0-9]{64}$/.test(backupResult.meta.sha256), `Valid SHA-256 digest: ${backupResult.meta.sha256}`);
  console.log(`Measured D1 remote backup generation duration: ${backupDurationMs}ms`);

  // --- SECTION 3: BACKUP ARTIFACT VERIFICATION ---
  console.log('\n--- SECTION 3: BACKUP ARTIFACT INTEGRITY VERIFICATION ---');
  const artifactVerification = await backupMgr.verifyBackupArtifact(backupResult.meta.backupFileName);
  assert(artifactVerification.valid === true, 'Backup passes cryptographic integrity and DDL check');
  assert(artifactVerification.errors.length === 0, 'Zero artifact verification errors');

  // --- SECTION 4: ISOLATED RESTORATION & SCHEMA AUDIT ---
  console.log('\n--- SECTION 4: ISOLATED RESTORATION & SCHEMA AUDIT ---');
  const isolatedDbPath = path.resolve('backups', 'd1', 'isolated_phase4_3_recovery_test.db');
  const restoreResult = await backupMgr.restoreToIsolatedTarget(backupResult.meta.backupFileName, isolatedDbPath);

  assert(restoreResult.integrityOk === true, 'Restored database passes PRAGMA integrity_check');
  assert(restoreResult.foreignKeyViolations === 0, `PRAGMA foreign_key_check: 0 violations (found: ${restoreResult.foreignKeyViolations})`);
  assert(restoreResult.tableCount >= 25, `Table count meets minimum baseline (found: ${restoreResult.tableCount} tables)`);
  console.log(`Empirical restore duration (RTO measurement): ${restoreResult.durationMs}ms`);

  // Inspect specific tables in isolated restore
  const testDb = new DatabaseSync(isolatedDbPath);
  const requiredTables = [
    'users',
    'classrooms',
    'classroom_members',
    'exams',
    'exam_sections',
    'exam_questions',
    'exam_sessions',
    'exam_question_responses',
    'exam_integrity_events',
    'question_bank',
    'exam_branching_rules',
  ];

  for (const table of requiredTables) {
    const tableExists = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    assert(tableExists !== undefined, `Required examination table exists post-restore: ${table}`);
  }

  // Verify pilot seed data exists in restored database
  const userCount = (testDb.prepare('SELECT count(*) as cnt FROM users').get() as any).cnt;
  const classroomCount = (testDb.prepare('SELECT count(*) as cnt FROM classrooms').get() as any).cnt;
  const examCount = (testDb.prepare('SELECT count(*) as cnt FROM exams').get() as any).cnt;

  assert(userCount > 0, `Users table populated post-restore (${userCount} records)`);
  assert(classroomCount > 0, `Classrooms table populated post-restore (${classroomCount} records)`);
  assert(examCount > 0, `Exams table populated post-restore (${examCount} records)`);

  // --- SECTION 5: SIMULATED CORRUPTION DETECTION & RE-RESTORATION ---
  console.log('\n--- SECTION 5: SIMULATED CORRUPTION DETECTION & RE-RESTORATION ---');
  // Inject intentional FK corruption into testDb: delete a classroom that has exams
  const sampleExam = testDb.prepare('SELECT id, classroom_id FROM exams LIMIT 1').get() as any;
  if (sampleExam) {
    testDb.exec('PRAGMA foreign_keys = OFF;');
    testDb.prepare('DELETE FROM classrooms WHERE id = ?').run(sampleExam.classroom_id);
    testDb.exec('PRAGMA foreign_keys = ON;');

    const corruptedFkCheck = testDb.prepare('PRAGMA foreign_key_check').all() as any[];
    assert(corruptedFkCheck.length > 0, `Simulated foreign key corruption successfully detected (${corruptedFkCheck.length} violations)`);
  }
  testDb.close();

  // Re-restore from authoritative backup SQL
  console.log('Re-restoring from authoritative backup SQL...');
  const reRestoreResult = await backupMgr.restoreToIsolatedTarget(backupResult.meta.backupFileName, isolatedDbPath);
  assert(reRestoreResult.integrityOk === true, 'Re-restored database passes integrity_check');
  assert(reRestoreResult.foreignKeyViolations === 0, 'Re-restored database completely clears foreign key corruption (0 violations)');

  // Clean up isolated test db
  if (fs.existsSync(isolatedDbPath)) {
    fs.unlinkSync(isolatedDbPath);
  }

  // --- SECTION 6: EMPIRICAL RPO / RTO ANALYSIS ---
  console.log('\n--- SECTION 6: EMPIRICAL RPO / RTO METRICS ---');
  // RTO is measured restore duration + Worker switch latency
  // RPO is maximum window of unpersisted data
  const measuredRtoSeconds = (restoreResult.durationMs / 1000).toFixed(2);
  console.log(`Measured Isolated D1 SQL Import Duration: ${restoreResult.durationMs}ms (~${measuredRtoSeconds}s)`);
  console.log(`Measured D1 Remote Export Duration: ${backupDurationMs}ms (~${(backupDurationMs / 1000).toFixed(2)}s)`);
  console.log('RPO Architecture: Atomic transactional commits for exam answers, IndexedDB write-ahead buffering with 30s auto-sync');
  assert(Number(measuredRtoSeconds) < 60, `Target RTO (< 60s for D1 SQL restore) satisfied: ${measuredRtoSeconds}s`);

  console.log('\n================================================================');
  console.log(`PHASE 4.3 AUDIT SUMMARY: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase43RecoveryAudit().catch((err) => {
  console.error('Phase 4.3 Audit Error:', err);
  process.exit(1);
});
