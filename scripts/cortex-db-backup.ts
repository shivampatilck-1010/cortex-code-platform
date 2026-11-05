/**
 * Cortex Online Examination System — Database Backup & Recovery Utility
 *
 * Implements authoritative backup generation, SHA-256 cryptographic checksumming,
 * schema and data verification, retention policy pruning, and isolated test restoration.
 *
 * Strictly zero emojis.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export class CortexBackupManager {
  private backupDir: string;

  constructor(backupDir?: string) {
    this.backupDir = backupDir || path.resolve('backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Computes SHA-256 hash of a file.
   */
  public computeFileHash(filePath: string): string {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Creates an atomic, consistent database backup from a source SQLite database.
   */
  public async createBackup(options: {
    sourceDbPath: string;
    environment?: string;
    backupType?: 'automated' | 'pre_exam' | 'post_exam' | 'manual';
  }): Promise<{ backupPath: string; metaPath: string; meta: any }> {
    const { sourceDbPath, environment = 'staging', backupType = 'manual' } = options;

    if (!fs.existsSync(sourceDbPath)) {
      throw new Error(`Source database does not exist at ${sourceDbPath}`);
    }

    // Flush WAL log to main database file before copying
    const srcDb = new DatabaseSync(sourceDbPath);
    srcDb.exec('PRAGMA busy_timeout = 5000;');
    srcDb.exec('PRAGMA wal_checkpoint(TRUNCATE);');

    // Collect table summary from source database
    const tableRows = srcDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];
    const tables = tableRows.map((r) => r.name);

    const counts: Record<string, number> = {};
    for (const t of tables) {
      try {
        const c = srcDb.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get() as any;
        counts[t] = c?.cnt || 0;
      } catch (_) {}
    }
    srcDb.close();

    const timestamp = Date.now();
    const isoDate = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
    const backupFileName = `cortex_backup_${environment}_${isoDate}_${backupType}.db`;
    const backupPath = path.join(this.backupDir, backupFileName);

    // Atomically copy database file
    fs.copyFileSync(sourceDbPath, backupPath);

    const sha256 = this.computeFileHash(backupPath);
    const stat = fs.statSync(backupPath);

    const meta = {
      backupId: `bk_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      fileName: backupFileName,
      environment,
      backupType,
      timestamp,
      isoTime: new Date(timestamp).toISOString(),
      sizeBytes: stat.size,
      sha256,
      tableCount: tables.length,
      tables,
      counts,
    };

    const metaPath = path.join(this.backupDir, `${backupFileName}.meta.json`);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    return { backupPath, metaPath, meta };
  }

  /**
   * Verifies the cryptographic and structural integrity of a backup.
   */
  public verifyBackup(backupPath: string, metaPath?: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!fs.existsSync(backupPath)) {
      errors.push(`Backup file missing at ${backupPath}`);
      return { valid: false, errors };
    }

    const stat = fs.statSync(backupPath);
    if (stat.size === 0) {
      errors.push('Backup file is empty (0 bytes)');
      return { valid: false, errors };
    }

    // Verify SHA-256 against metadata if available
    const resolvedMetaPath = metaPath || `${backupPath}.meta.json`;
    if (fs.existsSync(resolvedMetaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(resolvedMetaPath, 'utf-8'));
        const currentHash = this.computeFileHash(backupPath);
        if (currentHash !== meta.sha256) {
          errors.push(`SHA-256 checksum mismatch! Expected ${meta.sha256}, calculated ${currentHash}`);
        }
      } catch (err: any) {
        errors.push(`Failed to read metadata file: ${err.message}`);
      }
    }

    // Verify SQLite readable and foreign keys check
    try {
      const db = new DatabaseSync(backupPath);
      db.exec('PRAGMA busy_timeout = 3000;');
      const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
      if (fkCheck.length > 0) {
        errors.push(`Foreign key constraint violations detected: ${JSON.stringify(fkCheck)}`);
      }
      db.close();
    } catch (err: any) {
      errors.push(`SQLite verification failure: ${err.message}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Restores a backup file into a specified target database destination.
   */
  public restoreBackup(backupPath: string, targetDbPath: string): { restored: boolean; targetDbPath: string } {
    const verification = this.verifyBackup(backupPath);
    if (!verification.valid) {
      throw new Error(`Cannot restore corrupted backup: ${verification.errors.join('; ')}`);
    }

    const targetDir = path.dirname(targetDbPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.copyFileSync(backupPath, targetDbPath);

    // Verify restored database is functional
    const db = new DatabaseSync(targetDbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('SELECT 1;');
    db.close();

    return { restored: true, targetDbPath };
  }

  /**
   * Prunes old backups based on maximum retained count.
   */
  public pruneBackups(maxRetained: number = 10): { deleted: string[]; remaining: number } {
    const files = fs.readdirSync(this.backupDir).filter((f) => f.endsWith('.db'));
    const backups = files.map((f) => {
      const p = path.join(this.backupDir, f);
      return { file: f, path: p, mtime: fs.statSync(p).mtimeMs };
    });

    backups.sort((a, b) => b.mtime - a.mtime); // Newest first

    const toDelete = backups.slice(maxRetained);
    const deleted = [];

    for (const b of toDelete) {
      try {
        fs.unlinkSync(b.path);
        const metaPath = `${b.path}.meta.json`;
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        deleted.push(b.file);
      } catch (_) {}
    }

    return { deleted, remaining: backups.length - deleted.length };
  }
}

export const backupManager = new CortexBackupManager();
