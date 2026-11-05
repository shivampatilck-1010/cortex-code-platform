const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(__dirname, '..', 'data', 'cortex_classroom.db');
const sqlPath = path.resolve(__dirname, 'migrate-exam-system.sql');

console.log('Connecting to local SQLite database:', dbPath);
if (!fs.existsSync(dbPath)) {
  console.error('Database file not found at:', dbPath);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log('Applying examination system migration...');
db.exec(sql);

console.log('Verifying created tables...');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'exam%' OR name LIKE '%exam%') ORDER BY name").all();
console.log('Exam tables verified:', tables.map(t => t.name).join(', '));
console.log('Migration completed successfully.');
