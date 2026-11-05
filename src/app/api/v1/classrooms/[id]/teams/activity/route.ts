import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { id } = await params;
    const cid = id.toUpperCase().trim();

    const membership = await ClassroomAuth.verifyClassroomMembership(user, cid);
    if (!membership.authorized) {
      return NextResponse.json({ error: 'Access denied: not an active member of this classroom' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId') || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const activities = await classroomDb.listProjectActivity(cid, teamId, limit);
    return NextResponse.json({ success: true, activities, activity: activities });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list activity' }, { status: 500 });
  }
}
