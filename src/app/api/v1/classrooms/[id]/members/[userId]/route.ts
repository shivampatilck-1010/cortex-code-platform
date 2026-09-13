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
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can remove students.' }, { status: 403 });
    }

    const actingUser = auth.context!.user;

    // Verify the target is in THIS classroom
    const member = await classroomDb.getMember(id, userId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this classroom.' }, { status: 404 });
    }

    if (member.role === 'teacher') {
      return NextResponse.json({ error: 'Cannot remove the primary instructor from the classroom.' }, { status: 400 });
    }

    await classroomDb.removeMember(id, userId);

    // Broadcast authoritative student.removed event
    realtimeCoordinator.broadcast(
      id,
      'student.removed',
      {
        userId,
        userName: member.userName,
        removedBy: actingUser.name,
      },
      { id: actingUser.id, name: actingUser.name }
    );

    // Persist a notification for the student
    await classroomDb.createNotification({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      classroomId: id,
      type: 'enrollment',
      title: 'Classroom Enrollment Update',
      message: `You have been removed from the classroom by ${actingUser.name}.`,
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
    const body = await req.json();
    const { action, suspensionDurationMs } = body;

    // Validate action
    if (!action || !['suspend', 'restore'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "suspend" or "restore".' }, { status: 400 });
    }

    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can manage student status.' }, { status: 403 });
    }

    const actingUser = auth.context!.user;

    // Verify the target member is in THIS classroom
    const member = await classroomDb.getMember(id, userId);
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this classroom.' }, { status: 404 });
    }

    if (member.role === 'teacher') {
      return NextResponse.json({ error: 'Cannot suspend the primary instructor.' }, { status: 400 });
    }

    // Prevent teacher from suspending themselves
    if (userId === actingUser.id) {
      return NextResponse.json({ error: 'You cannot suspend yourself.' }, { status: 400 });
    }

    let updatedMember;
    let broadcastEvent: string;

    if (action === 'suspend') {
      // Calculate optional expiry
      const suspensionExpiresAt = suspensionDurationMs && typeof suspensionDurationMs === 'number'
        ? Date.now() + suspensionDurationMs
        : undefined;

      updatedMember = await classroomDb.suspendMember(id, userId, suspensionExpiresAt);
      broadcastEvent = 'student.suspended';

      // Notify the suspended student
      await classroomDb.createNotification({
        id: `notif_suspend_${Date.now()}_${userId}`,
        userId,
        classroomId: id,
        type: 'enrollment',
        title: 'Classroom Access Suspended',
        message: suspensionExpiresAt
          ? `Your access to this classroom has been temporarily suspended until ${new Date(suspensionExpiresAt).toLocaleDateString()}.`
          : `Your access to this classroom has been suspended.`,
        createdAt: Date.now(),
      });
    } else {
      // Restore
      updatedMember = await classroomDb.restoreMember(id, userId);
      broadcastEvent = 'student.restored';

      // Notify the restored student
      await classroomDb.createNotification({
        id: `notif_restore_${Date.now()}_${userId}`,
        userId,
        classroomId: id,
        type: 'enrollment',
        title: 'Classroom Access Restored',
        message: 'Your access to this classroom has been restored.',
        createdAt: Date.now(),
      });
    }

    realtimeCoordinator.broadcast(
      id,
      broadcastEvent,
      {
        userId,
        userName: member.userName,
        actedBy: actingUser.name,
        newStatus: action === 'suspend' ? 'suspended' : 'active',
      },
      { id: actingUser.id, name: actingUser.name }
    );

    return NextResponse.json({
      success: true,
      action,
      member: updatedMember,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update member status' }, { status: 500 });
  }
}
