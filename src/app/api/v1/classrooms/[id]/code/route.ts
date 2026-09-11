import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

function generateClassCode(): string {
  // 6-8 chars uppercase alphanumeric, skipping confusing characters like 0/O, 1/I
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can regenerate the join code.' }, { status: 403 });
    }

    let newCode = generateClassCode();
    // Ensure uniqueness
    let existing = classroomDb.getClassroomByJoinCode(newCode);
    let attempts = 0;
    while (existing && attempts < 10) {
      newCode = generateClassCode();
      existing = classroomDb.getClassroomByJoinCode(newCode);
      attempts++;
    }

    const updated = classroomDb.regenerateJoinCode(id, newCode);
    if (!updated) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
    realtimeCoordinator.broadcast(
      id,
      'classroom.updated',
      { classroom: updated },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, joinCode: newCode, classroom: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to regenerate class code' }, { status: 500 });
  }
}
