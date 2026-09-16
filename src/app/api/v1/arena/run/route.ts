import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb } from '@/lib/project/db';
import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { TestCase } from '@/lib/execution/types';
import { readJsonBody, RequestBodyError } from '@/lib/http/safe-json';
import { ARENA_MAX_REQUEST_BYTES, validateArenaAutosaveFiles } from '@/lib/arena/request-validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await readJsonBody<any>(req, ARENA_MAX_REQUEST_BYTES);
    const { challengeId, language, files: clientFiles } = body;

    const fileValidation = clientFiles === undefined ? null : validateArenaAutosaveFiles(clientFiles);
    if (fileValidation && !fileValidation.valid) {
      return NextResponse.json({ error: fileValidation.error }, { status: fileValidation.status });
    }

    if (!challengeId || !language) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const challenge = CHALLENGES.find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Verify user owns this workspace
    const workspace = await arenaDb.getArenaWorkspace(user.id, challenge.id);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found. Initialize workspace first.' }, { status: 404 });
    }

    // If client sent updated files, autosave to workspace (persists code changes)
    if (fileValidation?.valid && fileValidation.files.length > 0) {
      const existingFiles = await projectDb.listFilesForProject(workspace.projectId);
      for (const clientFile of fileValidation.files) {
        const existing = existingFiles.find(f => f.name === clientFile.name || f.id === clientFile.id);
        if (existing) {
          await projectDb.updateFile(existing.id, { content: clientFile.content, updatedAt: Date.now() });
        } else {
          // New file in workspace
          await projectDb.createFile({
            id: clientFile.id || `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            projectId: workspace.projectId,
            name: clientFile.name,
            path: clientFile.path || `/${clientFile.name}`,
            content: clientFile.content || '',
            isFolder: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    }

    // AUTHORITATIVE: Load files from server-side workspace project
    const serverFiles = await projectDb.listFilesForProject(workspace.projectId);
    if (!serverFiles || serverFiles.length === 0) {
      return NextResponse.json({ error: 'Workspace files not found. Initialize workspace first.' }, { status: 404 });
    }

    // Only test against VISIBLE tests for "Run"
    const visibleTests = challenge.testCases.filter(tc => !tc.isHidden);
    const results: TestCase[] = [];
    
    let allPassed = true;

    for (const test of visibleTests) {
       const res = await executeInCloudRunner({
         language,
         files: serverFiles,
         stdin: test.stdin,
         runTimeoutMs: 2000,
         memoryLimitMb: 128
       });
       
       let passed = false;
       let actualStdout = res.stdout || '';
       let errorStr = res.stderr || '';

       if (res.status === 'success') {
           passed = actualStdout.trim() === test.expectedStdout.trim();
       } else {
           allPassed = false;
           passed = false;
           if (res.status === 'compilation_error') errorStr = res.compileOutput || res.stderr;
           else if (res.status === 'timeout') errorStr = 'Time Limit Exceeded';
           else if (res.status === 'memory_limit_exceeded') errorStr = 'Memory Limit Exceeded';
           else errorStr = res.stderr || res.status;
       }

       if (!passed) allPassed = false;

       results.push({
           ...test,
           passed,
           actualStdout: actualStdout.trim(),
           error: errorStr.trim() || undefined,
           timeMs: res.executionTimeMs,
           memoryMb: res.memoryUsageMb
       });
    }

    return NextResponse.json({
       success: true,
       allPassed,
       testResults: results
    });

  } catch (err: any) {
    if (err instanceof RequestBodyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
