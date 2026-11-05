import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { sanitizeQuestionForStudent } from '@/lib/classroom/exam-sanitizer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; qId: string }> }
) {
  try {
    const { id, examId, qId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const user = await ClassroomAuth.getCurrentUser(req);
    const isTeacher =
      user.role === 'admin' ||
      auth.context?.membership?.role === 'teacher' ||
      (await classroomDb.getClassroom(id))?.teacherId === user.id;

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    if (!isTeacher) {
      if (exam.status === 'draft') {
        return NextResponse.json({ error: 'Question unavailable for draft examination' }, { status: 403 });
      }
      if (exam.assignedStudentIds && exam.assignedStudentIds.length > 0 && !exam.assignedStudentIds.includes(user.id)) {
        return NextResponse.json({ error: 'You are not assigned to this examination' }, { status: 403 });
      }
    }

    const question = await classroomDb.getExamQuestion(qId);
    if (!question || question.examId !== examId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (isTeacher) {
      return NextResponse.json({ question });
    }

    return NextResponse.json({ question: sanitizeQuestionForStudent(question) });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get question' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; qId: string }> }
) {
  try {
    const { id, examId, qId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const question = await classroomDb.getExamQuestion(qId);
    if (!question || question.examId !== examId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const body = await req.json();

    const updated = await classroomDb.updateExamQuestion(qId, {
      sectionId: body.sectionId !== undefined ? body.sectionId : undefined,
      questionType: body.questionType !== undefined ? body.questionType : undefined,
      promptText: body.promptText !== undefined ? String(body.promptText).trim() : undefined,
      promptMediaUrl: body.promptMediaUrl !== undefined ? body.promptMediaUrl : undefined,
      options: body.options !== undefined ? body.options : undefined,
      correctAnswer: body.correctAnswer !== undefined ? body.correctAnswer : undefined,
      testCases: body.testCases !== undefined ? body.testCases : undefined,
      initialCode: body.initialCode !== undefined ? body.initialCode : undefined,
      language: body.language !== undefined ? body.language : undefined,
      points: body.points !== undefined ? parseFloat(body.points) : undefined,
      negativeMarks: body.negativeMarks !== undefined ? Math.abs(parseFloat(body.negativeMarks)) : undefined,
      numericalTolerance: body.numericalTolerance !== undefined ? Math.abs(parseFloat(body.numericalTolerance)) : undefined,
      sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : undefined,
    });

    return NextResponse.json({ question: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update question' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; qId: string }> }
) {
  try {
    const { id, examId, qId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const question = await classroomDb.getExamQuestion(qId);
    if (!question || question.examId !== examId) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    await classroomDb.deleteExamQuestion(qId);
    return NextResponse.json({ success: true, message: 'Question deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete question' }, { status: 500 });
  }
}
