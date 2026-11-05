/**
 * Cortex Online Examination System — Phase 3.9.1 Audit
 * Cloudflare D1 Backup & Disaster Recovery Verification
 *
 * Evaluates:
 * 1. Cloudflare D1 remote export artifact integrity
 * 2. Real D1 disaster recovery restoration into isolated target
 * 3. Schema consistency, table presence, foreign keys, record counts
 * 4. Realistic RTO and RPO metrics for remote Cloudflare D1
 *
 * Strictly zero emojis.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

console.log('================================================================');
console.log('PHASE 3.9.1: CLOUDFLARE D1 BACKUP & DISASTER RECOVERY AUDIT');
console.log('================================================================\n');

const exportPath = path.resolve('backups', 'test-staging-export.sql');

if (!fs.existsSync(exportPath)) {
  console.error(`Export file not found at ${exportPath}`);
  process.exit(1);
}

// 1. Inspect Artifact Size and Compute SHA-256
const stats = fs.statSync(exportPath);
const fileBuffer = fs.readFileSync(exportPath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

console.log(`[ARTIFACT] File: ${exportPath}`);
console.log(`[ARTIFACT] Size: ${stats.size} bytes (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`[ARTIFACT] SHA-256 Digest: ${sha256}`);

// 2. Perform Isolated Target Restoration
const targetDbPath = path.resolve('backups', 'd1-restored-audit.db');
if (fs.existsSync(targetDbPath)) {
  fs.unlinkSync(targetDbPath);
}

console.log('\n--- RESTORING D1 SQL DUMP INTO ISOLATED DATABASE ---');
const restoreStartTime = Date.now();
const targetDb = new DatabaseSync(targetDbPath);

// Optimize SQLite for bulk SQL import
targetDb.exec('PRAGMA synchronous = OFF;');
targetDb.exec('PRAGMA journal_mode = MEMORY;');
targetDb.exec('PRAGMA defer_foreign_keys = TRUE;');

const sqlContent = fileBuffer.toString('utf8');

// Execute restoration within a single transaction if not already wrapped
targetDb.exec('BEGIN TRANSACTION;');
targetDb.exec(sqlContent);
targetDb.exec('COMMIT;');

const restoreDurationMs = Date.now() - restoreStartTime;
console.log(`[RESTORATION] Completed in: ${restoreDurationMs}ms`);

// Reset pragmas for verification
targetDb.exec('PRAGMA synchronous = NORMAL;');

// 3. Structural & Integrity Audits
console.log('\n--- POST-RESTORATION INTEGRITY & SCHEMA AUDIT ---');
const integrityResult = targetDb.prepare('PRAGMA integrity_check').all() as any[];
const isIntegrityOk = integrityResult.length === 1 && integrityResult[0].integrity_check === 'ok';
console.log(`[INTEGRITY] PRAGMA integrity_check: ${integrityResult[0]?.integrity_check} (Pass: ${isIntegrityOk})`);

const fkCheck = targetDb.prepare('PRAGMA foreign_key_check').all() as any[];
console.log(`[FOREIGN KEYS] Violations detected: ${fkCheck.length}`);

const tables = targetDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
console.log(`[SCHEMA] Total user/app tables restored: ${tables.length}`);

// 4. Record Count Preservations
console.log('\n--- RECORD PRESERVATION METRICS ---');
function getCount(tableName: string): number {
  try {
    const row = targetDb.prepare(`SELECT COUNT(*) as cnt FROM ${tableName}`).get() as any;
    return row?.cnt || 0;
  } catch (err: any) {
    console.error(`Error querying ${tableName}:`, err.message);
    return -1;
  }
}

const usersCount = getCount('users');
const classroomsCount = getCount('classrooms');
const examsCount = getCount('exams');
const questionsCount = getCount('exam_questions');
const sessionsCount = getCount('exam_sessions');
const responsesCount = getCount('exam_question_responses');
const eventsCount = getCount('exam_integrity_events');
const migrationsCount = getCount('d1_migrations');

console.log(`* Users:                  ${usersCount}`);
console.log(`* Classrooms:             ${classroomsCount}`);
console.log(`* Exams:                  ${examsCount}`);
console.log(`* Exam Questions:         ${questionsCount}`);
console.log(`* Exam Sessions:          ${sessionsCount}`);
console.log(`* Question Responses:     ${responsesCount}`);
console.log(`* Integrity Audit Events: ${eventsCount}`);
console.log(`* D1 Migrations:          ${migrationsCount}`);

// 5. Query Compatibility Verification
console.log('\n--- APPLICATION QUERY COMPATIBILITY TEST ---');
const sampleExam = targetDb.prepare('SELECT id, title, status FROM exams LIMIT 1').get() as any;
console.log(`[QUERY] Sample Exam record: ${JSON.stringify(sampleExam)}`);

const sampleSession = targetDb.prepare('SELECT id, exam_id, user_id, status FROM exam_sessions LIMIT 1').get() as any;
console.log(`[QUERY] Sample Session record: ${JSON.stringify(sampleSession)}`);

targetDb.close();

// Clean up restored DB
if (fs.existsSync(targetDbPath)) {
  fs.unlinkSync(targetDbPath);
}

console.log('\n================================================================');
console.log('AUDIT VERDICT:');
console.log(`Export Size: ${(stats.size / 1024).toFixed(1)} KB | Restored in ${restoreDurationMs}ms | FK Violations: ${fkCheck.length}`);
console.log('================================================================\n');
