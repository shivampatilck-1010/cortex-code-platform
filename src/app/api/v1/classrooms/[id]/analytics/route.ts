import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const classroom = classroomDb.getClassroom(id);
    const isTeacher = classroom?.teacherId === user.id || auth.context?.membership?.role === 'teacher';

    const analytics = classroomDb.getClassroomAnalytics(id);
    const studentProgress = !isTeacher ? classroomDb.getStudentProgress(id, user.id) : undefined;

    return NextResponse.json({
      analytics,
      studentProgress,
      isTeacher,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get analytics' }, { status: 500 });
  }
}
