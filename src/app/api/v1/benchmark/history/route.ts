import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';

export const runtime = 'nodejs';

/**
 * GET /api/v1/benchmark/history?benchmarkId=<id>
 * Returns the authenticated user's benchmark run history.
 * Enforces ownership — no cross-user access.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const benchmarkId = searchParams.get('benchmarkId');

    if (!benchmarkId) {
      return NextResponse.json({ error: 'benchmarkId is required' }, { status: 400 });
    }

    const runs = await arenaDb.listBenchmarkRuns(user.id, benchmarkId);

    return NextResponse.json({ benchmarkId, runs });

  } catch (err: any) {
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
