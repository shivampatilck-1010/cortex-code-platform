import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required to access platform analytics' },
        { status: 401 }
      );
    }
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Administrator authorization required to access platform analytics' },
        { status: 403 }
      );
    }

    const platformAnalytics = await classroomDb.getPlatformAdminAnalytics();
    return NextResponse.json(platformAnalytics);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to load platform analytics' },
      { status: 500 }
    );
  }
}
