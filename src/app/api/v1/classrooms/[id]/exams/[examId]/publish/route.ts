import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { VALID_EXAM_TRANSITIONS, ExamStatus } from '@/lib/classroom/models';

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

    const body = await req.json().catch(() => ({}));
    const targetStatus: ExamStatus = body.status || (exam.status === 'draft' ? 'published' : 'draft');

    const allowed = VALID_EXAM_TRANSITIONS[exam.status] || [];
    if (!allowed.includes(targetStatus)) {
      return NextResponse.json({
        error: `Cannot transition from '${exam.status}' to '${targetStatus}'. Allowed: ${allowed.join(', ')}`,
      }, { status: 400 });
    }

    const updated = await classroomDb.updateExam(examId, { status: targetStatus });
    return NextResponse.json({ exam: updated, status: targetStatus });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to toggle publish status' }, { status: 500 });
  }
}
