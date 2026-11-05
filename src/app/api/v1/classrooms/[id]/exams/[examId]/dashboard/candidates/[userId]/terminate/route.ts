import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { gradeQuestionResponse } from '@/lib/classroom/exam-grader';
import { computeActiveExamRoute } from '@/lib/classroom/exam-branching';
import { authorizeRbacRequest, AuditRole } from '@/lib/lockdown/privacy-governance';
import { revokeSession } from '@/lib/lockdown/security-policy';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; userId: string }> }
) {
  try {
    const { id, examId, userId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const teacher = await ClassroomAuth.getCurrentUser(req);
    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const sessions = await classroomDb.getUserExamSessions(examId, userId);
    const activeSession = sessions.find((s) => s.status === 'in_progress');

    if (!activeSession) {
      return NextResponse.json({ error: 'No active in-progress session found for this candidate' }, { status: 404 });
    }

    const actorRole = (teacher.role === 'admin' ? 'department_dean' : 'faculty_lead') as AuditRole;
    const rbac = authorizeRbacRequest(
      {
        actorId: teacher.id,
        actorRole,
        assignedExamIds: [examId],
      },
      'TERMINATE_SESSION',
      {
        resourceType: 'session',
        targetExamId: examId,
        targetStudentId: userId,
        targetSessionId: activeSession.id,
      }
    );

    if (!rbac.authorized) {
      return NextResponse.json({
        error: rbac.message,
        errorCode: rbac.errorCode || 'FORBIDDEN',
      }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || 'Terminated by instructor').trim();
    const action = body.action === 'force_submit' ? 'force_submit' : 'terminate';
    const targetStatus = action === 'force_submit' ? 'submitted' : 'timed_out';

    // 1. Grade existing responses and calculate route
    const questions = await classroomDb.listExamQuestions(examId);
    const existingResponses = await classroomDb.listExamResponses(activeSession.id);
    const responseMap = new Map(existingResponses.map((r) => [r.questionId, r]));

    const rules = await classroomDb.listExamBranchingRules(examId);
    const responsesObj: Record<string, any> = {};
    for (const r of existingResponses) {
      responsesObj[r.questionId] = r.response;
    }

    const routeResult = computeActiveExamRoute({
      exam,
      rules,
      responses: responsesObj,
    });
    const activeQuestionSet = new Set(routeResult.activeQuestionIds);

    let totalEarnedScore = 0;
    let pendingManualGradingCount = 0;

    for (const q of questions) {
      const resp = responseMap.get(q.id);
      if (!activeQuestionSet.has(q.id)) {
        if (resp) {
          await classroomDb.saveExamResponse({
            id: resp.id,
            sessionId: activeSession.id,
            questionId: q.id,
            response: resp.response,
            earnedPoints: 0,
            gradingStatus: 'auto_graded',
            graderNotes: 'Question excluded from scoring as candidate took a different branch',
            flaggedForReview: resp.flaggedForReview,
          });
        }
        continue;
      }

      if (resp) {
        const gradeResult = gradeQuestionResponse(q, resp.response);
        totalEarnedScore += gradeResult.earnedPoints;
        if (gradeResult.status === 'pending') {
          pendingManualGradingCount++;
        }
        await classroomDb.saveExamResponse({
          id: resp.id,
          sessionId: activeSession.id,
          questionId: q.id,
          response: resp.response,
          earnedPoints: gradeResult.earnedPoints,
          gradingStatus: gradeResult.status,
          graderNotes: gradeResult.feedback || '',
          flaggedForReview: resp.flaggedForReview,
        });
      }
    }

    const autoScore = Math.max(0, Math.round(totalEarnedScore * 100) / 100);
    const finalScore = pendingManualGradingCount === 0 ? autoScore : null;

    // 2. Record integrity event for audit trail
    await classroomDb.createExamIntegrityEvent({
      sessionId: activeSession.id,
      eventType: 'proctor_action',
      timestamp: Date.now(),
      details: {
        action: action === 'force_submit' ? 'force_submitted_by_teacher' : 'session_terminated_by_teacher',
        teacherId: teacher.id,
        teacherName: teacher.name,
        candidateUserId: userId,
        reason,
        autoScore,
        finalScore,
        pendingManualGradingCount,
      },
    });

    await classroomDb.appendLockdownAuditEntry({
      actorId: teacher.id,
      actorRole,
      action: 'TERMINATE_SESSION',
      resourceType: 'session',
      resourceId: activeSession.id,
      targetStudentId: userId,
      targetExamId: examId,
      outcome: 'GRANTED',
      reason: `Terminated attempt: ${reason} (action: ${action})`,
    });

    // 3. Lock session status atomically (guarantees exactly-once finalization)
    const updated = await classroomDb.updateExamSession(activeSession.id, {
      status: targetStatus,
      submittedAt: Date.now(),
      autoScore,
      finalScore: finalScore !== null ? finalScore : undefined,
      traversedRoute: routeResult.traversedNodeIds,
      teacherFeedback: `Session concluded early by teacher: ${reason}`,
    }, 'in_progress');

    if (!updated) {
      return NextResponse.json({
        error: 'Cannot terminate a session that has already been submitted or completed',
      }, { status: 400 });
    }

    // Revoke session in memory and persistent token registry to immediately propagate revocation
    revokeSession(activeSession.id, reason);
    await classroomDb.revokeSession({
      sessionId: activeSession.id,
      examId,
      userId,
      revokedBy: teacher.id,
      reason,
    });
    await classroomDb.revokeToken({
      identifier: activeSession.id,
      type: 'session',
      reason,
    });

    return NextResponse.json({
      success: true,
      message: action === 'force_submit'
        ? 'Candidate examination successfully force-submitted and auto-graded'
        : 'Examination attempt terminated successfully',
      session: updated,
      pendingManualGrading: pendingManualGradingCount > 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to terminate attempt' }, { status: 500 });
  }
}
