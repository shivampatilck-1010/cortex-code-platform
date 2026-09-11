import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { ClassroomMessage, ClassroomMemberRole } from '@/lib/classroom/models';

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

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
    const isTeacher = Boolean(auth.context?.isTeacher);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);

    const messages = classroomDb.listMessages(id, user.id, isTeacher, limit);
    return NextResponse.json({ messages });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(
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

    const user = auth.context?.user || ClassroomAuth.getCurrentUser(req);
    const isTeacher = Boolean(auth.context?.isTeacher);

    // Enforce classroom settings
    if (!isTeacher && classroom.settings?.allowStudentPosting === false) {
      return NextResponse.json({ error: 'Student messaging is currently disabled by the instructor.' }, { status: 403 });
    }

    const body = await req.json();
    const { content, recipientType, recipientId, attachments } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // If direct message from student to student, check allowStudentMessaging
    if (!isTeacher && recipientType === 'direct' && classroom.settings?.allowStudentMessaging === false) {
      const recipientMember = recipientId ? classroomDb.getMember(id, recipientId) : null;
      if (recipientMember && recipientMember.role === 'student') {
        return NextResponse.json({ error: 'Direct messaging between students is disabled.' }, { status: 403 });
      }
    }

    const member = classroomDb.getMember(id, user.id);
    const role: ClassroomMemberRole =
      (member?.role as ClassroomMemberRole) || (user.role === 'teacher' ? 'teacher' : 'student');

    const message: ClassroomMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classroomId: id,
      senderId: user.id,
      senderName: user.name,
      senderRole: role,
      recipientType: recipientType === 'direct' ? 'direct' : (recipientType === 'teacher' ? 'teacher' : 'class'),
      recipientId: recipientId || undefined,
      content: content.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    classroomDb.createMessage(message);

    // Broadcast authoritative message.created event
    realtimeCoordinator.broadcast(
      id,
      'message.created',
      { message },
      { id: user.id, name: user.name }
    );

    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to send message' }, { status: 500 });
  }
}
