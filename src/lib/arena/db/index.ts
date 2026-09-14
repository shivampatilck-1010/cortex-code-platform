import { DBInstance, getDbInstance } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

export interface ArenaWorkspace {
  id: string; // usually `arena_${userId}_${challengeId}`
  userId: string;
  challengeId: string;
  projectId: string; // The underlying project in projectDb
  createdAt: number;
  updatedAt: number;
}

export interface ArenaSubmission {
  id: string;
  userId: string;
  challengeId: string;
  language: string;
  status: 'PASSED' | 'FAILED' | 'COMPILE_ERROR' | 'RUNTIME_ERROR' | 'TIMEOUT' | 'MEMORY_LIMIT' | 'OUTPUT_LIMIT' | 'SYSTEM_ERROR';
  score: number;
  sourceCode: string; // JSON string of files
  testSummary: string; // JSON string of aggregated test results
  executionTimeMs: number;
  memoryUsageMb: number;
  createdAt: number;
}

export interface BenchmarkWorkspace {
  id: string; // usually `benchmark_${userId}_${benchmarkId}`
  userId: string;
  benchmarkId: string;
  workspaceAProjectId: string;
  workspaceBProjectId: string;
  createdAt: number;
  updatedAt: number;
}

export interface BenchmarkRun {
  id: string;
  userId: string;
  benchmarkId: string;
  langA: string;
  langB: string;
  timeMsA: number;
  timeMsB: number;
  memoryMbA: number;
  memoryMbB: number;
  statusA: string;
  statusB: string;
  createdAt: number;
}


class SqliteWrapper implements DBInstance {
  constructor(private sqlite: any) {}
  async exec(sql: string): Promise<void> {
    this.sqlite.exec(sql);
  }
  prepare(sql: string) {
    return {
      run: async (...params: any[]) => {
        return this.sqlite.prepare(sql).run(...params);
      },
      get: async (...params: any[]) => {
        return this.sqlite.prepare(sql).get(...params);
      },
      all: async (...params: any[]) => {
        return this.sqlite.prepare(sql).all(...params);
      },
    };
  }
}

export class ArenaDatabase {
  private db: DBInstance | null = null;
  private initializing = false;
  private initPromise: Promise<void> | null = null;

    async getDb(): Promise<DBInstance | null> {
    if (this.db) return this.db;
    this.db = (await getDbInstance('.cortex/data/arena.db')) as any;
    if (this.db) {
      await this.init();
    }
    return this.db;
  }



  async init(): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS arena_workspaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          challenge_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS arena_submissions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          challenge_id TEXT NOT NULL,
          language TEXT NOT NULL,
          status TEXT NOT NULL,
          score INTEGER NOT NULL,
          source_code TEXT NOT NULL,
          test_summary TEXT NOT NULL,
          execution_time_ms INTEGER NOT NULL,
          memory_usage_mb INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS benchmark_workspaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          benchmark_id TEXT NOT NULL,
          workspace_a_project_id TEXT NOT NULL,
          workspace_b_project_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS benchmark_runs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          benchmark_id TEXT NOT NULL,
          lang_a TEXT NOT NULL,
          lang_b TEXT NOT NULL,
          time_ms_a INTEGER NOT NULL,
          time_ms_b INTEGER NOT NULL,
          memory_mb_a INTEGER NOT NULL,
          memory_mb_b INTEGER NOT NULL,
          status_a TEXT NOT NULL,
          status_b TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
    } catch (e) {
      console.error('[Arena DB] Init schema failed:', e);
    }
  }

  // --- Arena Workspace ---
  async getArenaWorkspace(userId: string, challengeId: string): Promise<ArenaWorkspace | null> {
    const db = await this.getDb();
    if (!db) return null;
    const row = await db.prepare('SELECT * FROM arena_workspaces WHERE user_id = ? AND challenge_id = ?').get(userId, challengeId) as any;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      challengeId: row.challenge_id,
      projectId: row.project_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createArenaWorkspace(w: ArenaWorkspace): Promise<ArenaWorkspace> {
    const db = await this.getDb();
    if (!db) return w;
    await db.prepare('INSERT OR REPLACE INTO arena_workspaces (id, user_id, challenge_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(w.id, w.userId, w.challengeId, w.projectId, w.createdAt, w.updatedAt);
    return w;
  }

  // --- Submissions ---
  async createSubmission(s: ArenaSubmission): Promise<ArenaSubmission> {
    const db = await this.getDb();
    if (!db) return s;
    await db.prepare('INSERT INTO arena_submissions (id, user_id, challenge_id, language, status, score, source_code, test_summary, execution_time_ms, memory_usage_mb, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(s.id, s.userId, s.challengeId, s.language, s.status, s.score, s.sourceCode, s.testSummary, s.executionTimeMs, s.memoryUsageMb, s.createdAt);
    return s;
  }

  
  async listSubmissionsForUser(userId: string): Promise<ArenaSubmission[]> {
    const db = await this.getDb();
    if (!db) return [];
    const rows = await db.prepare('SELECT * FROM arena_submissions WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
    return rows.map(r => ({
      id: r.id,
      challengeId: r.challenge_id,
      userId: r.user_id,
      language: r.language,
      code: r.code,
      status: r.status,
      score: r.score,
      executionTimeMs: r.execution_time_ms,
      memoryUsageMb: r.memory_usage_mb,
      error: r.error,
      createdAt: r.created_at,
      sourceCode: r.code,
      testSummary: r.test_summary ? JSON.parse(r.test_summary) : undefined
    } as any));
  }


  async listSubmissions(userId: string, challengeId: string): Promise<ArenaSubmission[]> {
    const db = await this.getDb();
    if (!db) return [];
    const rows = await db.prepare('SELECT * FROM arena_submissions WHERE user_id = ? AND challenge_id = ? ORDER BY created_at DESC').all(userId, challengeId) as any[];
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      challengeId: r.challenge_id,
      language: r.language,
      status: r.status as any,
      score: r.score,
      sourceCode: r.source_code,
      testSummary: r.test_summary,
      executionTimeMs: r.execution_time_ms,
      memoryUsageMb: r.memory_usage_mb,
      createdAt: r.created_at
    }));
  }
  
  async getLeaderboard(challengeId: string): Promise<{userId: string; score: number; timeMs: number}[]> {
     const db = await this.getDb();
     if (!db) return [];
     const rows = await db.prepare(`
        SELECT user_id, MAX(score) as max_score, MIN(execution_time_ms) as min_time 
        FROM arena_submissions 
        WHERE challenge_id = ? 
        GROUP BY user_id 
        ORDER BY max_score DESC, min_time ASC
        LIMIT 100
     `).all(challengeId) as any[];
     return rows.map(r => ({
         userId: r.user_id,
         score: r.max_score,
         timeMs: r.min_time
     }));
  }

  // --- Benchmark Workspace ---
  async getBenchmarkWorkspace(userId: string, benchmarkId: string): Promise<BenchmarkWorkspace | null> {
    const db = await this.getDb();
    if (!db) return null;
    const row = await db.prepare('SELECT * FROM benchmark_workspaces WHERE user_id = ? AND benchmark_id = ?').get(userId, benchmarkId) as any;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      benchmarkId: row.benchmark_id,
      workspaceAProjectId: row.workspace_a_project_id,
      workspaceBProjectId: row.workspace_b_project_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createBenchmarkWorkspace(w: BenchmarkWorkspace): Promise<BenchmarkWorkspace> {
    const db = await this.getDb();
    if (!db) return w;
    await db.prepare('INSERT OR REPLACE INTO benchmark_workspaces (id, user_id, benchmark_id, workspace_a_project_id, workspace_b_project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(w.id, w.userId, w.benchmarkId, w.workspaceAProjectId, w.workspaceBProjectId, w.createdAt, w.updatedAt);
    return w;
  }
  
  async listBenchmarkRuns(userId: string, benchmarkId: string): Promise<BenchmarkRun[]> {
    const db = await this.getDb();
    if (!db) return [];
    const rows = await db.prepare('SELECT * FROM benchmark_runs WHERE user_id = ? AND benchmark_id = ? ORDER BY created_at DESC').all(userId, benchmarkId) as any[];
    return rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      benchmarkId: r.benchmark_id,
      langA: r.lang_a,
      langB: r.lang_b,
      timeMsA: r.time_ms_a,
      timeMsB: r.time_ms_b,
      memoryMbA: r.memory_mb_a,
      memoryMbB: r.memory_mb_b,
      statusA: r.status_a,
      statusB: r.status_b,
      createdAt: r.created_at
    }));
  }
  
  async createBenchmarkRun(r: BenchmarkRun): Promise<BenchmarkRun> {
      const db = await this.getDb();
      if (!db) return r;
      await db.prepare('INSERT INTO benchmark_runs (id, user_id, benchmark_id, lang_a, lang_b, time_ms_a, time_ms_b, memory_mb_a, memory_mb_b, status_a, status_b, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(r.id, r.userId, r.benchmarkId, r.langA, r.langB, r.timeMsA, r.timeMsB, r.memoryMbA, r.memoryMbB, r.statusA, r.statusB, r.createdAt);
      return r;
  }
}

export const arenaDb = new ArenaDatabase();

