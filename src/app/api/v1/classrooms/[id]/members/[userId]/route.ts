import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can remove students.' }, { status: 403 });
    }

    const member = classroomDb.getMember(id, userId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this classroom.' }, { status: 404 });
    }

    if (member.role === 'teacher') {
      return NextResponse.json({ error: 'Cannot remove the primary instructor from the classroom.' }, { status: 400 });
    }

    classroomDb.removeMember(id, userId);

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
    // Broadcast authoritative student.removed event
    realtimeCoordinator.broadcast(
      id,
      'student.removed',
      {
        userId,
        userName: member.userName,
        removedBy: user.name,
      },
      { id: user.id, name: user.name }
    );

    // Persist a notification for the student
    classroomDb.createNotification({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      classroomId: id,
      type: 'enrollment',
      title: 'Classroom Enrollment Update',
      message: `You have been removed from the classroom by ${user.name}.`,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      success: true,
      removedUserId: userId,
      userName: member.userName,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to remove member' }, { status: 500 });
  }
}
