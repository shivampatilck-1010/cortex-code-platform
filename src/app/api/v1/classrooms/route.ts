import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { Classroom } from '@/lib/classroom/models';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const user = ClassroomAuth.getCurrentUser(req);
    const classrooms = classroomDb.listClassroomsForUser(user.id);
    return NextResponse.json({ classrooms });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list classrooms' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = ClassroomAuth.getCurrentUser(req);
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Teacher privileges required for this action.' }, { status: 403 });
    }
    const body = await req.json();
    const { name, subject, description, settings } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Classroom name is required' }, { status: 400 });
    }

    const classroomId = `CLS_${crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
    const joinCode = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();

    const newClassroom: Classroom = {
      id: classroomId,
      name: name.trim(),
      courseCode: body.courseCode || 'CS-NEW',
      academicYear: body.academicYear || '2024-2025',
      section: body.section || 'Sec 01',
      subject: subject || 'Computer Science',
      description: description || '',
      teacherId: user.id,
      teacherName: user.name,
      joinCode,
      joinEnabled: true,
      status: 'active',
      settings: {
        allowStudentPosting: true,
        allowStudentMessaging: true,
        allowCodeSharing: true,
        leaderboardEnabled: true,
        defaultAIPolicy: 'hints_only',
        ...(settings || {}),
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    classroomDb.createClassroom(newClassroom);

    // Register teacher as member
    classroomDb.addMember({
      id: `mem_${classroomId}_${user.id}`,
      classroomId,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: 'teacher',
      status: 'active',
      isOnline: true,
      joinedAt: Date.now(),
      lastActiveAt: Date.now(),
    });

    realtimeCoordinator.broadcast(
      classroomId,
      'classroom.updated',
      { classroom: newClassroom },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, classroom: newClassroom });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create classroom' }, { status: 500 });
  }
}
