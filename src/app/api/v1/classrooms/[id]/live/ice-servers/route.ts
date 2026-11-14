import { NextRequest, NextResponse } from 'next/server';
import { getAuthoritativeIceServers } from '@/lib/classroom/ice-servers';
import { ClassroomAuth } from '@/lib/classroom/auth';

/**
 * GET /api/v1/classrooms/[id]/live/ice-servers
 * Authoritatively provides STUN and dynamically signed ephemeral TURN relay credentials.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await ClassroomAuth.authenticateRequest(req);
    const userId = user?.id || req.nextUrl.searchParams.get('userId') || 'cortex-participant';
    const result = getAuthoritativeIceServers(userId);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    const fallback = getAuthoritativeIceServers('fallback-user');
    return NextResponse.json(fallback);
  }
}
