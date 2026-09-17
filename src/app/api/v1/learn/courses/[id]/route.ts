import { NextRequest, NextResponse } from 'next/server';
import { learningDb } from '@/lib/learning/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const courseId = id;
    if (!courseId) {
      return NextResponse.json({ error: 'Missing course ID' }, { status: 400 });
    }

    const course = await learningDb.getCourseDetails(courseId);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (error: any) {
    console.error('[API] GET /api/v1/learn/courses/[id] Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
