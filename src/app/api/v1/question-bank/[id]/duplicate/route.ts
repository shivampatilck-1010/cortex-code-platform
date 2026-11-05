import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Teacher authorization required' }, { status: 403 });
    }

    const duplicated = await classroomDb.duplicateQuestionBankItem(id, user.id);
    if (!duplicated) {
      return NextResponse.json({ error: 'Source question not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, question: duplicated }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to duplicate question' }, { status: 500 });
  }
}
