import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { getAuthoritativeIceServers } from '@/lib/classroom/ice-servers';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const classroomId = (id || '').toUpperCase().trim();

    // 1. Authenticate request via session cookie or bearer token
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Enforce classroom membership
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

    // 3. Obtain authoritative ICE servers
    const iceConfig = getAuthoritativeIceServers(user.id);

    return NextResponse.json({
      success: true,
      classroomId,
      ...iceConfig,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to retrieve ICE server configuration' },
      { status: 500 }
    );
  }
}
