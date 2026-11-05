import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Teacher authorization required' }, { status: 403 });
    }

    const question = await classroomDb.getQuestionBankItem(id);
    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (question.teacherId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied to this question' }, { status: 403 });
    }

    return NextResponse.json({ question });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch question' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Teacher authorization required' }, { status: 403 });
    }

    const existing = await classroomDb.getQuestionBankItem(id);
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (existing.teacherId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied to modify this question' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const updated = await classroomDb.updateQuestionBankItem(id, body);

    return NextResponse.json({ success: true, question: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update question' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Teacher authorization required' }, { status: 403 });
    }

    const existing = await classroomDb.getQuestionBankItem(id);
    if (!existing) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    if (existing.teacherId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied to delete this question' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const hardDelete = searchParams.get('hard') === 'true';

    await classroomDb.deleteQuestionBankItem(id, hardDelete);

    return NextResponse.json({ success: true, archived: !hardDelete, deleted: hardDelete });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete question' }, { status: 500 });
  }
}
