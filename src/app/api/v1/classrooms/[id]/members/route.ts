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

    let members = classroomDb.listMembers(id);

    // If student and member visibility is restricted, show instructors only
    if (!auth.context?.isTeacher && classroom.settings?.memberVisibility === false) {
      members = members.filter((m) => m.role === 'teacher' || m.role === 'ta');
    }

    return NextResponse.json({ members });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list members' }, { status: 500 });
  }
}
