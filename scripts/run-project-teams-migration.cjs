const fs = require('fs');
const Database = require('better-sqlite3');

const sql = fs.readFileSync('scripts/migrate-project-teams.sql', 'utf8');
const db = new Database('data/cortex_classroom.db');

try {
  db.exec(sql);
  console.log('Successfully applied project teams migration to local SQLite.');
  const integrity = db.pragma('integrity_check');
  console.log('Integrity check:', integrity);
} catch (e) {
  console.error('Migration failed:', e);
} finally {
  db.close();
}
