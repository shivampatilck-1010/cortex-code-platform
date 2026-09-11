import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; annId: string }> }
) {
  try {
    const { id, annId } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can edit announcements.' }, { status: 403 });
    }

    const existing = classroomDb.getAnnouncement(annId);
    if (!existing || existing.classroomId !== id) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    const body = await req.json();
    const updates: any = {};
    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.content !== undefined) updates.content = body.content.trim();
    if (body.pinned !== undefined) updates.pinned = Boolean(body.pinned);

    const updated = classroomDb.updateAnnouncement(annId, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
    }

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
    realtimeCoordinator.broadcast(
      id,
      'announcement.updated',
      { announcement: updated },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, announcement: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update announcement' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; annId: string }> }
) {
  try {
    const { id, annId } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Only teachers can delete announcements.' }, { status: 403 });
    }

    const existing = classroomDb.getAnnouncement(annId);
    if (!existing || existing.classroomId !== id) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    classroomDb.deleteAnnouncement(annId);

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
    realtimeCoordinator.broadcast(
      id,
      'announcement.deleted',
      { announcementId: annId },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, announcementId: annId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete announcement' }, { status: 500 });
  }
}
