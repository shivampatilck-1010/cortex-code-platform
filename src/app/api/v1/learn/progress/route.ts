import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { learningDb } from '@/lib/learning/db';
import { readJsonBody, RequestBodyError } from '@/lib/http/safe-json';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId') || undefined;

    const progress = await learningDb.getProgress(user.id, courseId);
    return NextResponse.json({ progress });
  } catch (error: any) {
    console.error('[API] GET /api/v1/learn/progress Error:', error);
    if (error?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1MB limit for progress updates
    const body = await readJsonBody<any>(req, 1024 * 1024);
    
    const { courseId, lessonId, status, lastCode } = body;
    
    if (!courseId || !lessonId || !status) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    if (status !== 'completed' && status !== 'in_progress') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // IDOR protection: Use the authenticated user ID (user.id), not anything from the client body.
    const progress = await learningDb.updateProgress(user.id, courseId, lessonId, status, lastCode || '');

    return NextResponse.json({ success: true, progress });
  } catch (error: any) {
    console.error('[API] POST /api/v1/learn/progress Error:', error);
    if (error instanceof RequestBodyError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
