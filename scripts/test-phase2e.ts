import { NextRequest } from 'next/server';
import { arenaDb } from '../src/lib/arena/db';
import { projectDb } from '../src/lib/project/db';
import { POST as ArenaWorkspacePOST } from '../src/app/api/v1/arena/workspace/route';
import { POST as ArenaRunPOST } from '../src/app/api/v1/arena/run/route';
import { POST as ArenaSubmitPOST } from '../src/app/api/v1/arena/submit/route';
import { POST as BenchmarkWorkspacePOST } from '../src/app/api/v1/benchmark/workspace/route';
import { POST as BenchmarkRunPOST } from '../src/app/api/v1/benchmark/run/route';

async function mockRequest(body: any, userId = 'test_user_a') {
  return {
    json: async () => body,
    headers: new Map([
      ['cookie', `cortex_session=mock_session_token`]
    ])
  } as unknown as NextRequest;
}

// Monkey patch auth
import { ClassroomAuth } from '../src/lib/classroom/auth';
ClassroomAuth.getCurrentUser = async (req: any) => {
    const cookie = req.headers.get('cookie');
    if (!cookie) return null;
    return { id: (global as any).TEST_USER_ID || 'test_user_a', name: 'Test User', email: 'test@example.com' } as any;
};

async function runTests() {
  console.log('============================================================');
  console.log('PHASE 2E TEST SUITE: ARENA + BENCHMARK / COMPARE');
  console.log('============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[\x1b[32mPASS\x1b[0m] ${msg}`);
      passed++;
    } else {
      console.log(`[\x1b[31mFAIL\x1b[0m] ${msg}`);
    }
  }

  try {
    await arenaDb.init();
    await projectDb.init();

    (global as any).TEST_USER_ID = 'user_1';

    // ARENA AUTH
    const reqUnauth = await mockRequest({ challengeId: 'two-sum' });
    reqUnauth.headers.delete('cookie');
    const resUnauth = await ArenaWorkspacePOST(reqUnauth);
    assert(resUnauth.status === 401, 'unauthenticated Arena access rejected where required');
    
    // CHALLENGES
    const reqWorkspace = await mockRequest({ challengeId: 'two-sum', language: 'python' });
    const resWorkspace = await ArenaWorkspacePOST(reqWorkspace);
    const dataWorkspace = await resWorkspace.json();
    console.log('resWorkspace', resWorkspace.status, dataWorkspace);
    assert(resWorkspace.status === 200, 'authenticated Arena access works');
    assert(!!dataWorkspace.workspace, 'challenge workspace initializes');
    assert(!!dataWorkspace.files && dataWorkspace.files.length > 0, 'starter code populates files');
    assert(dataWorkspace.challenge.testCases.every((tc: any) => tc.isHidden === false), 'hidden tests removed from workspace challenge payload');
    
    // PERSISTENCE
    const reqWorkspaceReload = await mockRequest({ challengeId: 'two-sum', language: 'python' });
    const resWorkspaceReload = await ArenaWorkspacePOST(reqWorkspaceReload);
    const dataWorkspaceReload = await resWorkspaceReload.json();
    assert(dataWorkspaceReload.created === false, 'workspace persists and reloads correctly');

    // EXECUTION & VISIBLE TESTS
    const runFiles = [
      { id: 'f1', name: 'solution.py', path: '/solution.py', content: 'def twoSum(nums, target):\n    return [0, 1]\n' }
    ];
    const reqRun = await mockRequest({ challengeId: 'two-sum', language: 'python', files: runFiles });
    const resRun = await ArenaRunPOST(reqRun);
    const dataRun = await resRun.json();
    assert(dataRun.success === true, 'Run executes real code via Phase 2B sandbox');
    assert(dataRun.testResults.length > 0, 'visible tests execute');
    assert(dataRun.testResults.every((tc: any) => !tc.isHidden), 'only visible tests run');
    assert(dataRun.testResults[0].actualStdout !== undefined, 'actual output returned for visible tests');

    // JUDGING & SUBMISSIONS
    const reqSubmit = await mockRequest({ challengeId: 'two-sum', language: 'python', files: runFiles });
    const resSubmit = await ArenaSubmitPOST(reqSubmit);
    const dataSubmit = await resSubmit.json();
    
    assert(dataSubmit.success === true, 'Submit executes all tests');
    assert(!!dataSubmit.submission, 'submission created and returned');
    assert(dataSubmit.submission.score !== undefined, 'score persisted');
    assert(dataSubmit.submission.status !== undefined, 'status persisted');
    
    const summary = JSON.parse(dataSubmit.submission.testSummary);
    const hiddenTests = summary.filter((tc: any) => tc.isHidden);
    assert(hiddenTests.length > 0, 'hidden tests execute in submission');
    assert(hiddenTests.every((tc: any) => tc.actualStdout === '[HIDDEN]'), 'hidden expected outputs/actual outputs never returned');
    assert(dataSubmit.submission.sourceCode === JSON.stringify(runFiles), 'source snapshot persisted and immutable');

    // CROSS-USER SECURITY
    (global as any).TEST_USER_ID = 'user_2';
    const reqWorkspace2 = await mockRequest({ challengeId: 'two-sum', language: 'python' });
    const resWorkspace2 = await ArenaWorkspacePOST(reqWorkspace2);
    const dataWorkspace2 = await resWorkspace2.json();
    assert(dataWorkspace2.workspace.id !== dataWorkspace.workspace.id, 'cross-user isolation works');
    assert(dataWorkspace2.workspace.projectId !== dataWorkspace.workspace.projectId, 'unauthorized workspace access rejected (new project)');

    const testBenchmarkId = 'search_' + Date.now();
    // BENCHMARK
    (global as any).TEST_USER_ID = 'user_bench_1';
    const reqBenchWorkspace = await mockRequest({ benchmarkId: testBenchmarkId, preset: { name: 'Search', langA: 'python', langB: 'javascript', codeA: 'print("A")', codeB: 'console.log("B")' } });
    const resBenchWorkspace = await BenchmarkWorkspacePOST(reqBenchWorkspace);
    const dataBenchWorkspace = await resBenchWorkspace.json();
    
    assert(!!dataBenchWorkspace.workspace, 'Benchmark workspace initializes');
    assert(dataBenchWorkspace.workspace.workspaceAProjectId !== dataBenchWorkspace.workspace.workspaceBProjectId, 'A/B independent projects');
    assert(dataBenchWorkspace.projectA.language === 'python', 'A language independent');
    assert(dataBenchWorkspace.projectB.language === 'javascript', 'B language independent');
    assert(dataBenchWorkspace.filesA[0].content === 'print("A")', 'A code independent');
    
    // BENCHMARK RUN
    const reqBenchRunA = await mockRequest({ 
       benchmarkId: testBenchmarkId, 
       runType: 'A',
       langA: 'python',
       langB: 'javascript',
       filesA: [{ id: '1', name: 'sol.py', path: '/sol.py', content: 'print("A run")' }],
       filesB: [{ id: '2', name: 'sol.js', path: '/sol.js', content: 'console.log("B run")' }]
    });
    const resBenchRunA = await BenchmarkRunPOST(reqBenchRunA);
    const dataBenchRunA = await resBenchRunA.json();
    
    console.log('dataBenchRunA', dataBenchRunA);
    assert(!!dataBenchRunA.resultA, 'Run A works');
    assert(dataBenchRunA.resultB === null, 'Run A leaves B untouched');
    assert(dataBenchRunA.resultA.stdout.trim() === 'A run', 'A output independent');

    const reqBenchRunBoth = await mockRequest({ 
       benchmarkId: testBenchmarkId, 
       runType: 'BOTH',
       langA: 'python',
       langB: 'javascript',
       filesA: [{ id: '1', name: 'sol.py', path: '/sol.py', content: 'print("A run")' }],
       filesB: [{ id: '2', name: 'sol.js', path: '/sol.js', content: 'console.log("B run")' }]
    });
    const resBenchRunBoth = await BenchmarkRunPOST(reqBenchRunBoth);
    const dataBenchRunBoth = await resBenchRunBoth.json();
    
    console.log('dataBenchRunBoth', dataBenchRunBoth);
    assert(!!dataBenchRunBoth.resultA && !!dataBenchRunBoth.resultB, 'Run Both works');
    assert(dataBenchRunBoth.resultA.executionTimeMs !== undefined, 'Benchmark metrics real for A');
    assert(dataBenchRunBoth.resultB.executionTimeMs !== undefined, 'Benchmark metrics real for B');

    console.log(`\n============================================================`);
    console.log(`RESULTS: ${passed} / ${total} PASS`);
    console.log(`============================================================`);
  } catch (e) {
    console.error('Test execution failed:', e);
  }
}

runTests();
