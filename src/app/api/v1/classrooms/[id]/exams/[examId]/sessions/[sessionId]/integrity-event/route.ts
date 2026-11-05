import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ExamIntegrityEventType } from '@/lib/classroom/models';

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

    if (session.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized session event' }, { status: 403 });
    }

    const body = await req.json();
    const validEventTypes: ExamIntegrityEventType[] = [
      'fullscreen_exit',
      'window_blur',
      'tab_hidden',
      'paste_attempt',
      'reconnect',
    ];

    const eventType: ExamIntegrityEventType = body.eventType;
    if (!validEventTypes.includes(eventType)) {
      return NextResponse.json({ error: `Invalid eventType '${eventType}'` }, { status: 400 });
    }

    const event = await classroomDb.createExamIntegrityEvent({
      sessionId,
      eventType,
      timestamp: Date.now(),
      details: body.details || {},
    });

    return NextResponse.json({ success: true, event });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to record integrity event' }, { status: 500 });
  }
}
