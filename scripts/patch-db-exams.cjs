const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'src', 'lib', 'classroom', 'db', 'index.ts');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add imports if not present
if (!content.includes('ExamQuestion')) {
  const modelImportMarker = "import {\n";
  const replacement = `import {
  Exam,
  ExamSection,
  ExamQuestion,
  ExamSession,
  ExamQuestionResponse,
  ExamIntegrityEvent,
  ExamStatus,
  ExamQuestionType,
  ExamSessionStatus,
  ExamGradingStatus,
  ExamIntegrityEventType,
  VALID_EXAM_TRANSITIONS,
`;
  content = content.replace(modelImportMarker, replacement);
  console.log('Added exam model imports.');
}

// 2. Add CREATE TABLE in createTables if not present
if (!content.includes('CREATE TABLE IF NOT EXISTS exams')) {
  const createTablesMarker = 'CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(classroom_id);';
  const examTablesSql = `CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(classroom_id);

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
      CREATE INDEX IF NOT EXISTS idx_exam_integrity_session ON exam_integrity_events(session_id, timestamp);`;

  content = content.replace(createTablesMarker, examTablesSql);
  console.log('Added exam CREATE TABLE to createTables().');
}

// 3. Add exam database query methods if not present
if (!content.includes('async createExam(')) {
  const methodsCode = `
  // --- ONLINE EXAMINATION SYSTEM (PHASE 1) ---

  async createExam(exam: Partial<Exam>): Promise<Exam> {
    const db = await this.getDb();
    const id = exam.id || \`exam_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    const now = Date.now();
    const cid = (exam.classroomId || '').toUpperCase().trim();
    const assignedJson = JSON.stringify(exam.assignedStudentIds || []);

    await db.prepare(\`
      INSERT INTO exams (
        id, classroom_id, title, description, duration_minutes,
        start_time, end_time, total_marks, passing_marks, attempts_allowed,
        security_level, status, shuffle_questions, shuffle_options, show_results_immediately,
        assigned_student_ids_json, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
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

    fields.push('updated_at = ?');
    values.push(now);
    values.push(examId);

    await db.prepare(\`UPDATE exams SET \${fields.join(', ')} WHERE id = ?\`).run(...values);
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
    const id = section.id || \`sec_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    await db.prepare(\`
      INSERT INTO exam_sections (id, exam_id, title, description, sort_order, section_marks)
      VALUES (?, ?, ?, ?, ?, ?)
    \`).run(
      id,
      section.examId,
      section.title || 'Section',
      section.description || '',
      section.sortOrder || 0,
      section.sectionMarks || 0
    );

    return {
      id,
      examId: section.examId!,
      title: section.title || 'Section',
      description: section.description || '',
      sortOrder: section.sortOrder || 0,
      sectionMarks: section.sectionMarks || 0,
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
      sortOrder: r.sort_order,
      sectionMarks: r.section_marks,
    }));
  }

  async deleteExamSection(sectionId: string): Promise<boolean> {
    const db = await this.getDb();
    await db.prepare('DELETE FROM exam_sections WHERE id = ?').run(sectionId);
    return true;
  }

  // --- QUESTIONS ---
  async createExamQuestion(q: Partial<ExamQuestion>): Promise<ExamQuestion> {
    const db = await this.getDb();
    const id = q.id || \`q_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    const now = Date.now();

    const optionsJson = JSON.stringify(q.options || []);
    const correctAnswerJson = JSON.stringify(q.correctAnswer || {});
    const testCasesJson = JSON.stringify(q.testCases || []);

    await db.prepare(\`
      INSERT INTO exam_questions (
        id, exam_id, section_id, question_type, prompt_text,
        prompt_media_url, options_json, correct_answer_json, test_cases_json,
        initial_code, language, points, negative_marks, numerical_tolerance,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
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

    await db.prepare(\`UPDATE exam_questions SET \${fields.join(', ')} WHERE id = ?\`).run(...values);
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
    const id = session.id || \`sess_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    const now = Date.now();

    await db.prepare(\`
      INSERT INTO exam_sessions (
        id, exam_id, user_id, attempt_number, status,
        started_at, expires_at, submitted_at, auto_score, manual_score,
        final_score, is_published, teacher_feedback, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
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
      now,
      now
    );

    return (await this.getExamSession(id))!;
  }

  async getExamSession(sessionId: string): Promise<ExamSession | null> {
    const db = await this.getDb();
    const r: any = await db.prepare(\`
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM exam_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    \`).get(sessionId);
    if (!r) return null;

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
      autoScore: r.auto_score,
      manualScore: r.manual_score,
      finalScore: r.final_score,
      isPublished: r.is_published === 1,
      teacherFeedback: r.teacher_feedback || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async getUserExamSessions(examId: string, userId: string): Promise<ExamSession[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare(\`
      SELECT * FROM exam_sessions
      WHERE exam_id = ? AND user_id = ?
      ORDER BY attempt_number DESC
    \`).all(examId, userId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => ({
      id: r.id,
      examId: r.exam_id,
      userId: r.user_id,
      attemptNumber: r.attempt_number,
      status: r.status,
      startedAt: r.started_at,
      expiresAt: r.expires_at,
      submittedAt: r.submitted_at,
      autoScore: r.auto_score,
      manualScore: r.manual_score,
      finalScore: r.final_score,
      isPublished: r.is_published === 1,
      teacherFeedback: r.teacher_feedback || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async listExamSessions(examId: string): Promise<ExamSession[]> {
    const db = await this.getDb();
    const rows: any = await db.prepare(\`
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM exam_sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.exam_id = ?
      ORDER BY s.created_at DESC
    \`).all(examId);
    const results = (rows && rows.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    return results.map((r: any) => ({
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
      autoScore: r.auto_score,
      manualScore: r.manual_score,
      finalScore: r.final_score,
      isPublished: r.is_published === 1,
      teacherFeedback: r.teacher_feedback || '',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async updateExamSession(sessionId: string, updates: Partial<ExamSession>): Promise<ExamSession | null> {
    const db = await this.getDb();
    const existing = await this.getExamSession(sessionId);
    if (!existing) return null;

    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.submittedAt !== undefined) { fields.push('submitted_at = ?'); values.push(updates.submittedAt); }
    if (updates.autoScore !== undefined) { fields.push('auto_score = ?'); values.push(updates.autoScore); }
    if (updates.manualScore !== undefined) { fields.push('manual_score = ?'); values.push(updates.manualScore); }
    if (updates.finalScore !== undefined) { fields.push('final_score = ?'); values.push(updates.finalScore); }
    if (updates.isPublished !== undefined) { fields.push('is_published = ?'); values.push(updates.isPublished ? 1 : 0); }
    if (updates.teacherFeedback !== undefined) { fields.push('teacher_feedback = ?'); values.push(updates.teacherFeedback); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(sessionId);

    await db.prepare(\`UPDATE exam_sessions SET \${fields.join(', ')} WHERE id = ?\`).run(...values);
    return await this.getExamSession(sessionId);
  }

  // --- RESPONSES ---
  async saveExamResponse(resp: Partial<ExamQuestionResponse>): Promise<ExamQuestionResponse> {
    const db = await this.getDb();
    const id = resp.id || \`resp_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    const now = Date.now();
    const responseJson = JSON.stringify(resp.response !== undefined ? resp.response : {});

    await db.prepare(\`
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
    \`).run(
      id,
      resp.sessionId,
      resp.questionId,
      responseJson,
      resp.earnedPoints || 0,
      resp.gradingStatus || 'pending',
      resp.graderNotes || '',
      resp.flaggedForReview ? 1 : 0,
      now
    );

    return {
      id,
      sessionId: resp.sessionId!,
      questionId: resp.questionId!,
      response: resp.response,
      earnedPoints: resp.earnedPoints || 0,
      gradingStatus: resp.gradingStatus || 'pending',
      graderNotes: resp.graderNotes || '',
      flaggedForReview: !!resp.flaggedForReview,
      updatedAt: now,
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
    const id = evt.id || \`ievt_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    const now = evt.timestamp || Date.now();
    const detailsJson = JSON.stringify(evt.details || {});

    await db.prepare(\`
      INSERT INTO exam_integrity_events (id, session_id, event_type, timestamp, details_json)
      VALUES (?, ?, ?, ?, ?)
    \`).run(id, evt.sessionId, evt.eventType, now, detailsJson);

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
`;

  // Insert before the closing brace of ClassroomDatabase
  const lastBraceIndex = content.lastIndexOf('}');
  content = content.substring(0, lastBraceIndex) + methodsCode + '\n}\n' + content.substring(lastBraceIndex + 1);
  console.log('Added exam database methods.');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully updated src/lib/classroom/db/index.ts');
