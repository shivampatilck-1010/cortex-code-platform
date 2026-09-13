import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only instructors can restore a classroom.' }, { status: 403 });
    }

    const classroom = await classroomDb.getClassroom(id);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    if (classroom.status !== 'archived') {
      return NextResponse.json({ error: 'Classroom is not archived' }, { status: 400 });
    }

    // Restore the classroom
    const updated = await classroomDb.restoreClassroom(id);
    
    if (!updated) {
      return NextResponse.json({ error: 'Failed to restore classroom' }, { status: 500 });
    }

    // Regenerate join code to prevent previously shared archived codes from working
    const newJoinCode = `CLS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const withNewCode = await classroomDb.regenerateJoinCode(id, newJoinCode);

    const user = auth.context?.user || (await ClassroomAuth.getCurrentUser(req));
    realtimeCoordinator.broadcast(
      id,
      'classroom.restored',
      { classroomId: id, classroom: updated },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, classroom: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to restore classroom' }, { status: 500 });
  }
}
