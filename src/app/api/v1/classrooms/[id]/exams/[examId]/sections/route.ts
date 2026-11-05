import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

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

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const sections = await classroomDb.listExamSections(examId);
    return NextResponse.json({ sections });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list exam sections' }, { status: 500 });
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
    const title = (body.title || '').trim();
    if (!title) {
      return NextResponse.json({ error: 'Section title is required' }, { status: 400 });
    }

    const existingSections = await classroomDb.listExamSections(examId);
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : existingSections.length;

    const section = await classroomDb.createExamSection({
      examId,
      title,
      description: (body.description || '').trim(),
      instructions: (body.instructions || '').trim(),
      isMandatory: body.isMandatory !== false,
      timeLimitMinutes: typeof body.timeLimitMinutes === 'number' ? body.timeLimitMinutes : 0,
      sectionMarks: typeof body.sectionMarks === 'number' ? body.sectionMarks : 0,
      sortOrder,
    });

    return NextResponse.json({ section }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create section' }, { status: 500 });
  }
}
