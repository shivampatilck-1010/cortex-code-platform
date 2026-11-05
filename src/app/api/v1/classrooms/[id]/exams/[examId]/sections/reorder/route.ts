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
    if (!Array.isArray(body.orderedSectionIds)) {
      return NextResponse.json({ error: 'orderedSectionIds array is required' }, { status: 400 });
    }

    await classroomDb.reorderExamSections(examId, body.orderedSectionIds);
    const sections = await classroomDb.listExamSections(examId);

    return NextResponse.json({ success: true, sections });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to reorder sections' }, { status: 500 });
  }
}
