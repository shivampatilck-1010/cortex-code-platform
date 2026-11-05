import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const sessions = await classroomDb.listExamSessions(examId);

    // Enrich sessions with integrity event counts
    const enrichedSessions = await Promise.all(
      sessions.map(async (sess) => {
        const events = await classroomDb.listExamIntegrityEvents(sess.id);
        const responses = await classroomDb.listExamResponses(sess.id);
        return {
          ...sess,
          integrityEventCount: events.length,
          integrityEvents: events,
          responseCount: responses.length,
        };
      })
    );

    return NextResponse.json({ submissions: enrichedSessions });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list submissions' }, { status: 500 });
  }
}
