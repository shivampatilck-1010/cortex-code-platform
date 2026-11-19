import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { executeSqlQuery, SqlDialect, SqlQueryResult } from '@/lib/sql/database-engine';

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
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const { projectId, query, dialect = 'sqlite' } = body || {};

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query is required' }, { status: 400 });
    }

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

    const validDialects: SqlDialect[] = ['sqlite', 'postgresql', 'mysql', 'mssql', 'oracle'];
    const chosenDialect: SqlDialect = validDialects.includes(dialect?.toLowerCase()) ? dialect.toLowerCase() : 'sqlite';

    // 5-second timeout guard on execution returning structured error if timed out
    const TIMEOUT_MS = 5000;
    let timer: any;
    const timeoutPromise = new Promise<{ isTimeout: true }>((resolve) => {
      timer = setTimeout(() => resolve({ isTimeout: true }), TIMEOUT_MS);
      if (timer && typeof timer.unref === 'function') timer.unref();
    });

    const executionPromise = executeSqlQuery(targetDbId, query, chosenDialect).then(res => ({
      isTimeout: false as const,
      result: res,
    }));

    const outcome = await Promise.race([executionPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);

    let result: SqlQueryResult;
    if (outcome.isTimeout) {
      result = {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: TIMEOUT_MS,
        dialect: chosenDialect,
        error: 'SQL query execution exceeded 5-second timeout limit',
      };
    } else {
      result = outcome.result;
    }

    // Asynchronously log to history
    projectDb.logSqlQuery(
      user.id,
      targetDbId,
      query,
      chosenDialect,
      result.rowCount,
      result.executionTimeMs
    ).catch(e => console.warn('[SQL History] Log error:', e));

    return NextResponse.json({
      success: !result.error,
      result,
    });
  } catch (err: any) {
    console.error('[SQL Execute Route Error]', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
