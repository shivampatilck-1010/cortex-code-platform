import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';
import { ensureNodeWsServer } from '@/lib/classroom/node-ws-server';
import { LiveClassSession } from '@/lib/classroom/models';

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
    if (typeof window === 'undefined' && process.env.CLASSROOM_ROOM_DO === undefined) {
      await ensureNodeWsServer(3002);
    }
    const session = classroomDb.getActiveLiveSession(id);
    return NextResponse.json({ session });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get live session' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 403 });
    }

    const classroom = classroomDb.getClassroom(id);
    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }
    if (classroom.status === 'archived') {
      return NextResponse.json({ error: 'Archived classrooms cannot start or update live sessions.' }, { status: 409 });
    }
    const isTeacher = classroom?.teacherId === user.id || auth.context?.membership?.role === 'teacher';
    const body = await req.json();
    const { action, title, topic, language, starterCode, sharedCode, isBroadcastingCode } = body;

    // 1. Teacher starts live coding session
    if (action === 'start') {
      if (!isTeacher) {
        return NextResponse.json({ error: 'Only teachers can start a live coding session.' }, { status: 403 });
      }

      const newSession: LiveClassSession = {
        id: `sess_${Date.now()}`,
        classroomId: id,
        teacherId: user.id,
        teacherName: user.name,
        title: title || 'Interactive Code Lab',
        topic: topic || 'Algorithm Exploration',
        language: language || 'cpp',
        starterCode: starterCode || '// Write code together\n',
        sharedCode: starterCode || '// Write code together\n',
        isBroadcastingCode: true,
        startedAt: Date.now(),
        durationMinutes: 90,
        status: 'active',
        activeStudentCount: realtimeCoordinator.getOnlineCount(id),
      };

      classroomDb.createLiveSession(newSession);

      realtimeCoordinator.broadcast(
        id,
        'session.started',
        { session: newSession },
        { id: user.id, name: user.name }
      );

      return NextResponse.json({ success: true, session: newSession });
    }

    // 2. Broadcast live code updates
    if (action === 'update_code') {
      const activeSession = classroomDb.getActiveLiveSession(id);
      if (!activeSession) {
        return NextResponse.json({ error: 'No active live session found' }, { status: 400 });
      }

      if (!isTeacher && !classroom?.settings.allowCodeSharing) {
        return NextResponse.json({ error: 'Code sharing is not enabled for students.' }, { status: 403 });
      }

      classroomDb.updateLiveSessionCode(
        activeSession.id,
        sharedCode ?? activeSession.sharedCode,
        isBroadcastingCode !== undefined ? isBroadcastingCode : activeSession.isBroadcastingCode
      );

      realtimeCoordinator.broadcast(
        id,
        'code.updated',
        {
          sharedCode,
          isBroadcastingCode,
          senderId: user.id,
          senderName: user.name,
          timestamp: Date.now(),
        },
        { id: user.id, name: user.name }
      );

      return NextResponse.json({ success: true });
    }

    // 3. End session
    if (action === 'end') {
      if (!isTeacher) {
        return NextResponse.json({ error: 'Only teachers can end the live session.' }, { status: 403 });
      }

      const activeSession = classroomDb.getActiveLiveSession(id);
      if (activeSession) {
        classroomDb.endLiveSession(activeSession.id);
        realtimeCoordinator.broadcast(
          id,
          'session.ended',
          { sessionId: activeSession.id },
          { id: user.id, name: user.name }
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid session action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Live session action failed' }, { status: 500 });
  }
}
