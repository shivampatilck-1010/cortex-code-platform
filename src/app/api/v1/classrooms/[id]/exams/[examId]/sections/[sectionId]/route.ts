import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; sectionId: string }> }
) {
  try {
    const { id, examId, sectionId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const section = await classroomDb.getExamSection(sectionId);
    if (!section || section.examId !== examId) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({ section });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get section' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; sectionId: string }> }
) {
  try {
    const { id, examId, sectionId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const section = await classroomDb.getExamSection(sectionId);
    if (!section || section.examId !== examId) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const body = await req.json();
    const updated = await classroomDb.updateExamSection(sectionId, {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      instructions: body.instructions !== undefined ? String(body.instructions).trim() : undefined,
      isMandatory: body.isMandatory !== undefined ? !!body.isMandatory : undefined,
      timeLimitMinutes: body.timeLimitMinutes !== undefined ? parseInt(body.timeLimitMinutes, 10) : undefined,
      sectionMarks: body.sectionMarks !== undefined ? parseFloat(body.sectionMarks) : undefined,
      sortOrder: body.sortOrder !== undefined ? parseInt(body.sortOrder, 10) : undefined,
    });

    return NextResponse.json({ section: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update section' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string; sectionId: string }> }
) {
  try {
    const { id, examId, sectionId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const section = await classroomDb.getExamSection(sectionId);
    if (!section || section.examId !== examId) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    await classroomDb.deleteExamSection(sectionId);
    return NextResponse.json({ success: true, message: 'Section removed' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete section' }, { status: 500 });
  }
}
