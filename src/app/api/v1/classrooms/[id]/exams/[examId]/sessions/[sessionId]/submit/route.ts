import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { gradeQuestionResponse } from '@/lib/classroom/exam-grader';
import { computeActiveExamRoute } from '@/lib/classroom/exam-branching';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; sessionId: string }> }
) {
  try {
    const { id, examId, sessionId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);

    const session = await classroomDb.getExamSession(sessionId);
    if (!session || session.examId !== examId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Cannot submit another student\'s examination' }, { status: 403 });
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Cannot submit a session with status '${session.status}'` }, { status: 400 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const now = Date.now();
    const GRACE_PERIOD_MS = 30 * 1000; // 30-second network latency grace period
    const isLate = now > session.expiresAt + GRACE_PERIOD_MS;

    const questions = await classroomDb.listExamQuestions(examId);
    const existingResponses = await classroomDb.listExamResponses(sessionId);
    const responseMap = new Map(existingResponses.map((r) => [r.questionId, r]));

    // The 30-second grace period permits only final network delivery, not additional answering time.
    // Therefore, accept final batch responses ONLY if received within valid examination time (now <= session.expiresAt).
    const body = await req.json().catch(() => ({}));
    const canAcceptFinalAnswers = now <= session.expiresAt;
    if (canAcceptFinalAnswers && body.finalResponses && typeof body.finalResponses === 'object') {
      for (const [qId, respVal] of Object.entries(body.finalResponses)) {
        let cleanVal = respVal;
        if (respVal && typeof respVal === 'object' && !Array.isArray(respVal)) {
          const { earnedPoints, gradingStatus, graderNotes, ...rest } = respVal as any;
          cleanVal = rest;
        }
        await classroomDb.saveExamResponse({
          sessionId,
          questionId: qId,
          response: cleanVal,
          updatedAt: now,
        });
      }
    }

    // Refresh responses after saving any final batch
    const allResponses = await classroomDb.listExamResponses(sessionId);
    const updatedResponseMap = new Map(allResponses.map((r) => [r.questionId, r]));

    // Construct response object for route evaluation
    const responsesObj: Record<string, any> = {};
    for (const r of allResponses) {
      responsesObj[r.questionId] = r.response;
    }

    // Evaluate conditional branching route taken
    const rules = await classroomDb.listExamBranchingRules(examId);
    const routeResult = computeActiveExamRoute({
      exam,
      rules,
      responses: responsesObj,
    });

    const activeQuestionSet = new Set(routeResult.activeQuestionIds);

    let totalEarnedScore = 0;
    let pendingManualGradingCount = 0;

    // Grade only questions on the active traversed branch
    for (const q of questions) {
      const resp = updatedResponseMap.get(q.id);
      const studentAns = resp ? resp.response : undefined;

      // If question was not part of the branch taken, do not award marks or count towards score
      if (!activeQuestionSet.has(q.id)) {
        if (resp) {
          await classroomDb.saveExamResponse({
            id: resp.id,
            sessionId,
            questionId: q.id,
            response: resp.response,
            earnedPoints: 0,
            gradingStatus: 'auto_graded',
            graderNotes: 'Question excluded from scoring as student took a different branch',
            flaggedForReview: resp.flaggedForReview,
          });
        }
        continue;
      }

      const gradeResult = gradeQuestionResponse(q, studentAns);
      totalEarnedScore += gradeResult.earnedPoints;

      if (gradeResult.status === 'pending') {
        pendingManualGradingCount++;
      }

      // Update response with points earned
      if (resp) {
        await classroomDb.saveExamResponse({
          id: resp.id,
          sessionId,
          questionId: q.id,
          response: resp.response,
          earnedPoints: gradeResult.earnedPoints,
          gradingStatus: gradeResult.status,
          graderNotes: gradeResult.feedback || '',
          flaggedForReview: resp.flaggedForReview,
        });
      }
    }

    const finalStatus = isLate ? 'timed_out' : 'submitted';
    const autoScore = Math.max(0, Math.round(totalEarnedScore * 100) / 100);
    const finalScore = pendingManualGradingCount === 0 ? autoScore : null;

    const updatedSession = await classroomDb.updateExamSession(sessionId, {
      status: finalStatus,
      submittedAt: now,
      autoScore,
      finalScore: finalScore !== null ? finalScore : undefined,
      traversedRoute: routeResult.traversedNodeIds,
    }, 'in_progress');

    if (!updatedSession) {
      return NextResponse.json({ error: 'Cannot submit a session that has already been submitted or completed' }, { status: 400 });
    }

    const showImmediate = exam.showResultsImmediately === true;

    return NextResponse.json({
      success: true,
      session: {
        id: updatedSession?.id,
        status: updatedSession?.status,
        submittedAt: updatedSession?.submittedAt,
        autoScore: showImmediate ? updatedSession?.autoScore : null,
        finalScore: showImmediate ? updatedSession?.finalScore : null,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        passed: showImmediate && finalScore !== null ? finalScore >= exam.passingMarks : null,
        pendingManualGrading: pendingManualGradingCount > 0,
      },
      message: isLate
        ? 'Examination submitted after deadline (recorded as timed out)'
        : 'Examination submitted successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to submit examination' }, { status: 500 });
  }
}
