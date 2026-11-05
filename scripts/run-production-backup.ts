/**
 * Production D1 Backup Runner
 * Executes backup, verification, and isolated restore test.
 * Strictly zero emojis.
 */
import { CortexD1BackupManager } from './cortex-d1-backup.ts';

async function main() {
  const mgr = new CortexD1BackupManager();

  console.log('[BACKUP] Starting production D1 backup...');
  const result = await mgr.createD1Backup({
    databaseName: 'cortex-db',
    backupType: 'manual',
    allowProduction: true,
  });
  console.log('[BACKUP] Backup created:');
  console.log(JSON.stringify(result.meta, null, 2));
  console.log('[BACKUP] Backup path:', result.backupPath);

  // Verify checksum
  console.log('\n[VERIFY] Verifying backup artifact...');
  const verify = await mgr.verifyBackupArtifact(result.meta.backupFileName);
  console.log('[VERIFY] Valid:', verify.valid);
  if (verify.errors.length > 0) {
    console.log('[VERIFY] Errors:', verify.errors);
  }

  // Isolated restore test
  console.log('\n[RESTORE] Testing isolated restore...');
  const restorePath = 'backups/d1/cortex-db-isolated-restore-test.sqlite';
  const restore = await mgr.restoreToIsolatedTarget(result.meta.backupFileName, restorePath);
  console.log('[RESTORE] Result:');
  console.log(JSON.stringify(restore, null, 2));

  // Final summary
  console.log('\n=== PRODUCTION BACKUP SUMMARY ===');
  console.log(`File: ${result.meta.backupFileName}`);
  console.log(`Size: ${result.meta.sizeBytes} bytes`);
  console.log(`SHA-256: ${result.meta.sha256}`);
  console.log(`Tables: ${result.meta.tableCount}`);
  console.log(`Checksum valid: ${verify.valid}`);
  console.log(`Restore integrity: ${restore.integrityOk}`);
  console.log(`Restore tables: ${restore.tableCount}`);
  console.log(`Restore FK violations: ${restore.foreignKeyViolations}`);
  console.log(`Restore duration: ${restore.durationMs}ms`);
  console.log(`Status: ${verify.valid && restore.integrityOk && restore.foreignKeyViolations === 0 ? 'PASS' : 'FAIL'}`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
