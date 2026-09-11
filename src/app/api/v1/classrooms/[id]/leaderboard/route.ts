import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const classroom = classroomDb.getClassroom(id);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    if (!classroom.settings.leaderboardEnabled) {
      return NextResponse.json({ error: 'Leaderboard is disabled by the instructor.', disabled: true }, { status: 403 });
    }

    const leaderboard = classroomDb.getLeaderboard(id);
    return NextResponse.json({ leaderboard });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get leaderboard' }, { status: 500 });
  }
}
