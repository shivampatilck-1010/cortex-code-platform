import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { resetPracticeDb, getPracticeDbSchema } from '@/lib/sql/database-engine';

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { projectId } = body || {};

    // Scoping fallback: If projectId is missing, 'demo_sql_project', or not found in projectDb, fallback to user-scoped practice DB (user_${user.id})
    let targetDbId = `user_${user.id}`;
    if (projectId && typeof projectId === 'string' && projectId !== 'demo_sql_project') {
      const project = await projectDb.getProject(projectId);
      if (project) {
        if (project.ownerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
        }
        targetDbId = projectId;
      }
    }

    await resetPracticeDb(targetDbId);
    const tables = await getPracticeDbSchema(targetDbId);

    return NextResponse.json({
      success: true,
      message: 'Practice database reset to initial sample schema successfully.',
      tables,
    });
  } catch (err: any) {
    console.error('[SQL Reset Route Error]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
