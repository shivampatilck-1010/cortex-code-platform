import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb } from '@/lib/project/db';
import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { executeArenaTestCase } from '@/lib/arena/execute-test';
import { TestCase } from '@/lib/execution/types';
import { readJsonBody, RequestBodyError } from '@/lib/http/safe-json';
import { ARENA_MAX_REQUEST_BYTES, validateArenaAutosaveFiles } from '@/lib/arena/request-validation';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);

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

    let serverFiles: any[];

    if (!user) {
      if (fileValidation?.valid && fileValidation.files.length > 0) {
        serverFiles = fileValidation.files.map(f => ({
          id: f.id || 'f_guest',
          projectId: 'guest_project',
          name: f.name,
          path: f.path || `/${f.name}`,
          content: f.content || '',
          isFolder: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }));
      } else {
        const targetLang =
          language && challenge.starterTemplates[language]
            ? language
            : Object.keys(challenge.starterTemplates)[0] || language || 'python';
        const starterCode = challenge.starterTemplates[targetLang] || challenge.starterTemplates['python'] || '# Write your solution here\n';
        const ext = targetLang === 'python' ? 'py' : targetLang === 'javascript' ? 'js' : targetLang === 'typescript' ? 'ts' : targetLang === 'cpp' ? 'cpp' : targetLang === 'c' ? 'c' : targetLang === 'java' ? 'java' : targetLang === 'sql' ? 'sql' : 'txt';
        serverFiles = [{
          id: 'guest_sol',
          projectId: 'guest_project',
          name: `solution.${ext}`,
          path: `/solution.${ext}`,
          content: starterCode,
          isFolder: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }];
      }
    } else {
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
      serverFiles = await projectDb.listFilesForProject(workspace.projectId);
      if (!serverFiles || serverFiles.length === 0) {
        return NextResponse.json({ error: 'Workspace files not found. Initialize workspace first.' }, { status: 404 });
      }
    }

    // Only test against VISIBLE tests for "Run"
    const visibleTests = challenge.testCases.filter(tc => !tc.isHidden);
    const results: TestCase[] = [];
    
    let allPassed = true;

    for (const test of visibleTests) {
       const res = await executeArenaTestCase({
         language,
         files: serverFiles,
         stdin: test.stdin,
         runTimeoutMs: 2000,
         memoryLimitMb: 128
       });
       
       let passed = false;
       const actualStdout = (res.stdout || '').replace(/\r\n/g, '\n');
       let errorStr = (res.stderr || '').replace(/\r\n/g, '\n');

       if (res.status === 'success') {
           passed = actualStdout.trim() === test.expectedStdout.replace(/\r\n/g, '\n').trim();
       } else {
           allPassed = false;
           passed = false;
           if (res.status === 'compilation_error') {
             errorStr = (res.compileOutput || res.stderr || '').replace(/\r\n/g, '\n');
           } else if (res.status === 'timeout') {
             errorStr = 'Time Limit Exceeded';
           } else if (res.status === 'memory_limit_exceeded') {
             errorStr = 'Memory Limit Exceeded';
           } else {
             errorStr = errorStr || res.status;
           }
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
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
