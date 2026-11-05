const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(__dirname, '../data/cortex_classroom.db');
const bakPath = path.resolve(__dirname, '../data/cortex_classroom.db.bak_phase3_1');

console.log('=== PHASE 3.1 DATABASE SECURITY MIGRATION ===');
console.log('Database Path:', dbPath);
console.log('Verified Backup Path:', bakPath);

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found:', dbPath);
  process.exit(1);
}

if (!fs.existsSync(bakPath)) {
  console.error('Verified backup does not exist. Aborting to protect data integrity.');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

try {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('BEGIN TRANSACTION;');

  // 1. Check existing columns
  const examCols = db.prepare('PRAGMA table_info(exams)').all().map((c) => c.name);

  if (!examCols.includes('seb_quit_password_hash')) {
    console.log('Adding seb_quit_password_hash column to exams table...');
    db.exec('ALTER TABLE exams ADD COLUMN seb_quit_password_hash TEXT;');
  }

  // 2. Add indices
  db.exec('CREATE INDEX IF NOT EXISTS idx_exams_security ON exams(security_level, status);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_exam_responses_session_updated ON exam_question_responses(session_id, updated_at);');

  // 3. Migrate plaintext passwords to SHA-256 hashes
  const examsWithPassword = db.prepare('SELECT id, seb_quit_password FROM exams WHERE seb_quit_password IS NOT NULL').all();
  console.log(`Auditing ${examsWithPassword.length} examinations with plaintext passwords...`);

  let migratedCount = 0;
  for (const ex of examsWithPassword) {
    if (ex.seb_quit_password && ex.seb_quit_password.trim().length > 0) {
      // If already a 64-char hex string, it might be a precomputed hash; otherwise compute SHA-256
      const isHex64 = /^[a-f0-9]{64}$/i.test(ex.seb_quit_password.trim());
      const hash = isHex64
        ? ex.seb_quit_password.trim().toLowerCase()
        : crypto.createHash('sha256').update(ex.seb_quit_password).digest('hex');

      db.prepare(`
        UPDATE exams
        SET seb_quit_password_hash = ?,
            seb_quit_password = NULL
        WHERE id = ?
      `).run(hash, ex.id);

      migratedCount++;
    }
  }

  db.exec('COMMIT;');
  console.log(`Successfully migrated ${migratedCount} passwords to SHA-256 hashes and cleared plaintext storage.`);

  // Verification checks
  const remainingPlaintext = db.prepare('SELECT count(*) as count FROM exams WHERE seb_quit_password IS NOT NULL').get();
  const totalHashed = db.prepare('SELECT count(*) as count FROM exams WHERE seb_quit_password_hash IS NOT NULL').get();
  const totalExams = db.prepare('SELECT count(*) as count FROM exams').get();

  console.log('Migration Verification:');
  console.log('- Total Examinations:', totalExams.count);
  console.log('- Hashed Quit Passwords:', totalHashed.count);
  console.log('- Remaining Plaintext Passwords:', remainingPlaintext.count);

  if (remainingPlaintext.count > 0) {
    throw new Error('Plaintext passwords still remain in the database!');
  }

  console.log('=== PHASE 3.1 MIGRATION COMPLETE AND VERIFIED ===');
} catch (err) {
  try {
    db.exec('ROLLBACK;');
  } catch (_) {}
  console.error('Migration failed:', err);
  process.exit(1);
} finally {
  db.close();
}
