import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

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
    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const session = await classroomDb.getExamSession(sessionId);

    if (!session || session.examId !== examId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify student ownership
    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: Session does not belong to you' }, { status: 403 });
    }

    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.floor((session.expiresAt - now) / 1000));

    // Update heartbeat timestamp on session with direct optimized write
    await classroomDb.touchSessionHeartbeat(sessionId, now);

    return NextResponse.json({
      ok: true,
      serverTime: now,
      expiresAt: session.expiresAt,
      remainingSeconds,
      status: session.status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to record heartbeat' }, { status: 500 });
  }
}
