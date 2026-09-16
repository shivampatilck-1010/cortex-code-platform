import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';

export const runtime = 'nodejs';

/**
 * GET /api/v1/arena/submissions?challengeId=<id>
 * Returns the authenticated user's submission history for a challenge.
 * No foreign user data is returned.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const challengeId = searchParams.get('challengeId');

    if (!challengeId) {
      // Return all submissions for this user
      const submissions = await arenaDb.listSubmissionsForUser(user.id);
      return NextResponse.json({ submissions });
    }

    const submissions = await arenaDb.listSubmissions(user.id, challengeId);
    return NextResponse.json({ submissions });

  } catch (err: any) {
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
