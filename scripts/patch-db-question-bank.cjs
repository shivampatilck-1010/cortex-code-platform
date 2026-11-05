const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'src', 'lib', 'classroom', 'db', 'index.ts');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Ensure CREATE TABLE IF NOT EXISTS question_bank in createTables()
if (!content.includes('CREATE TABLE IF NOT EXISTS question_bank')) {
  const marker = 'CREATE INDEX IF NOT EXISTS idx_exam_integrity_session ON exam_integrity_events(session_id, timestamp);';
  const tableSql = `${marker}

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
      CREATE INDEX IF NOT EXISTS idx_question_bank_archived ON question_bank(is_archived);`;

  if (content.includes(marker)) {
    content = content.replace(marker, tableSql);
    console.log('Added question_bank table creation to createTables.');
  } else {
    console.error('Could not find marker for table creation.');
  }
}

// 2. Add Question Bank methods before the export
const methodsMarker = '// --- QUESTION BANK (PHASE 2) ---';
if (!content.includes(methodsMarker)) {
  const endClassMarker = 'export const classroomDb = new ClassroomDatabase();';
  const methodsCode = `  // --- QUESTION BANK (PHASE 2) ---
  async createQuestionBankItem(item: Partial<QuestionBankItem>): Promise<QuestionBankItem> {
    const db = await this.getDb();
    const id = item.id || \`qb_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    const now = Date.now();

    const optionsJson = JSON.stringify(item.options || []);
    const correctAnswerJson = JSON.stringify(item.correctAnswer || {});
    const testCasesJson = JSON.stringify(item.testCases || []);
    const tagsJson = JSON.stringify(item.tags || []);

    await db.prepare(\`
      INSERT INTO question_bank (
        id, teacher_id, classroom_id, subject, topic, difficulty,
        question_type, prompt_text, prompt_media_url, options_json,
        correct_answer_json, test_cases_json, initial_code, language,
        default_points, negative_marks, numerical_tolerance, tags_json,
        is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
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
        const pattern = \`%\${filter.search}%\`;
        params.push(pattern, pattern, pattern);
      }
    } else {
      clauses.push('is_archived = 0');
    }

    const sql = \`SELECT * FROM question_bank WHERE \${clauses.join(' AND ')} ORDER BY created_at DESC\`;
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

    await db.prepare(\`UPDATE question_bank SET \${fields.join(', ')} WHERE id = ?\`).run(...values);
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
      promptText: \`\${existing.promptText} (Copy)\`,
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
  }): Promise<ExamQuestion> {
    const bankItem = await this.getQuestionBankItem(params.bankQuestionId);
    if (!bankItem) {
      throw new Error(\`Question bank item \${params.bankQuestionId} not found\`);
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
}

${endClassMarker}`;

  content = content.replace(endClassMarker, methodsCode);
  console.log('Added Question Bank methods to ClassroomDatabase.');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully patched src/lib/classroom/db/index.ts for Question Bank.');
