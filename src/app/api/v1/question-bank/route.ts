import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { QuestionBankDifficulty, ExamQuestionType } from '@/lib/classroom/models';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Teacher authorization required to access question bank' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get('subject') || undefined;
    const topic = searchParams.get('topic') || undefined;
    const difficulty = (searchParams.get('difficulty') as QuestionBankDifficulty) || undefined;
    const questionType = (searchParams.get('questionType') as ExamQuestionType) || undefined;
    const tag = searchParams.get('tag') || undefined;
    const search = searchParams.get('search') || undefined;
    const includeArchived = searchParams.get('includeArchived') === 'true' || searchParams.get('includeArchived') === '1';

    const questions = await classroomDb.listQuestionBankItems(user.id, {
      subject,
      topic,
      difficulty,
      questionType,
      tag,
      search,
      includeArchived,
    });

    return NextResponse.json({ questions, total: questions.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list question bank items' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Teacher authorization required to create question bank items' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (!body.promptText || typeof body.promptText !== 'string' || !body.promptText.trim()) {
      return NextResponse.json({ error: 'Question prompt text is required' }, { status: 400 });
    }
    if (!body.questionType) {
      return NextResponse.json({ error: 'questionType is required' }, { status: 400 });
    }

    const created = await classroomDb.createQuestionBankItem({
      teacherId: user.id,
      classroomId: body.classroomId || null,
      subject: body.subject || 'General',
      topic: body.topic || 'General',
      difficulty: body.difficulty || 'medium',
      questionType: body.questionType,
      promptText: body.promptText.trim(),
      promptMediaUrl: body.promptMediaUrl || null,
      options: Array.isArray(body.options) ? body.options : [],
      correctAnswer: body.correctAnswer || {},
      testCases: Array.isArray(body.testCases) ? body.testCases : [],
      initialCode: body.initialCode || null,
      language: body.language || null,
      defaultPoints: typeof body.defaultPoints === 'number' ? body.defaultPoints : 1.0,
      negativeMarks: typeof body.negativeMarks === 'number' ? body.negativeMarks : 0.0,
      numericalTolerance: typeof body.numericalTolerance === 'number' ? body.numericalTolerance : 0.0,
      tags: Array.isArray(body.tags) ? body.tags : [],
      isArchived: false,
    });

    return NextResponse.json({ success: true, question: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create question bank item' }, { status: 500 });
  }
}
