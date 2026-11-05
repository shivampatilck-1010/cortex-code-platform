import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import { broadcastToRoom } from '@/lib/classroom/node-ws-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const classroomId = (id || '').toUpperCase().trim();
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('sessionId') || 'default';

    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const membership = await ClassroomAuth.verifyClassroomMembership(user, classroomId);
    if (!membership.authorized) {
      const isNotFound = membership.error?.toLowerCase().includes('not found');
      return NextResponse.json(
        {
          error: isNotFound ? 'Not Found' : 'Forbidden',
          code: isNotFound ? 'CLASSROOM_NOT_FOUND' : 'FORBIDDEN_NOT_MEMBER',
          message: membership.error || 'Access denied: not enrolled in classroom.',
        },
        { status: isNotFound ? 404 : 403 }
      );
    }

    const presentation = await classroomDb.getPresentation(classroomId, sessionId);

    return NextResponse.json({
      success: true,
      classroomId,
      sessionId,
      presentation: presentation || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to retrieve presentation' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const classroomId = (id || '').toUpperCase().trim();

    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const membership = await ClassroomAuth.verifyClassroomMembership(user, classroomId);
    if (!membership.authorized) {
      const isNotFound = membership.error?.toLowerCase().includes('not found');
      return NextResponse.json(
        {
          error: isNotFound ? 'Not Found' : 'Forbidden',
          code: isNotFound ? 'CLASSROOM_NOT_FOUND' : 'FORBIDDEN_NOT_MEMBER',
          message: membership.error || 'Access denied: not enrolled in classroom.',
        },
        { status: isNotFound ? 404 : 403 }
      );
    }

    // Server-side role authorization: Only teachers/admins can modify presentation state
    if (membership.role !== 'teacher' && membership.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Forbidden: Only instructors can modify classroom presentation state.',
          code: 'FORBIDDEN_TEACHER_ONLY',
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { sessionId = 'default', deck, activeSlideIndex = 0, isPresenting = false, version } = body;

    if (!deck || typeof deck !== 'object' || !Array.isArray(deck.slides)) {
      return NextResponse.json({ error: 'deck must be an object containing a slides array' }, { status: 400 });
    }

    // Size limit check: max 10 MB
    const jsonStr = JSON.stringify(deck);
    if (jsonStr.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Presentation payload exceeds maximum size limit (10MB)' }, { status: 413 });
    }

    const saved = await classroomDb.savePresentation(
      classroomId,
      sessionId,
      deck,
      typeof activeSlideIndex === 'number' ? activeSlideIndex : 0,
      Boolean(isPresenting),
      user.id,
      typeof version === 'number' ? version : undefined
    );

    // Broadcast presentation update event over WebSocket
    try {
      broadcastToRoom(classroomId, {
        version: '1.0',
        messageId: 'pres-' + Date.now(),
        type: 'CLASSROOM_EVENT',
        sessionId: classroomId,
        timestamp: Date.now(),
        payload: {
          eventName: 'PRESENTATION_STATE_SYNC',
          data: {
            deck: saved.deck,
            activeSlideIndex: saved.activeSlideIndex,
            isPresenting: saved.isPresenting,
            version: saved.version,
            updatedBy: user.id,
          },
        },
      }, user.id);
    } catch {}

    return NextResponse.json({
      success: true,
      classroomId,
      sessionId,
      presentation: saved,
    });
  } catch (err: any) {
    if (err?.message?.includes('VERSION_CONFLICT')) {
      return NextResponse.json({ error: err.message, code: 'VERSION_CONFLICT' }, { status: 409 });
    }
    return NextResponse.json(
      { error: err?.message || 'Failed to save presentation' },
      { status: 500 }
    );
  }
}
