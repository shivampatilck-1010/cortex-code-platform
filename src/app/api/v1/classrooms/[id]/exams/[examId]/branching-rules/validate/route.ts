import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  return handleValidate(req, params);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; examId: string }> }
) {
  return handleValidate(req, params);
}

async function handleValidate(
  req: NextRequest,
  paramsPromise: Promise<{ id: string; examId: string }>
) {
  try {
    const { id, examId } = await paramsPromise;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher authorization required' }, { status: 403 });
    }

    const exam = await classroomDb.getExam(examId);
    if (!exam || exam.classroomId !== id.toUpperCase().trim()) {
      return NextResponse.json({ error: 'Examination not found' }, { status: 404 });
    }

    const result = await classroomDb.validateBranchingRules(examId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to validate branching rules' }, { status: 500 });
  }
}
