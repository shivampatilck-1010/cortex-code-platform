import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { getPracticeDbSchema } from '@/lib/sql/database-engine';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    // Scoping fallback: If projectId is missing, 'demo_sql_project', or not found in projectDb, fallback to user-scoped practice DB (user_${user.id})
    let targetDbId = `user_${user.id}`;
    if (projectId && projectId !== 'demo_sql_project') {
      const project = await projectDb.getProject(projectId);
      if (project) {
        if (project.ownerId !== user.id) {
          return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
        }
        targetDbId = projectId;
      }
    }

    const tables = await getPracticeDbSchema(targetDbId);
    const history = await projectDb.listSqlQueryHistory(targetDbId, 25);

    return NextResponse.json({
      success: true,
      tables,
      history,
    });
  } catch (err: any) {
    console.error('[SQL Schema Route Error]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
