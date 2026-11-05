import { DBInstance, getDbInstance, DatabaseProviderCapabilities } from '@/lib/db';
import crypto from 'crypto';
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
  ClassroomTeamSettings,
  ProjectTeam,
  ProjectTeamMember,
  ProjectActivityRecord,
  TeamFormationMode,
  TeamMemberRole,
  TeamMemberStatus,
  ThemePresetId,
  ProjectTeamStatus,
  Exam,
  ExamSection,
  ExamQuestion,
  ExamSession,
  ExamQuestionResponse,
  ExamIntegrityEvent,
  ExamBranchingRule,
  CandidateSessionInfo,
  ExamLiveDashboardData,
  ExamStatus,
  ExamQuestionType,
  ExamSessionStatus,
  ExamGradingStatus,
  ExamIntegrityEventType,
  VALID_EXAM_TRANSITIONS,
  QuestionBankItem,
  QuestionBankFilter,
  QuestionBankDifficulty,
  ExamAnalytics,
  PlatformAdminAnalytics,
  ExamQuestionPerformance,
  ExamScoreDistribution,
} from '../models';
import { ClassroomIdentity } from '../identity';


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
  getProviderCapabilities(): DatabaseProviderCapabilities {
    return {
      providerName: 'sqlite_local',
      supportsImmediateTransactions: true,
      supportsWalSharedMemory: true,
      supportsCrossProcessSameHostLocking: true,
      supportsDistributedCrossHostLocking: false,
      supportsSavepoints: true,
      supportsAtomicCasUpdates: true,
      supportsUniqueConstraintRejections: true,
      concurrencyModelDescription: 'Local multi-process SQLite with WAL mode and BEGIN IMMEDIATE file-level serialization on single host.'
    };
  }
}

class ClassroomDatabase {
  public db: DBInstance | null = null;
  private dbPath: string = '';
  private initialized: boolean = false;
  private auditAppendMutex: Promise<any> = Promise.resolve();

  constructor() {}

  
  async getProviderCapabilities(): Promise<DatabaseProviderCapabilities> {
    const db = await this.getDb();
    if (typeof (db as any).getProviderCapabilities === 'function') {
      return (db as any).getProviderCapabilities();
    }
    return {
      providerName: 'sqlite_local',
      supportsImmediateTransactions: true,
      supportsWalSharedMemory: true,
      supportsCrossProcessSameHostLocking: true,
      supportsDistributedCrossHostLocking: false,
      supportsSavepoints: true,
      supportsAtomicCasUpdates: true,
      supportsUniqueConstraintRejections: true,
      concurrencyModelDescription: 'Default local SQLite database instance.'
    };
  }

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
    let d1Binding: any = null;
    if (typeof process !== 'undefined' && process.env && process.env.DB) {
      d1Binding = process.env.DB;
    } else if (typeof globalThis !== 'undefined' && (globalThis as any).env && (globalThis as any).env.DB) {
      d1Binding = (globalThis as any).env.DB;
    }

    if (d1Binding) {
      this.db = new D1Wrapper(d1Binding); this.initialized = true;
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
      sqliteDb.exec('PRAGMA busy_timeout = 5000;');
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
        updated_at INTEGER NOT NULL,
        professional_email TEXT UNIQUE
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

      CREATE TABLE IF NOT EXISTS platform_feedback (id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, email TEXT, severity TEXT NOT NULL, category TEXT, diagnostics_json TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, user_id TEXT);

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

      CREATE TABLE IF NOT EXISTS classroom_whiteboards (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        pages_json TEXT NOT NULL,
        active_page_index INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(classroom_id, session_id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS classroom_presentations (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        deck_json TEXT NOT NULL,
        active_slide_index INTEGER NOT NULL DEFAULT 0,
        is_presenting INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(classroom_id, session_id),
        FOREIGN KEY(classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_whiteboards_room ON classroom_whiteboards(classroom_id, session_id);
      CREATE INDEX IF NOT EXISTS idx_presentations_room ON classroom_presentations(classroom_id, session_id);
      CREATE INDEX IF NOT EXISTS idx_events_room_seq ON classroom_events(classroom_id, sequence);
      CREATE INDEX IF NOT EXISTS idx_members_room ON classroom_members(classroom_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON submissions(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(classroom_id);

      CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        classroom_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        duration_minutes INTEGER NOT NULL DEFAULT 60,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        total_marks INTEGER NOT NULL DEFAULT 100,
        passing_marks INTEGER NOT NULL DEFAULT 40,
        attempts_allowed INTEGER NOT NULL DEFAULT 1,
        security_level TEXT NOT NULL DEFAULT 'standard',
        status TEXT NOT NULL DEFAULT 'draft',
        shuffle_questions INTEGER NOT NULL DEFAULT 0,
        shuffle_options INTEGER NOT NULL DEFAULT 0,
        show_results_immediately INTEGER NOT NULL DEFAULT 0,
        assigned_student_ids_json TEXT NOT NULL DEFAULT '[]',
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS exam_sections (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        section_marks INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS exam_questions (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        section_id TEXT,
        question_type TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        prompt_media_url TEXT,
        options_json TEXT NOT NULL DEFAULT '[]',
        correct_answer_json TEXT NOT NULL DEFAULT '{}',
        test_cases_json TEXT NOT NULL DEFAULT '[]',
        initial_code TEXT,
        language TEXT,
        points REAL NOT NULL DEFAULT 1.0,
        negative_marks REAL NOT NULL DEFAULT 0.0,
        numerical_tolerance REAL NOT NULL DEFAULT 0.0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (section_id) REFERENCES exam_sections(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS exam_sessions (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'in_progress',
        started_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        submitted_at INTEGER,
        auto_score REAL NOT NULL DEFAULT 0,
        manual_score REAL,
        final_score REAL,
        is_published INTEGER NOT NULL DEFAULT 0,
        teacher_feedback TEXT NOT NULL DEFAULT '',
        submission_receipt TEXT,
        answer_digest TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(exam_id, user_id, attempt_number),
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS exam_question_responses (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        response_json TEXT NOT NULL DEFAULT '{}',
        earned_points REAL NOT NULL DEFAULT 0,
        grading_status TEXT NOT NULL DEFAULT 'pending',
        grader_notes TEXT NOT NULL DEFAULT '',
        flagged_for_review INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        UNIQUE(session_id, question_id),
        FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS exam_integrity_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (session_id) REFERENCES exam_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_exams_classroom ON exams(classroom_id, status);
      CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_exam_sessions_user ON exam_sessions(exam_id, user_id, status);
      CREATE INDEX IF NOT EXISTS idx_exam_responses_session ON exam_question_responses(session_id);
      CREATE INDEX IF NOT EXISTS idx_exam_integrity_session ON exam_integrity_events(session_id, timestamp);

      CREATE TABLE IF NOT EXISTS question_bank (
        id TEXT PRIMARY KEY,
        teacher_id TEXT NOT NULL,
        classroom_id TEXT,
        subject TEXT NOT NULL DEFAULT 'General',
        topic TEXT NOT NULL DEFAULT 'General',
        difficulty TEXT NOT NULL DEFAULT 'medium',
        question_type TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        prompt_media_url TEXT,
        options_json TEXT NOT NULL DEFAULT '[]',
        correct_answer_json TEXT NOT NULL DEFAULT '{}',
        test_cases_json TEXT NOT NULL DEFAULT '[]',
        initial_code TEXT,
        language TEXT,
        default_points REAL NOT NULL DEFAULT 1.0,
        negative_marks REAL NOT NULL DEFAULT 0.0,
        numerical_tolerance REAL NOT NULL DEFAULT 0.0,
        tags_json TEXT NOT NULL DEFAULT '[]',
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_question_bank_teacher ON question_bank(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_question_bank_subject_topic ON question_bank(subject, topic);
      CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON question_bank(difficulty);
      CREATE INDEX IF NOT EXISTS idx_question_bank_type ON question_bank(question_type);
      CREATE INDEX IF NOT EXISTS idx_question_bank_archived ON question_bank(is_archived);

      CREATE TABLE IF NOT EXISTS exam_branching_rules (
        id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        source_question_id TEXT NOT NULL,
        condition_operator TEXT NOT NULL,
        condition_value TEXT NOT NULL,
        destination_type TEXT NOT NULL,
        destination_id TEXT,
        default_destination_type TEXT NOT NULL DEFAULT 'section',
        default_destination_id TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (source_question_id) REFERENCES exam_questions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_exam_branching_exam ON exam_branching_rules(exam_id);
      CREATE INDEX IF NOT EXISTS idx_exam_branching_source ON exam_branching_rules(source_question_id);
      CREATE INDEX IF NOT EXISTS idx_exams_security ON exams(security_level, status);
      CREATE INDEX IF NOT EXISTS idx_exam_responses_session_updated ON exam_question_responses(session_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_exam_sessions_heartbeat ON exam_sessions(exam_id, last_heartbeat_at);
      CREATE INDEX IF NOT EXISTS idx_exams_status_time ON exams(status, start_time, end_time);

      CREATE TABLE IF NOT EXISTS lockdown_emergency_authorizations (
        id TEXT PRIMARY KEY,
        challenge TEXT UNIQUE NOT NULL,
        exam_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        device_id TEXT,
        session_id TEXT,
        code_hash TEXT NOT NULL,
        code_salt TEXT NOT NULL,
        issued_by TEXT NOT NULL,
        issued_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        redeemed_at INTEGER,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        reason TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_lockdown_emergency_challenge ON lockdown_emergency_authorizations(challenge);
      CREATE INDEX IF NOT EXISTS idx_lockdown_emergency_exam_cand ON lockdown_emergency_authorizations(exam_id, candidate_id);

      CREATE TABLE IF NOT EXISTS lockdown_distributed_rate_limits (
        limiter_key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lockdown_ratelimit_exp ON lockdown_distributed_rate_limits(expires_at);
      CREATE TABLE IF NOT EXISTS lockdown_institutional_policies (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        hash TEXT NOT NULL,
        policy_json TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        change_summary TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE(policy_id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_lockdown_inst_pol_lookup ON lockdown_institutional_policies(policy_id, version);

      CREATE TABLE IF NOT EXISTS lockdown_session_policy_bindings (
        session_id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        hash TEXT NOT NULL,
        policy_json TEXT NOT NULL,
        bound_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lockdown_sess_binding_exam ON lockdown_session_policy_bindings(exam_id);

      CREATE TABLE IF NOT EXISTS lockdown_audit_log (
        id TEXT PRIMARY KEY,
        sequence_num INTEGER NOT NULL UNIQUE,
        timestamp INTEGER NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        target_student_id TEXT,
        target_exam_id TEXT,
        outcome TEXT NOT NULL,
        error_code TEXT,
        reason TEXT,
        client_ip TEXT,
        previous_entry_hash TEXT NOT NULL,
        entry_hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lockdown_audit_exam ON lockdown_audit_log(target_exam_id);
      CREATE INDEX IF NOT EXISTS idx_lockdown_audit_seq ON lockdown_audit_log(sequence_num);

      CREATE TABLE IF NOT EXISTS lockdown_audit_checkpoints (
        checkpoint_id TEXT PRIMARY KEY,
        checkpoint_seq INTEGER NOT NULL UNIQUE,
        up_to_sequence_num INTEGER NOT NULL,
        checkpoint_hash TEXT NOT NULL,
        entry_count INTEGER NOT NULL,
        server_signature TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lockdown_chk_seq ON lockdown_audit_checkpoints(checkpoint_seq);

      CREATE TABLE IF NOT EXISTS lockdown_revoked_tokens (
        token_identifier TEXT PRIMARY KEY,
        revocation_type TEXT NOT NULL,
        revoked_at INTEGER NOT NULL,
        reason TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lockdown_replay_cache (
        replay_key TEXT PRIMARY KEY,
        replay_type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        context_id TEXT,
        consumed_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lockdown_replay_exp ON lockdown_replay_cache(expires_at);
      CREATE INDEX IF NOT EXISTS idx_lockdown_replay_type ON lockdown_replay_cache(replay_type);

      CREATE TABLE IF NOT EXISTS lockdown_revoked_sessions (
        session_id TEXT PRIMARY KEY,
        exam_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        revoked_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        revoked_at INTEGER NOT NULL,
        expires_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_lockdown_rev_sess_exam ON lockdown_revoked_sessions(exam_id);
      CREATE INDEX IF NOT EXISTS idx_lockdown_rev_sess_user ON lockdown_revoked_sessions(user_id);
    `);

    // Helper for safe backward-compatible column and index migrations
    const safeAlterTable = async (sql: string, description: string) => {
      try {
        await this.db!.exec(sql);
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (
          msg.includes('duplicate column name') ||
          msg.includes('already exists')
        ) {
          // Expected idempotent behavior when column or index already exists.
          return;
        }
        console.warn(`[ClassroomDatabase] Warning during schema upgrade (${description}):`, msg);
        throw err;
      }
    };

    // Run migrations for columns that might not exist in older databases
    await safeAlterTable('ALTER TABLE classroom_members ADD COLUMN suspended_at INTEGER', 'add suspended_at to classroom_members');
    await safeAlterTable('ALTER TABLE classroom_members ADD COLUMN suspension_expires_at INTEGER', 'add suspension_expires_at to classroom_members');
    await safeAlterTable('ALTER TABLE classroom_members ADD COLUMN removed_at INTEGER', 'add removed_at to classroom_members');
    await safeAlterTable('ALTER TABLE submissions ADD COLUMN project_id TEXT', 'add project_id to submissions');
    await safeAlterTable('ALTER TABLE submissions ADD COLUMN snapshot_json TEXT', 'add snapshot_json to submissions');
    await safeAlterTable('ALTER TABLE users ADD COLUMN professional_email TEXT', 'add professional_email to users');
    await safeAlterTable('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_professional_email ON users(professional_email)', 'create index on users.professional_email');
    await safeAlterTable('ALTER TABLE classroom_members ADD COLUMN user_professional_email TEXT', 'add user_professional_email to classroom_members');
    await safeAlterTable('ALTER TABLE exams ADD COLUMN seb_config_key TEXT', 'add seb_config_key to exams');
    await safeAlterTable('ALTER TABLE exams ADD COLUMN seb_browser_exam_key TEXT', 'add seb_browser_exam_key to exams');
    await safeAlterTable('ALTER TABLE exams ADD COLUMN seb_quit_password TEXT', 'add seb_quit_password to exams');
    await safeAlterTable('ALTER TABLE exams ADD COLUMN seb_quit_password_hash TEXT', 'add seb_quit_password_hash to exams');
    await safeAlterTable('ALTER TABLE exams ADD COLUMN seb_allow_reload INTEGER NOT NULL DEFAULT 0', 'add seb_allow_reload to exams');
    await safeAlterTable('ALTER TABLE exams ADD COLUMN seb_show_reload_warning INTEGER NOT NULL DEFAULT 1', 'add seb_show_reload_warning to exams');
    await safeAlterTable("ALTER TABLE exam_sections ADD COLUMN instructions TEXT NOT NULL DEFAULT ''", 'add instructions to exam_sections');
    await safeAlterTable('ALTER TABLE exam_sections ADD COLUMN is_mandatory INTEGER NOT NULL DEFAULT 1', 'add is_mandatory to exam_sections');
    await safeAlterTable('ALTER TABLE exam_sections ADD COLUMN time_limit_minutes INTEGER NOT NULL DEFAULT 0', 'add time_limit_minutes to exam_sections');
    await safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN question_order_json TEXT', 'add question_order_json to exam_sessions');
    await safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN option_order_json TEXT', 'add option_order_json to exam_sessions');
    await safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN current_section_id TEXT', 'add current_section_id to exam_sessions');
    await safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN traversed_route_json TEXT', 'add traversed_route_json to exam_sessions');
    await safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN last_heartbeat_at INTEGER', 'add last_heartbeat_at to exam_sessions');
    await safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN submission_receipt TEXT', 'add submission_receipt to exam_sessions');
    await safeAlterTable('ALTER TABLE exam_sessions ADD COLUMN answer_digest TEXT', 'add answer_digest to exam_sessions');
    await safeAlterTable("ALTER TABLE lockdown_audit_checkpoints ADD COLUMN key_id TEXT NOT NULL DEFAULT 'k1'", 'add key_id to lockdown_audit_checkpoints');

    // Backfill any legacy plaintext quit passwords into hashes and null out plaintext
    try {
      const legacyPasswordRows = (await this.db!.prepare(
        'SELECT id, seb_quit_password, seb_quit_password_hash FROM exams WHERE seb_quit_password IS NOT NULL'
      ).all()) as Array<{ id: string; seb_quit_password: string | null; seb_quit_password_hash: string | null }>;

      for (const row of legacyPasswordRows || []) {
        if (!row.id) continue;
        const plaintext = (row.seb_quit_password || '').trim();
        if (plaintext.length > 0) {
          // If hash already exists, preserve it; otherwise compute SHA-256
          const hash = row.seb_quit_password_hash || crypto.createHash('sha256').update(plaintext).digest('hex').toLowerCase();
          await this.db!.prepare(
            'UPDATE exams SET seb_quit_password_hash = ?, seb_quit_password = NULL WHERE id = ?'
          ).run(hash, row.id);
        } else {
          // Empty or whitespace password: clear plaintext
          await this.db!.prepare('UPDATE exams SET seb_quit_password = NULL WHERE id = ?').run(row.id);
        }
      }
    } catch (err: any) {
      const sanitizedMsg = String(err?.message || err).replace(/([a-f0-9]{32,64})/gi, '[REDACTED_HASH]');
      console.error('[ClassroomDatabase] FATAL: SEB password backfill migration failed:', sanitizedMsg);
      throw new Error('[ClassroomDatabase] SEB password migration failure: ' + sanitizedMsg);
    }

    // Verify complete examination schema integrity before proceeding
    await this.verifyExaminationSchema();
  }

  /**
   * Fail-hard verification of the examination schema to guarantee all Phase 3
   * tables and columns are present before application usage.
   */
  public async verifyExaminationSchema(): Promise<{ valid: boolean; missing: string[] }> {
    const db = await this.getDb();
    const missing: string[] = [];

    const checkColumns = async (table: string, requiredColumns: string[]) => {
      try {
        const rows = (await db.prepare(`PRAGMA table_info(${table})`).all()) as Array<{ name: string }>;
        const existing = new Set((rows || []).map((r) => r.name));
        for (const col of requiredColumns) {
          if (!existing.has(col)) {
            missing.push(`${table}.${col}`);
          }
        }
      } catch (err: any) {
        missing.push(`${table} (table missing or query failed: ${err?.message || err})`);
      }
    };

    await checkColumns('exams', [
      'seb_config_key',
      'seb_browser_exam_key',
      'seb_quit_password',
      'seb_quit_password_hash',
      'seb_allow_reload',
      'seb_show_reload_warning'
    ]);

    await checkColumns('exam_sections', [
      'instructions',
      'is_mandatory',
      'time_limit_minutes'
    ]);

    await checkColumns('exam_sessions', [
      'question_order_json',
      'option_order_json',
      'current_section_id',
      'traversed_route_json',
      'last_heartbeat_at'
    ]);

    try {
      const branchingRows = (await db.prepare('PRAGMA table_info(exam_branching_rules)').all()) as Array<{ name: string }>;
      if (!branchingRows || branchingRows.length === 0) {
        missing.push('exam_branching_rules (table does not exist)');
      }
    } catch (err: any) {
      missing.push(`exam_branching_rules (${err?.message || err})`);
    }

    if (missing.length > 0) {
      const errMsg = `[ClassroomDatabase] Examination schema verification FAILED. Missing columns or tables: ${missing.join(', ')}`;
      console.error(errMsg);
      throw new Error(errMsg);
    }

    return { valid: true, missing: [] };
  }

  // --- USERS ---
  async createUser(user: User): Promise<User> {
    if (!(await this.getDb())) return user;
    const profEmail =
      (user as any).professional_email ||
      (user as any).professionalEmail ||
      ClassroomIdentity.generateProfessionalIdentity(user);

    const stmt = (await this.getDb()).prepare(`
      INSERT OR REPLACE INTO users (id, name, email, role, avatar, status, created_at, updated_at, cortex_id, password_hash, professional_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await stmt.run(
      user.id,
      user.name,
      user.email,
      user.role,
      user.avatar || null,
      user.status || 'active',
      user.createdAt || Date.now(),
      user.updatedAt || Date.now(),
      (user as any).cortex_id || null,
      (user as any).password_hash || null,
      profEmail
    );
    (user as any).professional_email = profEmail;
    (user as any).professionalEmail = profEmail;
    return user;
  }


  // --- AUTH & SESSIONS ---

  async getUserByEmail(email: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!row) return null;
    return this.getUser(row.id);
  }

  async getUserByProfessionalEmail(professionalEmail: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    const norm = (professionalEmail || '').toLowerCase().trim();
    const row = await (await this.getDb()).prepare('SELECT * FROM users WHERE LOWER(professional_email) = ?').get(norm) as any;
    if (!row) return null;
    return this.getUser(row.id);
  }

  async getUserByCortexId(cortexId: string): Promise<any | null> {
    if (!(await this.getDb())) return null;
    const row = await (await this.getDb()).prepare('SELECT * FROM users WHERE cortex_id = ?').get(cortexId) as any;
    if (!row) return null;
    return this.getUser(row.id);
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
    const profEmail =
      row.professional_email ||
      (row.cortex_id && row.cortex_id.includes('@') ? row.cortex_id : ClassroomIdentity.generateProfessionalIdentity(row));

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      professional_email: profEmail,
      professionalEmail: profEmail,
      role: row.role as any,
      avatar: row.avatar || undefined,
      status: row.status as any,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cortex_id: row.cortex_id,
      cortexId: row.cortex_id,
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
      classroom.coursecode || (classroom as any).code || '',
      classroom.academicYear || '',
      classroom.section || '',
      classroom.teacherId,
      classroom.teacherName || '',
      classroom.image || null,
      classroom.joincode || classroom.joinCode || (classroom as any).code || '',
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

  async getClassroomByJoinCode(joincode: string): Promise<Classroom | null> {
    if (!(await this.getDb())) return null;
    const norm = joincode.trim().toUpperCase();
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
      coursecode: row.course_code,
      academicYear: row.academic_year,
      section: row.section,
      teacherId: row.teacher_id,
      teacherName: row.teacher_name,
      image: row.image || undefined,
      joincode: row.join_code,
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

  
  async listMembershipsForUser(userId: string): Promise<ClassroomMember[]> {
    const db = await this.getDb();
    if (!db) return [];
    const rows = await db.prepare('SELECT * FROM classroom_members WHERE user_id = ?').all(userId) as any[];
    return rows.map(r => this.mapMember(r));
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
      userEmail: row.user_professional_email || row.user_email,
      userProfessionalEmail: row.user_professional_email,
      professionalEmail: row.user_professional_email,
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
      userId: r.user_id,
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
          AND (recipient_type = 'class' OR recipient_type = 'announcement' OR sender_id = ? OR recipient_id = ?)
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
      asg.startercode || '',
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
      starterCode: row.starter_code || row.startercode || '',
      startercode: row.starter_code || row.startercode || '',
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
      testCases: (JSON.parse(row.test_cases_json || '[]') as any[]).map((tc, idx) => ({
        id: tc.id || `tc_${idx + 1}`,
        name: tc.name || `Test Case ${idx + 1}`,
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        visibility: (tc.visibility === 'hidden' || tc.isHidden === true || tc.hidden === true) ? 'hidden' : 'public',
        isHidden: Boolean(tc.visibility === 'hidden' || tc.isHidden === true || tc.hidden === true),
        weight: typeof tc.weight === 'number' ? tc.weight : 25,
        timeoutMs: tc.timeoutMs || 2000,
        memoryLimitMb: tc.memoryLimitMb || 128,
      })),
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

  
  async listSubmissionsForUser(studentId: string): Promise<Submission[]> {
    const db = await this.getDb();
    if (!db) return [];
    const rows = await db.prepare('SELECT * FROM submissions WHERE student_id = ?').all(studentId) as any[];
    return rows.map(r => this.mapSubmission(r));
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
      session.startercode,
      session.sharedcode,
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
      startercode: row.starter_code,
      sharedcode: row.shared_code,
      isBroadcastingCode: Boolean(row.is_broadcasting_code),
      startedAt: row.started_at,
      endedAt: row.ended_at || undefined,
      durationMinutes: row.ended_at ? Math.round((row.ended_at - row.started_at) / 60000) : Math.round((Date.now() - row.started_at) / 60000),
      status: row.status as any,
      activeStudentCount: 0, // Real count comes from WebSocket Durable Object
    };
  }

  async updateLiveSessionCode(sessionId: string, sharedcode: string, isBroadcasting: boolean) {
    if (!(await this.getDb())) return;
    await (await this.getDb()).prepare('UPDATE live_sessions SET shared_code = ?, is_broadcasting_code = ? WHERE id = ?').run(sharedcode, isBroadcasting ? 1 : 0, sessionId);
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

    
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const trendCounts = new Array(12).fill(0);
    for (const sub of submissions) {
      const daysAgo = Math.floor((now - sub.submittedAt) / DAY);
      if (daysAgo >= 0 && daysAgo < 12) {
        trendCounts[11 - daysAgo]++;
      }
    }
    const maxCount = Math.max(...trendCounts, 1);
    const recentTrend = trendCounts.map(count => Math.round((count / maxCount) * 100));

    return {
      classroomId,
      totalStudents: members.length,
      activeToday: members.filter((m) => m.isOnline).length, // Real presence from DB
      averageScore: classAverageScore,
      completionRate: submissionRate,
      assignmentsCount: assignments.length,
      recentTrend,
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

  async createPlatformFeedback(f: any): Promise<void> {
    const db = await this.getDb();
    if (!db) return;
    await db.prepare('INSERT INTO platform_feedback (id, type, title, description, email, severity, category, diagnostics_json, status, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(f.id, f.type, f.title, f.description, f.email, f.severity, f.category, f.diagnostics ? JSON.stringify(f.diagnostics) : null, f.status, f.createdAt, f.userId);
  }

  async listPlatformFeedback(): Promise<any[]> {
    const db = await this.getDb();
    if (!db) return [];
    const rows = await db.prepare('SELECT * FROM platform_feedback ORDER BY created_at DESC LIMIT 1000').all() as any[];
    return rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      email: r.email,
      severity: r.severity,
      category: r.category,
      diagnostics: r.diagnostics_json ? JSON.parse(r.diagnostics_json) : undefined,
      status: r.status,
      createdAt: r.created_at
    }));
  }

  // Whiteboard State Persistence
  async getWhiteboard(classroomId: string, sessionId: string = 'default') {
    const db = await this.getDb();
    const row: any = await db.prepare(
      `SELECT * FROM classroom_whiteboards WHERE classroom_id = ? AND session_id = ?`
    ).get(classroomId.toUpperCase().trim(), sessionId);
    if (!row) return null;
    return {
      id: row.id,
      classroomId: row.classroom_id,
      sessionId: row.session_id,
      pages: JSON.parse(row.pages_json),
      activePageIndex: row.active_page_index,
      version: row.version,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async saveWhiteboard(
    classroomId: string,
    sessionId: string = 'default',
    pages: any[],
    activePageIndex: number = 0,
    updatedBy: string = 'system',
    expectedVersion?: number
  ) {
    const db = await this.getDb();
    const normClassroomId = classroomId.toUpperCase().trim();
    const now = Date.now();
    const pagesJson = JSON.stringify(pages);

    const existing: any = await db.prepare(
      `SELECT id, version FROM classroom_whiteboards WHERE classroom_id = ? AND session_id = ?`
    ).get(normClassroomId, sessionId);

    if (existing) {
      if (typeof expectedVersion === 'number' && expectedVersion > 0 && existing.version !== expectedVersion) {
        throw new Error('VERSION_CONFLICT: Whiteboard has been updated by another session. Please reload.');
      }
      const newVersion = (existing.version || 1) + 1;
      await db.prepare(
        `UPDATE classroom_whiteboards SET pages_json = ?, active_page_index = ?, version = ?, updated_by = ?, updated_at = ? WHERE id = ?`
      ).run(pagesJson, activePageIndex, newVersion, updatedBy, now, existing.id);

      return {
        id: existing.id,
        classroomId: normClassroomId,
        sessionId,
        pages,
        activePageIndex,
        version: newVersion,
        updatedBy,
        updatedAt: now,
      };
    } else {
      const id = 'wb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await db.prepare(
        `INSERT INTO classroom_whiteboards (id, classroom_id, session_id, pages_json, active_page_index, version, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, normClassroomId, sessionId, pagesJson, activePageIndex, 1, updatedBy, now, now);

      return {
        id,
        classroomId: normClassroomId,
        sessionId,
        pages,
        activePageIndex,
        version: 1,
        updatedBy,
        updatedAt: now,
      };
    }
  }

  // Presentation State Persistence
  async getPresentation(classroomId: string, sessionId: string = 'default') {
    const db = await this.getDb();
    const row: any = await db.prepare(
      `SELECT * FROM classroom_presentations WHERE classroom_id = ? AND session_id = ?`
    ).get(classroomId.toUpperCase().trim(), sessionId);
    if (!row) return null;
    return {
      id: row.id,
      classroomId: row.classroom_id,
      sessionId: row.session_id,
      deck: JSON.parse(row.deck_json),
      activeSlideIndex: row.active_slide_index,
      isPresenting: Boolean(row.is_presenting),
      version: row.version,
      updatedBy: row.updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async savePresentation(
    classroomId: string,
    sessionId: string = 'default',
    deck: any,
    activeSlideIndex: number = 0,
    isPresenting: boolean = false,
    updatedBy: string = 'system',
    expectedVersion?: number
  ) {
    const db = await this.getDb();
    const normClassroomId = classroomId.toUpperCase().trim();
    const now = Date.now();
    const deckJson = JSON.stringify(deck);

    const existing: any = await db.prepare(
      `SELECT id, version FROM classroom_presentations WHERE classroom_id = ? AND session_id = ?`
    ).get(normClassroomId, sessionId);

    if (existing) {
      if (typeof expectedVersion === 'number' && expectedVersion > 0 && existing.version !== expectedVersion) {
        throw new Error('VERSION_CONFLICT: Presentation has been modified by another session. Please reload.');
      }
      const newVersion = (existing.version || 1) + 1;
      await db.prepare(
        `UPDATE classroom_presentations SET deck_json = ?, active_slide_index = ?, is_presenting = ?, version = ?, updated_by = ?, updated_at = ? WHERE id = ?`
      ).run(deckJson, activeSlideIndex, isPresenting ? 1 : 0, newVersion, updatedBy, now, existing.id);

      return {
        id: existing.id,
        classroomId: normClassroomId,
        sessionId,
        deck,
        activeSlideIndex,
        isPresenting,
        version: newVersion,
        updatedBy,
        updatedAt: now,
      };
    } else {
      const id = 'pres_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      await db.prepare(
        `INSERT INTO classroom_presentations (id, classroom_id, session_id, deck_json, active_slide_index, is_presenting, version, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, normClassroomId, sessionId, deckJson, activeSlideIndex, isPresenting ? 1 : 0, 1, updatedBy, now, now);

      return {
        id,
        classroomId: normClassroomId,
        sessionId,
        deck,
        activeSlideIndex,
        isPresenting,
        version: 1,
        updatedBy,
        updatedAt: now,
      };
    }
  }

  async updateUserProfessionalEmail(userId: string, profEmail: string): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    await db.prepare('UPDATE users SET professional_email = ?, updated_at = ? WHERE id = ?').run(profEmail.toLowerCase().trim(), now, userId);
    try {
      await db.prepare('UPDATE classroom_members SET user_professional_email = ? WHERE user_id = ?').run(profEmail.toLowerCase().trim(), userId);
    } catch (_) {}
  }

  async migrateProfessionalIdentities(): Promise<{
    totalInventoried: number;
    migratedCount: number;
    alreadyMigratedCount: number;
    failures: Array<{ id: string; error: string }>;
    records: Array<{ id: string; name: string; authEmail: string; professionalEmail: string; status: string }>;
  }> {
    const db = await this.getDb();
    const users = await db.prepare('SELECT id, name, email, cortex_id, professional_email FROM users ORDER BY created_at ASC').all();
    const existingClaims = new Map<string, string>();

    // First register all existing professional_email values to prevent collisions
    for (const u of users) {
      if (u.professional_email && u.professional_email.trim()) {
        existingClaims.set(u.professional_email.toLowerCase().trim(), u.id);
      }
    }

    let migratedCount = 0;
    let alreadyMigratedCount = 0;
    const failures: Array<{ id: string; error: string }> = [];
    const records: Array<{ id: string; name: string; authEmail: string; professionalEmail: string; status: string }> = [];

    for (const u of users) {
      try {
        if (u.professional_email && u.professional_email.trim()) {
          alreadyMigratedCount++;
          records.push({
            id: u.id,
            name: u.name,
            authEmail: u.email,
            professionalEmail: u.professional_email,
            status: 'already_migrated',
          });
          continue;
        }

        const generated = ClassroomIdentity.generateProfessionalIdentity(u, existingClaims);
        await db.prepare('UPDATE users SET professional_email = ?, updated_at = ? WHERE id = ?').run(generated, Date.now(), u.id);

        try {
          await db.prepare('UPDATE classroom_members SET user_professional_email = ? WHERE user_id = ?').run(generated, u.id);
        } catch (_) {}

        migratedCount++;
        records.push({
          id: u.id,
          name: u.name,
          authEmail: u.email,
          professionalEmail: generated,
          status: 'migrated',
        });
      } catch (err: any) {
        failures.push({ id: u.id, error: err?.message || 'Migration error' });
      }
    }

    return {
      totalInventoried: users.length,
      migratedCount,
      alreadyMigratedCount,
      failures,
      records,
    };
  }

  // --- Project Teams & Formation Studio Methods ---

  async getTeamSettings(classroomId: string): Promise<ClassroomTeamSettings> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    const row: any = await db.prepare(
      'SELECT * FROM classroom_team_settings WHERE classroom_id = ?'
    ).get(cid);

    if (row) {
      return {
        classroomId: row.classroom_id,
        formationMode: row.formation_mode,
        joiningPolicy: row.joining_policy,
        minTeamSize: row.min_team_size,
        maxTeamSize: row.max_team_size,
        allowMultipleTeams: Boolean(row.allow_multiple_teams),
        membershipLocked: Boolean(row.membership_locked),
        themePolicy: row.theme_policy,
        creationDeadline: row.creation_deadline,
        joiningDeadline: row.joining_deadline,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }

    const now = Date.now();
    const defaultSettings: ClassroomTeamSettings = {
      classroomId: cid,
      formationMode: 'teacher_controlled',
      joiningPolicy: 'direct',
      minTeamSize: 2,
      maxTeamSize: 5,
      allowMultipleTeams: false,
      membershipLocked: false,
      themePolicy: 'teacher_controlled',
      creationDeadline: null,
      joiningDeadline: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await db.prepare(`
        INSERT OR IGNORE INTO classroom_team_settings
        (classroom_id, formation_mode, joining_policy, min_team_size, max_team_size, allow_multiple_teams, membership_locked, theme_policy, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cid,
        defaultSettings.formationMode,
        defaultSettings.joiningPolicy,
        defaultSettings.minTeamSize,
        defaultSettings.maxTeamSize,
        defaultSettings.allowMultipleTeams ? 1 : 0,
        defaultSettings.membershipLocked ? 1 : 0,
        defaultSettings.themePolicy,
        now,
        now
      );
    } catch (_) {}

    return defaultSettings;
  }

  async updateTeamSettings(classroomId: string, updates: Partial<ClassroomTeamSettings>): Promise<ClassroomTeamSettings> {
    const current = await this.getTeamSettings(classroomId);
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    const now = Date.now();

    const merged: ClassroomTeamSettings = {
      ...current,
      ...updates,
      updatedAt: now,
    };

    await db.prepare(`
      INSERT INTO classroom_team_settings
      (classroom_id, formation_mode, joining_policy, min_team_size, max_team_size, allow_multiple_teams, membership_locked, theme_policy, creation_deadline, joining_deadline, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(classroom_id) DO UPDATE SET
        formation_mode = excluded.formation_mode,
        joining_policy = excluded.joining_policy,
        min_team_size = excluded.min_team_size,
        max_team_size = excluded.max_team_size,
        allow_multiple_teams = excluded.allow_multiple_teams,
        membership_locked = excluded.membership_locked,
        theme_policy = excluded.theme_policy,
        creation_deadline = excluded.creation_deadline,
        joining_deadline = excluded.joining_deadline,
        updated_at = excluded.updated_at
    `).run(
      cid,
      merged.formationMode,
      merged.joiningPolicy,
      merged.minTeamSize,
      merged.maxTeamSize,
      merged.allowMultipleTeams ? 1 : 0,
      merged.membershipLocked ? 1 : 0,
      merged.themePolicy,
      merged.creationDeadline ?? null,
      merged.joiningDeadline ?? null,
      merged.createdAt,
      now
    );

    return merged;
  }

  async createTeam(team: {
    id?: string;
    classroomId: string;
    name: string;
    projectTitle: string;
    description?: string;
    createdBy: string;
    status?: ProjectTeamStatus;
    themePreset?: ThemePresetId;
  }): Promise<ProjectTeam> {
    const db = await this.getDb();
    const now = Date.now();
    const teamId = team.id || `team_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cid = team.classroomId.toUpperCase().trim();
    const name = team.name.trim();
    const title = (team.projectTitle || name).trim();
    const desc = (team.description || '').trim();
    const status = team.status || 'forming';
    const theme = team.themePreset || 'cortex_signature';

    await db.prepare(`
      INSERT INTO project_teams
      (id, classroom_id, name, project_title, description, created_by, status, theme_preset, is_locked, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(teamId, cid, name, title, desc, team.createdBy, status, theme, now, now);

    return {
      id: teamId,
      classroomId: cid,
      name,
      projectTitle: title,
      description: desc,
      createdBy: team.createdBy,
      status,
      themePreset: theme,
      isLocked: false,
      createdAt: now,
      updatedAt: now,
      members: [],
      memberCount: 0,
    };
  }

  async getTeam(teamId: string): Promise<ProjectTeam | null> {
    const db = await this.getDb();
    const row: any = await db.prepare('SELECT * FROM project_teams WHERE id = ?').get(teamId);
    if (!row) return null;

    const members = await this.listTeamMembers(teamId);

    return {
      id: row.id,
      classroomId: row.classroom_id,
      name: row.name,
      projectTitle: row.project_title,
      description: row.description,
      createdBy: row.created_by,
      status: row.status,
      themePreset: row.theme_preset,
      proposedThemePreset: row.proposed_theme_preset,
      isLocked: Boolean(row.is_locked),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      members,
      memberCount: members.length,
    };
  }

  async listTeams(classroomId: string, status?: string): Promise<ProjectTeam[]> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    let sql = 'SELECT * FROM project_teams WHERE classroom_id = ?';
    const params: any[] = [cid];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at ASC';

    const rows: any = await db.prepare(sql).all(...params);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    const teams: ProjectTeam[] = [];
    for (const r of results) {
      const members = await this.listTeamMembers(r.id);
      teams.push({
        id: r.id,
        classroomId: r.classroom_id,
        name: r.name,
        projectTitle: r.project_title,
        description: r.description,
        createdBy: r.created_by,
        status: r.status,
        themePreset: r.theme_preset,
        proposedThemePreset: r.proposed_theme_preset,
        isLocked: Boolean(r.is_locked),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        members,
        memberCount: members.length,
      });
    }

    return teams;
  }

  async updateTeam(teamId: string, updates: Partial<ProjectTeam>): Promise<ProjectTeam | null> {
    const db = await this.getDb();
    const current = await this.getTeam(teamId);
    if (!current) return null;

    const now = Date.now();
    const name = updates.name !== undefined ? updates.name.trim() : current.name;
    const projectTitle = updates.projectTitle !== undefined ? updates.projectTitle.trim() : current.projectTitle;
    const description = updates.description !== undefined ? updates.description.trim() : current.description;
    const status = updates.status !== undefined ? updates.status : current.status;
    const themePreset = updates.themePreset !== undefined ? updates.themePreset : current.themePreset;
    const proposedThemePreset = updates.proposedThemePreset !== undefined ? updates.proposedThemePreset : current.proposedThemePreset;
    const isLocked = updates.isLocked !== undefined ? (updates.isLocked ? 1 : 0) : (current.isLocked ? 1 : 0);

    await db.prepare(`
      UPDATE project_teams
      SET name = ?, project_title = ?, description = ?, status = ?, theme_preset = ?, proposed_theme_preset = ?, is_locked = ?, updated_at = ?
      WHERE id = ?
    `).run(name, projectTitle, description, status, themePreset, proposedThemePreset ?? null, isLocked, now, teamId);

    return await this.getTeam(teamId);
  }

  async deleteTeam(teamId: string): Promise<void> {
    const db = await this.getDb();
    await db.prepare('DELETE FROM project_teams WHERE id = ?').run(teamId);
  }

  async archiveTeam(teamId: string): Promise<void> {
    const db = await this.getDb();
    await db.prepare('UPDATE project_teams SET status = "archived", updated_at = ? WHERE id = ?').run(Date.now(), teamId);
  }

  async addTeamMember(member: {
    teamId: string;
    userId: string;
    teamRole?: TeamMemberRole;
    membershipStatus?: TeamMemberStatus;
    assignedBy: string;
  }): Promise<ProjectTeamMember> {
    const db = await this.getDb();
    const now = Date.now();
    const memId = `ptm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const role = member.teamRole || 'member';
    const status = member.membershipStatus || 'active';

    await db.prepare(`
      INSERT INTO project_team_members
      (id, team_id, user_id, team_role, membership_status, assigned_by, joined_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(team_id, user_id) DO UPDATE SET
        team_role = excluded.team_role,
        membership_status = excluded.membership_status,
        assigned_by = excluded.assigned_by,
        updated_at = excluded.updated_at
    `).run(memId, member.teamId, member.userId, role, status, member.assignedBy, now, now);

    return {
      id: memId,
      teamId: member.teamId,
      userId: member.userId,
      teamRole: role,
      membershipStatus: status,
      assignedBy: member.assignedBy,
      joinedAt: now,
      updatedAt: now,
    };
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    const db = await this.getDb();
    await db.prepare('DELETE FROM project_team_members WHERE team_id = ? AND user_id = ?').run(teamId, userId);
  }

  async updateTeamMemberRole(teamId: string, userId: string, role: TeamMemberRole): Promise<void> {
    const db = await this.getDb();
    await db.prepare(`
      UPDATE project_team_members
      SET team_role = ?, updated_at = ?
      WHERE team_id = ? AND user_id = ?
    `).run(role, Date.now(), teamId, userId);
  }

  async listTeamMembers(teamId: string): Promise<ProjectTeamMember[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare(`
      SELECT ptm.*, u.name as user_name, u.email as user_email, u.cortex_id
      FROM project_team_members ptm
      JOIN users u ON ptm.user_id = u.id
      WHERE ptm.team_id = ? AND ptm.membership_status = 'active'
      ORDER BY ptm.team_role DESC, ptm.joined_at ASC
    `).all(teamId);

    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);
    return results.map((r: any) => ({
      id: r.id,
      teamId: r.team_id,
      userId: r.user_id,
      userName: r.user_name,
      userEmail: (r.cortex_id && r.cortex_id.includes('@')) ? r.cortex_id : (r.user_email || ''),
      cortexId: r.cortex_id,
      teamRole: r.team_role,
      membershipStatus: r.membership_status,
      assignedBy: r.assigned_by,
      joinedAt: r.joined_at,
      updatedAt: r.updated_at,
    }));
  }

  async listTeamsForUser(classroomId: string, userId: string): Promise<ProjectTeam[]> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    const rows: any = await db.prepare(`
      SELECT pt.*
      FROM project_teams pt
      JOIN project_team_members ptm ON pt.id = ptm.team_id
      WHERE pt.classroom_id = ? AND ptm.user_id = ? AND ptm.membership_status = 'active'
      ORDER BY pt.created_at ASC
    `).all(cid, userId);

    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);
    const teams: ProjectTeam[] = [];
    for (const r of results) {
      const members = await this.listTeamMembers(r.id);
      teams.push({
        id: r.id,
        classroomId: r.classroom_id,
        name: r.name,
        projectTitle: r.project_title,
        description: r.description,
        createdBy: r.created_by,
        status: r.status,
        themePreset: r.theme_preset,
        proposedThemePreset: r.proposed_theme_preset,
        isLocked: Boolean(r.is_locked),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        members,
        memberCount: members.length,
      });
    }
    return teams;
  }

  async recordProjectActivity(record: {
    classroomId: string;
    teamId: string;
    actorUserId: string;
    actorName: string;
    eventType: string;
    details?: Record<string, any>;
  }): Promise<ProjectActivityRecord> {
    const db = await this.getDb();
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const details = record.details || {};
    const detailsJson = JSON.stringify(details);

    await db.prepare(`
      INSERT INTO project_activity_records
      (id, classroom_id, team_id, actor_user_id, actor_name, event_type, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, record.classroomId.toUpperCase().trim(), record.teamId, record.actorUserId, record.actorName, record.eventType, detailsJson, now);

    return {
      id,
      classroomId: record.classroomId,
      teamId: record.teamId,
      actorUserId: record.actorUserId,
      actorName: record.actorName,
      eventType: record.eventType,
      details,
      createdAt: now,
    };
  }

  async listProjectActivity(classroomId: string, teamId?: string, limit: number = 50): Promise<ProjectActivityRecord[]> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    let sql = 'SELECT * FROM project_activity_records WHERE classroom_id = ?';
    const params: any[] = [cid];
    if (teamId) {
      sql += ' AND team_id = ?';
      params.push(teamId);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows: any = await db.prepare(sql).all(...params);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => {
      let details: any = {};
      try { details = JSON.parse(r.details_json); } catch (_) {}
      return {
        id: r.id,
        classroomId: r.classroom_id,
        teamId: r.team_id,
        actorUserId: r.actor_user_id,
        actorName: r.actor_name,
        eventType: r.event_type,
        details,
        createdAt: r.created_at,
      };
    });
  }

  async getUnassignedStudents(classroomId: string): Promise<any[]> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();

    const members = await this.listMembers(cid);
    const students = members.filter(m => m.role === 'student' && m.status === 'active');

    const assignedRows: any = await db.prepare(`
      SELECT DISTINCT ptm.user_id
      FROM project_team_members ptm
      JOIN project_teams pt ON ptm.team_id = pt.id
      WHERE pt.classroom_id = ? AND ptm.membership_status = 'active'
    `).all(cid);

    const assignedResults = (assignedRows && assignedRows.results) ? assignedRows.results : (Array.isArray(assignedRows) ? assignedRows : []);
    const assignedSet = new Set(assignedResults.map((r: any) => r.user_id));

    return students.filter(s => !assignedSet.has(s.userId)).map(s => ({
      userId: s.userId,
      name: s.userName,
      email: s.userEmail,
      role: s.role,
      isOnline: s.isOnline,
    }));
  }


  // --- ONLINE EXAMINATION SYSTEM (PHASE 1) ---

  async createExam(exam: Partial<Exam>): Promise<Exam> {
    const db = await this.getDb();
    const id = exam.id || `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const cid = (exam.classroomId || '').toUpperCase().trim();
    const assignedJson = JSON.stringify(exam.assignedStudentIds || []);

    // Secure quit password hashing (never store plaintext)
    const quitHash = exam.sebQuitPassword && exam.sebQuitPassword.trim()
      ? crypto.createHash('sha256').update(exam.sebQuitPassword.trim()).digest('hex').toLowerCase()
      : (exam.sebQuitPasswordHash || null);

    await db.prepare(`
      INSERT INTO exams (
        id, classroom_id, title, description, duration_minutes,
        start_time, end_time, total_marks, passing_marks, attempts_allowed,
        security_level, status, shuffle_questions, shuffle_options, show_results_immediately,
        assigned_student_ids_json, created_by,
        seb_config_key, seb_browser_exam_key, seb_quit_password, seb_quit_password_hash, seb_allow_reload, seb_show_reload_warning,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      cid,
      exam.title || 'Untitled Examination',
      exam.description || '',
      exam.durationMinutes || 60,
      exam.startTime || now,
      exam.endTime || (now + 3600000),
      exam.totalMarks || 100,
      exam.passingMarks || 40,
      exam.attemptsAllowed || 1,
      exam.securityLevel || 'standard',
      exam.status || 'draft',
      exam.shuffleQuestions ? 1 : 0,
      exam.shuffleOptions ? 1 : 0,
      exam.showResultsImmediately ? 1 : 0,
      assignedJson,
      exam.createdBy || 'system',
      exam.sebConfigKey || null,
      exam.sebBrowserExamKey || null,
      null, // Never store plaintext quit password
      quitHash,
      exam.sebAllowReload ? 1 : 0,
      exam.sebShowReloadWarning !== false ? 1 : 0,
      now,
      now
    );

    return {
      id,
      classroomId: cid,
      title: exam.title || 'Untitled Examination',
      description: exam.description || '',
      durationMinutes: exam.durationMinutes || 60,
      startTime: exam.startTime || now,
      endTime: exam.endTime || (now + 3600000),
      totalMarks: exam.totalMarks || 100,
      passingMarks: exam.passingMarks || 40,
      attemptsAllowed: exam.attemptsAllowed || 1,
      securityLevel: (exam.securityLevel as any) || 'standard',
      sebConfigKey: exam.sebConfigKey || null,
      sebBrowserExamKey: exam.sebBrowserExamKey || null,
      sebQuitPassword: null,
      sebQuitPasswordHash: quitHash,
      hasQuitPassword: !!quitHash,
      sebAllowReload: !!exam.sebAllowReload,
      sebShowReloadWarning: exam.sebShowReloadWarning !== false,
      status: (exam.status as any) || 'draft',
      shuffleQuestions: !!exam.shuffleQuestions,
      shuffleOptions: !!exam.shuffleOptions,
      showResultsImmediately: !!exam.showResultsImmediately,
      assignedStudentIds: exam.assignedStudentIds || [],
      createdBy: exam.createdBy || 'system',
      createdAt: now,
      updatedAt: now,
      questionCount: 0,
    };
  }

  async getExam(examId: string): Promise<Exam | null> {
    const db = await this.getDb();
    const row: any = await db.prepare('SELECT * FROM exams WHERE id = ?').get(examId);
    if (!row) return null;

    let assignedStudentIds: string[] = [];
    try { assignedStudentIds = JSON.parse(row.assigned_student_ids_json || '[]'); } catch (_) {}

    const sections = await this.listExamSections(examId);
    const questions = await this.listExamQuestions(examId);
    const branchingRules = await this.listExamBranchingRules(examId);

    return {
      id: row.id,
      classroomId: row.classroom_id,
      title: row.title,
      description: row.description,
      durationMinutes: row.duration_minutes,
      startTime: row.start_time,
      endTime: row.end_time,
      totalMarks: row.total_marks,
      passingMarks: row.passing_marks,
      attemptsAllowed: row.attempts_allowed,
      securityLevel: row.security_level,
      sebConfigKey: row.seb_config_key || null,
      sebBrowserExamKey: row.seb_browser_exam_key || null,
      sebQuitPassword: null,
      sebQuitPasswordHash: row.seb_quit_password_hash || (row.seb_quit_password ? crypto.createHash('sha256').update(row.seb_quit_password).digest('hex').toLowerCase() : null),
      hasQuitPassword: !!row.seb_quit_password_hash || !!row.seb_quit_password,
      sebAllowReload: row.seb_allow_reload === 1,
      sebShowReloadWarning: row.seb_show_reload_warning === 1,
      status: row.status,
      shuffleQuestions: row.shuffle_questions === 1,
      shuffleOptions: row.shuffle_options === 1,
      showResultsImmediately: row.show_results_immediately === 1,
      assignedStudentIds,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sections,
      questions,
      branchingRules,
      questionCount: questions.length,
    };
  }

  async listExams(classroomId: string, statusFilter?: string): Promise<Exam[]> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    let sql = 'SELECT * FROM exams WHERE classroom_id = ?';
    const params: any[] = [cid];
    if (statusFilter) {
      sql += ' AND status = ?';
      params.push(statusFilter);
    }
    sql += ' ORDER BY created_at DESC';

    const rows: any = await db.prepare(sql).all(...params);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    const exams: Exam[] = [];
    for (const row of results) {
      let assignedStudentIds: string[] = [];
      try { assignedStudentIds = JSON.parse(row.assigned_student_ids_json || '[]'); } catch (_) {}

      const qCountRow: any = await db.prepare('SELECT COUNT(*) as count FROM exam_questions WHERE exam_id = ?').get(row.id);
      const questionCount = qCountRow?.count || 0;

      exams.push({
        id: row.id,
        classroomId: row.classroom_id,
        title: row.title,
        description: row.description,
        durationMinutes: row.duration_minutes,
        startTime: row.start_time,
        endTime: row.end_time,
        totalMarks: row.total_marks,
        passingMarks: row.passing_marks,
        attemptsAllowed: row.attempts_allowed,
        securityLevel: row.security_level,
        hasQuitPassword: !!row.seb_quit_password_hash || !!row.seb_quit_password,
        status: row.status,
        shuffleQuestions: row.shuffle_questions === 1,
        shuffleOptions: row.shuffle_options === 1,
        showResultsImmediately: row.show_results_immediately === 1,
        assignedStudentIds,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        questionCount,
      });
    }

    return exams;
  }

  async updateExam(examId: string, updates: Partial<Exam>): Promise<Exam | null> {
    const db = await this.getDb();
    const existing = await this.getExam(examId);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.durationMinutes !== undefined) { fields.push('duration_minutes = ?'); values.push(updates.durationMinutes); }
    if (updates.startTime !== undefined) { fields.push('start_time = ?'); values.push(updates.startTime); }
    if (updates.endTime !== undefined) { fields.push('end_time = ?'); values.push(updates.endTime); }
    if (updates.totalMarks !== undefined) { fields.push('total_marks = ?'); values.push(updates.totalMarks); }
    if (updates.passingMarks !== undefined) { fields.push('passing_marks = ?'); values.push(updates.passingMarks); }
    if (updates.attemptsAllowed !== undefined) { fields.push('attempts_allowed = ?'); values.push(updates.attemptsAllowed); }
    if (updates.securityLevel !== undefined) { fields.push('security_level = ?'); values.push(updates.securityLevel); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.shuffleQuestions !== undefined) { fields.push('shuffle_questions = ?'); values.push(updates.shuffleQuestions ? 1 : 0); }
    if (updates.shuffleOptions !== undefined) { fields.push('shuffle_options = ?'); values.push(updates.shuffleOptions ? 1 : 0); }
    if (updates.showResultsImmediately !== undefined) { fields.push('show_results_immediately = ?'); values.push(updates.showResultsImmediately ? 1 : 0); }
    if (updates.assignedStudentIds !== undefined) {
      fields.push('assigned_student_ids_json = ?');
      values.push(JSON.stringify(updates.assignedStudentIds));
    }
    if (updates.sebConfigKey !== undefined) { fields.push('seb_config_key = ?'); values.push(updates.sebConfigKey); }
    if (updates.sebBrowserExamKey !== undefined) { fields.push('seb_browser_exam_key = ?'); values.push(updates.sebBrowserExamKey); }
    if (updates.sebQuitPassword !== undefined) {
      if (updates.sebQuitPassword && updates.sebQuitPassword.trim()) {
        const hash = crypto.createHash('sha256').update(updates.sebQuitPassword.trim()).digest('hex').toLowerCase();
        fields.push('seb_quit_password_hash = ?');
        values.push(hash);
        fields.push('seb_quit_password = NULL');
      } else {
        fields.push('seb_quit_password_hash = NULL');
        fields.push('seb_quit_password = NULL');
      }
    }
    if (updates.sebAllowReload !== undefined) { fields.push('seb_allow_reload = ?'); values.push(updates.sebAllowReload ? 1 : 0); }
    if (updates.sebShowReloadWarning !== undefined) { fields.push('seb_show_reload_warning = ?'); values.push(updates.sebShowReloadWarning ? 1 : 0); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(examId);

    await db.prepare(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return await this.getExam(examId);
  }

  async deleteExam(examId: string): Promise<boolean> {
    const db = await this.getDb();
    await db.prepare('DELETE FROM exams WHERE id = ?').run(examId);
    return true;
  }

  // --- SECTIONS ---
  async createExamSection(section: Partial<ExamSection>): Promise<ExamSection> {
    const db = await this.getDb();
    const id = section.id || `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await db.prepare(`
      INSERT INTO exam_sections (id, exam_id, title, description, instructions, is_mandatory, time_limit_minutes, sort_order, section_marks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      section.examId,
      section.title || 'Section',
      section.description || '',
      section.instructions || '',
      section.isMandatory !== false ? 1 : 0,
      section.timeLimitMinutes || 0,
      section.sortOrder || 0,
      section.sectionMarks || 0
    );

    return {
      id,
      examId: section.examId!,
      title: section.title || 'Section',
      description: section.description || '',
      instructions: section.instructions || '',
      isMandatory: section.isMandatory !== false,
      timeLimitMinutes: section.timeLimitMinutes || 0,
      sortOrder: section.sortOrder || 0,
      sectionMarks: section.sectionMarks || 0,
    };
  }

  async getExamSection(sectionId: string): Promise<ExamSection | null> {
    const db = await this.getDb();
    const r: any = await db.prepare('SELECT * FROM exam_sections WHERE id = ?').get(sectionId);
    if (!r) return null;
    return {
      id: r.id,
      examId: r.exam_id,
      title: r.title,
      description: r.description,
      instructions: r.instructions || '',
      isMandatory: r.is_mandatory !== 0,
      timeLimitMinutes: r.time_limit_minutes || 0,
      sortOrder: r.sort_order,
      sectionMarks: r.section_marks,
    };
  }

  async listExamSections(examId: string): Promise<ExamSection[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare('SELECT * FROM exam_sections WHERE exam_id = ? ORDER BY sort_order ASC').all(examId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);
    return results.map((r: any) => ({
      id: r.id,
      examId: r.exam_id,
      title: r.title,
      description: r.description,
      instructions: r.instructions || '',
      isMandatory: r.is_mandatory !== 0,
      timeLimitMinutes: r.time_limit_minutes || 0,
      sortOrder: r.sort_order,
      sectionMarks: r.section_marks,
    }));
  }

  async updateExamSection(sectionId: string, updates: Partial<ExamSection>): Promise<ExamSection | null> {
    const db = await this.getDb();
    const existing = await this.getExamSection(sectionId);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.instructions !== undefined) { fields.push('instructions = ?'); values.push(updates.instructions); }
    if (updates.isMandatory !== undefined) { fields.push('is_mandatory = ?'); values.push(updates.isMandatory ? 1 : 0); }
    if (updates.timeLimitMinutes !== undefined) { fields.push('time_limit_minutes = ?'); values.push(updates.timeLimitMinutes); }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }
    if (updates.sectionMarks !== undefined) { fields.push('section_marks = ?'); values.push(updates.sectionMarks); }

    if (fields.length > 0) {
      values.push(sectionId);
      await db.prepare(`UPDATE exam_sections SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return await this.getExamSection(sectionId);
  }

  async reorderExamSections(examId: string, orderedSectionIds: string[]): Promise<void> {
    const db = await this.getDb();
    for (let i = 0; i < orderedSectionIds.length; i++) {
      await db.prepare('UPDATE exam_sections SET sort_order = ? WHERE id = ? AND exam_id = ?').run(i, orderedSectionIds[i], examId);
    }
  }

  async deleteExamSection(sectionId: string): Promise<boolean> {
    const db = await this.getDb();
    // Do not silently discard questions: reassign questions in this section to section_id = NULL
    await db.prepare('UPDATE exam_questions SET section_id = NULL WHERE section_id = ?').run(sectionId);
    await db.prepare('DELETE FROM exam_sections WHERE id = ?').run(sectionId);
    return true;
  }

  // --- QUESTIONS ---
  async createExamQuestion(q: Partial<ExamQuestion>): Promise<ExamQuestion> {
    const db = await this.getDb();
    const id = q.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const optionsJson = JSON.stringify(q.options || []);
    const correctAnswerJson = JSON.stringify(q.correctAnswer || {});
    const testCasesJson = JSON.stringify(q.testCases || []);

    await db.prepare(`
      INSERT INTO exam_questions (
        id, exam_id, section_id, question_type, prompt_text,
        prompt_media_url, options_json, correct_answer_json, test_cases_json,
        initial_code, language, points, negative_marks, numerical_tolerance,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      q.examId,
      q.sectionId || null,
      q.questionType || 'mcq_single',
      q.promptText || '',
      q.promptMediaUrl || null,
      optionsJson,
      correctAnswerJson,
      testCasesJson,
      q.initialCode || null,
      q.language || null,
      q.points !== undefined ? q.points : 1.0,
      q.negativeMarks || 0.0,
      q.numericalTolerance || 0.0,
      q.sortOrder || 0,
      now,
      now
    );

    return (await this.getExamQuestion(id))!;
  }

  async getExamQuestion(questionId: string): Promise<ExamQuestion | null> {
    const db = await this.getDb();
    const r: any = await db.prepare('SELECT * FROM exam_questions WHERE id = ?').get(questionId);
    if (!r) return null;

    let options: any[] = [];
    let correctAnswer: any = {};
    let testCases: any[] = [];
    try { options = JSON.parse(r.options_json || '[]'); } catch (_) {}
    try { correctAnswer = JSON.parse(r.correct_answer_json || '{}'); } catch (_) {}
    try { testCases = JSON.parse(r.test_cases_json || '[]'); } catch (_) {}

    return {
      id: r.id,
      examId: r.exam_id,
      sectionId: r.section_id,
      questionType: r.question_type,
      promptText: r.prompt_text,
      promptMediaUrl: r.prompt_media_url,
      options,
      correctAnswer,
      testCases,
      initialCode: r.initial_code,
      language: r.language,
      points: r.points,
      negativeMarks: r.negative_marks,
      numericalTolerance: r.numerical_tolerance,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async listExamQuestions(examId: string): Promise<ExamQuestion[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY sort_order ASC, created_at ASC').all(examId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => {
      let options: any[] = [];
      let correctAnswer: any = {};
      let testCases: any[] = [];
      try { options = JSON.parse(r.options_json || '[]'); } catch (_) {}
      try { correctAnswer = JSON.parse(r.correct_answer_json || '{}'); } catch (_) {}
      try { testCases = JSON.parse(r.test_cases_json || '[]'); } catch (_) {}

      return {
        id: r.id,
        examId: r.exam_id,
        sectionId: r.section_id,
        questionType: r.question_type,
        promptText: r.prompt_text,
        promptMediaUrl: r.prompt_media_url,
        options,
        correctAnswer,
        testCases,
        initialCode: r.initial_code,
        language: r.language,
        points: r.points,
        negativeMarks: r.negative_marks,
        numericalTolerance: r.numerical_tolerance,
        sortOrder: r.sort_order,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  async updateExamQuestion(questionId: string, updates: Partial<ExamQuestion>): Promise<ExamQuestion | null> {
    const db = await this.getDb();
    const existing = await this.getExamQuestion(questionId);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.sectionId !== undefined) { fields.push('section_id = ?'); values.push(updates.sectionId); }
    if (updates.questionType !== undefined) { fields.push('question_type = ?'); values.push(updates.questionType); }
    if (updates.promptText !== undefined) { fields.push('prompt_text = ?'); values.push(updates.promptText); }
    if (updates.promptMediaUrl !== undefined) { fields.push('prompt_media_url = ?'); values.push(updates.promptMediaUrl); }
    if (updates.options !== undefined) { fields.push('options_json = ?'); values.push(JSON.stringify(updates.options)); }
    if (updates.correctAnswer !== undefined) { fields.push('correct_answer_json = ?'); values.push(JSON.stringify(updates.correctAnswer)); }
    if (updates.testCases !== undefined) { fields.push('test_cases_json = ?'); values.push(JSON.stringify(updates.testCases)); }
    if (updates.initialCode !== undefined) { fields.push('initial_code = ?'); values.push(updates.initialCode); }
    if (updates.language !== undefined) { fields.push('language = ?'); values.push(updates.language); }
    if (updates.points !== undefined) { fields.push('points = ?'); values.push(updates.points); }
    if (updates.negativeMarks !== undefined) { fields.push('negative_marks = ?'); values.push(updates.negativeMarks); }
    if (updates.numericalTolerance !== undefined) { fields.push('numerical_tolerance = ?'); values.push(updates.numericalTolerance); }
    if (updates.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(updates.sortOrder); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(questionId);

    await db.prepare(`UPDATE exam_questions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return await this.getExamQuestion(questionId);
  }

  async deleteExamQuestion(questionId: string): Promise<boolean> {
    const db = await this.getDb();
    await db.prepare('DELETE FROM exam_questions WHERE id = ?').run(questionId);
    return true;
  }

  async reorderExamQuestions(examId: string, orderedQuestionIds: string[]): Promise<void> {
    const db = await this.getDb();
    for (let i = 0; i < orderedQuestionIds.length; i++) {
      await db.prepare('UPDATE exam_questions SET sort_order = ? WHERE id = ? AND exam_id = ?').run(i, orderedQuestionIds[i], examId);
    }
  }

  // --- SESSIONS ---
  async createExamSession(session: Partial<ExamSession>): Promise<ExamSession> {
    const db = await this.getDb();
    const id = session.id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    await db.prepare(`
      INSERT INTO exam_sessions (
        id, exam_id, user_id, attempt_number, status,
        started_at, expires_at, submitted_at, auto_score, manual_score,
        final_score, is_published, teacher_feedback,
        question_order_json, option_order_json, current_section_id, traversed_route_json, last_heartbeat_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      session.examId,
      session.userId,
      session.attemptNumber || 1,
      session.status || 'in_progress',
      session.startedAt || now,
      session.expiresAt || (now + 3600000),
      session.submittedAt || null,
      session.autoScore || 0,
      session.manualScore || null,
      session.finalScore || null,
      session.isPublished ? 1 : 0,
      session.teacherFeedback || '',
      session.questionOrder ? JSON.stringify(session.questionOrder) : null,
      session.optionOrder ? JSON.stringify(session.optionOrder) : null,
      session.currentSectionId || null,
      session.traversedRoute ? JSON.stringify(session.traversedRoute) : null,
      session.lastHeartbeatAt || now,
      now,
      now
    );

    return (await this.getExamSession(id))!;
  }

  async getExamSession(sessionId: string): Promise<ExamSession | null> {
    const db = await this.getDb();
    const r: any = await db.prepare(`
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM exam_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(sessionId);
    if (!r) return null;

    let questionOrder: string[] | undefined = undefined;
    if (r.question_order_json) {
      try { questionOrder = JSON.parse(r.question_order_json); } catch (_) {}
    }
    let optionOrder: Record<string, string[]> | undefined = undefined;
    if (r.option_order_json) {
      try { optionOrder = JSON.parse(r.option_order_json); } catch (_) {}
    }
    let traversedRoute: string[] | undefined = undefined;
    if (r.traversed_route_json) {
      try { traversedRoute = JSON.parse(r.traversed_route_json); } catch (_) {}
    }

    return {
      id: r.id,
      examId: r.exam_id,
      userId: r.user_id,
      userName: r.user_name || undefined,
      userEmail: r.user_email || undefined,
      attemptNumber: r.attempt_number,
      status: r.status,
      startedAt: r.started_at,
      expiresAt: r.expires_at,
      submittedAt: r.submitted_at,
      submissionReceipt: r.submission_receipt || undefined,
      answerDigest: r.answer_digest || undefined,
      autoScore: r.auto_score,
      manualScore: r.manual_score,
      finalScore: r.final_score,
      isPublished: r.is_published === 1,
      teacherFeedback: r.teacher_feedback || '',
      questionOrder,
      optionOrder,
      currentSectionId: r.current_section_id || null,
      traversedRoute,
      lastHeartbeatAt: r.last_heartbeat_at || r.started_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async getUserExamSessions(examId: string, userId: string): Promise<ExamSession[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare(`
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM exam_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.exam_id = ? AND s.user_id = ?
      ORDER BY s.attempt_number DESC
    `).all(examId, userId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => {
      let questionOrder: string[] | undefined = undefined;
      if (r.question_order_json) {
        try { questionOrder = JSON.parse(r.question_order_json); } catch (_) {}
      }
      let optionOrder: Record<string, string[]> | undefined = undefined;
      if (r.option_order_json) {
        try { optionOrder = JSON.parse(r.option_order_json); } catch (_) {}
      }
      let traversedRoute: string[] | undefined = undefined;
      if (r.traversed_route_json) {
        try { traversedRoute = JSON.parse(r.traversed_route_json); } catch (_) {}
      }

      return {
        id: r.id,
        examId: r.exam_id,
        userId: r.user_id,
        userName: r.user_name || undefined,
        userEmail: r.user_email || undefined,
        attemptNumber: r.attempt_number,
        status: r.status,
        startedAt: r.started_at,
        expiresAt: r.expires_at,
        submittedAt: r.submitted_at,
      submissionReceipt: r.submission_receipt || undefined,
      answerDigest: r.answer_digest || undefined,
        autoScore: r.auto_score,
        manualScore: r.manual_score,
        finalScore: r.final_score,
        isPublished: r.is_published === 1,
        teacherFeedback: r.teacher_feedback || '',
        questionOrder,
        optionOrder,
        currentSectionId: r.current_section_id || null,
        traversedRoute,
        lastHeartbeatAt: r.last_heartbeat_at || r.started_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  async listExamSessions(examId: string): Promise<ExamSession[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare(`
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM exam_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.exam_id = ?
      ORDER BY s.created_at DESC
    `).all(examId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => {
      let questionOrder: string[] | undefined = undefined;
      if (r.question_order_json) {
        try { questionOrder = JSON.parse(r.question_order_json); } catch (_) {}
      }
      let optionOrder: Record<string, string[]> | undefined = undefined;
      if (r.option_order_json) {
        try { optionOrder = JSON.parse(r.option_order_json); } catch (_) {}
      }
      let traversedRoute: string[] | undefined = undefined;
      if (r.traversed_route_json) {
        try { traversedRoute = JSON.parse(r.traversed_route_json); } catch (_) {}
      }

      return {
        id: r.id,
        examId: r.exam_id,
        userId: r.user_id,
        userName: r.user_name || undefined,
        userEmail: r.user_email || undefined,
        attemptNumber: r.attempt_number,
        status: r.status,
        startedAt: r.started_at,
        expiresAt: r.expires_at,
        submittedAt: r.submitted_at,
      submissionReceipt: r.submission_receipt || undefined,
      answerDigest: r.answer_digest || undefined,
        autoScore: r.auto_score,
        manualScore: r.manual_score,
        finalScore: r.final_score,
        isPublished: r.is_published === 1,
        teacherFeedback: r.teacher_feedback || '',
        questionOrder,
        optionOrder,
        currentSectionId: r.current_section_id || null,
        traversedRoute,
        lastHeartbeatAt: r.last_heartbeat_at || r.started_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  async updateExamSession(sessionId: string, updates: Partial<ExamSession>, expectedStatus?: ExamSessionStatus): Promise<ExamSession | null> {
    const db = await this.getDb();
    const existing = await this.getExamSession(sessionId);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.startedAt !== undefined) { fields.push('started_at = ?'); values.push(updates.startedAt); }
    if (updates.expiresAt !== undefined) { fields.push('expires_at = ?'); values.push(updates.expiresAt); }
    if (updates.submittedAt !== undefined) { fields.push('submitted_at = ?'); values.push(updates.submittedAt); }
    if (updates.submissionReceipt !== undefined) { fields.push('submission_receipt = ?'); values.push(updates.submissionReceipt); }
    if (updates.answerDigest !== undefined) { fields.push('answer_digest = ?'); values.push(updates.answerDigest); }
    if (updates.autoScore !== undefined) { fields.push('auto_score = ?'); values.push(updates.autoScore); }
    if (updates.manualScore !== undefined) { fields.push('manual_score = ?'); values.push(updates.manualScore); }
    if (updates.finalScore !== undefined) { fields.push('final_score = ?'); values.push(updates.finalScore); }
    if (updates.isPublished !== undefined) { fields.push('is_published = ?'); values.push(updates.isPublished ? 1 : 0); }
    if (updates.teacherFeedback !== undefined) { fields.push('teacher_feedback = ?'); values.push(updates.teacherFeedback); }
    if (updates.questionOrder !== undefined) { fields.push('question_order_json = ?'); values.push(JSON.stringify(updates.questionOrder)); }
    if (updates.optionOrder !== undefined) { fields.push('option_order_json = ?'); values.push(JSON.stringify(updates.optionOrder)); }
    if (updates.currentSectionId !== undefined) { fields.push('current_section_id = ?'); values.push(updates.currentSectionId); }
    if (updates.traversedRoute !== undefined) { fields.push('traversed_route_json = ?'); values.push(JSON.stringify(updates.traversedRoute)); }
    if (updates.lastHeartbeatAt !== undefined) { fields.push('last_heartbeat_at = ?'); values.push(updates.lastHeartbeatAt); }

    fields.push('updated_at = ?');
    values.push(now);

    if (expectedStatus) {
      values.push(sessionId);
      values.push(expectedStatus);
      const res: any = await db.prepare(`UPDATE exam_sessions SET ${fields.join(', ')} WHERE id = ? AND status = ?`).run(...values);
      if (res && typeof res.changes === 'number' && res.changes === 0) {
        return null;
      }
    } else {
      values.push(sessionId);
      await db.prepare(`UPDATE exam_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return await this.getExamSession(sessionId);
  }

  async touchSessionHeartbeat(sessionId: string, timestamp: number): Promise<void> {
    const db = await this.getDb();
    await db.prepare('UPDATE exam_sessions SET last_heartbeat_at = ?, updated_at = ? WHERE id = ?').run(timestamp, timestamp, sessionId);
  }

  /**
   * Retrieves authoritative concurrent active candidate session count for an examination.
   * Filters out:
   * 1. Non-active sessions (submitted, terminated, completed)
   * 2. Expired sessions where server-authoritative expires_at <= current timestamp
   * 3. Abandoned / ghost sessions where last_heartbeat_at is older than heartbeat cutoff window
   *    (or null and started_at is older than heartbeat cutoff window).
   */
  async getAuthoritativeActiveSessionCount(examId: string, heartbeatWindowSeconds: number = 120): Promise<number> {
    const db = await this.getDb();
    const now = Date.now();
    const heartbeatCutoff = now - (heartbeatWindowSeconds * 1000);
    const row = await db.prepare(`
      SELECT COUNT(*) as activeCount
      FROM exam_sessions
      WHERE exam_id = ?
        AND status = 'in_progress'
        AND (expires_at > ? OR expires_at IS NULL)
        AND (
          (last_heartbeat_at IS NOT NULL AND last_heartbeat_at > ?) OR
          (last_heartbeat_at IS NULL AND started_at > ?)
        )
    `).get(examId, now, heartbeatCutoff, heartbeatCutoff) as any;
    return row?.activeCount || 0;
  }

  // --- RESPONSES ---
  async saveExamResponse(resp: Partial<ExamQuestionResponse>): Promise<ExamQuestionResponse> {
    const db = await this.getDb();
    const id = resp.id || `resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const serverNow = Date.now();
    // Enforce server-authoritative timestamp boundary: client timestamp cannot be in the future
    let updatedAt = serverNow;
    if (typeof resp.updatedAt === 'number') {
      updatedAt = Math.min(resp.updatedAt, serverNow);
    }
    const responseJson = JSON.stringify(resp.response !== undefined ? resp.response : {});

    const runResult: any = await db.prepare(`
      INSERT INTO exam_question_responses (
        id, session_id, question_id, response_json, earned_points,
        grading_status, grader_notes, flagged_for_review, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, question_id) DO UPDATE SET
        response_json = excluded.response_json,
        earned_points = excluded.earned_points,
        grading_status = excluded.grading_status,
        grader_notes = excluded.grader_notes,
        flagged_for_review = excluded.flagged_for_review,
        updated_at = excluded.updated_at
      WHERE excluded.updated_at >= exam_question_responses.updated_at
    `).run(
      id,
      resp.sessionId,
      resp.questionId,
      responseJson,
      resp.earnedPoints || 0,
      resp.gradingStatus || 'pending',
      resp.graderNotes || '',
      resp.flaggedForReview ? 1 : 0,
      updatedAt
    );

    // If no row was inserted or updated, a newer response already exists in the database.
    // Fetch and return the authoritative stored record.
    if (runResult && runResult.changes === 0) {
      const existing: any = await db.prepare(
        'SELECT * FROM exam_question_responses WHERE session_id = ? AND question_id = ?'
      ).get(resp.sessionId, resp.questionId);
      if (existing) {
        let existingRespJson: any = {};
        try { existingRespJson = JSON.parse(existing.response_json || '{}'); } catch (_) {}
        return {
          id: existing.id,
          sessionId: existing.session_id,
          questionId: existing.question_id,
          response: existingRespJson,
          earnedPoints: existing.earned_points,
          gradingStatus: existing.grading_status,
          graderNotes: existing.grader_notes,
          flaggedForReview: existing.flagged_for_review === 1,
          updatedAt: existing.updated_at,
          staleRejected: true,
        };
      }
    }

    return {
      id,
      sessionId: resp.sessionId!,
      questionId: resp.questionId!,
      response: resp.response,
      earnedPoints: resp.earnedPoints || 0,
      gradingStatus: resp.gradingStatus || 'pending',
      graderNotes: resp.graderNotes || '',
      flaggedForReview: !!resp.flaggedForReview,
      updatedAt,
    };
  }

  async listExamResponses(sessionId: string): Promise<ExamQuestionResponse[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare('SELECT * FROM exam_question_responses WHERE session_id = ?').all(sessionId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => {
      let response: any = {};
      try { response = JSON.parse(r.response_json || '{}'); } catch (_) {}
      return {
        id: r.id,
        sessionId: r.session_id,
        questionId: r.question_id,
        response,
        earnedPoints: r.earned_points,
        gradingStatus: r.grading_status,
        graderNotes: r.grader_notes,
        flaggedForReview: r.flagged_for_review === 1,
        updatedAt: r.updated_at,
      };
    });
  }

  // --- INTEGRITY EVENTS ---
  async createExamIntegrityEvent(evt: Partial<ExamIntegrityEvent>): Promise<ExamIntegrityEvent> {
    const db = await this.getDb();
    const id = evt.id || `ievt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = evt.timestamp || Date.now();
    const detailsJson = JSON.stringify(evt.details || {});

    await db.prepare(`
      INSERT INTO exam_integrity_events (id, session_id, event_type, timestamp, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, evt.sessionId, evt.eventType, now, detailsJson);

    return {
      id,
      sessionId: evt.sessionId!,
      eventType: evt.eventType as any,
      timestamp: now,
      details: evt.details || {},
    };
  }

  async listExamIntegrityEvents(sessionId: string): Promise<ExamIntegrityEvent[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare('SELECT * FROM exam_integrity_events WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => {
      let details: any = {};
      try { details = JSON.parse(r.details_json || '{}'); } catch (_) {}
      return {
        id: r.id,
        sessionId: r.session_id,
        eventType: r.event_type,
        timestamp: r.timestamp,
        details,
      };
    });
  }

// --- QUESTION BANK (PHASE 2) ---
  async createQuestionBankItem(item: Partial<QuestionBankItem>): Promise<QuestionBankItem> {
    const db = await this.getDb();
    const id = item.id || `qb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const optionsJson = JSON.stringify(item.options || []);
    const correctAnswerJson = JSON.stringify(item.correctAnswer || {});
    const testCasesJson = JSON.stringify(item.testCases || []);
    const tagsJson = JSON.stringify(item.tags || []);

    await db.prepare(`
      INSERT INTO question_bank (
        id, teacher_id, classroom_id, subject, topic, difficulty,
        question_type, prompt_text, prompt_media_url, options_json,
        correct_answer_json, test_cases_json, initial_code, language,
        default_points, negative_marks, numerical_tolerance, tags_json,
        is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      item.teacherId,
      item.classroomId || null,
      item.subject || 'General',
      item.topic || 'General',
      item.difficulty || 'medium',
      item.questionType || 'mcq_single',
      item.promptText || '',
      item.promptMediaUrl || null,
      optionsJson,
      correctAnswerJson,
      testCasesJson,
      item.initialCode || null,
      item.language || null,
      item.defaultPoints !== undefined ? item.defaultPoints : 1.0,
      item.negativeMarks !== undefined ? item.negativeMarks : 0.0,
      item.numericalTolerance !== undefined ? item.numericalTolerance : 0.0,
      tagsJson,
      item.isArchived ? 1 : 0,
      now,
      now
    );

    return (await this.getQuestionBankItem(id))!;
  }

  async getQuestionBankItem(id: string): Promise<QuestionBankItem | null> {
    const db = await this.getDb();
    const r: any = await db.prepare('SELECT * FROM question_bank WHERE id = ?').get(id);
    if (!r) return null;

    let options: any[] = [];
    let correctAnswer: any = {};
    let testCases: any[] = [];
    let tags: string[] = [];

    try { options = JSON.parse(r.options_json || '[]'); } catch (_) {}
    try { correctAnswer = JSON.parse(r.correct_answer_json || '{}'); } catch (_) {}
    try { testCases = JSON.parse(r.test_cases_json || '[]'); } catch (_) {}
    try { tags = JSON.parse(r.tags_json || '[]'); } catch (_) {}

    return {
      id: r.id,
      teacherId: r.teacher_id,
      classroomId: r.classroom_id || null,
      subject: r.subject,
      topic: r.topic,
      difficulty: r.difficulty,
      questionType: r.question_type,
      promptText: r.prompt_text,
      promptMediaUrl: r.prompt_media_url || null,
      options,
      correctAnswer,
      testCases,
      initialCode: r.initial_code || null,
      language: r.language || null,
      defaultPoints: r.default_points,
      negativeMarks: r.negative_marks,
      numericalTolerance: r.numerical_tolerance,
      tags,
      isArchived: r.is_archived === 1,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async listQuestionBankItems(teacherId: string, filter?: QuestionBankFilter): Promise<QuestionBankItem[]> {
    const db = await this.getDb();
    const clauses: string[] = ['teacher_id = ?'];
    const params: any[] = [teacherId];

    if (filter) {
      if (!filter.includeArchived) {
        clauses.push('is_archived = 0');
      }
      if (filter.subject) {
        clauses.push('LOWER(subject) = LOWER(?)');
        params.push(filter.subject);
      }
      if (filter.topic) {
        clauses.push('LOWER(topic) = LOWER(?)');
        params.push(filter.topic);
      }
      if (filter.difficulty) {
        clauses.push('difficulty = ?');
        params.push(filter.difficulty);
      }
      if (filter.questionType) {
        clauses.push('question_type = ?');
        params.push(filter.questionType);
      }
      if (filter.search) {
        clauses.push('(LOWER(prompt_text) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?) OR LOWER(topic) LIKE LOWER(?))');
        const pattern = `%${filter.search}%`;
        params.push(pattern, pattern, pattern);
      }
    } else {
      clauses.push('is_archived = 0');
    }

    const sql = `SELECT * FROM question_bank WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`;
    const rows: any = await db.prepare(sql).all(...params);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    let items = results.map((r: any) => {
      let options: any[] = [];
      let correctAnswer: any = {};
      let testCases: any[] = [];
      let tags: string[] = [];

      try { options = JSON.parse(r.options_json || '[]'); } catch (_) {}
      try { correctAnswer = JSON.parse(r.correct_answer_json || '{}'); } catch (_) {}
      try { testCases = JSON.parse(r.test_cases_json || '[]'); } catch (_) {}
      try { tags = JSON.parse(r.tags_json || '[]'); } catch (_) {}

      return {
        id: r.id,
        teacherId: r.teacher_id,
        classroomId: r.classroom_id || null,
        subject: r.subject,
        topic: r.topic,
        difficulty: r.difficulty,
        questionType: r.question_type,
        promptText: r.prompt_text,
        promptMediaUrl: r.prompt_media_url || null,
        options,
        correctAnswer,
        testCases,
        initialCode: r.initial_code || null,
        language: r.language || null,
        defaultPoints: r.default_points,
        negativeMarks: r.negative_marks,
        numericalTolerance: r.numerical_tolerance,
        tags,
        isArchived: r.is_archived === 1,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });

    if (filter?.tag) {
      const lowerTag = filter.tag.toLowerCase();
      items = items.filter((i: any) => i.tags && i.tags.some((t: string) => t.toLowerCase() === lowerTag));
    }

    return items;
  }

  async updateQuestionBankItem(id: string, updates: Partial<QuestionBankItem>): Promise<QuestionBankItem | null> {
    const db = await this.getDb();
    const existing = await this.getQuestionBankItem(id);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.subject !== undefined) { fields.push('subject = ?'); values.push(updates.subject); }
    if (updates.topic !== undefined) { fields.push('topic = ?'); values.push(updates.topic); }
    if (updates.difficulty !== undefined) { fields.push('difficulty = ?'); values.push(updates.difficulty); }
    if (updates.questionType !== undefined) { fields.push('question_type = ?'); values.push(updates.questionType); }
    if (updates.promptText !== undefined) { fields.push('prompt_text = ?'); values.push(updates.promptText); }
    if (updates.promptMediaUrl !== undefined) { fields.push('prompt_media_url = ?'); values.push(updates.promptMediaUrl); }
    if (updates.options !== undefined) { fields.push('options_json = ?'); values.push(JSON.stringify(updates.options)); }
    if (updates.correctAnswer !== undefined) { fields.push('correct_answer_json = ?'); values.push(JSON.stringify(updates.correctAnswer)); }
    if (updates.testCases !== undefined) { fields.push('test_cases_json = ?'); values.push(JSON.stringify(updates.testCases)); }
    if (updates.initialCode !== undefined) { fields.push('initial_code = ?'); values.push(updates.initialCode); }
    if (updates.language !== undefined) { fields.push('language = ?'); values.push(updates.language); }
    if (updates.defaultPoints !== undefined) { fields.push('default_points = ?'); values.push(updates.defaultPoints); }
    if (updates.negativeMarks !== undefined) { fields.push('negative_marks = ?'); values.push(updates.negativeMarks); }
    if (updates.numericalTolerance !== undefined) { fields.push('numerical_tolerance = ?'); values.push(updates.numericalTolerance); }
    if (updates.tags !== undefined) { fields.push('tags_json = ?'); values.push(JSON.stringify(updates.tags)); }
    if (updates.isArchived !== undefined) { fields.push('is_archived = ?'); values.push(updates.isArchived ? 1 : 0); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    await db.prepare(`UPDATE question_bank SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return await this.getQuestionBankItem(id);
  }

  async deleteQuestionBankItem(id: string, hardDelete: boolean = false): Promise<boolean> {
    const db = await this.getDb();
    if (hardDelete) {
      await db.prepare('DELETE FROM question_bank WHERE id = ?').run(id);
    } else {
      await db.prepare('UPDATE question_bank SET is_archived = 1, updated_at = ? WHERE id = ?').run(Date.now(), id);
    }
    return true;
  }

  async duplicateQuestionBankItem(id: string, teacherId: string): Promise<QuestionBankItem | null> {
    const existing = await this.getQuestionBankItem(id);
    if (!existing) return null;

    return await this.createQuestionBankItem({
      teacherId,
      classroomId: existing.classroomId,
      subject: existing.subject,
      topic: existing.topic,
      difficulty: existing.difficulty,
      questionType: existing.questionType,
      promptText: `${existing.promptText} (Copy)`,
      promptMediaUrl: existing.promptMediaUrl,
      options: existing.options,
      correctAnswer: existing.correctAnswer,
      testCases: existing.testCases,
      initialCode: existing.initialCode,
      language: existing.language,
      defaultPoints: existing.defaultPoints,
      negativeMarks: existing.negativeMarks,
      numericalTolerance: existing.numericalTolerance,
      tags: [...existing.tags],
      isArchived: false,
    });
  }

  // --- IMMUTABLE QUESTION BANK IMPORT TO EXAM ---
  async importQuestionBankItemToExam(params: {
    bankQuestionId: string;
    examId: string;
    sectionId?: string;
    pointsOverride?: number;
    sortOrder?: number;
    teacherId?: string;
  }): Promise<ExamQuestion> {
    const bankItem = await this.getQuestionBankItem(params.bankQuestionId);
    if (!bankItem) {
      throw new Error(`Question bank item ${params.bankQuestionId} not found`);
    }

    if (params.teacherId && bankItem.teacherId !== params.teacherId) {
      throw new Error('Forbidden: You do not have permission to import this question bank item');
    }

    const points = typeof params.pointsOverride === 'number' ? params.pointsOverride : bankItem.defaultPoints;
    const existingExamQuestions = await this.listExamQuestions(params.examId);
    const order = typeof params.sortOrder === 'number' ? params.sortOrder : existingExamQuestions.length + 1;

    // Snapshot creation: copies all question data immutably into exam_questions
    const newExamQuestion = await this.createExamQuestion({
      examId: params.examId,
      sectionId: params.sectionId || null,
      questionType: bankItem.questionType,
      promptText: bankItem.promptText,
      promptMediaUrl: bankItem.promptMediaUrl,
      options: bankItem.options ? JSON.parse(JSON.stringify(bankItem.options)) : [],
      correctAnswer: bankItem.correctAnswer ? JSON.parse(JSON.stringify(bankItem.correctAnswer)) : {},
      testCases: bankItem.testCases ? JSON.parse(JSON.stringify(bankItem.testCases)) : [],
      initialCode: bankItem.initialCode,
      language: bankItem.language,
      points,
      negativeMarks: bankItem.negativeMarks,
      numericalTolerance: bankItem.numericalTolerance,
      sortOrder: order,
    });

    return newExamQuestion;
  }

  // --- CONDITIONAL BRANCHING RULES (PHASE 3) ---

  async createExamBranchingRule(rule: Partial<ExamBranchingRule>): Promise<ExamBranchingRule> {
    const db = await this.getDb();
    const id = rule.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    const allowedOps = ['equals', 'not_equals', 'selected_option'];
    const op = allowedOps.includes(rule.conditionOperator || '') ? rule.conditionOperator! : 'selected_option';

    await db.prepare(`
      INSERT INTO exam_branching_rules (
        id, exam_id, source_question_id, condition_operator, condition_value,
        destination_type, destination_id, default_destination_type, default_destination_id,
        priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      rule.examId,
      rule.sourceQuestionId,
      op,
      rule.conditionValue || '',
      rule.destinationType || 'section',
      rule.destinationId || null,
      rule.defaultDestinationType || 'section',
      rule.defaultDestinationId || null,
      rule.priority || 0,
      now,
      now
    );

    return (await this.getExamBranchingRule(id))!;
  }

  async getExamBranchingRule(id: string): Promise<ExamBranchingRule | null> {
    const db = await this.getDb();
    const r: any = await db.prepare('SELECT * FROM exam_branching_rules WHERE id = ?').get(id);
    if (!r) return null;
    return {
      id: r.id,
      examId: r.exam_id,
      sourceQuestionId: r.source_question_id,
      conditionOperator: r.condition_operator,
      conditionValue: r.condition_value,
      destinationType: r.destination_type,
      destinationId: r.destination_id || null,
      defaultDestinationType: r.default_destination_type,
      defaultDestinationId: r.default_destination_id || null,
      priority: r.priority,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async listExamBranchingRules(examId: string): Promise<ExamBranchingRule[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare('SELECT * FROM exam_branching_rules WHERE exam_id = ? ORDER BY priority ASC, created_at ASC').all(examId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);
    return results.map((r: any) => ({
      id: r.id,
      examId: r.exam_id,
      sourceQuestionId: r.source_question_id,
      conditionOperator: r.condition_operator,
      conditionValue: r.condition_value,
      destinationType: r.destination_type,
      destinationId: r.destination_id || null,
      defaultDestinationType: r.default_destination_type,
      defaultDestinationId: r.default_destination_id || null,
      priority: r.priority,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async updateExamBranchingRule(id: string, updates: Partial<ExamBranchingRule>): Promise<ExamBranchingRule | null> {
    const db = await this.getDb();
    const existing = await this.getExamBranchingRule(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    const now = Date.now();

    if (updates.sourceQuestionId !== undefined) { fields.push('source_question_id = ?'); values.push(updates.sourceQuestionId); }
    if (updates.conditionOperator !== undefined) {
      const allowedOps = ['equals', 'not_equals', 'selected_option'];
      if (allowedOps.includes(updates.conditionOperator)) {
        fields.push('condition_operator = ?');
        values.push(updates.conditionOperator);
      }
    }
    if (updates.conditionValue !== undefined) { fields.push('condition_value = ?'); values.push(updates.conditionValue); }
    if (updates.destinationType !== undefined) { fields.push('destination_type = ?'); values.push(updates.destinationType); }
    if (updates.destinationId !== undefined) { fields.push('destination_id = ?'); values.push(updates.destinationId); }
    if (updates.defaultDestinationType !== undefined) { fields.push('default_destination_type = ?'); values.push(updates.defaultDestinationType); }
    if (updates.defaultDestinationId !== undefined) { fields.push('default_destination_id = ?'); values.push(updates.defaultDestinationId); }
    if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);
      await db.prepare(`UPDATE exam_branching_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    return await this.getExamBranchingRule(id);
  }

  async deleteExamBranchingRule(id: string): Promise<boolean> {
    const db = await this.getDb();
    await db.prepare('DELETE FROM exam_branching_rules WHERE id = ?').run(id);
    return true;
  }

  async validateBranchingRules(examId: string): Promise<{ valid: boolean; errors: string[] }> {
    const db = await this.getDb();
    const rules = await this.listExamBranchingRules(examId);
    const questions = await this.listExamQuestions(examId);
    const sections = await this.listExamSections(examId);

    const questionIds = new Set(questions.map((q) => q.id));
    const sectionIds = new Set(sections.map((s) => s.id));
    const errors: string[] = [];

    // Adjacency graph for cycle detection: node -> Set of target nodes
    const graph = new Map<string, Set<string>>();

    // Map of section -> questions in that section
    const questionsBySection = new Map<string, string[]>();
    for (const q of questions) {
      if (q.sectionId) {
        const list = questionsBySection.get(q.sectionId) || [];
        list.push(q.id);
        questionsBySection.set(q.sectionId, list);
      }
    }

    // Connect sections to their member questions
    for (const [secId, qIds] of questionsBySection.entries()) {
      if (!graph.has(secId)) graph.set(secId, new Set());
      for (const qId of qIds) {
        graph.get(secId)!.add(qId);
      }
    }

    for (const rule of rules) {
      if (!questionIds.has(rule.sourceQuestionId)) {
        errors.push(`Branching rule ${rule.id} references non-existent source question ${rule.sourceQuestionId}`);
      }

      // Validate destination
      if (rule.destinationType === 'section' && rule.destinationId && !sectionIds.has(rule.destinationId)) {
        errors.push(`Branching rule ${rule.id} references non-existent destination section ${rule.destinationId}`);
      }
      if (rule.destinationType === 'question' && rule.destinationId && !questionIds.has(rule.destinationId)) {
        errors.push(`Branching rule ${rule.id} references non-existent destination question ${rule.destinationId}`);
      }

      // Validate default destination
      if (rule.defaultDestinationType === 'section' && rule.defaultDestinationId && !sectionIds.has(rule.defaultDestinationId)) {
        errors.push(`Branching rule ${rule.id} references non-existent default section ${rule.defaultDestinationId}`);
      }
      if (rule.defaultDestinationType === 'question' && rule.defaultDestinationId && !questionIds.has(rule.defaultDestinationId)) {
        errors.push(`Branching rule ${rule.id} references non-existent default question ${rule.defaultDestinationId}`);
      }

      // Add to graph for cycle detection
      const fromNode = rule.sourceQuestionId;
      if (!graph.has(fromNode)) graph.set(fromNode, new Set());

      if (rule.destinationId) {
        if (rule.destinationType === 'question') {
          graph.get(fromNode)!.add(rule.destinationId);
        } else if (rule.destinationType === 'section') {
          graph.get(fromNode)!.add(rule.destinationId);
          for (const qId of (questionsBySection.get(rule.destinationId) || [])) {
            graph.get(fromNode)!.add(qId);
          }
        }
      }

      if (rule.defaultDestinationId) {
        if (rule.defaultDestinationType === 'question') {
          graph.get(fromNode)!.add(rule.defaultDestinationId);
        } else if (rule.defaultDestinationType === 'section') {
          graph.get(fromNode)!.add(rule.defaultDestinationId);
          for (const qId of (questionsBySection.get(rule.defaultDestinationId) || [])) {
            graph.get(fromNode)!.add(qId);
          }
        }
      }
    }

    // Cycle detection via DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          errors.push(`Cycle detected in branching rules involving question ${neighbor}`);
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // --- LIVE TEACHER DASHBOARD (PHASE 3) ---

  async getExamLiveDashboardData(classroomId: string, examId: string): Promise<ExamLiveDashboardData> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    const exam = await this.getExam(examId);

    if (!exam || exam.classroomId !== cid) {
      throw new Error(`Examination ${examId} not found in classroom ${classroomId}`);
    }

    const now = Date.now();

    // 1. Fetch cohort students
    const memberRows: any = await db.prepare(`
      SELECT cm.user_id, u.name, u.email
      FROM classroom_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.classroom_id = ? AND cm.role = 'student'
      ORDER BY u.name ASC
    `).all(cid);
    const members = (memberRows && memberRows.results) ? memberRows.results : (Array.isArray(memberRows) ? memberRows : []);

    // Filter to assigned students if cohort assignment is configured
    let assignedStudents = members;
    if (exam.assignedStudentIds && exam.assignedStudentIds.length > 0) {
      const assignedSet = new Set(exam.assignedStudentIds);
      assignedStudents = members.filter((m: any) => assignedSet.has(m.user_id));
    }

    // 2. Fetch all sessions for this exam
    const sessions = await this.listExamSessions(examId);
    const sessionMap = new Map<string, ExamSession>();
    for (const s of sessions) {
      // If multiple attempts, pick the highest attempt
      if (!sessionMap.has(s.userId) || (sessionMap.get(s.userId)!.attemptNumber < s.attemptNumber)) {
        sessionMap.set(s.userId, s);
      }
    }

    // 3. Fetch integrity event counts per session
    const integrityCountsRow: any = await db.prepare(`
      SELECT session_id, COUNT(*) as count
      FROM exam_integrity_events
      GROUP BY session_id
    `).all();
    const integrityResults = (integrityCountsRow && integrityCountsRow.results) ? integrityCountsRow.results : (Array.isArray(integrityCountsRow) ? integrityCountsRow : []);
    const integrityMap = new Map<string, number>();
    for (const r of integrityResults) {
      integrityMap.set(r.session_id, r.count || 0);
    }

    // 4. Fetch flagged question counts per session
    const flaggedRows: any = await db.prepare(`
      SELECT session_id, COUNT(*) as count
      FROM exam_question_responses
      WHERE flagged_for_review = 1
      GROUP BY session_id
    `).all();
    const flaggedResults = (flaggedRows && flaggedRows.results) ? flaggedRows.results : (Array.isArray(flaggedRows) ? flaggedRows : []);
    const flaggedMap = new Map<string, number>();
    for (const r of flaggedResults) {
      flaggedMap.set(r.session_id, r.count || 0);
    }

    // 5. Construct candidate rows
    const candidates: CandidateSessionInfo[] = [];
    let notStartedCount = 0;
    let inProgressCount = 0;
    let submittedCount = 0;
    let expiredCount = 0;
    let requiresAttentionCount = 0;

    for (const student of assignedStudents) {
      const sess = sessionMap.get(student.user_id);
      if (!sess) {
        notStartedCount++;
        candidates.push({
          userId: student.user_id,
          name: student.name,
          email: student.email,
          sessionId: null,
          attemptNumber: 0,
          status: 'not_started',
          startedAt: null,
          submittedAt: null,
          remainingSeconds: 0,
          lastHeartbeatAt: null,
          connectionState: 'not_started',
          integrityEventCount: 0,
          flaggedQuestionCount: 0,
          autoScore: 0,
          manualScore: null,
          finalScore: null,
        });
      } else {
        const remainingSeconds = Math.max(0, Math.floor((sess.expiresAt - now) / 1000));
        const lastActivity = sess.lastHeartbeatAt || sess.updatedAt || sess.startedAt;
        const timeSinceActivity = now - lastActivity;

        let connState: 'active' | 'stale' | 'disconnected' | 'not_started' = 'disconnected';
        if (sess.status === 'in_progress') {
          if (timeSinceActivity < 60000) {
            connState = 'active';
          } else if (timeSinceActivity < 300000) {
            connState = 'stale';
          } else {
            connState = 'disconnected';
          }
        } else {
          connState = 'disconnected';
        }

        const eventsCount = integrityMap.get(sess.id) || 0;
        const flaggedCount = flaggedMap.get(sess.id) || 0;

        let displayStatus: 'not_started' | 'in_progress' | 'submitted' | 'timed_out' | 'cancelled' = sess.status as any;
        if (sess.status === 'in_progress' && remainingSeconds === 0) {
          displayStatus = 'timed_out';
          expiredCount++;
        } else if (sess.status === 'in_progress') {
          inProgressCount++;
        } else if (sess.status === 'submitted') {
          submittedCount++;
        } else if (sess.status === 'timed_out') {
          expiredCount++;
        }

        const needsAttention = eventsCount >= 2 || connState === 'stale' || (sess.status === 'submitted' && sess.manualScore === null);
        if (needsAttention) requiresAttentionCount++;

        candidates.push({
          userId: student.user_id,
          name: student.name,
          email: student.email,
          sessionId: sess.id,
          attemptNumber: sess.attemptNumber,
          status: displayStatus,
          startedAt: sess.startedAt,
          submittedAt: sess.submittedAt || null,
          remainingSeconds,
          lastHeartbeatAt: sess.lastHeartbeatAt || null,
          connectionState: connState,
          integrityEventCount: eventsCount,
          flaggedQuestionCount: flaggedCount,
          autoScore: sess.autoScore,
          manualScore: sess.manualScore,
          finalScore: sess.finalScore,
        });
      }
    }

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        securityLevel: exam.securityLevel,
        startTime: exam.startTime,
        endTime: exam.endTime,
        durationMinutes: exam.durationMinutes,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
      },
      metrics: {
        totalCandidates: assignedStudents.length,
        notStarted: notStartedCount,
        inProgress: inProgressCount,
        submitted: submittedCount,
        expired: expiredCount,
        requiresAttention: requiresAttentionCount,
        lastUpdated: now,
      },
      candidates,
    };
  }

  /**
   * Health and readiness diagnostics probe.
   */
  /**
   * Retrieves comprehensive server-authoritative analytics for an examination.
   */
  async getExamAnalytics(classroomId: string, examId: string): Promise<ExamAnalytics> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    const exam = await this.getExam(examId);
    if (!exam || exam.classroomId !== cid) {
      throw new Error(`Examination ${examId} not found in classroom ${classroomId}`);
    }

    // 1. Fetch cohort students
    const memberRows: any = await db.prepare(`
      SELECT cm.user_id, u.name, u.email
      FROM classroom_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.classroom_id = ? AND cm.role = 'student'
    `).all(cid);
    const members = (memberRows && memberRows.results) ? memberRows.results : (Array.isArray(memberRows) ? memberRows : []);

    let assignedStudents = members;
    if (exam.assignedStudentIds && exam.assignedStudentIds.length > 0) {
      const assignedSet = new Set(exam.assignedStudentIds);
      assignedStudents = members.filter((m: any) => assignedSet.has(m.user_id));
    }
    const totalCandidates = assignedStudents.length;

    // 2. Fetch sessions
    const sessions = await this.listExamSessions(examId);
    const submittedSessions = sessions.filter(s => s.status === 'submitted');
    const startedSessions = sessions.filter(s => s.status === 'in_progress' || s.status === 'submitted' || s.status === 'timed_out');

    const startedCount = startedSessions.length;
    const submittedCount = submittedSessions.length;
    const absentCount = Math.max(0, totalCandidates - startedCount);
    const completionRate = totalCandidates > 0 ? Math.round((submittedCount / totalCandidates) * 100) : 0;

    // 3. Compute score statistics
    const scores: number[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let autoGradedCount = 0;
    let pendingManualCount = 0;

    const passingMarks = exam.passingMarks || 40;
    const dist: ExamScoreDistribution = {
      bucket_0_39: 0,
      bucket_40_59: 0,
      bucket_60_79: 0,
      bucket_80_100: 0,
    };

    for (const s of submittedSessions) {
      const effectiveScore = typeof s.finalScore === 'number'
        ? s.finalScore
        : (typeof s.autoScore === 'number' ? s.autoScore : 0);
      scores.push(effectiveScore);

      if (effectiveScore >= passingMarks) {
        passedCount++;
      } else {
        failedCount++;
      }

      const pct = exam.totalMarks > 0 ? (effectiveScore / exam.totalMarks) * 100 : effectiveScore;
      if (pct < 40) dist.bucket_0_39++;
      else if (pct < 60) dist.bucket_40_59++;
      else if (pct < 80) dist.bucket_60_79++;
      else dist.bucket_80_100++;

      if (s.manualScore !== null && s.manualScore !== undefined) {
        autoGradedCount++;
      } else {
        const pendingRow: any = await db.prepare(`
          SELECT COUNT(*) as cnt FROM exam_question_responses
          WHERE session_id = ? AND grading_status = 'pending'
        `).get(s.id);
        if (pendingRow?.cnt > 0) {
          pendingManualCount++;
        } else {
          autoGradedCount++;
        }
      }
    }

    scores.sort((a, b) => a - b);
    const sum = scores.reduce((acc, v) => acc + v, 0);
    const averageScore = scores.length > 0 ? Math.round((sum / scores.length) * 100) / 100 : 0;
    const medianScore = scores.length > 0
      ? (scores.length % 2 === 1
          ? scores[Math.floor(scores.length / 2)]
          : Math.round(((scores[Math.floor(scores.length / 2) - 1] + scores[Math.floor(scores.length / 2)]) / 2) * 100) / 100)
      : 0;
    const highestScore = scores.length > 0 ? scores[scores.length - 1] : 0;
    const lowestScore = scores.length > 0 ? scores[0] : 0;

    const passRate = scores.length > 0 ? Math.round((passedCount / scores.length) * 100) : 0;
    const failRate = scores.length > 0 ? Math.round((failedCount / scores.length) * 100) : 0;

    // 4. Question-level performance
    const questions = await this.listExamQuestions(examId);
    const questionPerformance: ExamQuestionPerformance[] = [];

    for (const q of questions) {
      const respRows: any = await db.prepare(`
        SELECT earned_points, grading_status FROM exam_question_responses
        WHERE question_id = ?
      `).all(q.id);
      const resps = (respRows && respRows.results) ? respRows.results : (Array.isArray(respRows) ? respRows : []);

      const attemptCount = resps.length;
      let correctCount = 0;
      let totalEarned = 0;

      for (const r of resps) {
        totalEarned += (r.earned_points || 0);
        if (r.earned_points >= q.points && q.points > 0) {
          correctCount++;
        }
      }

      const avgEarned = attemptCount > 0 ? Math.round((totalEarned / attemptCount) * 100) / 100 : 0;
      const accRate = attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0;

      questionPerformance.push({
        questionId: q.id,
        promptText: q.promptText,
        maxPoints: q.points,
        attemptCount,
        correctCount,
        averageEarnedPoints: avgEarned,
        accuracyRate: accRate,
      });
    }

    return {
      examId,
      classroomId: cid,
      examTitle: exam.title,
      totalCandidates,
      startedCount,
      submittedCount,
      absentCount,
      completionRate,
      passedCount,
      failedCount,
      passRate,
      failRate,
      averageScore,
      medianScore,
      highestScore,
      lowestScore,
      scoreDistribution: dist,
      gradingCompletion: {
        autoGradedCount,
        pendingManualCount,
        isGradingComplete: pendingManualCount === 0,
      },
      questionPerformance,
      generatedAt: Date.now(),
    };
  }

  /**
   * Retrieves authoritative platform-wide administrative analytics.
   */
  async getPlatformAdminAnalytics(): Promise<PlatformAdminAnalytics> {
    const db = await this.getDb();
    const userStats: any = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN role = 'teacher' THEN 1 ELSE 0 END) as teachers,
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as students,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM users
    `).get();

    const classStats: any = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
      FROM classrooms
    `).get();

    const examStats: any = await db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM exams
    `).get();

    const sessStats: any = await db.prepare(`
      SELECT
        COUNT(*) as totalAttempts,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completedAttempts,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as activeAttempts
      FROM exam_sessions
    `).get();

    return {
      users: {
        total: userStats?.total || 0,
        teachers: userStats?.teachers || 0,
        students: userStats?.students || 0,
        admins: userStats?.admins || 0,
        active: userStats?.active || 0,
      },
      classrooms: {
        total: classStats?.total || 0,
        active: classStats?.active || 0,
        archived: classStats?.archived || 0,
      },
      exams: {
        total: examStats?.total || 0,
        draft: examStats?.draft || 0,
        scheduled: examStats?.scheduled || 0,
        active: examStats?.active || 0,
        completed: examStats?.completed || 0,
        cancelled: examStats?.cancelled || 0,
      },
      sessions: {
        totalAttempts: sessStats?.totalAttempts || 0,
        completedAttempts: sessStats?.completedAttempts || 0,
        activeAttempts: sessStats?.activeAttempts || 0,
      },
      generatedAt: Date.now(),
    };
  }

  // --- Cortex Lockdown Alpha 9: Durable Atomic Emergency Recovery & Distributed Rate Limiting ---

  async createLockdownEmergencyAuthorization(auth: {
    id: string;
    challenge: string;
    examId: string;
    candidateId: string;
    deviceId?: string;
    sessionId?: string;
    codeHash: string;
    codeSalt: string;
    issuedBy: string;
    issuedAt: number;
    expiresAt: number;
    reason?: string;
  }): Promise<void> {
    const db = await this.getDb();
    await db.prepare(`
      INSERT INTO lockdown_emergency_authorizations (
        id, challenge, exam_id, candidate_id, device_id, session_id,
        code_hash, code_salt, issued_by, issued_at, expires_at,
        used, redeemed_at, failed_attempts, max_attempts, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 0, 3, ?)
    `).run(
      auth.id,
      auth.challenge.trim().toUpperCase(),
      auth.examId.trim().toLowerCase(),
      auth.candidateId.trim(),
      auth.deviceId ? auth.deviceId.trim() : null,
      auth.sessionId ? auth.sessionId.trim() : null,
      auth.codeHash,
      auth.codeSalt,
      auth.issuedBy,
      auth.issuedAt,
      auth.expiresAt,
      auth.reason || 'Emergency proctor intervention'
    );
  }

  async getLockdownEmergencyAuthorization(challenge: string): Promise<any | null> {
    const db = await this.getDb();
    const row = await db.prepare(`
      SELECT * FROM lockdown_emergency_authorizations
      WHERE challenge = ?
    `).get(challenge.trim().toUpperCase());
    return row || null;
  }

  /** atomic conditional redemption: Exactly ONE winner can redeem an authorization */
  async atomicRedeemLockdownEmergencyAuthorization(params: {
    challenge: string;
    examId: string;
    candidateId: string;
    now: number;
  }): Promise<{ success: boolean; changes: number }> {
    const db = await this.getDb();
    const res = await db.prepare(`
      UPDATE lockdown_emergency_authorizations
      SET used = 1, redeemed_at = ?
      WHERE challenge = ?
        AND exam_id = ?
        AND candidate_id = ?
        AND used = 0
        AND expires_at > ?
        AND failed_attempts < max_attempts
    `).run(
      params.now,
      params.challenge.trim().toUpperCase(),
      params.examId.trim().toLowerCase(),
      params.candidateId.trim(),
      params.now
    );
    return { success: res.changes === 1, changes: res.changes || 0 };
  }

  /** atomic failed-attempt counter increment and auto-burn on >= max_attempts */
  async atomicIncrementLockdownFailedAttempts(challenge: string, now: number): Promise<{ failedAttempts: number; burned: boolean }> {
    const db = await this.getDb();
    await db.prepare(`
      UPDATE lockdown_emergency_authorizations
      SET failed_attempts = failed_attempts + 1,
          used = CASE WHEN failed_attempts + 1 >= max_attempts THEN 1 ELSE used END
      WHERE challenge = ?
        AND used = 0
        AND expires_at > ?
    `).run(challenge.trim().toUpperCase(), now);

    const updated = await this.getLockdownEmergencyAuthorization(challenge);
    if (!updated) return { failedAttempts: 0, burned: false };
    return {
      failedAttempts: updated.failed_attempts,
      burned: updated.used === 1 || updated.failed_attempts >= updated.max_attempts,
    };
  }

  /** distributed durable rate limiting using atomic SQL UPSERT */
  async checkDistributedRateLimit(params: {
    key: string;
    limit: number;
    windowSeconds: number;
    now?: number;
  }): Promise<{ allowed: boolean; current: number; limit: number; resetInSeconds: number }> {
    const db = await this.getDb();
    const now = params.now || Date.now();
    const windowMs = params.windowSeconds * 1000;
    const key = params.key.trim();

    const existing = await db.prepare(`
      SELECT request_count, window_start, expires_at
      FROM lockdown_distributed_rate_limits
      WHERE limiter_key = ?
    `).get(key);

    if (!existing || now >= existing.expires_at) {
      const newExpiresAt = now + windowMs;
      await db.prepare(`
        INSERT INTO lockdown_distributed_rate_limits (limiter_key, window_start, request_count, expires_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(limiter_key) DO UPDATE SET
          window_start = excluded.window_start,
          request_count = 1,
          expires_at = excluded.expires_at
      `).run(key, now, newExpiresAt);
      return { allowed: true, current: 1, limit: params.limit, resetInSeconds: params.windowSeconds };
    }

    if (existing.request_count >= params.limit) {
      const resetInSeconds = Math.max(1, Math.ceil((existing.expires_at - now) / 1000));
      return { allowed: false, current: existing.request_count, limit: params.limit, resetInSeconds };
    }

    await db.prepare(`
      UPDATE lockdown_distributed_rate_limits
      SET request_count = request_count + 1
      WHERE limiter_key = ? AND expires_at = ?
    `).run(key, existing.expires_at);

    const resetInSeconds = Math.max(1, Math.ceil((existing.expires_at - now) / 1000));
    return { allowed: true, current: existing.request_count + 1, limit: params.limit, resetInSeconds };
  }

  /**
   * Data Retention Control: Deletes historical exam integrity events older than the specified retention threshold.
   * Default retention is 90 days (standard academic grading dispute window).
   */
  async cleanupExpiredIntegrityEvents(olderThanMs: number = 90 * 24 * 60 * 60 * 1000): Promise<number> {
    const db = await this.getDb();
    const cutoff = Date.now() - olderThanMs;
    const res = await db.prepare(`
      DELETE FROM exam_integrity_events
      WHERE timestamp < ?
    `).run(cutoff);
    return res.changes || 0;
  }

  /**
   * Data Retention Control: Deletes all integrity events associated with a specific examination session.
   */
  async deleteExamSessionIntegrityEvents(sessionId: string): Promise<number> {
    const db = await this.getDb();
    const res = await db.prepare(`
      DELETE FROM exam_integrity_events
      WHERE session_id = ?
    `).run(sessionId);
    return res.changes || 0;
  }

  async cleanupExpiredEmergencyAuthorizations(olderThanMs: number = 3600000): Promise<number> {
    const db = await this.getDb();
    const cutoff = Date.now() - olderThanMs;
    const res = await db.prepare(`
      DELETE FROM lockdown_emergency_authorizations
      WHERE expires_at < ? AND used = 1
    `).run(cutoff);
    return res.changes || 0;
  }

  async clearLockdownEmergencyAuthorizations(): Promise<void> {
    const db = await this.getDb();
    await db.prepare('DELETE FROM lockdown_emergency_authorizations').run();
    await db.prepare('DELETE FROM lockdown_distributed_rate_limits').run();
  }

  // --- LOCKDOWN INSTITUTIONAL POLICIES & AUDIT LOG ---

  async saveLockdownPolicy(params: {
    policyId: string;
    version: number;
    hash: string;
    policyJson: string;
    actorId: string;
    actorRole: string;
    changeSummary: string;
    createdAt?: number;
  }): Promise<void> {
    const db = await this.getDb();
    const id = `lpol_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const createdAt = params.createdAt || Date.now();

    await db.prepare(`
      INSERT OR REPLACE INTO lockdown_institutional_policies (id, policy_id, version, hash, policy_json, actor_id, actor_role, change_summary, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.policyId, params.version, params.hash, params.policyJson, params.actorId, params.actorRole, params.changeSummary, createdAt);
  }

  async getLockdownPolicy(policyId: string, version?: number): Promise<any | null> {
    const db = await this.getDb();
    let row: any;
    if (typeof version === 'number') {
      row = await db.prepare(`
        SELECT * FROM lockdown_institutional_policies WHERE policy_id = ? AND version = ?
      `).get(policyId, version);
    } else {
      row = await db.prepare(`
        SELECT * FROM lockdown_institutional_policies WHERE policy_id = ? ORDER BY version DESC LIMIT 1
      `).get(policyId);
    }
    if (!row) return null;
    return {
      id: row.id,
      policyId: row.policy_id,
      version: row.version,
      hash: row.hash,
      policy: JSON.parse(row.policy_json),
      actorId: row.actor_id,
      actorRole: row.actor_role,
      changeSummary: row.change_summary,
      createdAt: row.created_at,
    };
  }

  async listLockdownPolicyVersions(policyId: string): Promise<any[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare(`
      SELECT * FROM lockdown_institutional_policies WHERE policy_id = ? ORDER BY version ASC
    `).all(policyId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);
    return results.map((row: any) => ({
      id: row.id,
      policyId: row.policy_id,
      version: row.version,
      hash: row.hash,
      policy: JSON.parse(row.policy_json),
      actorId: row.actor_id,
      actorRole: row.actor_role,
      changeSummary: row.change_summary,
      createdAt: row.created_at,
    }));
  }

  async saveLockdownSessionBinding(params: {
    sessionId: string;
    examId: string;
    version: number;
    hash: string;
    policyJson: string;
    boundAt?: number;
  }): Promise<void> {
    const db = await this.getDb();
    const boundAt = params.boundAt || Date.now();
    await db.prepare(`
      INSERT OR REPLACE INTO lockdown_session_policy_bindings (session_id, exam_id, version, hash, policy_json, bound_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(params.sessionId, params.examId, params.version, params.hash, params.policyJson, boundAt);
  }

  async getLockdownSessionBinding(sessionId: string): Promise<any | null> {
    const db = await this.getDb();
    const row: any = await db.prepare(`
      SELECT * FROM lockdown_session_policy_bindings WHERE session_id = ?
    `).get(sessionId);
    if (!row) return null;
    return {
      sessionId: row.session_id,
      examId: row.exam_id,
      version: row.version,
      hash: row.hash,
      policy: JSON.parse(row.policy_json),
      boundAt: row.bound_at,
    };
  }

  private async _appendLockdownAuditEntryInternal(entry: {
    actorId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    targetStudentId?: string;
    targetExamId?: string;
    outcome: 'GRANTED' | 'DENIED';
    errorCode?: string;
    reason: string;
    clientIp?: string;
    timestamp?: number;
  }): Promise<{ id: string; sequenceNum: number; entryHash: string }> {
    const db = await this.getDb();
    const escapeField = (val: string | number | undefined | null) => String(val ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');

    let attempts = 0;
    while (attempts < 8) {
      const id = `laud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const timestamp = entry.timestamp || Date.now();
      try {
        await db.exec('BEGIN IMMEDIATE;');
        const latestRow: any = await db.prepare(`
          SELECT sequence_num, entry_hash FROM lockdown_audit_log ORDER BY sequence_num DESC LIMIT 1
        `).get();

        const sequenceNum = latestRow ? latestRow.sequence_num + 1 : 1;
        const previousEntryHash = latestRow ? latestRow.entry_hash : 'GENESIS_LOCKDOWN_AUDIT_BLOCK_000000';

        const payloadToHash = [
          sequenceNum,
          timestamp,
          escapeField(entry.actorId),
          escapeField(entry.actorRole),
          escapeField(entry.action),
          escapeField(entry.resourceType),
          escapeField(entry.outcome),
          escapeField(entry.reason),
          previousEntryHash
        ].join('|');
        const entryHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

        await db.prepare(`
          INSERT INTO lockdown_audit_log (
            id, sequence_num, timestamp, actor_id, actor_role, action, resource_type,
            resource_id, target_student_id, target_exam_id, outcome, error_code, reason,
            client_ip, previous_entry_hash, entry_hash
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          sequenceNum,
          timestamp,
          entry.actorId,
          entry.actorRole,
          entry.action,
          entry.resourceType,
          entry.resourceId || null,
          entry.targetStudentId || null,
          entry.targetExamId || null,
          entry.outcome,
          entry.errorCode || null,
          entry.reason,
          entry.clientIp || '127.0.0.1',
          previousEntryHash,
          entryHash
        );

        await db.exec('COMMIT;');
        return { id, sequenceNum, entryHash };
      } catch (err: any) {
        try { await db.exec('ROLLBACK;'); } catch (_) {}
        const msg = String(err?.message || err);
        if (msg.includes('busy') || msg.includes('locked') || msg.includes('UNIQUE constraint failed')) {
          attempts++;
          await new Promise(r => setTimeout(r, 10 + Math.floor(Math.random() * 40)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('[ClassroomDatabase] Failed to append audit log after maximum retry attempts (database contention)');
  }

  async appendLockdownAuditEntry(entry: {
    actorId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    targetStudentId?: string;
    targetExamId?: string;
    outcome: 'GRANTED' | 'DENIED';
    errorCode?: string;
    reason: string;
    clientIp?: string;
    timestamp?: number;
  }): Promise<{ id: string; sequenceNum: number; entryHash: string }> {
    return new Promise<{ id: string; sequenceNum: number; entryHash: string }>((resolve, reject) => {
      this.auditAppendMutex = this.auditAppendMutex.then(async () => {
        try {
          const res = await this._appendLockdownAuditEntryInternal(entry);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  async verifyLockdownAuditLogIntegrity(): Promise<{
    valid: boolean;
    totalEntries: number;
    tamperedIndex?: number;
    reason?: string;
  }> {
    const db = await this.getDb();
    const rows: any = await db.prepare(`
      SELECT * FROM lockdown_audit_log ORDER BY sequence_num ASC
    `).all();
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    let expectedPrevHash = 'GENESIS_LOCKDOWN_AUDIT_BLOCK_000000';
    const escapeField = (val: string | number | undefined | null) => String(val ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      if (row.sequence_num !== i + 1) {
        return {
          valid: false,
          totalEntries: results.length,
          tamperedIndex: i,
          reason: `Sequence break detected at index ${i}: expected seq ${i + 1}, found ${row.sequence_num}`,
        };
      }
      if (row.previous_entry_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalEntries: results.length,
          tamperedIndex: i,
          reason: `Hash chain broken at sequence ${row.sequence_num}: expected prev hash ${expectedPrevHash}, found ${row.previous_entry_hash}`,
        };
      }

      // Canonical payload verification with unescaped fallback for legacy rows
      const canonicalPayload = [
        row.sequence_num,
        row.timestamp,
        escapeField(row.actor_id),
        escapeField(row.actor_role),
        escapeField(row.action),
        escapeField(row.resource_type),
        escapeField(row.outcome),
        escapeField(row.reason),
        row.previous_entry_hash
      ].join('|');
      const canonicalHash = crypto.createHash('sha256').update(canonicalPayload).digest('hex');

      const legacyPayload = `${row.sequence_num}|${row.timestamp}|${row.actor_id}|${row.actor_role}|${row.action}|${row.resource_type}|${row.outcome}|${row.reason}|${row.previous_entry_hash}`;
      const legacyHash = crypto.createHash('sha256').update(legacyPayload).digest('hex');

      if (canonicalHash !== row.entry_hash && legacyHash !== row.entry_hash) {
        return {
          valid: false,
          totalEntries: results.length,
          tamperedIndex: i,
          reason: `Content tampering detected at sequence ${row.sequence_num}: hash mismatch`,
        };
      }
      expectedPrevHash = row.entry_hash;
    }

    return {
      valid: true,
      totalEntries: results.length,
    };
  }

  async createAuditLogCheckpoint(options?: {
    secret?: string;
    checkpointSeq?: number;
    keyId?: string;
  }): Promise<{
    checkpointId: string;
    checkpointSeq: number;
    upToSequenceNum: number;
    checkpointHash: string;
    entryCount: number;
    serverSignature: string;
    keyId: string;
    createdAt: number;
  }> {
    const db = await this.getDb();
    const secret = options?.secret || 'dev_audit_checkpoint_hmac_secret_key_32chars';
    const keyId = options?.keyId || 'k1';

    let attempts = 0;
    while (attempts < 8) {
      try {
        await db.exec('BEGIN IMMEDIATE;');
        const latestRow: any = await db.prepare(`
          SELECT sequence_num, entry_hash FROM lockdown_audit_log ORDER BY sequence_num DESC LIMIT 1
        `).get();

        if (!latestRow) {
          await db.exec('ROLLBACK;');
          throw new Error('Cannot create checkpoint on empty audit log');
        }

        const latestCheckpoint: any = await db.prepare(`
          SELECT checkpoint_seq FROM lockdown_audit_checkpoints ORDER BY checkpoint_seq DESC LIMIT 1
        `).get();

        const checkpointSeq = options?.checkpointSeq || (latestCheckpoint ? latestCheckpoint.checkpoint_seq + 1 : 1);
        const upToSequenceNum = latestRow.sequence_num;
        const checkpointHash = latestRow.entry_hash;
        const countRow: any = await db.prepare(`
          SELECT COUNT(*) as cnt FROM lockdown_audit_log WHERE sequence_num <= ?
        `).get(upToSequenceNum);
        const entryCount = countRow ? countRow.cnt : upToSequenceNum;
        const createdAt = Date.now();
        const checkpointId = `chk_${checkpointSeq}_${Date.now()}`;

        // Standard signing payload incorporating keyId
        const signingPayload = `${checkpointId}|${checkpointSeq}|${upToSequenceNum}|${checkpointHash}|${entryCount}|${keyId}|${createdAt}`;
        const serverSignature = crypto.createHmac('sha256', secret).update(signingPayload).digest('hex');

        await db.prepare(`
          INSERT INTO lockdown_audit_checkpoints (
            checkpoint_id, checkpoint_seq, up_to_sequence_num, checkpoint_hash, entry_count, server_signature, key_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(checkpointId, checkpointSeq, upToSequenceNum, checkpointHash, entryCount, serverSignature, keyId, createdAt);

        await db.exec('COMMIT;');
        return {
          checkpointId,
          checkpointSeq,
          upToSequenceNum,
          checkpointHash,
          entryCount,
          serverSignature,
          keyId,
          createdAt,
        };
      } catch (err: any) {
        try { await db.exec('ROLLBACK;'); } catch (_) {}
        const msg = String(err?.message || err);
        if (msg.includes('empty audit log')) throw err;
        if (msg.includes('busy') || msg.includes('locked') || msg.includes('UNIQUE constraint failed')) {
          attempts++;
          await new Promise(r => setTimeout(r, 10 + Math.floor(Math.random() * 40)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('[ClassroomDatabase] Failed to create checkpoint after maximum retry attempts (database contention)');
  }

  async verifyAuditLogCheckpoints(options?: {
    secret?: string;
    keyring?: Record<string, string>;
    expectedMinCheckpointSeq?: number;
    knownHighWaterMark?: number;
  }): Promise<{
    valid: boolean;
    totalCheckpoints: number;
    tamperedCheckpointSeq?: number;
    reason?: string;
  }> {
    const db = await this.getDb();
    const defaultSecret = options?.secret || 'dev_audit_checkpoint_hmac_secret_key_32chars';

    const rows: any = await db.prepare(`
      SELECT * FROM lockdown_audit_checkpoints ORDER BY checkpoint_seq ASC
    `).all();
    const checkpoints = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    let prevUpTo = 0;
    for (let i = 0; i < checkpoints.length; i++) {
      const chk = checkpoints[i];

      // 1. Checkpoint Sequence Continuity (Detect deleted checkpoints)
      if (chk.checkpoint_seq !== i + 1) {
        return {
          valid: false,
          totalCheckpoints: checkpoints.length,
          tamperedCheckpointSeq: chk.checkpoint_seq,
          reason: `Audit checkpoint sequence gap detected at index ${i}: expected seq ${i + 1}, found ${chk.checkpoint_seq} (checkpoint deletion detected)`,
        };
      }

      // 2. Monotonicity Check (Detect reordered checkpoints or regression)
      if (chk.up_to_sequence_num < prevUpTo) {
        return {
          valid: false,
          totalCheckpoints: checkpoints.length,
          tamperedCheckpointSeq: chk.checkpoint_seq,
          reason: `Audit checkpoint sequence regression at seq ${chk.checkpoint_seq}: up_to_sequence_num ${chk.up_to_sequence_num} is less than prior ${prevUpTo} (out-of-order or rollback detected)`,
        };
      }
      prevUpTo = chk.up_to_sequence_num;

      // 3. Verify HMAC signature with server secret (supporting key rotation via keyring)
      const defaultKeyring: Record<string, string> = {
        k1: 'dev_audit_checkpoint_hmac_secret_key_32chars',
        k2: 'audit_secret_v2_rotated_key_32bytes_long!',
      };
      if (chk.key_id && options?.keyring && !options.keyring[chk.key_id] && !defaultKeyring[chk.key_id]) {
        return {
          valid: false,
          totalCheckpoints: checkpoints.length,
          tamperedCheckpointSeq: chk.checkpoint_seq,
          reason: `Unknown or retired key ID '${chk.key_id}' used for checkpoint ${chk.checkpoint_seq} signature (untrusted signing key)`,
        };
      }
      const secret = (options?.keyring && chk.key_id && options.keyring[chk.key_id])
        ? options.keyring[chk.key_id]
        : (chk.key_id && defaultKeyring[chk.key_id] ? defaultKeyring[chk.key_id] : defaultSecret);

      const payloadWithKey = `${chk.checkpoint_id}|${chk.checkpoint_seq}|${chk.up_to_sequence_num}|${chk.checkpoint_hash}|${chk.entry_count}|${chk.key_id || 'k1'}|${chk.created_at}`;
      const payloadLegacy = `${chk.checkpoint_id}|${chk.checkpoint_seq}|${chk.up_to_sequence_num}|${chk.checkpoint_hash}|${chk.entry_count}|${chk.created_at}`;

      const expectedSigWithKey = crypto.createHmac('sha256', secret).update(payloadWithKey).digest('hex');
      const expectedSigLegacy = crypto.createHmac('sha256', secret).update(payloadLegacy).digest('hex');

      const sigBuf = Buffer.from(chk.server_signature);
      const expBufWithKey = Buffer.from(expectedSigWithKey);
      const expBufLegacy = Buffer.from(expectedSigLegacy);

      const matchesWithKey = sigBuf.length === expBufWithKey.length && crypto.timingSafeEqual(sigBuf, expBufWithKey);
      const matchesLegacy = sigBuf.length === expBufLegacy.length && crypto.timingSafeEqual(sigBuf, expBufLegacy);

      if (!matchesWithKey && !matchesLegacy) {
        return {
          valid: false,
          totalCheckpoints: checkpoints.length,
          tamperedCheckpointSeq: chk.checkpoint_seq,
          reason: `Checkpoint ${chk.checkpoint_seq} signature verification failed (forged or modified checkpoint signature)`,
        };
      }

      // 4. Verify that the checkpoint_hash matches the actual audit row at up_to_sequence_num
      const auditRow: any = await db.prepare(`
        SELECT entry_hash FROM lockdown_audit_log WHERE sequence_num = ?
      `).get(chk.up_to_sequence_num);

      if (!auditRow) {
        return {
          valid: false,
          totalCheckpoints: checkpoints.length,
          tamperedCheckpointSeq: chk.checkpoint_seq,
          reason: `Checkpoint ${chk.checkpoint_seq} references missing audit sequence ${chk.up_to_sequence_num} (audit log truncated or deleted)`,
        };
      }

      if (auditRow.entry_hash !== chk.checkpoint_hash) {
        return {
          valid: false,
          totalCheckpoints: checkpoints.length,
          tamperedCheckpointSeq: chk.checkpoint_seq,
          reason: `Audit log entry at sequence ${chk.up_to_sequence_num} has hash '${auditRow.entry_hash}', but signed checkpoint expects '${chk.checkpoint_hash}' (full-chain rewrite detected)`,
        };
      }
    }

    const latestSeq = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].checkpoint_seq : 0;
    const minRequired = options?.knownHighWaterMark ?? options?.expectedMinCheckpointSeq;
    if (minRequired !== undefined && latestSeq < minRequired) {
      return {
        valid: false,
        totalCheckpoints: checkpoints.length,
        reason: `Database rollback detected: latest verified checkpoint sequence ${latestSeq} is below authoritative high-water mark ${minRequired}`,
      };
    }

    return {
      valid: true,
      totalCheckpoints: checkpoints.length,
    };
  }

  async consumeReplayIdentifier(params: {
    type: 'SAML_ASSERTION' | 'LTI_NONCE' | 'LAUNCH_GRANT';
    identifier: string;
    contextId?: string;
    expiresAt: number;
    now?: number;
  }): Promise<{ success: boolean; alreadyConsumed: boolean }> {
    const db = await this.getDb();
    const now = params.now || Date.now();
    const replayKey = `${params.type}:${params.identifier}`;
    try {
      await db.prepare(`
        INSERT INTO lockdown_replay_cache (
          replay_key, replay_type, identifier, context_id, consumed_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(replayKey, params.type, params.identifier, params.contextId || null, now, params.expiresAt);
      return { success: true, alreadyConsumed: false };
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('UNIQUE constraint failed') || msg.includes('PRIMARY KEY') || msg.includes('constraint failed')) {
        return { success: false, alreadyConsumed: true };
      }
      throw err;
    }
  }

  async isReplayIdentifierConsumed(type: string, identifier: string): Promise<boolean> {
    const db = await this.getDb();
    const replayKey = `${type}:${identifier}`;
    const row: any = await db.prepare(`
      SELECT replay_key FROM lockdown_replay_cache WHERE replay_key = ?
    `).get(replayKey);
    return !!row;
  }

  async cleanupExpiredReplayCache(now?: number): Promise<number> {
    const db = await this.getDb();
    const current = now || Date.now();
    const res: any = await db.prepare(`
      DELETE FROM lockdown_replay_cache WHERE expires_at < ?
    `).run(current);
    return res?.changes || 0;
  }

  async revokeSession(params: {
    sessionId: string;
    examId?: string;
    userId?: string;
    revokedBy?: string;
    reason?: string;
    expiresAt?: number;
  }): Promise<void> {
    const db = await this.getDb();
    await db.prepare(`
      INSERT OR REPLACE INTO lockdown_revoked_sessions (
        session_id, exam_id, user_id, revoked_by, reason, revoked_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.sessionId,
      params.examId || 'UNKNOWN_EXAM',
      params.userId || 'UNKNOWN_USER',
      params.revokedBy || 'SYSTEM',
      params.reason || 'Session explicitly revoked',
      Date.now(),
      params.expiresAt || null
    );
  }

  async isSessionRevoked(sessionId: string): Promise<boolean> {
    const db = await this.getDb();
    const row: any = await db.prepare(`
      SELECT session_id FROM lockdown_revoked_sessions WHERE session_id = ?
    `).get(sessionId);
    return !!row;
  }

  async listRevokedSessions(examId?: string): Promise<any[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM lockdown_revoked_sessions WHERE 1=1';
    const params: any[] = [];
    if (examId) {
      query += ' AND exam_id = ?';
      params.push(examId);
    }
    query += ' ORDER BY revoked_at DESC';
    const rows: any = await db.prepare(query).all(...params);
    return (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);
  }

  async revokeToken(params: {
    identifier: string;
    type: 'launch_grant' | 'session' | 'user_logout';
    reason: string;
  }): Promise<void> {
    const db = await this.getDb();
    await db.prepare(`
      INSERT OR REPLACE INTO lockdown_revoked_tokens (token_identifier, revocation_type, revoked_at, reason)
      VALUES (?, ?, ?, ?)
    `).run(params.identifier, params.type, Date.now(), params.reason);
  }

  async isTokenRevoked(identifier: string): Promise<boolean> {
    const db = await this.getDb();
    const row: any = await db.prepare(`
      SELECT token_identifier FROM lockdown_revoked_tokens WHERE token_identifier = ?
    `).get(identifier);
    return !!row;
  }

  async listLockdownAuditLog(filter?: {
    examId?: string;
    studentId?: string;
    actorId?: string;
    action?: string;
    outcome?: string;
  }): Promise<any[]> {
    const db = await this.getDb();
    let query = 'SELECT * FROM lockdown_audit_log WHERE 1=1';
    const params: any[] = [];
    if (filter?.examId) {
      query += ' AND target_exam_id = ?';
      params.push(filter.examId);
    }
    if (filter?.studentId) {
      query += ' AND target_student_id = ?';
      params.push(filter.studentId);
    }
    if (filter?.actorId) {
      query += ' AND actor_id = ?';
      params.push(filter.actorId);
    }
    if (filter?.action) {
      query += ' AND action = ?';
      params.push(filter.action);
    }
    if (filter?.outcome) {
      query += ' AND outcome = ?';
      params.push(filter.outcome);
    }
    query += ' ORDER BY sequence_num ASC';

    const rows: any = await db.prepare(query).all(...params);
    return (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);
  }

  async getHealthStats(): Promise<{ userCount: number; examCount: number; sessionCount: number }> {
    const db = await this.getDb();
    const userRow = (await db.prepare('SELECT COUNT(*) as cnt FROM users').get()) as any;
    const examRow = (await db.prepare('SELECT COUNT(*) as cnt FROM exams').get()) as any;
    const sessRow = (await db.prepare('SELECT COUNT(*) as cnt FROM exam_sessions').get()) as any;
    return {
      userCount: userRow?.cnt || 0,
      examCount: examRow?.cnt || 0,
      sessionCount: sessRow?.cnt || 0,
    };
  }
}

export const classroomDb = new ClassroomDatabase();
