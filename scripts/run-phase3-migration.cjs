const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(__dirname, '..', 'data', 'cortex_classroom.db');
if (!fs.existsSync(dbPath)) {
  console.error('Database file does not exist at:', dbPath);
  process.exit(1);
}

console.log('Connecting to database:', dbPath);
const db = new DatabaseSync(dbPath);

function getExistingColumns(tableName) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return new Set(cols.map(c => c.name));
  } catch (err) {
    return new Set();
  }
}

function addColumnIfNotExists(tableName, colName, colDef) {
  const existing = getExistingColumns(tableName);
  if (!existing.has(colName)) {
    console.log(`Adding column ${tableName}.${colName} (${colDef})...`);
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef};`);
  } else {
    console.log(`Column ${tableName}.${colName} already exists.`);
  }
}

try {
  // 1. Add columns to exams
  addColumnIfNotExists('exams', 'seb_config_key', 'TEXT');
  addColumnIfNotExists('exams', 'seb_browser_exam_key', 'TEXT');
  addColumnIfNotExists('exams', 'seb_quit_password', 'TEXT');
  addColumnIfNotExists('exams', 'seb_allow_reload', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists('exams', 'seb_show_reload_warning', 'INTEGER NOT NULL DEFAULT 1');

  // 2. Add columns to exam_sections
  addColumnIfNotExists('exam_sections', 'instructions', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists('exam_sections', 'is_mandatory', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfNotExists('exam_sections', 'time_limit_minutes', 'INTEGER NOT NULL DEFAULT 0');

  // 3. Add columns to exam_sessions
  addColumnIfNotExists('exam_sessions', 'question_order_json', 'TEXT');
  addColumnIfNotExists('exam_sessions', 'option_order_json', 'TEXT');
  addColumnIfNotExists('exam_sessions', 'current_section_id', 'TEXT');
  addColumnIfNotExists('exam_sessions', 'traversed_route_json', 'TEXT');
  addColumnIfNotExists('exam_sessions', 'last_heartbeat_at', 'INTEGER');

  // 4. Run migration 0006_examination_phase3.sql for exam_branching_rules
  const migrationSqlPath = path.resolve(__dirname, '..', 'migrations', '0006_examination_phase3.sql');
  const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');
  db.exec(migrationSql);
  console.log('Executed 0006_examination_phase3.sql successfully.');

  // 5. Verification
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
  console.log('Existing tables:', tables);
  if (tables.includes('exam_branching_rules')) {
    console.log('Verification: exam_branching_rules table exists.');
  } else {
    throw new Error('exam_branching_rules table missing!');
  }

  console.log('Phase 3 database migration applied successfully!');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
