// Cortex Lockdown — Alpha 34 Multi-Process Worker Subprocess
// Simulates independent Node.js process instances accessing persistent SQLite storage.
// Strictly zero emojis.

import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';
import * as crypto from 'crypto';

const dbPath = path.resolve(process.cwd(), 'data', 'cortex_classroom.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

const action = process.argv[2];

function escapeField(val) {
  return String(val ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

switch (action) {
  case 'consume_saml_replay': {
    const assertionId = process.argv[3];
    const spEntityId = process.argv[4] || 'https://cortex.university.edu/sp';
    const expiresAt = Number(process.argv[5]) || (Date.now() + 600000);
    const replayKey = `SAML_ASSERTION:${assertionId}`;
    try {
      db.prepare(`
        INSERT INTO lockdown_replay_cache (
          replay_key, replay_type, identifier, context_id, consumed_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(replayKey, 'SAML_ASSERTION', assertionId, spEntityId, Date.now(), expiresAt);
      console.log(JSON.stringify({ valid: true }));
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes('UNIQUE') || msg.includes('PRIMARY KEY') || msg.includes('constraint failed')) {
        console.log(JSON.stringify({ valid: false, errorCode: 'SAML_ASSERTION_REPLAY_DETECTED' }));
      } else {
        console.error(err);
        process.exit(1);
      }
    }
    break;
  }

  case 'consume_lti_nonce': {
    const nonce = process.argv[3];
    const audience = process.argv[4] || 'cortex_academic_client';
    const expiresAt = Number(process.argv[5]) || (Date.now() + 600000);
    const replayKey = `LTI_NONCE:${nonce}`;
    try {
      db.prepare(`
        INSERT INTO lockdown_replay_cache (
          replay_key, replay_type, identifier, context_id, consumed_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(replayKey, 'LTI_NONCE', nonce, audience, Date.now(), expiresAt);
      console.log(JSON.stringify({ valid: true }));
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes('UNIQUE') || msg.includes('PRIMARY KEY') || msg.includes('constraint failed')) {
        console.log(JSON.stringify({ valid: false, errorCode: 'LTI_NONCE_REPLAY_DETECTED' }));
      } else {
        console.error(err);
        process.exit(1);
      }
    }
    break;
  }

  case 'revoke_session': {
    const sessionId = process.argv[3];
    const examId = process.argv[4] || 'UNKNOWN_EXAM';
    const userId = process.argv[5] || 'UNKNOWN_USER';
    const reason = process.argv[6] || 'Session revoked by independent process';
    const now = Date.now();

    db.prepare(`
      INSERT OR REPLACE INTO lockdown_revoked_sessions (
        session_id, exam_id, user_id, revoked_by, reason, revoked_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, examId, userId, 'worker_' + process.pid, reason, now, null);

    db.prepare(`
      INSERT OR REPLACE INTO lockdown_revoked_tokens (
        token_identifier, revocation_type, revoked_at, reason
      ) VALUES (?, ?, ?, ?)
    `).run(sessionId, 'session', now, reason);

    console.log('REVOKED_OK');
    break;
  }

  case 'check_session_revoked': {
    const sessionId = process.argv[3];
    const row = db.prepare('SELECT session_id FROM lockdown_revoked_sessions WHERE session_id = ?').get(sessionId);
    console.log(JSON.stringify({ isRevoked: !!row }));
    break;
  }

  case 'append_audit_entries': {
    const count = Number(process.argv[3]) || 5;
    const workerTag = 'worker_' + process.pid;
    const seqs = [];

    for (let i = 0; i < count; i++) {
      let attempts = 0;
      let inserted = false;
      while (attempts < 8 && !inserted) {
        try {
          db.exec('BEGIN IMMEDIATE;');
          const latestRow = db.prepare('SELECT sequence_num, entry_hash FROM lockdown_audit_log ORDER BY sequence_num DESC LIMIT 1').get();
          const sequenceNum = latestRow ? latestRow.sequence_num + 1 : 1;
          const previousEntryHash = latestRow ? latestRow.entry_hash : 'GENESIS_LOCKDOWN_AUDIT_BLOCK_000000';
          const timestamp = Date.now();
          const id = `laud_${timestamp}_${crypto.randomBytes(4).toString('hex')}`;

          const payloadToHash = [
            sequenceNum,
            timestamp,
            escapeField(workerTag),
            escapeField('student'),
            escapeField('CONCURRENT_APPEND'),
            escapeField('telemetry'),
            escapeField('GRANTED'),
            escapeField('Worker entry ' + i),
            previousEntryHash
          ].join('|');
          const entryHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

          db.prepare(`
            INSERT INTO lockdown_audit_log (
              id, sequence_num, timestamp, actor_id, actor_role, action, resource_type,
              resource_id, target_student_id, target_exam_id, outcome, error_code, reason,
              client_ip, previous_entry_hash, entry_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id, sequenceNum, timestamp, workerTag, 'student', 'CONCURRENT_APPEND', 'telemetry',
            null, null, null, 'GRANTED', null, 'Worker entry ' + i, '127.0.0.1',
            previousEntryHash, entryHash
          );

          db.exec('COMMIT;');
          seqs.push(sequenceNum);
          inserted = true;
        } catch (err) {
          try { db.exec('ROLLBACK;'); } catch (_) {}
          attempts++;
        }
      }
    }
    console.log('SEQS:' + seqs.join(','));
    break;
  }

  default:
    console.error('Unknown action:', action);
    process.exit(1);
}
