import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; sessionId: string }> }
) {
  try {
    const { id, examId, sessionId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const session = await classroomDb.getExamSession(sessionId);
    if (!session || session.examId !== examId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { questionGrades, manualScore, finalScore, teacherFeedback, isPublished } = body;

    // Existing responses
    const currentResponses = await classroomDb.listExamResponses(sessionId);
    const responseMap = new Map(currentResponses.map((r) => [r.questionId, r]));

    // If itemized grades provided, update each response
    if (Array.isArray(questionGrades)) {
      for (const qg of questionGrades) {
        if (!qg.questionId) continue;
        const existing = responseMap.get(qg.questionId);
        await classroomDb.saveExamResponse({
          id: existing?.id,
          sessionId,
          questionId: qg.questionId,
          response: existing?.response || {},
          earnedPoints: typeof qg.earnedPoints === 'number' ? Math.max(0, qg.earnedPoints) : (existing?.earnedPoints || 0),
          gradingStatus: qg.gradingStatus || 'manually_graded',
          graderNotes: qg.graderNotes !== undefined ? String(qg.graderNotes) : (existing?.graderNotes || ''),
          flaggedForReview: existing?.flaggedForReview || false,
        });
      }
    }

    // Refresh responses after update
    const updatedResponses = await classroomDb.listExamResponses(sessionId);

    // Compute updated final score
    let calculatedFinalScore: number;
    if (typeof finalScore === 'number') {
      calculatedFinalScore = Math.max(0, Math.round(finalScore * 100) / 100);
    } else if (typeof manualScore === 'number') {
      calculatedFinalScore = Math.max(0, Math.round(((session.autoScore || 0) + manualScore) * 100) / 100);
    } else {
      // Sum all question earned points
      const totalEarned = updatedResponses.reduce((sum, r) => sum + (r.earnedPoints || 0), 0);
      calculatedFinalScore = Math.max(0, Math.round(totalEarned * 100) / 100);
    }

    const sessionUpdates: any = {
      finalScore: calculatedFinalScore,
    };
    if (typeof manualScore === 'number') {
      sessionUpdates.manualScore = manualScore;
    }
    if (typeof teacherFeedback === 'string') {
      sessionUpdates.teacherFeedback = teacherFeedback;
    }
    if (typeof isPublished === 'boolean') {
      sessionUpdates.isPublished = isPublished;
    }

    const updatedSession = await classroomDb.updateExamSession(sessionId, sessionUpdates);

    return NextResponse.json({
      success: true,
      session: updatedSession,
      responses: updatedResponses,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update grades' }, { status: 500 });
  }
}
