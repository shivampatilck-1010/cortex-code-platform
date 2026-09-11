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
      const status = auth.error?.includes('Authentication required') ? 401 : 403;
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status });
    }

    const isInstructor = Boolean(auth.context?.isTeacher || auth.context?.isAdmin);
    const allEvents = classroomDb.getEventsSince(id, 0);

    const events = allEvents.filter((ev) => {
      // 1. Direct message privacy: only sender, recipient, and instructors
      if (ev.type === 'message.created' && (ev.payload?.message?.recipientType === 'direct' || ev.payload?.message?.recipientType === 'teacher')) {
        const recipientId = ev.payload?.message?.recipientId;
        const senderId = ev.payload?.message?.senderId || ev.actorId;
        return isInstructor || user.id === recipientId || user.id === senderId;
      }
      // 2. Grade event privacy: only target student and instructors
      if (ev.type === 'grade.updated' || ev.type === 'submission.graded') {
        const gradeStudentId = ev.payload?.submission?.studentId || ev.payload?.studentId;
        return isInstructor || user.id === gradeStudentId;
      }
      return true;
    });

    return NextResponse.json({ events });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get history' }, { status: 500 });
  }
}
