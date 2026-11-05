import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; userId: string }> }
) {
  try {
    const { id, examId, userId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const sessions = await classroomDb.getUserExamSessions(examId, userId);
    const activeSession = sessions[0] || null;

    if (!activeSession) {
      return NextResponse.json({
        userId,
        status: 'not_started',
        session: null,
        responses: [],
        integrityEvents: [],
      });
    }

    const responses = await classroomDb.listExamResponses(activeSession.id);
    const integrityEvents = await classroomDb.listExamIntegrityEvents(activeSession.id);

    return NextResponse.json({
      userId,
      session: activeSession,
      responses,
      integrityEvents,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get candidate details' }, { status: 500 });
  }
}
