-- Cortex Phase 2H Initial Schema

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
      CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(classroom_id);;











CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        language TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        is_folder INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );;

CREATE TABLE IF NOT EXISTS arena_workspaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          challenge_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );;

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
        );;

CREATE TABLE IF NOT EXISTS benchmark_workspaces (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          benchmark_id TEXT NOT NULL,
          workspace_a_project_id TEXT NOT NULL,
          workspace_b_project_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );;

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
        );;

