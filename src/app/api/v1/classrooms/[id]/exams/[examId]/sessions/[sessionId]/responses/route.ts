import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { computeActiveExamRoute } from '@/lib/classroom/exam-branching';

export async function GET(
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

    const isTeacher =
      user.role === 'admin' ||
      auth.context?.membership?.role === 'teacher' ||
      (await classroomDb.getClassroom(id))?.teacherId === user.id;

    // Students can only view their own responses
    if (!isTeacher && session.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied to session responses' }, { status: 403 });
    }

    const responses = await classroomDb.listExamResponses(sessionId);
    return NextResponse.json({ responses });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list responses' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; examId: string; sessionId: string }> }
) {
  return PUT(req, ctx);
}

export async function PUT(
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
    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const session = await classroomDb.getExamSession(sessionId);
    if (!session || session.examId !== examId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Cannot save responses to another student\'s session' }, { status: 403 });
    }

    if (session.status !== 'in_progress') {
      return NextResponse.json({ error: `Cannot save responses to a ${session.status} session` }, { status: 400 });
    }

    const now = Date.now();
    const GRACE_PERIOD_MS = 30 * 1000; // 30-second network delivery grace period strictly for final submission

    // Once duration has passed, answering is closed. Responses cannot be modified after expiresAt.
    if (now > session.expiresAt) {
      if (now > session.expiresAt + GRACE_PERIOD_MS) {
        await classroomDb.updateExamSession(sessionId, { status: 'timed_out' });
      }
      return NextResponse.json({
        error: 'Examination duration has ended. Please submit your answers.',
        expired: true,
        expiresAt: session.expiresAt,
        serverTime: now,
      }, { status: 403 });
    }

    const body = await req.json();
    const questionId = body.questionId;
    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    // Verify timestamp integrity: client timestamp cannot be in the future
    const clientTimestamp = body.clientTimestamp !== undefined ? body.clientTimestamp : body.updatedAt;
    if (typeof clientTimestamp === 'number' && clientTimestamp > now + 1000) {
      return NextResponse.json({
        error: 'Client timestamp cannot be in the future',
        serverTime: now,
      }, { status: 400 });
    }

    // Clean user response to prevent client-injected scoring fields
    let userAns = body.response !== undefined ? body.response : {};
    if (userAns && typeof userAns === 'object' && !Array.isArray(userAns)) {
      const { earnedPoints, gradingStatus, graderNotes, ...cleanAns } = userAns as any;
      userAns = cleanAns;
    }

    const response = await classroomDb.saveExamResponse({
      sessionId,
      questionId,
      response: userAns,
      flaggedForReview: !!body.flaggedForReview,
      updatedAt: typeof clientTimestamp === 'number' ? clientTimestamp : now,
    });

    // Update heartbeat timestamp on session with direct optimized write
    await classroomDb.touchSessionHeartbeat(sessionId, now);

    // Recalculate route if branching rules are defined
    let routeInfo: any = null;
    const rules = await classroomDb.listExamBranchingRules(examId);
    if (rules.length > 0 && exam) {
      const allResp = await classroomDb.listExamResponses(sessionId);
      const respMap: Record<string, any> = {};
      for (const r of allResp) respMap[r.questionId] = r.response;
      respMap[questionId] = userAns;
      const activeRoute = computeActiveExamRoute({ exam, rules, responses: respMap });
      await classroomDb.updateExamSession(sessionId, {
        traversedRoute: activeRoute.traversedNodeIds,
        currentSectionId: activeRoute.currentDestinationId,
      });
      routeInfo = {
        activeSectionIds: activeRoute.activeSectionIds,
        activeQuestionIds: activeRoute.activeQuestionIds,
        effectiveTotalMarks: activeRoute.effectiveTotalMarks,
      };
    }

    return NextResponse.json({ success: true, response, routeInfo, serverTime: now, staleRejected: !!response.staleRejected });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to save response' }, { status: 500 });
  }
}
