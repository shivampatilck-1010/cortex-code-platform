import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function POST(
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

    const body = await req.json();
    const orderedQuestionIds = Array.isArray(body.orderedQuestionIds) ? body.orderedQuestionIds : [];

    if (orderedQuestionIds.length === 0) {
      return NextResponse.json({ error: 'orderedQuestionIds must be a non-empty array' }, { status: 400 });
    }

    await classroomDb.reorderExamQuestions(examId, orderedQuestionIds);
    const questions = await classroomDb.listExamQuestions(examId);

    return NextResponse.json({ success: true, questions });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to reorder questions' }, { status: 500 });
  }
}
