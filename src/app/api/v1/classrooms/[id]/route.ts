import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

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

    const members = classroomDb.listMembers(id);
    const announcements = classroomDb.listAnnouncements(id);

    return NextResponse.json({
      classroom,
      memberCount: members.length,
      announcementCount: announcements.length,
      currentRole: auth.context?.isTeacher ? 'teacher' : (auth.context?.membership?.role || 'student'),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch classroom' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can modify classroom settings.' }, { status: 403 });
    }

    const body = await req.json();
    const existing = classroomDb.getClassroom(id);
    if (!existing) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.subject !== undefined) updates.subject = body.subject.trim();
    if (body.description !== undefined) updates.description = body.description.trim();
    if (body.courseCode !== undefined) updates.courseCode = body.courseCode.trim();
    if (body.academicYear !== undefined) updates.academicYear = body.academicYear.trim();
    if (body.section !== undefined) updates.section = body.section.trim();
    if (body.joinEnabled !== undefined) updates.joinEnabled = Boolean(body.joinEnabled);

    if (body.settings !== undefined) {
      updates.settings = {
        ...existing.settings,
        ...body.settings,
      };
    }

    const updated = classroomDb.updateClassroom(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update classroom' }, { status: 500 });
    }

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
    realtimeCoordinator.broadcast(
      id,
      'classroom.updated',
      { classroom: updated },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, classroom: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update classroom' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only instructors can archive a classroom.' }, { status: 403 });
    }

    const archived = classroomDb.archiveClassroom(id);
    if (!archived) {
      return NextResponse.json({ error: 'Classroom not found or already archived' }, { status: 404 });
    }

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
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
