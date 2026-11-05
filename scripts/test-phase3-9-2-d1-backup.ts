/**
 * Cortex Online Examination System — Phase 3.9.2 Test
 * Cloudflare D1 Remote Backup & Isolated Target Recovery Test
 *
 * Strictly zero emojis.
 */

import fs from 'node:fs';
import path from 'node:path';
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

async function run() {
  console.log('================================================================');
  console.log('PHASE 3.9.2: CLOUDFLARE D1 BACKUP & RECOVERY TOOL TEST');
  console.log('================================================================\n');

  const mgr = new CortexD1BackupManager();

  // Test 1: Ambiguous database name rejection
  console.log('--- TEST 1: AMBIGUOUS DATABASE REJECTION ---');
  try {
    await mgr.createD1Backup({ databaseName: 'non_existent_random_db' });
    assert(false, 'Should have rejected ambiguous database name');
  } catch (err: any) {
    assert(err.message.includes('Ambiguous or unauthorized database name'), 'Ambiguous database name safely rejected');
  }

  // Test 2: Production safety gate
  console.log('\n--- TEST 2: PRODUCTION EXPORT SAFEGUARD ---');
  try {
    await mgr.createD1Backup({ databaseName: 'cortex-db', allowProduction: false });
    assert(false, 'Should have blocked production export without explicit flag');
  } catch (err: any) {
    assert(err.message.includes('PRODUCTION SAFEGUARD'), 'Production database export requires explicit allowProduction flag');
  }

  // Test 3: Create real staging D1 backup
  console.log('\n--- TEST 3: REAL STAGING D1 EXPORT ---');
  const backupRes = await mgr.createD1Backup({
    databaseName: 'cortex-staging-db',
    backupType: 'pre_exam',
  });

  assert(fs.existsSync(backupRes.backupPath), `Backup SQL file exists: ${path.basename(backupRes.backupPath)}`);
  assert(fs.existsSync(backupRes.metaPath), 'Metadata manifest exists (.meta.json)');
  assert(backupRes.meta.sizeBytes > 100000, `Backup size is non-trivial (${backupRes.meta.sizeBytes} bytes)`);
  assert(/^[a-f0-9]{64}$/.test(backupRes.meta.sha256), `Valid SHA-256 digest: ${backupRes.meta.sha256}`);
  assert(backupRes.meta.tableCount >= 9, `Table definitions captured: ${backupRes.meta.tableCount}`);

  // Test 4: Verify artifact checksum and completeness
  console.log('\n--- TEST 4: ARTIFACT VERIFICATION ---');
  const verifyRes = await mgr.verifyBackupArtifact(backupRes.meta.backupFileName);
  assert(verifyRes.valid === true, 'Artifact passes cryptographic checksum and DDL verification');
  assert(verifyRes.errors.length === 0, 'Zero verification errors');

  // Test 5: Isolated Target Restoration & Integrity Checks
  console.log('\n--- TEST 5: ISOLATED RESTORATION & INTEGRITY ---');
  const isolatedTargetPath = path.resolve('backups', 'd1', 'isolated_verification_test.db');
  const restoreRes = await mgr.restoreToIsolatedTarget(backupRes.meta.backupFileName, isolatedTargetPath);

  assert(restoreRes.integrityOk === true, 'Restored database passes PRAGMA integrity_check (ok)');
  assert(restoreRes.foreignKeyViolations === 0, `PRAGMA foreign_key_check passes with 0 violations (found: ${restoreRes.foreignKeyViolations})`);
  assert(restoreRes.tableCount >= 30, `Restored table count meets or exceeds 30 tables (restored: ${restoreRes.tableCount})`);
  console.log(`Measured isolated restoration duration: ${restoreRes.durationMs}ms`);

  // Clean up test file
  if (fs.existsSync(isolatedTargetPath)) {
    fs.unlinkSync(isolatedTargetPath);
  }

  // Test 6: Retention Pruning
  console.log('\n--- TEST 6: RETENTION PRUNING ---');
  const pruned = mgr.pruneBackups('cortex-staging-db', 5);
  assert(typeof pruned === 'number', `Pruning executed cleanly (pruned: ${pruned} archives)`);

  console.log('\n================================================================');
  console.log(`D1 BACKUP TOOL RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
