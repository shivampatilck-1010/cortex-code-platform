import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb } from '@/lib/project/db';
import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { TestCase } from '@/lib/execution/types';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { challengeId, language, files: clientFiles } = body;

    if (!challengeId || !language) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const challenge = CHALLENGES.find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    // Verify user owns this workspace (prevents IDOR)
    const workspace = await arenaDb.getArenaWorkspace(user.id, challenge.id);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found. Initialize workspace first.' }, { status: 404 });
    }

    // If client sent updated files, autosave to workspace before evaluating
    if (clientFiles && Array.isArray(clientFiles) && clientFiles.length > 0) {
      const existingFiles = await projectDb.listFilesForProject(workspace.projectId);
      for (const clientFile of clientFiles) {
        const existing = existingFiles.find(f => f.name === clientFile.name || f.id === clientFile.id);
        if (existing) {
          await projectDb.updateFile(existing.id, { content: clientFile.content, updatedAt: Date.now() });
        } else {
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

    // AUTHORITATIVE: Load files from server-side workspace
    const serverFiles = await projectDb.listFilesForProject(workspace.projectId);
    if (!serverFiles || serverFiles.length === 0) {
      return NextResponse.json({ error: 'Workspace files not found. Initialize workspace first.' }, { status: 404 });
    }

    // Test against ALL tests for "Submit"
    const allTests = challenge.testCases;
    const results: TestCase[] = [];
    
    let allPassed = true;
    let passedCount = 0;
    let overallStatus = 'PASSED';
    let totalTime = 0;
    let maxMemory = 0;

    for (const test of allTests) {
       const res = await executeInCloudRunner({
         language,
         files: serverFiles,
         stdin: test.stdin,
         runTimeoutMs: 2000,
         memoryLimitMb: 128
       });
       
       totalTime += res.executionTimeMs || 0;
       maxMemory = Math.max(maxMemory, res.memoryUsageMb || 0);

       let passed = false;
       let actualStdout = res.stdout || '';
       let errorStr = res.stderr || '';

       if (res.status === 'success') {
           passed = actualStdout.trim() === test.expectedStdout.trim();
       } else {
           allPassed = false;
           passed = false;
           if (overallStatus === 'PASSED') {
              if (res.status === 'compilation_error') overallStatus = 'COMPILE_ERROR';
              else if (res.status === 'timeout') overallStatus = 'TIMEOUT';
              else if (res.status === 'memory_limit_exceeded') overallStatus = 'MEMORY_LIMIT';
              else overallStatus = 'RUNTIME_ERROR';
           }
       }

       if (passed) {
           passedCount++;
       } else if (overallStatus === 'PASSED') {
           overallStatus = 'FAILED';
           allPassed = false;
       }

       // Sanitize output for hidden tests — never leak stdin/expectedStdout
       if (test.isHidden) {
           results.push({
               id: test.id,
               name: test.name,
               isHidden: true,
               passed,
               stdin: '[HIDDEN]',
               expectedStdout: '[HIDDEN]',
               actualStdout: '[HIDDEN]',
               error: passed ? undefined : (errorStr ? 'Execution failed or output did not match expected hidden output.' : 'Output did not match expected hidden output.'),
               timeMs: res.executionTimeMs,
               memoryMb: res.memoryUsageMb
           });
       } else {
           results.push({
               ...test,
               passed,
               actualStdout: actualStdout.trim(),
               error: errorStr.trim() || undefined,
               timeMs: res.executionTimeMs,
               memoryMb: res.memoryUsageMb
           });
       }
    }

    const score = allTests.length > 0 ? Math.round((passedCount / allTests.length) * 100) : 100;
    
    // Snapshot the authoritative server-side files (not client-supplied)
    const sourceSnapshot = JSON.stringify(serverFiles.map(f => ({ name: f.name, content: f.content })));
    
    const submissionId = `sub_${crypto.randomUUID()}`;
    const submission = await arenaDb.createSubmission({
        id: submissionId,
        userId: user.id,
        challengeId: challenge.id,
        language,
        status: overallStatus as any,
        score,
        sourceCode: sourceSnapshot,
        testSummary: JSON.stringify(results),
        executionTimeMs: totalTime,
        memoryUsageMb: maxMemory,
        createdAt: Date.now()
    });

    return NextResponse.json({
       success: true,
       submission
    });

  } catch (err: any) {
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
