import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

export async function POST(req: NextRequest) {
  try {
    const user = ClassroomAuth.getCurrentUser(req);
    const body = await req.json().catch(() => ({}));
    const { joinCode } = body;

    if (!joinCode || !joinCode.trim()) {
      return NextResponse.json({ error: 'Please enter a valid class code.' }, { status: 400 });
    }

    const cleanCode = joinCode.toUpperCase().trim();
    const classroom = classroomDb.getClassroomByJoinCode(cleanCode);

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found. Please verify the code.' }, { status: 404 });
    }

    if (classroom.status === 'archived') {
      return NextResponse.json({ error: 'This classroom has been archived and is no longer accepting new members.' }, { status: 400 });
    }

    if (!classroom.joinEnabled) {
      return NextResponse.json({ error: 'Joining is currently disabled for this classroom by the instructor.' }, { status: 400 });
    }

    // Check if user is already an active member
    const existing = classroomDb.getMember(classroom.id, user.id);
    if (existing && existing.status === 'active') {
      return NextResponse.json({
        error: 'You are already an active member of this classroom.',
        alreadyMember: true,
        classroomId: classroom.id,
        classroom,
      }, { status: 400 });
    }

    // Add or reactivate member
    const member = classroomDb.addMember({
      id: existing ? existing.id : `mem_${classroom.id}_${user.id}`,
      classroomId: classroom.id,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role === 'teacher' ? 'teacher' : 'student',
      status: 'active',
      isOnline: true,
      joinedAt: existing ? existing.joinedAt : Date.now(),
      lastActiveAt: Date.now(),
    });

    // Notify instructor
    classroomDb.createNotification({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: classroom.teacherId,
      classroomId: classroom.id,
      type: 'enrollment',
      title: 'New Student Joined',
      message: `${user.name} joined ${classroom.name}.`,
      createdAt: Date.now(),
    });

    // Broadcast student.joined
    realtimeCoordinator.broadcast(
      classroom.id,
      'student.joined',
      {
        userId: user.id,
        userName: user.name,
        role: member.role,
        onlineCount: realtimeCoordinator.getOnlineCount(classroom.id),
      },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({
      success: true,
      classroom,
      member,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to join classroom' }, { status: 500 });
  }
}
