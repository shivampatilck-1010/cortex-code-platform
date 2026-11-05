/**
 * Cortex Online Examination System — Cloudflare D1 Backup & Disaster Recovery Manager
 *
 * Implements authoritative remote Cloudflare D1 backup generation, SHA-256
 * cryptographic verification, metadata manifest generation, retention policy pruning,
 * and isolated test database restoration.
 *
 * Strictly zero emojis.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

export interface D1BackupMeta {
  backupFileName: string;
  databaseName: string;
  databaseId?: string;
  environment: string;
  backupType: 'pre_exam' | 'post_exam' | 'automated' | 'manual';
  createdAt: string;
  sha256: string;
  sizeBytes: number;
  tableCount: number;
}

const AUTHORIZED_DATABASES: Record<string, { id: string; env: string }> = {
  'cortex-staging-db': {
    id: 'e6375738-d9b2-4c5a-a3e5-3a34e892f49d',
    env: 'staging',
  },
  // Production requires explicit confirmation
  'cortex-db': {
    id: 'f756374b-0e9b-4112-b502-b703788dd86f',
    env: 'production',
  },
};

export class CortexD1BackupManager {
  private backupDir: string;

  constructor(backupDir?: string) {
    this.backupDir = backupDir || path.resolve('backups', 'd1');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Computes SHA-256 hash of a file.
   */
  public computeSha256(filePath: string): string {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Creates an authoritative remote Cloudflare D1 SQL export.
   */
  public async createD1Backup(options: {
    databaseName: string;
    backupType?: 'pre_exam' | 'post_exam' | 'automated' | 'manual';
    allowProduction?: boolean;
  }): Promise<{ backupPath: string; metaPath: string; meta: D1BackupMeta }> {
    const { databaseName, backupType = 'manual', allowProduction = false } = options;

    if (!AUTHORIZED_DATABASES[databaseName]) {
      throw new Error(`Ambiguous or unauthorized database name: '${databaseName}'. Allowed: ${Object.keys(AUTHORIZED_DATABASES).join(', ')}`);
    }

    const dbConfig = AUTHORIZED_DATABASES[databaseName];
    if (dbConfig.env === 'production' && !allowProduction) {
      throw new Error('PRODUCTION SAFEGUARD: Exporting production database cortex-db requires allowProduction=true.');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `${databaseName}_${timestamp}_${backupType}.sql`;
    const backupPath = path.join(this.backupDir, backupFileName);
    const metaPath = `${backupPath}.meta.json`;

    console.log(`[CortexD1Backup] Starting remote export for ${databaseName} (${dbConfig.id})...`);
    const startTime = Date.now();

    // Execute Wrangler D1 Export
    const envFlag = dbConfig.env === 'staging' ? ' --env staging' : '';
    const exportCmd = `npx wrangler d1 export ${databaseName} --remote --output="${backupPath}" --skip-confirmation${envFlag}`;
    execSync(exportCmd, {
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    const durationMs = Date.now() - startTime;
    console.log(`[CortexD1Backup] Remote export completed in ${durationMs}ms`);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Export failed: artifact file not found at ${backupPath}`);
    }

    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      throw new Error(`Export failed: generated file is empty (0 bytes)`);
    }

    const sha256 = this.computeSha256(backupPath);

    // Count tables defined in the exported SQL
    const sqlText = fs.readFileSync(backupPath, 'utf8');
    const tableMatches = sqlText.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?/gi) || [];

    const meta: D1BackupMeta = {
      backupFileName,
      databaseName,
      databaseId: dbConfig.id,
      environment: dbConfig.env,
      backupType,
      createdAt: new Date().toISOString(),
      sha256,
      sizeBytes: stats.size,
      tableCount: tableMatches.length,
    };

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    // Run retention pruning
    this.pruneBackups(databaseName, 10);

    return { backupPath, metaPath, meta };
  }

  /**
   * Verifies the cryptographic checksum and schema completeness of an export artifact.
   */
  public async verifyBackupArtifact(backupFileName: string): Promise<{ valid: boolean; errors: string[] }> {
    const backupPath = path.join(this.backupDir, backupFileName);
    const metaPath = `${backupPath}.meta.json`;
    const errors: string[] = [];

    if (!fs.existsSync(backupPath)) {
      return { valid: false, errors: [`Backup file does not exist: ${backupPath}`] };
    }
    if (!fs.existsSync(metaPath)) {
      return { valid: false, errors: [`Metadata manifest does not exist: ${metaPath}`] };
    }

    const meta: D1BackupMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const currentSha256 = this.computeSha256(backupPath);

    if (currentSha256 !== meta.sha256) {
      errors.push(`SHA-256 checksum mismatch: expected ${meta.sha256}, calculated ${currentSha256}`);
    }

    const sqlText = fs.readFileSync(backupPath, 'utf8');
    if (!sqlText.includes('CREATE TABLE')) {
      errors.push('Export artifact does not contain DDL table statements');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Restores an exported D1 SQL file into a clean, isolated SQLite test target to verify recoverability.
   * NEVER restores over live databases.
   */
  public async restoreToIsolatedTarget(backupFileName: string, targetDbPath: string): Promise<{
    durationMs: number;
    tableCount: number;
    foreignKeyViolations: number;
    integrityOk: boolean;
  }> {
    const backupPath = path.join(this.backupDir, backupFileName);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found at ${backupPath}`);
    }

    if (fs.existsSync(targetDbPath)) {
      fs.unlinkSync(targetDbPath);
    }

    const startTime = Date.now();
    const db = new DatabaseSync(targetDbPath);

    db.exec('PRAGMA synchronous = OFF;');
    db.exec('PRAGMA journal_mode = MEMORY;');
    db.exec('PRAGMA defer_foreign_keys = TRUE;');

    const sql = fs.readFileSync(backupPath, 'utf8');
    db.exec('BEGIN TRANSACTION;');
    db.exec(sql);
    db.exec('COMMIT;');

    const durationMs = Date.now() - startTime;
    db.exec('PRAGMA synchronous = NORMAL;');

    const integrityResult = db.prepare('PRAGMA integrity_check').all() as any[];
    const integrityOk = integrityResult.length === 1 && integrityResult[0].integrity_check === 'ok';

    const fkCheck = db.prepare('PRAGMA foreign_key_check').all() as any[];
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];

    db.close();

    return {
      durationMs,
      tableCount: tables.length,
      foreignKeyViolations: fkCheck.length,
      integrityOk,
    };
  }

  /**
   * Prunes older backups keeping only the N most recent per database.
   */
  public pruneBackups(databaseName: string, retainCount = 10): number {
    const files = fs.readdirSync(this.backupDir)
      .filter((f) => f.startsWith(`${databaseName}_`) && f.endsWith('.sql'))
      .sort()
      .reverse();

    let pruned = 0;
    if (files.length > retainCount) {
      const toDelete = files.slice(retainCount);
      for (const f of toDelete) {
        const fullPath = path.join(this.backupDir, f);
        const metaPath = `${fullPath}.meta.json`;
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
        pruned++;
      }
    }
    return pruned;
  }
}
