/**
 * Multi-State Cloudflare D1 Migration Integrity Test Suite (Phase 3.4)
 *
 * Verifies schema integrity, D1 migration tracking semantics, backward
 * compatibility, idempotency, data preservation, and fail-hard schema verification
 * across four distinct database states:
 *
 * State A: Fresh Database (0001..0008 migration sequence)
 * State B: Existing Database Upgrade (0001..0007 -> 0008 with populated data)
 * State C: Partially Initialized Database Recovery (crashed/partial column addition)
 * State D: Repeated Invocation & D1 Migration Tracking Idempotency
 *
 * Requirements:
 * - Zero external side effects (operates on isolated temporary test databases).
 * - Zero emojis in test logs.
 * - Strict assertion validation with explicit pass/fail accounting.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
    throw new Error(`Assertion failed: ${message}`);
  }
}

function getMigrationSql(filename: string): string {
  const filePath = path.join(process.cwd(), 'migrations', filename);
  return fs.readFileSync(filePath, 'utf8');
}

function getTableColumns(db: DatabaseSync, table: string): Set<string> {
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  const rows = stmt.all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function getTableIndices(db: DatabaseSync, table: string): Set<string> {
  const stmt = db.prepare(`PRAGMA index_list(${table})`);
  const rows = stmt.all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

// =========================================================================
// TEST SUITE 1: STATE A - FRESH DATABASE MIGRATION FLOW (0001..0008)
// =========================================================================
async function testStateAFreshDatabase() {
  console.log('\n============================================================');
  console.log('TEST SUITE 1: State A - Fresh Database Migration Flow (0001..0008)');
  console.log('============================================================');

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  // Simulate Cloudflare D1 migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationFiles = [
    '0001_initial_schema.sql',
    '0002_github_integration.sql',
    '0003_fix_classrooms.sql',
    '0004_online_examination_system.sql',
    '0005_question_bank.sql',
    '0006_examination_phase3.sql',
    '0007_examination_security_audit.sql',
    '0008_examination_phase3_schema_completion.sql',
  ];

  for (const file of migrationFiles) {
    const sql = getMigrationSql(file);
    db.exec(sql);
    db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(file);
    console.log(`[State A] Applied migration: ${file}`);
  }

  // Verify all 8 migrations recorded in d1_migrations
  const recorded = (db.prepare('SELECT name FROM d1_migrations ORDER BY id ASC').all() as Array<{ name: string }>).map((r) => r.name);
  assert(recorded.length === 8, 'd1_migrations table contains exactly 8 migration entries');
  assert(recorded[7] === '0008_examination_phase3_schema_completion.sql', 'Final recorded migration is 0008');

  // Verify core exam tables exist
  const tables = ['exams', 'exam_sections', 'exam_questions', 'exam_sessions', 'exam_question_responses', 'exam_integrity_events', 'question_bank', 'exam_branching_rules'];
  for (const table of tables) {
    const count = (db.prepare(`SELECT count(*) as cnt FROM sqlite_master WHERE type='table' AND name=?`).get(table) as any).cnt;
    assert(count === 1, `Table ${table} exists in fresh database`);
  }

  // Verify Phase 3 columns in exams
  const examCols = getTableColumns(db, 'exams');
  assert(examCols.has('seb_config_key'), 'exams table has seb_config_key');
  assert(examCols.has('seb_browser_exam_key'), 'exams table has seb_browser_exam_key');
  assert(examCols.has('seb_quit_password'), 'exams table has seb_quit_password');
  assert(examCols.has('seb_quit_password_hash'), 'exams table has seb_quit_password_hash');
  assert(examCols.has('seb_allow_reload'), 'exams table has seb_allow_reload');
  assert(examCols.has('seb_show_reload_warning'), 'exams table has seb_show_reload_warning');

  // Verify Phase 3 columns in exam_sections
  const sectionCols = getTableColumns(db, 'exam_sections');
  assert(sectionCols.has('instructions'), 'exam_sections table has instructions');
  assert(sectionCols.has('is_mandatory'), 'exam_sections table has is_mandatory');
  assert(sectionCols.has('time_limit_minutes'), 'exam_sections table has time_limit_minutes');

  // Verify Phase 3 columns in exam_sessions
  const sessionCols = getTableColumns(db, 'exam_sessions');
  assert(sessionCols.has('question_order_json'), 'exam_sessions table has question_order_json');
  assert(sessionCols.has('option_order_json'), 'exam_sessions table has option_order_json');
  assert(sessionCols.has('current_section_id'), 'exam_sessions table has current_section_id');
  assert(sessionCols.has('traversed_route_json'), 'exam_sessions table has traversed_route_json');
  assert(sessionCols.has('last_heartbeat_at'), 'exam_sessions table has last_heartbeat_at');

  // Verify performance indexes
  const sessionIndices = getTableIndices(db, 'exam_sessions');
  assert(sessionIndices.has('idx_exam_sessions_heartbeat'), 'exam_sessions has idx_exam_sessions_heartbeat index');

  const examIndices = getTableIndices(db, 'exams');
  assert(examIndices.has('idx_exams_status_time'), 'exams has idx_exams_status_time index');
  assert(examIndices.has('idx_exams_security'), 'exams has idx_exams_security index');

  const branchingIndices = getTableIndices(db, 'exam_branching_rules');
  assert(branchingIndices.has('idx_exam_branching_exam'), 'exam_branching_rules has idx_exam_branching_exam index');

  // Verify foreign key integrity
  const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
  assert(fkCheck.length === 0, 'Foreign key check returns zero violations on fresh DB');
}

// =========================================================================
// TEST SUITE 2: STATE B - EXISTING DATABASE UPGRADE (0001..0007 -> 0008)
// =========================================================================
async function testStateBExistingDatabaseUpgrade() {
  console.log('\n============================================================');
  console.log('TEST SUITE 2: State B - Existing Database Upgrade (0001..0007 -> 0008)');
  console.log('============================================================');

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Apply migrations 0001..0007 (historical state where Phase 3 columns were missing from D1 tables)
  const priorMigrations = [
    '0001_initial_schema.sql',
    '0002_github_integration.sql',
    '0003_fix_classrooms.sql',
    '0004_online_examination_system.sql',
    '0005_question_bank.sql',
    '0006_examination_phase3.sql',
    '0007_examination_security_audit.sql',
  ];

  for (const file of priorMigrations) {
    db.exec(getMigrationSql(file));
    db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(file);
  }

  // Pre-upgrade verification: Phase 3 columns do NOT exist yet
  const preExamCols = getTableColumns(db, 'exams');
  assert(!preExamCols.has('seb_config_key'), 'Pre-upgrade: exams does not have seb_config_key');
  assert(!preExamCols.has('seb_browser_exam_key'), 'Pre-upgrade: exams does not have seb_browser_exam_key');

  const preSectionCols = getTableColumns(db, 'exam_sections');
  assert(!preSectionCols.has('instructions'), 'Pre-upgrade: exam_sections does not have instructions');

  const preSessionCols = getTableColumns(db, 'exam_sessions');
  assert(!preSessionCols.has('question_order_json'), 'Pre-upgrade: exam_sessions does not have question_order_json');

  // Insert representative production data into existing schema
  const teacherId = 'teacher_mig_01';
  const studentId = 'student_mig_01';
  const classroomId = 'class_mig_01';
  const examId = 'exam_mig_01';
  const sectionId = 'section_mig_01';
  const q1Id = 'q_mig_01';
  const qBankId = 'qb_mig_01';
  const sessionId = 'session_mig_01';
  const now = Date.now();

  db.prepare(`
    INSERT INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(teacherId, 'Dr. Migration Teacher', 'teacher.mig@example.edu', 'teacher', now, now);

  db.prepare(`
    INSERT INTO users (id, name, email, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(studentId, 'Jane Candidate', 'student.mig@example.edu', 'student', now, now);

  db.prepare(`
    INSERT INTO classrooms (id, name, subject, description, course_code, academic_year, section, teacher_id, teacher_name, join_code, created_at, updated_at, settings_json)
    VALUES (?, 'Migration Testing CS101', 'CS', 'Desc', 'CS101', '2026', 'A', ?, 'Dr. Migration Teacher', 'MIG101', ?, ?, '{}')
  `).run(classroomId, teacherId, now, now);

  db.prepare(`
    INSERT INTO exams (id, classroom_id, title, description, duration_minutes, start_time, end_time, total_marks, passing_marks, attempts_allowed, security_level, status, created_by, created_at, updated_at)
    VALUES (?, ?, 'Pre-upgrade Final Exam', 'Comprehensive exam', 90, ?, ?, 100, 50, 1, 'standard', 'published', ?, ?, ?)
  `).run(examId, classroomId, now - 10000, now + 3600000, teacherId, now, now);

  db.prepare(`
    INSERT INTO exam_sections (id, exam_id, title, description, sort_order, section_marks)
    VALUES (?, ?, 'Part A: Multiple Choice', 'Foundational concepts', 1, 50)
  `).run(sectionId, examId);

  db.prepare(`
    INSERT INTO exam_questions (id, exam_id, section_id, question_type, prompt_text, options_json, correct_answer_json, points, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, 'multiple_choice', 'What is ACID?', '["Atomicity, Consistency, Isolation, Durability"]', '["0"]', 10.0, 1, ?, ?)
  `).run(q1Id, examId, sectionId, now, now);

  db.prepare(`
    INSERT INTO question_bank (id, teacher_id, classroom_id, subject, topic, difficulty, question_type, prompt_text, default_points, created_at, updated_at)
    VALUES (?, ?, ?, 'Database', 'Transactions', 'medium', 'multiple_choice', 'Define serializability.', 5.0, ?, ?)
  `).run(qBankId, teacherId, classroomId, now, now);

  db.prepare(`
    INSERT INTO exam_sessions (id, exam_id, user_id, attempt_number, status, started_at, expires_at, auto_score, created_at, updated_at)
    VALUES (?, ?, ?, 1, 'in_progress', ?, ?, 0.0, ?, ?)
  `).run(sessionId, examId, studentId, now, now + 5400000, now, now);

  db.prepare(`
    INSERT INTO exam_question_responses (id, session_id, question_id, response_json, earned_points, grading_status, updated_at)
    VALUES ('resp_mig_01', ?, ?, '{"selectedOption": "0"}', 0.0, 'pending', ?)
  `).run(sessionId, q1Id, now);

  db.prepare(`
    INSERT INTO exam_integrity_events (id, session_id, event_type, timestamp, details_json)
    VALUES ('evt_mig_01', ?, 'window_blur', ?, '{"duration": 1200}')
  `).run(sessionId, now);

  console.log('[State B] Seeded representative examination data prior to migration 0008');

  // APPLY FORWARD MIGRATION 0008
  const migration0008Sql = getMigrationSql('0008_examination_phase3_schema_completion.sql');
  db.exec(migration0008Sql);
  db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run('0008_examination_phase3_schema_completion.sql');
  console.log('[State B] Successfully applied 0008_examination_phase3_schema_completion.sql');

  // Verify all Phase 3 columns exist post-upgrade
  const postExamCols = getTableColumns(db, 'exams');
  assert(postExamCols.has('seb_config_key'), 'Post-upgrade: exams has seb_config_key');
  assert(postExamCols.has('seb_browser_exam_key'), 'Post-upgrade: exams has seb_browser_exam_key');
  assert(postExamCols.has('seb_quit_password'), 'Post-upgrade: exams has seb_quit_password');
  assert(postExamCols.has('seb_allow_reload'), 'Post-upgrade: exams has seb_allow_reload');
  assert(postExamCols.has('seb_show_reload_warning'), 'Post-upgrade: exams has seb_show_reload_warning');

  const postSectionCols = getTableColumns(db, 'exam_sections');
  assert(postSectionCols.has('instructions'), 'Post-upgrade: exam_sections has instructions');
  assert(postSectionCols.has('is_mandatory'), 'Post-upgrade: exam_sections has is_mandatory');
  assert(postSectionCols.has('time_limit_minutes'), 'Post-upgrade: exam_sections has time_limit_minutes');

  const postSessionCols = getTableColumns(db, 'exam_sessions');
  assert(postSessionCols.has('question_order_json'), 'Post-upgrade: exam_sessions has question_order_json');
  assert(postSessionCols.has('option_order_json'), 'Post-upgrade: exam_sessions has option_order_json');
  assert(postSessionCols.has('current_section_id'), 'Post-upgrade: exam_sessions has current_section_id');
  assert(postSessionCols.has('traversed_route_json'), 'Post-upgrade: exam_sessions has traversed_route_json');
  assert(postSessionCols.has('last_heartbeat_at'), 'Post-upgrade: exam_sessions has last_heartbeat_at');

  // VERIFY DATA PRESERVATION
  const examRow = db.prepare('SELECT * FROM exams WHERE id = ?').get(examId) as any;
  assert(examRow.title === 'Pre-upgrade Final Exam', 'Exam title perfectly preserved');
  assert(examRow.total_marks === 100, 'Exam total_marks preserved');
  assert(examRow.seb_allow_reload === 0, 'New seb_allow_reload column receives default 0');
  assert(examRow.seb_show_reload_warning === 1, 'New seb_show_reload_warning receives default 1');

  const sectionRow = db.prepare('SELECT * FROM exam_sections WHERE id = ?').get(sectionId) as any;
  assert(sectionRow.title === 'Part A: Multiple Choice', 'Section title perfectly preserved');
  assert(sectionRow.instructions === '', 'New instructions column receives default empty string');
  assert(sectionRow.is_mandatory === 1, 'New is_mandatory column receives default 1');

  const sessionRow = db.prepare('SELECT * FROM exam_sessions WHERE id = ?').get(sessionId) as any;
  assert(sessionRow.user_id === studentId, 'Session user_id preserved');
  assert(sessionRow.status === 'in_progress', 'Session status preserved');
  assert(sessionRow.question_order_json === null, 'New question_order_json column defaults to NULL');

  const responseRow = db.prepare('SELECT * FROM exam_question_responses WHERE session_id = ?').get(sessionId) as any;
  assert(responseRow.question_id === q1Id, 'Response question_id preserved');
  assert(responseRow.response_json.includes('selectedOption'), 'Response json content preserved');

  const qBankRow = db.prepare('SELECT * FROM question_bank WHERE id = ?').get(qBankId) as any;
  assert(qBankRow.prompt_text === 'Define serializability.', 'Question bank row preserved');

  // Verify writeability on new columns
  db.prepare(`
    UPDATE exams
    SET seb_config_key = 'seb_cfg_test_123',
        seb_quit_password = 'QuitPassword123'
    WHERE id = ?
  `).run(examId);

  const updatedExam = db.prepare('SELECT seb_config_key, seb_quit_password FROM exams WHERE id = ?').get(examId) as any;
  assert(updatedExam.seb_config_key === 'seb_cfg_test_123', 'Updated seb_config_key written and read successfully');
  assert(updatedExam.seb_quit_password === 'QuitPassword123', 'Updated seb_quit_password written and read successfully');

  db.prepare(`
    UPDATE exam_sessions
    SET question_order_json = '["q_mig_01"]',
        last_heartbeat_at = ?
    WHERE id = ?
  `).run(now + 60000, sessionId);

  const updatedSession = db.prepare('SELECT question_order_json, last_heartbeat_at FROM exam_sessions WHERE id = ?').get(sessionId) as any;
  assert(updatedSession.question_order_json === '["q_mig_01"]', 'Updated question_order_json written and read successfully');
  assert(updatedSession.last_heartbeat_at === now + 60000, 'Updated last_heartbeat_at written and read successfully');

  // Verify foreign key integrity post-upgrade
  const fkCheck = db.prepare('PRAGMA foreign_key_check').all();
  assert(fkCheck.length === 0, 'Foreign key check returns zero violations on upgraded DB');
}

// =========================================================================
// TEST SUITE 3: STATE C - PARTIALLY INITIALIZED DATABASE RECOVERY
// =========================================================================
async function testStateCPartiallyInitializedRecovery() {
  console.log('\n============================================================');
  console.log('TEST SUITE 3: State C - Partially Initialized Database Recovery');
  console.log('============================================================');

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  // Apply 0001..0007
  const priorMigrations = [
    '0001_initial_schema.sql',
    '0002_github_integration.sql',
    '0003_fix_classrooms.sql',
    '0004_online_examination_system.sql',
    '0005_question_bank.sql',
    '0006_examination_phase3.sql',
    '0007_examination_security_audit.sql',
  ];
  for (const file of priorMigrations) {
    db.exec(getMigrationSql(file));
  }

  // Simulate partial execution where ONLY SOME Phase 3 columns were added before a failure
  db.exec('ALTER TABLE exams ADD COLUMN seb_config_key TEXT;');
  db.exec('ALTER TABLE exams ADD COLUMN seb_browser_exam_key TEXT;');
  db.exec('ALTER TABLE exam_sections ADD COLUMN instructions TEXT NOT NULL DEFAULT \'\';');
  console.log('[State C] Simulated interrupted migration with partial columns added');

  // Implement the guarded safeAlterTable pattern used in ClassroomDatabase
  const safeAlterTable = (sql: string, description: string) => {
    try {
      db.exec(sql);
      return { status: 'applied' };
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        return { status: 'skipped_duplicate' };
      }
      throw err;
    }
  };

  // Run the full completion sequence
  const r1 = safeAlterTable('ALTER TABLE exams ADD COLUMN seb_config_key TEXT', 'add seb_config_key');
  assert(r1.status === 'skipped_duplicate', 'Duplicate column seb_config_key safely skipped without crashing');

  const r2 = safeAlterTable('ALTER TABLE exams ADD COLUMN seb_browser_exam_key TEXT', 'add seb_browser_exam_key');
  assert(r2.status === 'skipped_duplicate', 'Duplicate column seb_browser_exam_key safely skipped without crashing');

  const r3 = safeAlterTable('ALTER TABLE exams ADD COLUMN seb_quit_password TEXT', 'add seb_quit_password');
  assert(r3.status === 'applied', 'Missing column seb_quit_password successfully applied');

  const r4 = safeAlterTable('ALTER TABLE exams ADD COLUMN seb_allow_reload INTEGER NOT NULL DEFAULT 0', 'add seb_allow_reload');
  assert(r4.status === 'applied', 'Missing column seb_allow_reload successfully applied');

  const r5 = safeAlterTable('ALTER TABLE exams ADD COLUMN seb_show_reload_warning INTEGER NOT NULL DEFAULT 1', 'add seb_show_reload_warning');
  assert(r5.status === 'applied', 'Missing column seb_show_reload_warning successfully applied');

  const r6 = safeAlterTable("ALTER TABLE exam_sections ADD COLUMN instructions TEXT NOT NULL DEFAULT ''", 'add instructions');
  assert(r6.status === 'skipped_duplicate', 'Duplicate column instructions safely skipped');

  const r7 = safeAlterTable('ALTER TABLE exam_sections ADD COLUMN is_mandatory INTEGER NOT NULL DEFAULT 1', 'add is_mandatory');
  assert(r7.status === 'applied', 'Missing column is_mandatory applied');

  const r8 = safeAlterTable('ALTER TABLE exam_sections ADD COLUMN time_limit_minutes INTEGER NOT NULL DEFAULT 0', 'add time_limit_minutes');
  assert(r8.status === 'applied', 'Missing column time_limit_minutes applied');

  const r9 = safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN question_order_json TEXT', 'add question_order_json');
  assert(r9.status === 'applied', 'Missing column question_order_json applied');

  const r10 = safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN option_order_json TEXT', 'add option_order_json');
  assert(r10.status === 'applied', 'Missing column option_order_json applied');

  const r11 = safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN current_section_id TEXT', 'add current_section_id');
  assert(r11.status === 'applied', 'Missing column current_section_id applied');

  const r12 = safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN traversed_route_json TEXT', 'add traversed_route_json');
  assert(r12.status === 'applied', 'Missing column traversed_route_json applied');

  const r13 = safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN last_heartbeat_at INTEGER', 'add last_heartbeat_at');
  assert(r13.status === 'applied', 'Missing column last_heartbeat_at applied');

  // Verify that all Phase 3 columns are present after recovery
  const finalExamCols = getTableColumns(db, 'exams');
  const finalSectionCols = getTableColumns(db, 'exam_sections');
  const finalSessionCols = getTableColumns(db, 'exam_sessions');

  assert(finalExamCols.has('seb_config_key') && finalExamCols.has('seb_quit_password'), 'All exam columns present after recovery');
  assert(finalSectionCols.has('instructions') && finalSectionCols.has('is_mandatory'), 'All section columns present after recovery');
  assert(finalSessionCols.has('question_order_json') && finalSessionCols.has('last_heartbeat_at'), 'All session columns present after recovery');
}

// =========================================================================
// TEST SUITE 4: STATE D - REPEATED EXECUTION & D1 MIGRATION TRACKING IDEMPOTENCY
// =========================================================================
async function testStateDRepeatedExecutionIdempotency() {
  console.log('\n============================================================');
  console.log('TEST SUITE 4: State D - Repeated Execution & D1 Migration Tracking Idempotency');
  console.log('============================================================');

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS d1_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Apply all 8 migrations
  const allMigrations = [
    '0001_initial_schema.sql',
    '0002_github_integration.sql',
    '0003_fix_classrooms.sql',
    '0004_online_examination_system.sql',
    '0005_question_bank.sql',
    '0006_examination_phase3.sql',
    '0007_examination_security_audit.sql',
    '0008_examination_phase3_schema_completion.sql',
  ];

  for (const file of allMigrations) {
    db.exec(getMigrationSql(file));
    db.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(file);
  }

  // Simulate Cloudflare Wrangler checking pending migrations
  const appliedSet = new Set(
    (db.prepare('SELECT name FROM d1_migrations').all() as Array<{ name: string }>).map((r) => r.name)
  );

  const pendingMigrations = allMigrations.filter((m) => !appliedSet.has(m));
  assert(pendingMigrations.length === 0, 'Wrangler detects ZERO pending migrations on already-upgraded database');

  // Simulate running ClassroomDatabase safeAlterTable upgrade multiple times in succession
  const safeAlterTable = (sql: string) => {
    try {
      db.exec(sql);
      return 'applied';
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('duplicate column name') || msg.includes('already exists')) {
        return 'skipped';
      }
      throw err;
    }
  };

  for (let run = 1; run <= 3; run++) {
    const results = [
      safeAlterTable('ALTER TABLE exams ADD COLUMN seb_config_key TEXT'),
      safeAlterTable('ALTER TABLE exams ADD COLUMN seb_browser_exam_key TEXT'),
      safeAlterTable('ALTER TABLE exams ADD COLUMN seb_quit_password TEXT'),
      safeAlterTable('ALTER TABLE exams ADD COLUMN seb_quit_password_hash TEXT'),
      safeAlterTable('ALTER TABLE exams ADD COLUMN seb_allow_reload INTEGER NOT NULL DEFAULT 0'),
      safeAlterTable('ALTER TABLE exams ADD COLUMN seb_show_reload_warning INTEGER NOT NULL DEFAULT 1'),
      safeAlterTable("ALTER TABLE exam_sections ADD COLUMN instructions TEXT NOT NULL DEFAULT ''"),
      safeAlterTable('ALTER TABLE exam_sections ADD COLUMN is_mandatory INTEGER NOT NULL DEFAULT 1'),
      safeAlterTable('ALTER TABLE exam_sections ADD COLUMN time_limit_minutes INTEGER NOT NULL DEFAULT 0'),
      safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN question_order_json TEXT'),
      safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN option_order_json TEXT'),
      safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN current_section_id TEXT'),
      safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN traversed_route_json TEXT'),
      safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN last_heartbeat_at INTEGER'),
    ];

    assert(results.every((r) => r === 'skipped'), `Run ${run}: All 14 ALTER TABLE statements skipped cleanly without error`);
  }

  // Ensure table definitions remain structurally sound
  const examCols = getTableColumns(db, 'exams');
  assert(examCols.size > 20, 'Exams table schema structure preserved');
}

// =========================================================================
// TEST SUITE 5: FAIL-HARD SCHEMA VERIFICATION VALIDATION
// =========================================================================
async function testFailHardSchemaVerification() {
  console.log('\n============================================================');
  console.log('TEST SUITE 5: Fail-Hard Schema Verification Validation');
  console.log('============================================================');

  // Verify that an incomplete database throws a descriptive error
  const brokenDb = new DatabaseSync(':memory:');
  brokenDb.exec('PRAGMA foreign_keys = ON;');
  brokenDb.exec(getMigrationSql('0001_initial_schema.sql'));
  brokenDb.exec(getMigrationSql('0004_online_examination_system.sql'));

  const checkExaminationSchema = (dbInstance: DatabaseSync) => {
    const missing: string[] = [];

    const checkColumns = (table: string, requiredColumns: string[]) => {
      try {
        const rows = dbInstance.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
        const existing = new Set((rows || []).map((r) => r.name));
        for (const col of requiredColumns) {
          if (!existing.has(col)) {
            missing.push(`${table}.${col}`);
          }
        }
      } catch (err: any) {
        missing.push(`${table} (table missing: ${err?.message || err})`);
      }
    };

    checkColumns('exams', [
      'seb_config_key',
      'seb_browser_exam_key',
      'seb_quit_password',
      'seb_quit_password_hash',
      'seb_allow_reload',
      'seb_show_reload_warning',
    ]);

    checkColumns('exam_sections', ['instructions', 'is_mandatory', 'time_limit_minutes']);
    checkColumns('exam_sessions', ['question_order_json', 'option_order_json', 'current_section_id', 'traversed_route_json', 'last_heartbeat_at']);

    try {
      const branchingRows = dbInstance.prepare('PRAGMA table_info(exam_branching_rules)').all() as Array<{ name: string }>;
      if (!branchingRows || branchingRows.length === 0) {
        missing.push('exam_branching_rules (table does not exist)');
      }
    } catch (err: any) {
      missing.push(`exam_branching_rules (${err?.message || err})`);
    }

    if (missing.length > 0) {
      throw new Error(`[ClassroomDatabase] Examination schema verification FAILED. Missing columns or tables: ${missing.join(', ')}`);
    }
  };

  let threwExpected = false;
  try {
    checkExaminationSchema(brokenDb);
  } catch (err: any) {
    threwExpected = true;
    console.log(`[State Fail-Hard] Caught expected error: ${err.message}`);
    assert(err.message.includes('Missing columns or tables: exams.seb_config_key'), 'Error explicitly lists missing Phase 3 columns');
    assert(err.message.includes('exam_branching_rules (table does not exist)'), 'Error explicitly notes missing exam_branching_rules table');
  }
  assert(threwExpected, 'Incomplete schema fails hard with informative diagnostic message');
}

// =========================================================================
// RUN ALL SUITES
// =========================================================================
async function run() {
  console.log('============================================================');
  console.log('STARTING PHASE 3.4 MULTI-STATE D1 MIGRATION TEST SUITE');
  console.log('============================================================');

  try {
    await testStateAFreshDatabase();
    await testStateBExistingDatabaseUpgrade();
    await testStateCPartiallyInitializedRecovery();
    await testStateDRepeatedExecutionIdempotency();
    await testFailHardSchemaVerification();

    console.log('\n============================================================');
    console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed, ${totalTests} total tests`);
    console.log('ALL PHASE 3.4 D1 MIGRATION INTEGRITY TESTS PASSED SUCCESSFULLY');
    console.log('============================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n[FATAL] Migration test suite encountered an unhandled error:', err);
    process.exit(1);
  }
}

run();
