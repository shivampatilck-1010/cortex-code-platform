const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '..', 'src', 'lib', 'classroom', 'db', 'index.ts');
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Add imports if missing
if (!code.includes('ExamAnalytics')) {
  code = code.replace(
    'QuestionBankDifficulty,',
    'QuestionBankDifficulty,\n  ExamAnalytics,\n  PlatformAdminAnalytics,\n  ExamQuestionPerformance,\n  ExamScoreDistribution,'
  );
}

// 2. Add methods before getHealthStats
const marker = '  async getHealthStats(): Promise';
const methodsToAdd = `  /**
   * Retrieves comprehensive server-authoritative analytics for an examination.
   */
  async getExamAnalytics(classroomId: string, examId: string): Promise<ExamAnalytics> {
    const db = await this.getDb();
    const cid = classroomId.toUpperCase().trim();
    const exam = await this.getExam(examId);
    if (!exam || exam.classroomId !== cid) {
      throw new Error(\`Examination \${examId} not found in classroom \${classroomId}\`);
    }

    // 1. Fetch cohort students
    const memberRows: any = await db.prepare(\`
      SELECT cm.user_id, u.name, u.email
      FROM classroom_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.classroom_id = ? AND cm.role = 'student'
    \`).all(cid);
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
    const startedSessions = sessions.filter(s => s.status === 'in_progress' || s.status === 'submitted' || s.status === 'expired');

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
        const pendingRow: any = await db.prepare(\`
          SELECT COUNT(*) as cnt FROM exam_question_responses
          WHERE session_id = ? AND grading_status = 'pending'
        \`).get(s.id);
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
      const respRows: any = await db.prepare(\`
        SELECT earned_points, grading_status FROM exam_question_responses
        WHERE question_id = ?
      \`).all(q.id);
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
    const userStats: any = await db.prepare(\`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN role = 'teacher' THEN 1 ELSE 0 END) as teachers,
        SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as students,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
      FROM users
    \`).get();

    const classStats: any = await db.prepare(\`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived
      FROM classrooms
    \`).get();

    const examStats: any = await db.prepare(\`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
      FROM exams
    \`).get();

    const sessStats: any = await db.prepare(\`
      SELECT
        COUNT(*) as totalAttempts,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as completedAttempts,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as activeAttempts
      FROM exam_sessions
    \`).get();

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

`;

if (!code.includes('async getExamAnalytics(')) {
  code = code.replace(marker, methodsToAdd + marker);
  fs.writeFileSync(targetPath, code, 'utf8');
  console.log('Successfully injected getExamAnalytics and getPlatformAdminAnalytics!');
} else {
  console.log('Methods already present in file.');
}
