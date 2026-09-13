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
      return NextResponse.json({ error: auth.error || 'Only instructors can archive a classroom.' }, { status: 403 });
    }

    const archived = await classroomDb.archiveClassroom(id);
    if (!archived) {
      return NextResponse.json({ error: 'Classroom not found or already archived' }, { status: 404 });
    }

    const user = auth.context?.user || (await ClassroomAuth.getCurrentUser(req));
    realtimeCoordinator.broadcast(
      id,
      'classroom.archived',
      { classroomId: id, archivedAt: archived.archivedAt },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, classroom: archived });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to archive classroom' }, { status: 500 });
  }
}
