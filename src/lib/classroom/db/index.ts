// Cortex Classroom Database Layer
// High-performance relational store using Node.js 22 native node:sqlite with ACID durability,
// transactional integrity, foreign key relations, and event sequence indexing.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import {
  User,
  Classroom,
  ClassroomMember,
  Announcement,
  ClassroomMessage,
  Assignment,
  TestCase,
  Submission,
  Grade,
  Feedback,
  LiveClassSession,
  ClassroomResource,
  Notification,
  ClassroomEvent,
  StudentProgress,
  LeaderboardEntry,
  ClassroomAnalytics,
} from '../models';

interface DBInstance {
  exec(sql: string): Promise<void>;
  prepare(sql: string): {
    run(...params: any[]): Promise<{ changes: number; lastInsertRowid: number }>;
    get(...params: any[]): Promise<any>;
    all(...params: any[]): Promise<any[]>;
  };
}

class D1Wrapper implements DBInstance {
  constructor(private d1: any) {}
  async exec(sql: string): Promise<void> {
    await this.d1.exec(sql);
  }
  prepare(sql: string) {
    return {
      run: async (...params: any[]) => {
        const res = await this.d1.prepare(sql).bind(...params).run();
        return { changes: res.meta.changes, lastInsertRowid: res.meta.last_row_id };
      },
      get: async (...params: any[]) => {
        return await this.d1.prepare(sql).bind(...params).first();
      },
      all: async (...params: any[]) => {
        const res = await this.d1.prepare(sql).bind(...params).all();
        return res.results;
      }
    };
  }
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
      }
    };
  }
}

class ClassroomDatabase {
  public db: DBInstance | null = null;
  private dbPath: string = '';
  private initialized: boolean = false;

  constructor() {}

  
  private async getDb(): Promise<DBInstance> {
    await this.init();
    if (!this.db) {
      throw new Error('[ClassroomDatabase] No database available. SQLite initialization failed. Check server logs.');
    }
    return this.db!;
  }

  private async init() {
    if (this.initialized) return;

    // Check for D1 first (production Cloudflare)
    let d1Binding = null;
    if (typeof process !== 'undefined' && process.env && process.env.DB) {
      d1Binding = process.env.DB;
    } else if (typeof globalThis !== 'undefined' && (globalThis as any).env && (globalThis as any).env.DB) {
      d1Binding = (globalThis as any).env.DB;
    }

    if (d1Binding) {
      this.db = new D1Wrapper(d1Binding);
      this.initialized = true;
      await this.createTables();
      return;
    }

    try {
      const dataDir = path.resolve(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      this.dbPath = path.join(dataDir, 'cortex_classroom.db');

      // Dynamically load node:sqlite safely across ESM and CJS
      let DatabaseSync: any = null;
      if (typeof require !== 'undefined') {
        // @ts-ignore
        DatabaseSync = require('node:sqlite').DatabaseSync;
      } else {
        const customReq = createRequire(import.meta.url);
        DatabaseSync = customReq('node:sqlite').DatabaseSync;
      }

      const sqliteDb = new DatabaseSync(this.dbPath);
      sqliteDb.exec('PRAGMA journal_mode = WAL;');
      sqliteDb.exec('PRAGMA foreign_keys = ON;');
      this.db = new SqliteWrapper(sqliteDb);
      this.initialized = true;
      await this.createTables();
    } catch (err) {
      console.error('[ClassroomDatabase] FATAL: Could not initialize SQLite. Failing closed.', err);
      this.initialized = true;
      this.db = null;
      // Do NOT fall back to in-memory. Fail hard so bugs are visible.
    }
  }

  private async createTables() {
    if (!this.db) return;

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        cortex_id TEXT UNIQUE,
        password_hash TEXT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL,
        avatar TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

      CREATE TABLE IF NOT EXISTS classrooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        course_code TEXT NOT NULL,
        academic_year TEXT NOT NULL,
        section TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        teacher_name TEXT NOT NULL,
        image TEXT,
        join_code TEXT NOT NULL UNIQUE,
        join_enabled INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived_at INTEGER,
        settings_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS classroom_members (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_email TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        joined_at INTEGER NOT NULL,
        last_active_at INTEGER NOT NULL,
        is_online INTEGER DEFAULT 0,
        suspended_at INTEGER,
        suspension_expires_at INTEGER,
        removed_at INTEGER,
        UNIQUE(classroom_id, user_id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        recipient_type TEXT NOT NULL,
        recipient_id TEXT,
        content TEXT NOT NULL,
        private_notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        type TEXT NOT NULL,
        language TEXT NOT NULL,
        starter_code TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        max_marks INTEGER NOT NULL,
        due_at INTEGER NOT NULL,
        published_at INTEGER NOT NULL,
        scheduled_at INTEGER,
        attempts_allowed INTEGER NOT NULL DEFAULT 3,
        allow_late_submission INTEGER NOT NULL DEFAULT 1,
        late_penalty_percent INTEGER NOT NULL DEFAULT 10,
        auto_grade INTEGER NOT NULL DEFAULT 1,
        manual_grade INTEGER NOT NULL DEFAULT 1,
        ai_policy TEXT NOT NULL DEFAULT 'full',
        plagiarism_policy TEXT NOT NULL DEFAULT 'review_only',
        status TEXT NOT NULL DEFAULT 'published',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        test_cases_json TEXT NOT NULL DEFAULT '[]',
        rubric_json TEXT,
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL,
        assignment_title TEXT NOT NULL,
        classroom_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        code TEXT NOT NULL,
        language TEXT NOT NULL,
        project_id TEXT,
        snapshot_json TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'completed',
        submitted_at INTEGER NOT NULL,
        execution_started_at INTEGER,
        execution_completed_at INTEGER,
        score REAL NOT NULL DEFAULT 0,
        max_score REAL NOT NULL DEFAULT 100,
        is_late INTEGER NOT NULL DEFAULT 0,
        test_results_json TEXT NOT NULL DEFAULT '[]',
        similarity_score REAL DEFAULT 0,
        similar_student_name TEXT,
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
        FOREIGN KEY(assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS grades (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL UNIQUE,
        student_id TEXT NOT NULL,
        assignment_id TEXT NOT NULL,
        automatic_score REAL NOT NULL DEFAULT 0,
        manual_adjustment REAL NOT NULL DEFAULT 0,
        final_score REAL NOT NULL DEFAULT 0,
        graded_by TEXT NOT NULL,
        graded_by_name TEXT NOT NULL,
        graded_at INTEGER NOT NULL,
        released_at INTEGER,
        rubric_scores_json TEXT,
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        content TEXT NOT NULL,
        private_notes TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS live_sessions (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        teacher_name TEXT NOT NULL,
        title TEXT NOT NULL,
        topic TEXT NOT NULL,
        language TEXT NOT NULL,
        starter_code TEXT NOT NULL,
        shared_code TEXT NOT NULL,
        is_broadcasting_code INTEGER NOT NULL DEFAULT 0,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS classroom_invites (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        code TEXT NOT NULL UNIQUE,
        created_by TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        max_uses INTEGER NOT NULL DEFAULT 0,
        uses INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_by_name TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT NOT NULL,
        unit TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        pinned INTEGER DEFAULT 0,
        visibility TEXT DEFAULT 'public',
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        classroom_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data_json TEXT,
        read_at INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS classroom_events (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_events_room_seq ON classroom_events(classroom_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_members_room ON classroom_members(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(classroom_id);
    `);

    // Run migrations for columns that might not exist in older databases
    try { await this.db.exec('ALTER TABLE classroom_members ADD COLUMN suspended_at INTEGER'); } catch(_) {}
    try { await this.db.exec('ALTER TABLE classroom_members ADD COLUMN suspension_expires_at INTEGER'); } catch(_) {}
    try { await this.db.exec('ALTER TABLE classroom_members ADD COLUMN removed_at INTEGER'); } catch(_) {}
    try { await this.db.exec('ALTER TABLE submissions ADD COLUMN project_id TEXT'); } catch(_) {}
    try { await this.db.exec('ALTER TABLE submissions ADD COLUMN snapshot_json TEXT'); } catch(_) {}
  }

  // --- USERS ---
  async createUser(user: User): Promise<User> {
    if (!(await this.getDb())) return user;
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO users (id, name, email, role, avatar, status, created_at, updated_at, cortex_id, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      user.id, user.name, user.email, user.role, user.avatar || null, user.status, user.createdAt, user.updatedAt,
      (user as any).cortex_id || null, (user as any).password_hash || null
    );
    return user;
  }


  // --- AUTH & SESSIONS ---

  async getUserByEmail(email: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  async getUserByCortexId(cortexId: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM users WHERE cortex_id = ?').get(cortexId);
  }

  async createSession(id: string, userId: string, expiresAt: number): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare(
      'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, userId, expiresAt, Date.now());
  }

  async getSession(id: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  }

  async deleteSession(id: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  async createResetToken(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare(
      'INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
    ).run(tokenHash, userId, expiresAt, Date.now());
  }

  async getResetToken(tokenHash: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    return await (await this.getDb()).prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?').get(tokenHash);
  }

  async markResetTokenUsed(tokenHash: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE password_reset_tokens SET used = 1 WHERE token_hash = ?').run(tokenHash);
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  }

  // --- END AUTH ---

  async getUser(id: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as any,
      avatar: row.avatar || undefined,
      status: row.status as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cortex_id: row.cortex_id,
      password_hash: row.password_hash
    };
  }

  // --- CLASSROOMS ---
  async createClassroom(classroom: any): Promise<any> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO classrooms (
        id, name, subject, description, course_code, academic_year, section,
        teacher_id, teacher_name, image, join_code, join_enabled, status,
        created_at, updated_at, archived_at, settings_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      classroom.id,
      classroom.name || (classroom as any).title || 'Untitled Classroom',
      classroom.subject || '',
      classroom.description || '',
      classroom.courseCode || (classroom as any).code || '',
      classroom.academicYear || '',
      classroom.section || '',
      classroom.teacherId,
      classroom.teacherName || '',
      classroom.image || null,
      classroom.joinCode || (classroom as any).code || '',
      classroom.joinEnabled !== undefined ? (classroom.joinEnabled ? 1 : 0) : 1,
      classroom.status || 'active',
      classroom.createdAt || Date.now(),
      classroom.updatedAt || Date.now(),
      classroom.archivedAt || null,
      JSON.stringify(classroom.settings || {})
    );
    return classroom;
  }

  async getClassroom(id: string): Promise<Classroom | null> {
    if (!(await this.getDb())) return null;
    let row = await (await this.getDb()).prepare('SELECT * FROM classrooms WHERE id = ?').get(id) as any;
    if (!row) {
      row = await (await this.getDb()).prepare('SELECT * FROM classrooms WHERE UPPER(id) = ?').get(id.toUpperCase()) as any;
    }
    if (!row) return null;
    return this.mapClassroom(row);
  }

  async getClassroomByJoinCode(joinCode: string): Promise<Classroom | null> {
    if (!(await this.getDb())) return null;
    const norm = joinCode.trim().toUpperCase();
    const row = await (await this.getDb()).prepare('SELECT * FROM classrooms WHERE UPPER(join_code) = ?').get(norm) as any;
    if (!row) return null;
    return this.mapClassroom(row);
  }

  async listClassroomsForUser(userId: string): Promise<Classroom[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare(`
      SELECT c.* FROM classrooms c
      LEFT JOIN classroom_members m ON c.id = m.classroom_id
      WHERE c.teacher_id = ? OR (m.user_id = ? AND m.status = 'active')
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).all(userId, userId) as any[];
    return rows.map((r) => this.mapClassroom(r));
  }

  async updateClassroom(id: string, updates: Partial<Classroom>): Promise<Classroom | null> {
    if (!(await this.getDb())) return null;
    const current = await this.getClassroom(id);
    if (!current) return null;

    const merged = { ...current, ...updates, updatedAt: Date.now() };
    await this.createClassroom(merged);
    return merged;
  }

  async deleteClassroom(id: string): Promise<boolean> {
    if (!(await this.getDb())) return false;
    await (await this.getDb()).prepare('DELETE FROM classrooms WHERE id = ?').run(id);
    return true;
  }

  async restoreClassroom(classroomId: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    const stmt = await (await this.getDb()).prepare("UPDATE classrooms SET status = 'active', join_enabled = 1, archived_at = NULL, updated_at = ? WHERE id = ?");
    const result = await stmt.run(Date.now(), classroomId);
    if (result.changes === 0) return null;
    return this.getClassroom(classroomId);
  }

  async archiveClassroom(id: string): Promise<Classroom | null> {
    if (!(await this.getDb())) return null;
    const now = Date.now();
    await (await this.getDb()).prepare('UPDATE classrooms SET status = ?, archived_at = ?, join_enabled = 0, updated_at = ? WHERE id = ?')
      .run('archived', now, now, id);
    return this.getClassroom(id);
  }

  async regenerateJoinCode(id: string, newCode: string): Promise<Classroom | null> {
    if (!(await this.getDb())) return null;
    const now = Date.now();
    await (await this.getDb()).prepare('UPDATE classrooms SET join_code = ?, updated_at = ? WHERE id = ?')
      .run(newCode.toUpperCase().trim(), now, id);
    return this.getClassroom(id);
  }

  private mapClassroom(row: any): Classroom {
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      description: row.description,
      courseCode: row.course_code,
      academicYear: row.academic_year,
      section: row.section,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      image: row.image || undefined,
      joinCode: row.join_code,
      joinEnabled: Boolean(row.join_enabled),
      status: row.status as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at || undefined,
      settings: JSON.parse(row.settings_json || '{}'),
    };
  }

  // --- MEMBERS ---
  async addMember(memberOrClassroomId: any, maybeMember?: any): Promise<ClassroomMember> {
    const member: ClassroomMember = maybeMember
      ? { ...maybeMember, classroomId: memberOrClassroomId }
      : memberOrClassroomId;

    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status,
        joined_at, last_active_at, is_online,
        suspended_at, suspension_expires_at, removed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const id = member.id || `mem_${member.classroomId}_${member.userId}`;
    const userEmail = member.userEmail || `${member.userId}@cortex.edu`;
    const status = member.status || 'active';
    const joinedAt = member.joinedAt || Date.now();
    const lastActiveAt = member.lastActiveAt || Date.now();

    await stmt.run(
      id,
      member.classroomId,
      member.userId,
      member.userName || 'Student',
      userEmail,
      member.role || 'student',
      status,
      joinedAt,
      lastActiveAt,
      member.isOnline ? 1 : 0,
      (member as any).suspendedAt || null,
      (member as any).suspensionExpiresAt || null,
      (member as any).removedAt || null,
    );
    return member;
  }

  /**
   * Suspend a member. Stores suspendedAt and optional suspensionExpiresAt.
   * Updates status to 'suspended'.
   */
  async suspendMember(classroomId: string, userId: string, suspensionExpiresAt?: number): Promise<ClassroomMember | null> {
    if (!(await this.getDb())) return null;
    const now = Date.now();
    await (await this.getDb()).prepare(`
      UPDATE classroom_members
      SET status = 'suspended', suspended_at = ?, suspension_expires_at = ?, last_active_at = ?
      WHERE classroom_id = ? AND user_id = ?
    `).run(now, suspensionExpiresAt || null, now, classroomId, userId);
    return this.getMember(classroomId, userId);
  }

  /**
   * Restore a suspended member. Clears suspension fields.
   */
  async restoreMember(classroomId: string, userId: string): Promise<ClassroomMember | null> {
    if (!(await this.getDb())) return null;
    const now = Date.now();
    await (await this.getDb()).prepare(`
      UPDATE classroom_members
      SET status = 'active', suspended_at = NULL, suspension_expires_at = NULL, last_active_at = ?
      WHERE classroom_id = ? AND user_id = ?
    `).run(now, classroomId, userId);
    return this.getMember(classroomId, userId);
  }

  /**
   * Check if a member is currently suspended (accounts for expiry).
   */
  isMemberSuspended(member: ClassroomMember): boolean {
    if (member.status !== 'suspended') return false;
    const expiresAt = (member as any).suspensionExpiresAt;
    if (!expiresAt) return true; // Permanent suspension
    return Date.now() < expiresAt; // Temporary - still active
  }

  async getMember(classroomId: string, userId: string): Promise<ClassroomMember | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM classroom_members WHERE classroom_id = ? AND user_id = ?').get(classroomId, userId) as any;
    if (!row) return null;
    return this.mapMember(row);
  }

  async listMembers(classroomId: string): Promise<ClassroomMember[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM classroom_members WHERE classroom_id = ? ORDER BY role DESC, user_name ASC').all(classroomId) as any[];
    return rows.map((r) => this.mapMember(r));
  }

  async updateMemberPresence(classroomId: string, userId: string, isOnline: boolean) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare(`
      UPDATE classroom_members
      SET is_online = ?, last_active_at = ?
      WHERE classroom_id = ? AND user_id = ?
    `).run(isOnline ? 1 : 0, Date.now(), classroomId, userId);
  }

  async removeMember(classroomId: string, userId: string) {
    if (!(await this.getDb())) return;
    const now = Date.now();
    // Soft-delete: set removed_at and drop the record. Since we have UNIQUE constraints, hard-delete is safe.
    await (await this.getDb()).prepare('DELETE FROM classroom_members WHERE classroom_id = ? AND user_id = ?').run(classroomId, userId);
  }

  private mapMember(row: any): ClassroomMember {
    const member: any = {
      id: row.id,
      classroomId: row.classroom_id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      role: row.role as any,
      status: row.status as any,
      joinedAt: row.joined_at,
      lastActiveAt: row.last_active_at,
      isOnline: Boolean(row.is_online),
    };
    if (row.suspended_at) member.suspendedAt = row.suspended_at;
    if (row.suspension_expires_at) member.suspensionExpiresAt = row.suspension_expires_at;
    if (row.removed_at) member.removedAt = row.removed_at;

    // Auto-restore expired temporary suspensions (server-side check)
    if (member.status === 'suspended' && member.suspensionExpiresAt && Date.now() >= member.suspensionExpiresAt) {
      member.status = 'active'; // Treat as active since expiry passed
    }
    return member;
  }

  // --- ANNOUNCEMENTS ---
  async createAnnouncement(ann: Announcement): Promise<Announcement> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO announcements (
        id, classroom_id, author_id, author_name, author_role,
        title, content, pinned, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      ann.id,
      ann.classroomId,
      ann.authorId,
      ann.authorName,
      ann.authorRole,
      ann.title,
      ann.content,
      ann.pinned ? 1 : 0,
      ann.createdAt,
      ann.updatedAt,
      ann.deletedAt || null
    );
    return ann;
  }

  async listAnnouncements(classroomId: string): Promise<Announcement[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare(`
      SELECT * FROM announcements
      WHERE classroom_id = ? AND deleted_at IS NULL
      ORDER BY pinned DESC, created_at DESC
    `).all(classroomId) as any[];
    return rows.map((r) => ({
      id: r.id,
      classroomId: r.classroom_id,
      authorId: r.author_id,
      authorName: r.author_name,
      authorRole: r.author_role as any,
      title: r.title,
      content: r.content,
      pinned: Boolean(r.pinned),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at || undefined,
    }));
  }

  async getAnnouncement(id: string): Promise<Announcement | null> {
    if (!(await this.getDb())) return null;
    const r = await (await this.getDb()).prepare('SELECT * FROM announcements WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      classroomId: r.classroom_id,
      authorId: r.author_id,
      authorName: r.author_name,
      authorRole: r.author_role as any,
      title: r.title,
      content: r.content,
      pinned: Boolean(r.pinned),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at || undefined,
    };
  }

  async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | null> {
    if (!(await this.getDb())) return null;
    const existing = await this.getAnnouncement(id);
    if (!existing) return null;
    const merged = { ...existing, ...updates, updatedAt: Date.now() };
    await this.createAnnouncement(merged);
    return merged;
  }

  async deleteAnnouncement(id: string) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE announcements SET deleted_at = ? WHERE id = ?').run(Date.now(), id);
  }

  // --- MESSAGES ---
  async createMessage(msg: ClassroomMessage): Promise<ClassroomMessage> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT INTO messages (
        id, classroom_id, sender_id, sender_name, sender_role,
        recipient_type, recipient_id, content, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      msg.id,
      msg.classroomId,
      msg.senderId,
      msg.senderName,
      msg.senderRole,
      msg.recipientType,
      msg.recipientId || null,
      msg.content,
      msg.createdAt,
      msg.updatedAt
    );
    return msg;
  }

  async listMessages(classroomId: string, limitOrUserId?: number | string, isTeacher = false, limit = 100): Promise<ClassroomMessage[]> {
    if (!(await this.getDb())) return [];
    let actualLimit = limit;
    let requestingUserId: string | undefined = undefined;

    if (typeof limitOrUserId === 'number') {
      actualLimit = limitOrUserId;
    } else if (typeof limitOrUserId === 'string') {
      requestingUserId = limitOrUserId;
    }

    let rows: any[] = [];
    if (isTeacher || !requestingUserId) {
      rows = await (await this.getDb()).prepare(`
        SELECT * FROM messages
        WHERE classroom_id = ? AND deleted_at IS NULL
        ORDER BY created_at ASC
        LIMIT ?
      `).all(classroomId, actualLimit) as any[];
    } else {
      // Direct message privacy filter for students
      rows = await (await this.getDb()).prepare(`
        SELECT * FROM messages
        WHERE classroom_id = ? AND deleted_at IS NULL
          AND (recipient_type = 'class' OR sender_id = ? OR recipient_id = ?)
        ORDER BY created_at ASC
        LIMIT ?
      `).all(classroomId, requestingUserId, requestingUserId, actualLimit) as any[];
    }
    return rows.map((r) => ({
      id: r.id,
      classroomId: r.classroom_id,
      senderId: r.sender_id,
      senderName: r.sender_name,
      senderRole: r.sender_role as any,
      recipientType: r.recipient_type as any,
      recipientId: r.recipient_id || undefined,
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  // --- ASSIGNMENTS ---
  async createAssignment(asg: Assignment): Promise<Assignment> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO assignments (
        id, classroom_id, title, description, instructions, type, language,
        starter_code, difficulty, max_marks, due_at, published_at, scheduled_at,
        attempts_allowed, allow_late_submission, late_penalty_percent, auto_grade,
        manual_grade, ai_policy, plagiarism_policy, status, created_by,
        created_at, updated_at, test_cases_json, rubric_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      asg.id,
      asg.classroomId,
      asg.title,
      asg.description,
      asg.instructions,
      asg.type,
      asg.language,
      asg.starterCode || '',
      asg.difficulty || 'medium',
      asg.maxMarks ?? 100,
      asg.dueAt || null,
      asg.publishedAt || Date.now(),
      asg.scheduledAt || null,
      asg.attemptsAllowed ?? 1,
      asg.allowLateSubmission ? 1 : 0,
      asg.latePenaltyPercent ?? 0,
      asg.autoGrade ? 1 : 0,
      asg.manualGrade ? 1 : 0,
      asg.aiPolicy || 'allowed',
      asg.plagiarismPolicy || 'strict',
      asg.status || 'published',
      asg.createdBy,
      asg.createdAt || Date.now(),
      asg.updatedAt || Date.now(),
      JSON.stringify(asg.testCases || []),
      asg.rubric ? JSON.stringify(asg.rubric) : null
    );
    return asg;
  }

  async getAssignment(id: string): Promise<Assignment | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM assignments WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapAssignment(row);
  }

  async listAssignments(classroomId: string): Promise<Assignment[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM assignments WHERE classroom_id = ? ORDER BY due_at ASC, created_at DESC').all(classroomId) as any[];
    return rows.map((r) => this.mapAssignment(r));
  }

  private mapAssignment(row: any): Assignment {
    return {
      id: row.id,
      classroomId: row.classroom_id,
      title: row.title,
      description: row.description,
      instructions: row.instructions,
      type: row.type as any,
      language: row.language,
      starterCode: row.starter_code,
      difficulty: row.difficulty as any,
      maxMarks: row.max_marks,
      dueAt: row.due_at,
      publishedAt: row.published_at,
      scheduledAt: row.scheduled_at || undefined,
      attemptsAllowed: row.attempts_allowed,
      allowLateSubmission: Boolean(row.allow_late_submission),
      latePenaltyPercent: row.late_penalty_percent,
      autoGrade: Boolean(row.auto_grade),
      manualGrade: Boolean(row.manual_grade),
      aiPolicy: row.ai_policy as any,
      plagiarismPolicy: row.plagiarism_policy as any,
      status: row.status as any,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      testCases: JSON.parse(row.test_cases_json || '[]'),
      rubric: row.rubric_json ? JSON.parse(row.rubric_json) : undefined,
    };
  }

  // --- SUBMISSIONS & GRADING ---
  async saveSubmission(sub: Submission): Promise<Submission> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO submissions (
        id, assignment_id, assignment_title, classroom_id, student_id,
        student_name, code, language, project_id, snapshot_json, version, status, submitted_at,
        execution_started_at, execution_completed_at, score, max_score,
        is_late, test_results_json, similarity_score, similar_student_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      sub.id,
      sub.assignmentId,
      sub.assignmentTitle,
      sub.classroomId,
      sub.studentId,
      sub.studentName,
      sub.code,
      sub.language,
      (sub as any).projectId || null,
      (sub as any).snapshotJson || null,
      sub.version || 1,
      sub.status,
      sub.submittedAt,
      sub.executionStartedAt || null,
      sub.executionCompletedAt || null,
      sub.score,
      sub.maxScore,
      sub.isLate ? 1 : 0,
      JSON.stringify(sub.testResults || []),
      sub.similarityScore || 0,
      sub.similarStudentName || null
    );

    if (sub.grade) {
      await this.saveGrade(sub.grade);
    }
    if (sub.feedback) {
      await this.saveFeedback(sub.feedback);
    }

    return sub;
  }

  async getSubmission(id: string): Promise<Submission | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM submissions WHERE id = ?').get(id) as any;
    if (!row) return null;
    return this.mapSubmission(row);
  }

  async listSubmissions(assignmentId: string): Promise<Submission[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM submissions WHERE assignment_id = ? ORDER BY submitted_at DESC').all(assignmentId) as any[];
    return rows.map((r) => this.mapSubmission(r));
  }

  async listSubmissionsForClassroom(classroomId: string): Promise<Submission[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM submissions WHERE classroom_id = ? ORDER BY submitted_at DESC').all(classroomId) as any[];
    return rows.map((r) => this.mapSubmission(r));
  }

  async getStudentSubmission(assignmentId: string, studentId: string): Promise<Submission | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ? ORDER BY version DESC LIMIT 1').get(assignmentId, studentId) as any;
    if (!row) return null;
    return this.mapSubmission(row);
  }

  private mapSubmission(row: any): Submission {
    const sub: Submission = {
      id: row.id,
      assignmentId: row.assignment_id,
      assignmentTitle: row.assignment_title,
      classroomId: row.classroom_id,
      studentId: row.student_id,
      studentName: row.student_name,
      code: row.code,
      language: row.language,
      version: row.version,
      status: row.status as any,
      submittedAt: row.submitted_at,
      executionStartedAt: row.execution_started_at || undefined,
      executionCompletedAt: row.execution_completed_at || undefined,
      score: row.score,
      maxScore: row.max_score,
      isLate: Boolean(row.is_late),
      testResults: JSON.parse(row.test_results_json || '[]'),
      similarityScore: row.similarity_score || 0,
      similarStudentName: row.similar_student_name || undefined,
    };

    // Sync load grade (SQLite allows sync inside SqliteWrapper)
    const gradeRow = (this.db as any)?.sqlite?.prepare('SELECT * FROM grades WHERE submission_id = ?')?.get(sub.id);
    if (gradeRow) {
      sub.grade = {
        id: gradeRow.id,
        submissionId: gradeRow.submission_id,
        studentId: gradeRow.student_id,
        assignmentId: gradeRow.assignment_id,
        automaticScore: gradeRow.automatic_score,
        manualAdjustment: gradeRow.manual_adjustment,
        finalScore: gradeRow.final_score,
        gradedBy: gradeRow.graded_by,
        gradedByName: gradeRow.graded_by_name,
        gradedAt: gradeRow.graded_at,
        releasedAt: gradeRow.released_at || undefined,
        rubricScores: gradeRow.rubric_scores_json ? JSON.parse(gradeRow.rubric_scores_json) : undefined,
      };
    }

    const fbkRow = (this.db as any)?.sqlite?.prepare('SELECT * FROM feedback WHERE submission_id = ?')?.get(sub.id);
    if (fbkRow) {
      sub.feedback = {
        id: fbkRow.id,
        submissionId: fbkRow.submission_id,
        authorId: fbkRow.author_id,
        authorName: fbkRow.author_name,
        content: fbkRow.content,
        privateNotes: fbkRow.private_notes || undefined,
        createdAt: fbkRow.created_at,
        updatedAt: fbkRow.updated_at,
      };
    }

    return sub;
  }

  async saveGrade(grade: Grade): Promise<Grade> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO grades (
        id, submission_id, student_id, assignment_id, automatic_score,
        manual_adjustment, final_score, graded_by, graded_by_name,
        graded_at, released_at, rubric_scores_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      grade.id,
      grade.submissionId,
      grade.studentId,
      grade.assignmentId,
      grade.automaticScore,
      grade.manualAdjustment,
      grade.finalScore,
      grade.gradedBy,
      grade.gradedByName,
      grade.gradedAt,
      grade.releasedAt || null,
      grade.rubricScores ? JSON.stringify(grade.rubricScores) : null
    );

    await (await this.getDb()).prepare('UPDATE submissions SET score = ?, status = ? WHERE id = ?').run(grade.finalScore, 'graded', grade.submissionId);

    return grade;
  }

  async saveFeedback(fbk: Feedback): Promise<Feedback> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO feedback (
        id, submission_id, author_id, author_name, content, private_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(fbk.id, fbk.submissionId, fbk.authorId, fbk.authorName, fbk.content, fbk.privateNotes || null, fbk.createdAt, fbk.updatedAt);
    return fbk;
  }

  // --- LIVE CODING SESSIONS ---
  async createLiveSession(session: LiveClassSession): Promise<LiveClassSession> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    await (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO live_sessions (
        id, classroom_id, teacher_id, teacher_name, title, topic, language,
        starter_code, shared_code, is_broadcasting_code, started_at, ended_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session.id,
      session.classroomId,
      session.teacherId,
      session.teacherName,
      session.title,
      session.topic,
      session.language,
      session.starterCode,
      session.sharedCode,
      session.isBroadcastingCode ? 1 : 0,
      session.startedAt,
      session.endedAt || null,
      session.status
    );
    return session;
  }

  async getActiveLiveSession(classroomId: string): Promise<LiveClassSession | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM live_sessions WHERE classroom_id = ? AND status = ? ORDER BY started_at DESC LIMIT 1').get(classroomId, 'active') as any;
    if (!row) return null;
    return {
      id: row.id,
      classroomId: row.classroom_id,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      title: row.title,
      topic: row.topic,
      language: row.language,
      starterCode: row.starter_code,
      sharedCode: row.shared_code,
      isBroadcastingCode: Boolean(row.is_broadcasting_code),
      startedAt: row.started_at,
      endedAt: row.ended_at || undefined,
      durationMinutes: row.ended_at ? Math.round((row.ended_at - row.started_at) / 60000) : Math.round((Date.now() - row.started_at) / 60000),
      status: row.status as any,
      activeStudentCount: 0, // Real count comes from WebSocket Durable Object
    };
  }

  async updateLiveSessionCode(sessionId: string, sharedCode: string, isBroadcasting: boolean) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE live_sessions SET shared_code = ?, is_broadcasting_code = ? WHERE id = ?').run(sharedCode, isBroadcasting ? 1 : 0, sessionId);
  }

  async endLiveSession(sessionId: string) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE live_sessions SET status = ?, ended_at = ? WHERE id = ?').run('ended', Date.now(), sessionId);
  }

  // --- RESOURCES ---
  async createResource(res: ClassroomResource): Promise<ClassroomResource> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    await (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO resources (id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(res.id, res.classroomId, res.uploadedBy, res.uploadedByName, res.name, res.type, res.url, res.description, res.unit || '', res.createdAt, res.pinned ? 1 : 0, res.visibility || 'public');
    return res;
  }

  async listResources(classroomId: string): Promise<ClassroomResource[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM resources WHERE classroom_id = ? ORDER BY pinned DESC, created_at DESC').all(classroomId) as any[];
    return rows.map((r) => ({
      id: r.id,
      classroomId: r.classroom_id,
      uploadedBy: r.uploaded_by,
      uploadedByName: r.uploaded_by_name,
      name: r.name,
      type: r.type as any,
      url: r.url,
      description: r.description,
      unit: r.unit,
      createdAt: r.created_at,
      pinned: r.pinned === 1,
      visibility: r.visibility || 'public',
    }));
  }

  async deleteResource(id: string) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('DELETE FROM resources WHERE id = ?').run(id);
  }

  // --- NOTIFICATIONS ---
  async createNotification(notif: Notification): Promise<Notification> {
    if (!(await this.getDb())) throw new Error('Database unavailable');
    await (await this.getDb()).prepare(`
      INSERT INTO notifications (id, user_id, classroom_id, type, title, message, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(notif.id, notif.userId, notif.classroomId, notif.type, notif.title, notif.message, notif.data ? JSON.stringify(notif.data) : null, notif.createdAt);
    return notif;
  }

  async listNotificationsForUser(userId: string, limit = 50): Promise<Notification[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      classroomId: r.classroom_id,
      type: r.type as any,
      title: r.title,
      message: r.message,
      data: r.data_json ? JSON.parse(r.data_json) : undefined,
      readAt: r.read_at || undefined,
      createdAt: r.created_at,
    }));
  }

  
  async markAllNotificationsRead(userId: string) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL').run(Date.now(), userId);
  }

  async markNotificationRead(id: string) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE notifications SET read_at = ? WHERE id = ?').run(Date.now(), id);
  }

  // --- REAL-TIME EVENTS & RESYNC ---
  async recordEvent(event: ClassroomEvent): Promise<ClassroomEvent> {
    if (!(await this.getDb())) return event;
    await (await this.getDb()).prepare(`
      INSERT OR IGNORE INTO classroom_events (id, classroom_id, sequence, type, actor_id, actor_name, timestamp, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.classroomId,
      event.sequence,
      event.type,
      event.actorId,
      event.actorName,
      event.timestamp,
      JSON.stringify(event.payload || {})
    );
    return event;
  }

  async getEventsSince(classroomId: string, sinceSequence: number): Promise<ClassroomEvent[]> {
    if (!(await this.getDb())) return [];
    const rows = await (await this.getDb()).prepare(`
      SELECT * FROM classroom_events
      WHERE classroom_id = ? AND sequence > ?
      ORDER BY sequence ASC
    `).all(classroomId, sinceSequence) as any[];
    return rows.map((r) => ({
      id: r.id,
      classroomId: r.classroom_id,
      sequence: r.sequence,
      type: r.type,
      actorId: r.actor_id,
      actorName: r.actor_name,
      timestamp: r.timestamp,
      payload: JSON.parse(r.payload_json || '{}'),
    }));
  }

  async getNextEventSequence(classroomId: string): Promise<number> {
    if (!(await this.getDb())) return 1;
    const row = await (await this.getDb()).prepare('SELECT MAX(sequence) as max_seq FROM classroom_events WHERE classroom_id = ?').get(classroomId) as any;
    return (row?.max_seq || 0) + 1;
  }

  // --- ANALYTICS & PROGRESS ---
  async getClassroomAnalytics(classroomId: string): Promise<ClassroomAnalytics> {
    const members = (await this.listMembers(classroomId)).filter((m) => m.role === 'student' && m.status !== 'suspended');
    const assignments = await this.listAssignments(classroomId);
    const submissions = await this.listSubmissionsForClassroom(classroomId);

    let totalScore = 0;
    let gradedCount = 0;
    for (const sub of submissions) {
      if (sub.status === 'graded' || (sub.score > 0 && sub.status === 'completed')) {
        totalScore += sub.score;
        gradedCount++;
      }
    }

    const classAverageScore = gradedCount > 0 ? Math.round(totalScore / gradedCount) : 0;
    const totalPotential = members.length * assignments.length;
    const submissionRate = totalPotential > 0 ? Math.round((submissions.length / totalPotential) * 100) : 0;

    // Determine at-risk students from real data
    const atRiskStudents = members
      .filter((m) => {
        const studentSubs = submissions.filter((s) => s.studentId === m.userId);
        const avgScore = studentSubs.length > 0
          ? studentSubs.reduce((sum, s) => sum + s.score, 0) / studentSubs.length
          : -1;
        return studentSubs.length === 0 || avgScore < 60;
      })
      .map((m) => {
        const studentSubs = submissions.filter((s) => s.studentId === m.userId);
        const avgScore = studentSubs.length > 0
          ? Math.round(studentSubs.reduce((sum, s) => sum + s.score, 0) / studentSubs.length)
          : 0;
        return {
          studentId: m.userId,
          studentName: m.userName,
          reason: studentSubs.length === 0 ? 'No submissions yet' : 'Average score below 60%',
          averageScore: avgScore,
        };
      });

    // Count real failure states from test results
    const commonFailureStates: Record<string, number> = {};
    for (const sub of submissions) {
      for (const tr of (sub.testResults || [])) {
        if (tr.status === 'timeout') {
          commonFailureStates['Time Limit Exceeded'] = (commonFailureStates['Time Limit Exceeded'] || 0) + 1;
        } else if (tr.status === 'error') {
          commonFailureStates['Runtime Error'] = (commonFailureStates['Runtime Error'] || 0) + 1;
        } else if (tr.status === 'failed') {
          commonFailureStates['Wrong Answer'] = (commonFailureStates['Wrong Answer'] || 0) + 1;
        }
      }
    }

    return {
      classroomId,
      totalStudents: members.length,
      activeToday: members.filter((m) => m.isOnline).length, // Real presence from DB
      classAverageScore,
      submissionRate,
      assignmentsCount: assignments.length,
      pendingGrading: submissions.filter(s => s.status === 'pending' || s.status === 'completed').length,
      commonFailureStates: Object.keys(commonFailureStates).length > 0 ? commonFailureStates : undefined,
      atRiskCount: atRiskStudents.length,
      atRiskStudents,
    };
  }

  async getStudentProgress(classroomId: string, studentId: string): Promise<StudentProgress> {
    const assignments = await this.listAssignments(classroomId);
    const allSubs = await this.listSubmissionsForClassroom(classroomId);
    const studentSubs = allSubs.filter((s) => s.studentId === studentId);
    const member = await this.getMember(classroomId, studentId);

    const completed = studentSubs.filter((s) => s.status === 'graded' || s.status === 'completed').length;
    const attempted = studentSubs.length;
    let sumScore = 0;
    for (const s of studentSubs) sumScore += s.score;
    const avgScore = studentSubs.length > 0 ? Math.round(sumScore / studentSubs.length) : 0;
    const solved = studentSubs.filter(s => s.score >= 70).length;

    return {
      classroomId,
      studentId,
      studentName: member?.userName || 'Student',
      assignmentsCompleted: completed,
      assignmentsTotal: assignments.length,
      averageScore: avgScore,
      solvedProblems: solved,
      codingActivityHours: 0, // Not tracked yet - emit 0 rather than fake value
      assignmentsAttempted: attempted,
      questionsAsked: 0,       // Not tracked yet - emit 0 rather than fake value
      liveSessionsJoined: 0,   // Not tracked yet - emit 0 rather than fake value
      topicMastery: {},         // Not tracked yet - emit empty rather than fake values
    };
  }

  async getLeaderboard(classroomId: string): Promise<LeaderboardEntry[]> {
    const members = (await this.listMembers(classroomId)).filter((m) => m.role === 'student' && m.status !== 'suspended');
    const submissions = await this.listSubmissionsForClassroom(classroomId);

    const entries: LeaderboardEntry[] = members.map((m) => {
      const studentSubs = submissions.filter((s) => s.studentId === m.userId);
      let points = 0;
      let solved = 0;
      let totalPossible = 0;
      for (const s of studentSubs) {
        points += s.score;
        totalPossible += s.maxScore;
        if (s.score >= 70) solved++;
      }
      const accuracy = totalPossible > 0 ? Math.round((points / totalPossible) * 100) : 0;

      return {
        classroomId,
        studentId: m.userId,
        studentName: m.userName,
        points,
        rank: 0, // set after sort
        solved,
        accuracy,
        lastActive: m.lastActiveAt,
      };
    });

    entries.sort((a, b) => b.points - a.points || b.solved - a.solved);
    entries.forEach((e, i) => (e.rank = i + 1));
    return entries;
  }
}

export const classroomDb = new ClassroomDatabase();
