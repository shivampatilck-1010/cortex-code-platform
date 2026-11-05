import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ExamQuestionType } from '@/lib/classroom/models';
import { sanitizeQuestionForStudent } from '@/lib/classroom/exam-sanitizer';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  try {
    const { id, examId } = await params;
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

    if (!isTeacher && exam.status === 'draft') {
      return NextResponse.json({ error: 'Examination is in draft status' }, { status: 403 });
    }

    const questions = await classroomDb.listExamQuestions(examId);

    if (isTeacher) {
      return NextResponse.json({ questions });
    }

    const sanitizedQuestions = questions.map(sanitizeQuestionForStudent);
    return NextResponse.json({ questions: sanitizedQuestions });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list questions' }, { status: 500 });
  }
}

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

    const validTypes: ExamQuestionType[] = [
      'mcq_single',
      'mcq_multiple',
      'true_false',
      'numerical',
      'short_answer',
      'programming',
    ];

    const questionType: ExamQuestionType = body.questionType;
    if (!validTypes.includes(questionType)) {
      return NextResponse.json({
        error: `Invalid question type '${questionType}'. Supported types: ${validTypes.join(', ')}`,
      }, { status: 400 });
    }

    const promptText = (body.promptText || '').trim();
    if (!promptText) {
      return NextResponse.json({ error: 'Prompt text is required' }, { status: 400 });
    }

    const points = body.points !== undefined ? parseFloat(body.points) : 1.0;
    if (isNaN(points) || points <= 0) {
      return NextResponse.json({ error: 'Points must be a positive number' }, { status: 400 });
    }

    const existingQuestions = await classroomDb.listExamQuestions(examId);
    const sortOrder = body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : existingQuestions.length;

    const question = await classroomDb.createExamQuestion({
      examId,
      sectionId: body.sectionId || null,
      questionType,
      promptText,
      promptMediaUrl: body.promptMediaUrl || null,
      options: Array.isArray(body.options) ? body.options : [],
      correctAnswer: body.correctAnswer !== undefined ? body.correctAnswer : {},
      testCases: Array.isArray(body.testCases) ? body.testCases : [],
      initialCode: body.initialCode || null,
      language: body.language || null,
      points,
      negativeMarks: body.negativeMarks !== undefined ? Math.abs(parseFloat(body.negativeMarks)) : 0.0,
      numericalTolerance: body.numericalTolerance !== undefined ? Math.abs(parseFloat(body.numericalTolerance)) : 0.0,
      sortOrder,
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create question' }, { status: 500 });
  }
}
