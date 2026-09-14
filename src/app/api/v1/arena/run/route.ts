import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb } from '@/lib/project/db';
import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { TestCase } from '@/lib/execution/types';

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { challengeId, files, language } = await req.json();
    if (!challengeId || !files || !language) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const challenge = CHALLENGES.find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }
    
    // Only test against VISIBLE tests for "Run"
    const visibleTests = challenge.testCases.filter(tc => !tc.isHidden);
    const results: TestCase[] = [];
    
    let allPassed = true;

    for (const test of visibleTests) {
       const res = await executeInCloudRunner({
         language,
         files,
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
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
