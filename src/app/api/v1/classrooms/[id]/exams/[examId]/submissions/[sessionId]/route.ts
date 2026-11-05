import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
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

    const questions = await classroomDb.listExamQuestions(examId);
    const responses = await classroomDb.listExamResponses(sessionId);
    const integrityEvents = await classroomDb.listExamIntegrityEvents(sessionId);

    return NextResponse.json({
      session,
      exam,
      questions,
      responses,
      integrityEvents,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch submission details' }, { status: 500 });
  }
}
