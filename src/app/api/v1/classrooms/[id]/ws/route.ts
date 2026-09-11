import { NextRequest, NextResponse } from 'next/server';
import { ensureNodeWsServer, getNodeWsPort } from '@/lib/classroom/node-ws-server';
import { ClassroomAuth, AuthenticatedClassroomUser } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const upgrade = req.headers.get('Upgrade');

  // 1. Authenticate request before upgrade
  const user = ClassroomAuth.authenticateRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED', message: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  // 2. Server-side Classroom Membership & Role Verification
  const membership = ClassroomAuth.verifyClassroomMembership(user, id);
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

  // Cloudflare Workers Native WebSocket forwarding to Durable Object
  // @ts-ignore
  if (upgrade === 'websocket' && typeof process.env.CLASSROOM_ROOM_DO !== 'undefined') {
    const authContext: AuthenticatedClassroomUser = {
      userId: user.id,
      classroomId: id.toUpperCase().trim(),
      role: membership.role!,
      displayName: user.name,
      email: user.email,
      authenticatedAt: Date.now(),
    };
    const internalToken = ClassroomAuth.createInternalAuthToken(authContext);
    const cleanHeaders = new Headers(req.headers);
    cleanHeaders.set('x-cortex-internal-auth', internalToken);
    const internalReq = new Request(req.url, {
      method: req.method,
      headers: cleanHeaders,
    });

    // @ts-ignore
    const doId = process.env.CLASSROOM_ROOM_DO.idFromName(id);
    // @ts-ignore
    const stub = process.env.CLASSROOM_ROOM_DO.get(doId);
    // @ts-ignore
    return stub.fetch(internalReq);
  }

  // Node.js Development & Production Environment
  if (typeof window === 'undefined') {
    await ensureNodeWsServer(3002);
  }

  const wsPort = getNodeWsPort() || 3002;

  return NextResponse.json({
    status: 'ws_ready',
    classroomId: id,
    port: wsPort,
    upgradeSupported: true,
    protocol: 'cortex-classroom-ws-v1',
    endpoint: `/api/v1/classrooms/${id}/ws`,
    user: {
      id: user.id,
      name: user.name,
      role: membership.role,
    },
  });
}
