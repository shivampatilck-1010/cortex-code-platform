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

    if (exam.status !== 'draft') {
      return NextResponse.json({ error: 'Cannot add questions to a published or active examination' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { bankQuestionId, sectionId, pointsOverride, sortOrder } = body;

    if (!bankQuestionId) {
      return NextResponse.json({ error: 'bankQuestionId is required' }, { status: 400 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);

    // Immutable snapshot: copies question data completely into exam_questions
    const importedQuestion = await classroomDb.importQuestionBankItemToExam({
      bankQuestionId,
      examId,
      sectionId,
      pointsOverride,
      sortOrder,
      teacherId: user.role === 'admin' ? undefined : user.id,
    });

    return NextResponse.json({ success: true, question: importedQuestion }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to import question from bank' }, { status: 500 });
  }
}
