import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { Announcement } from '@/lib/classroom/models';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized) {
      const status = auth.error?.includes('Authentication required') ? 401 : 403;
      return NextResponse.json({ error: auth.error || 'Access denied' }, { status });
    }

    const announcements = classroomDb.listAnnouncements(id);
    return NextResponse.json({ announcements });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get announcements' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');
    if (!auth.authorized) {
      const status = auth.error?.includes('Authentication required') ? 401 : 403;
      return NextResponse.json({ error: auth.error || 'Only teachers can post announcements.' }, { status });
    }
    const user = auth.context!.user;

    const body = await req.json();
    const { title, content, isPinned, pinned } = body;

    if (!title || !title.trim() || !content || !content.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    const announcement: Announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classroomId: id,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role === 'student' ? 'student' : 'teacher',
      title: title.trim(),
      content: content.trim(),
      pinned: Boolean(isPinned ?? pinned ?? false),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    classroomDb.createAnnouncement(announcement);

    // Broadcast authoritative announcement.created event
    realtimeCoordinator.broadcast(
      id,
      'announcement.created',
      { announcement },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, announcement });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create announcement' }, { status: 500 });
  }
}
