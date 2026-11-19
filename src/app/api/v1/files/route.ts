import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const data = await projectDb.listAllFilesForUser(user.id);
    return NextResponse.json({ projects: data });
  } catch (err: any) {
    console.error('List all files error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
