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

    const whiteboard = await classroomDb.getWhiteboard(classroomId, sessionId);

    return NextResponse.json({
      success: true,
      classroomId,
      sessionId,
      whiteboard: whiteboard || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to retrieve whiteboard' },
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const { sessionId = 'default', pages, activePageIndex = 0, version } = body;

    if (!Array.isArray(pages)) {
      return NextResponse.json({ error: 'pages must be an array' }, { status: 400 });
    }

    // Size limit check: max 5 MB
    const jsonStr = JSON.stringify(pages);
    if (jsonStr.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Whiteboard payload exceeds maximum size limit (5MB)' }, { status: 413 });
    }

    const saved = await classroomDb.saveWhiteboard(
      classroomId,
      sessionId,
      pages,
      typeof activePageIndex === 'number' ? activePageIndex : 0,
      user.id,
      typeof version === 'number' ? version : undefined
    );

    // Broadcast whiteboard update event over WebSocket
    try {
      broadcastToRoom(classroomId, {
        version: '1.0',
        messageId: 'wb-' + Date.now(),
        type: 'CLASSROOM_EVENT',
        sessionId: classroomId,
        timestamp: Date.now(),
        payload: {
          eventName: 'WHITEBOARD_PAGE_SYNC',
          data: {
            pages: saved.pages,
            activePageIndex: saved.activePageIndex,
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
      whiteboard: saved,
    });
  } catch (err: any) {
    if (err?.message?.includes('VERSION_CONFLICT')) {
      return NextResponse.json({ error: err.message, code: 'VERSION_CONFLICT' }, { status: 409 });
    }
    return NextResponse.json(
      { error: err?.message || 'Failed to save whiteboard' },
      { status: 500 }
    );
  }
}
