import { NextRequest, NextResponse } from 'next/server';
import { learningDb } from '@/lib/learning/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const courses = await learningDb.getCourses();
    return NextResponse.json({ courses });
  } catch (error: any) {
    console.error('[API] GET /api/v1/learn/courses Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
