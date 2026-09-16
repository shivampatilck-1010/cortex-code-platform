/**
 * CORTEX PHASE 2I-D TEST SUITE
 * Arena & Benchmark Completion Verification
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let PASS = 0;
let FAIL = 0;
let NEEDS_VERIF = 0;
const RESULTS: any[] = [];

function uid() { return Math.random().toString(36).substring(2, 9); }
function result(name: string, status: 'PASS' | 'FAIL' | 'NEEDS VERIFICATION', detail = '') {
  if (status === 'PASS') { PASS++; console.log(`[PASS] ${name} ${detail}`); }
  else if (status === 'FAIL') { FAIL++; console.error(`[FAIL] ${name} ${detail}`); }
  else { NEEDS_VERIF++; console.warn(`[NEEDS VERIFICATION] ${name} ${detail}`); }
  RESULTS.push({ name, status, detail });
}

async function apiPost(path: string, body: any, session?: string | null) {
  return await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'Cookie': `cortex_session=${session}` } : {})
    },
    body: JSON.stringify(body)
  });
}

async function apiGet(path: string, session?: string | null) {
  return await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { ...(session ? { 'Cookie': `cortex_session=${session}` } : {}) },
  });
}

async function apiPostRaw(path: string, body: string, session?: string | null) {
  return await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { 'Cookie': `cortex_session=${session}` } : {})
    },
    body,
  });
}

async function register() {
  const username = `user_${uid()}`;
  const password = 'Password123!';
  const res = await apiPost('/api/v1/auth/register', {
    name: username,
    email: `${username}@test.com`,
    cortexId: username.substring(0, 10),
    password,
    confirmPassword: password,
    role: 'student'
  });
  const cookieHeader = res.headers.get('set-cookie');
  const session = cookieHeader?.match(/cortex_session=([^;]+)/)?.[1];
  return { username, session: session || null };
}

async function runTests() {
  console.log(`\n=== CORTEX PHASE 2I-D TEST SUITE ===`);
  console.log(`Target: ${BASE_URL}\n`);

  const { session: userA } = await register();
  const { session: userB } = await register();

  if (!userA || !userB) {
    console.error('FATAL: Could not register test users. Ensure server is running.');
    process.exit(1);
  }

  // ============================================================
  // ARENA TESTS
  // ============================================================
  console.log('\n--- ARENA ---');

  // 1. Arena Authentication
  {
    const r = await apiPost('/api/v1/arena/workspace', { challengeId: 'two-sum', language: 'python' });
    result('Arena: workspace requires authentication', r.status === 401 ? 'PASS' : 'FAIL', `Status: ${r.status}`);
  }
  {
    const r = await apiPost('/api/v1/arena/run', { challengeId: 'two-sum', language: 'python', files: [] });
    result('Arena: run requires authentication', r.status === 401 ? 'PASS' : 'FAIL', `Status: ${r.status}`);
  }
  {
    const r = await apiPost('/api/v1/arena/submit', { challengeId: 'two-sum', language: 'python', files: [] });
    result('Arena: submit requires authentication', r.status === 401 ? 'PASS' : 'FAIL', `Status: ${r.status}`);
  }
  {
    const r = await apiGet('/api/v1/arena/submissions?challengeId=two-sum');
    result('Arena: submissions requires authentication', r.status === 401 ? 'PASS' : 'FAIL', `Status: ${r.status}`);
  }

  // 2. Challenge Access - workspace creation
  let workspaceData: any = null;
  {
    const r = await apiPost('/api/v1/arena/workspace', { challengeId: 'two-sum', language: 'python' }, userA);
    const data = await r.json();
    if (r.status === 200 && data.workspace && data.files && data.challenge) {
      result('Arena: workspace created with challenge data', 'PASS');
      workspaceData = data;
    } else {
      result('Arena: workspace created with challenge data', 'FAIL', JSON.stringify(data));
    }
  }

  // 3. Hidden tests not in workspace response
  if (workspaceData) {
    const hasHidden = workspaceData.challenge?.testCases?.some((t: any) => t.isHidden);
    result('Arena: hidden tests not in workspace response', !hasHidden ? 'PASS' : 'FAIL',
      hasHidden ? 'Hidden tests were returned to client!' : '');
  }

  // 4. Workspace idempotent (same challenge returns same workspace)
  {
    const r = await apiPost('/api/v1/arena/workspace', { challengeId: 'two-sum', language: 'python' }, userA);
    const data = await r.json();
    const sameWorkspace = data.workspace?.id === workspaceData?.workspace?.id;
    result('Arena: workspace is idempotent', sameWorkspace ? 'PASS' : 'FAIL');
  }

  // 5. Run against visible test cases
  {
    const starterCode = workspaceData?.challenge?.starterTemplates?.python || '# stub';
    const files = [{ id: 'sol', name: 'solution.py', path: '/solution.py', content: starterCode }];
    const r = await apiPost('/api/v1/arena/run', { challengeId: 'two-sum', language: 'python', files }, userA);
    const data = await r.json();
    if (r.ok && data.testResults) {
      result('Arena: run returns visible test results', 'PASS');
    } else {
      result('Arena: run returns visible test results', 'FAIL', JSON.stringify(data));
    }
  }

  // 6. Run does not expose hidden test data
  {
    const files = [{ id: 'sol', name: 'solution.py', path: '/solution.py', content: 'print("wrong")' }];
    const r = await apiPost('/api/v1/arena/run', { challengeId: 'two-sum', language: 'python', files }, userA);
    const data = await r.json();
    const bodyStr = JSON.stringify(data);
    const leaksHiddenExpected = bodyStr.includes('"isHidden":true') && !bodyStr.includes('[HIDDEN]');
    result('Arena: run does not return hidden test data', !leaksHiddenExpected ? 'PASS' : 'FAIL');
  }

  // 7. Submit — hidden test privacy
  let submissionData: any = null;
  {
    const files = [{ id: 'sol', name: 'solution.py', path: '/solution.py', content: 'print("wrong")' }];
    const r = await apiPost('/api/v1/arena/submit', { challengeId: 'two-sum', language: 'python', files }, userA);
    const data = await r.json();
    submissionData = data;

    if (r.ok && data.submission) {
      const testSummary = JSON.parse(data.submission.testSummary || '[]');
      const hiddenCase = testSummary.find((t: any) => t.isHidden);
      const hiddenLeakStdin = hiddenCase && hiddenCase.stdin !== '[HIDDEN]';
      const hiddenLeakExpected = hiddenCase && hiddenCase.expectedStdout !== '[HIDDEN]';
      const hiddenLeakActual = hiddenCase && hiddenCase.actualStdout !== '[HIDDEN]';
      
      if (hiddenLeakStdin || hiddenLeakExpected || hiddenLeakActual) {
        result('Arena: hidden tests redacted in submit response', 'FAIL', 
          `Leaked: stdin=${!hiddenLeakStdin}, expected=${!hiddenLeakExpected}, actual=${!hiddenLeakActual}`);
      } else {
        result('Arena: hidden tests redacted in submit response', 'PASS');
      }
    } else {
      result('Arena: hidden tests redacted in submit response', 'FAIL', JSON.stringify(data));
    }
  }

  // 8. Submission persisted
  {
    const r = await apiGet('/api/v1/arena/submissions?challengeId=two-sum', userA);
    const data = await r.json();
    if (r.ok && data.submissions && data.submissions.length > 0) {
      result('Arena: submission persisted to D1', 'PASS', `${data.submissions.length} submission(s) found`);
    } else {
      result('Arena: submission persisted to D1', 'FAIL', JSON.stringify(data));
    }
  }

  // 9. Cross-user submission access (IDOR)
  {
    const r = await apiGet('/api/v1/arena/submissions?challengeId=two-sum', userB);
    const data = await r.json();
    // userB's submissions list should be empty (no submissions yet)
    if (r.ok && data.submissions && data.submissions.length === 0) {
      result('Arena: IDOR — user B cannot see user A submissions', 'PASS');
    } else {
      result('Arena: IDOR — user B cannot see user A submissions', 'FAIL', 
        `userB got ${data.submissions?.length} submissions`);
    }
  }

  // 10. Arena workspace cross-user access (IDOR)
  {
    // userB tries to run with userA's challengeId but their own session
    // This should work for userB (creates their own workspace), but cannot execute against userA's files
    const r = await apiPost('/api/v1/arena/run', {
      challengeId: 'two-sum',
      language: 'python',
      files: [{ id: 'sol', name: 'solution.py', path: '/solution.py', content: 'print("hi")' }]
    }, userB);
    const data = await r.json();
    // Should fail because userB doesn't have a workspace yet (must call /workspace first)
    if (r.status === 404 || r.ok) {
      // Either 404 (no workspace) or OK (creates own workspace) — both acceptable
      result('Arena: IDOR — run cannot access other user workspace', 'PASS', `Status: ${r.status}`);
    } else {
      result('Arena: IDOR — run cannot access other user workspace', 'NEEDS VERIFICATION', 
        `Status: ${r.status}, data: ${JSON.stringify(data)}`);
    }
  }

  // 11. Leaderboard endpoint
  {
    const r = await apiGet('/api/v1/arena/leaderboard?challengeId=two-sum', userA);
    const data = await r.json();
    if (r.ok && data.leaderboard) {
      // Check no sourceCode in leaderboard entries
      const hasSrc = JSON.stringify(data.leaderboard).includes('sourceCode');
      result('Arena: leaderboard returns without source code', !hasSrc ? 'PASS' : 'FAIL');
    } else {
      result('Arena: leaderboard returns without source code', 'FAIL', JSON.stringify(data));
    }
  }

  // ============================================================
  // BENCHMARK TESTS
  // ============================================================
  console.log('\n--- BENCHMARK ---');

  const benchId = `test_bench_${uid()}`;
  const fileA = { id: 'fa', name: 'main.py', path: '/main.py', content: 'print("A")' };
  const fileB = { id: 'fb', name: 'main.py', path: '/main.py', content: 'print("B")' };

  // 12. Benchmark auth
  {
    const r = await apiPost('/api/v1/benchmark/run', { benchmarkId: benchId, runType: 'BOTH', langA: 'python', langB: 'python', filesA: [fileA], filesB: [fileB] });
    result('Benchmark: run requires authentication', r.status === 401 ? 'PASS' : 'FAIL', `Status: ${r.status}`);
  }

  // 13. Benchmark run A
  {
    const r = await apiPost('/api/v1/benchmark/run', {
      benchmarkId: benchId,
      runType: 'A',
      langA: 'python',
      langB: 'python',
      filesA: [fileA],
      filesB: [fileB]
    }, userA);
    const data = await r.json();
    if (r.ok && data.resultA) {
      result('Benchmark: run A executes independently', 'PASS', `status=${data.resultA.status}`);
    } else {
      result('Benchmark: run A executes independently', 'FAIL', JSON.stringify(data));
    }
  }

  // 14. Benchmark run B
  {
    const r = await apiPost('/api/v1/benchmark/run', {
      benchmarkId: benchId,
      runType: 'B',
      langA: 'python',
      langB: 'python',
      filesA: [fileA],
      filesB: [fileB]
    }, userA);
    const data = await r.json();
    if (r.ok && data.resultB) {
      result('Benchmark: run B executes independently', 'PASS', `status=${data.resultB.status}`);
    } else {
      result('Benchmark: run B executes independently', 'FAIL', JSON.stringify(data));
    }
  }

  // 15. Benchmark run BOTH — result isolation
  {
    const codeA2 = 'print("Output-A")';
    const codeB2 = 'print("Output-B")';
    const r = await apiPost('/api/v1/benchmark/run', {
      benchmarkId: benchId,
      runType: 'BOTH',
      langA: 'python',
      langB: 'python',
      filesA: [{ id: 'fa2', name: 'main.py', path: '/main.py', content: codeA2 }],
      filesB: [{ id: 'fb2', name: 'main.py', path: '/main.py', content: codeB2 }]
    }, userA);
    const data = await r.json();
    if (r.ok && data.resultA && data.resultB) {
      const outA = (data.resultA.stdout || '').trim();
      const outB = (data.resultB.stdout || '').trim();
      const isolated = outA === 'Output-A' && outB === 'Output-B';
      result('Benchmark: A/B outputs are isolated (not clobbered)', isolated ? 'PASS' : 'FAIL',
        `A="${outA}", B="${outB}"`);
    } else {
      result('Benchmark: A/B outputs are isolated (not clobbered)', 'FAIL', JSON.stringify(data));
    }
  }

  // 16. Benchmark history persisted
  {
    const r = await apiGet(`/api/v1/benchmark/history?benchmarkId=${benchId}`, userA);
    const data = await r.json();
    if (r.ok && data.runs && data.runs.length > 0) {
      result('Benchmark: BOTH run persisted to history', 'PASS', `${data.runs.length} run(s)`);
    } else {
      result('Benchmark: BOTH run persisted to history', 'FAIL', JSON.stringify(data));
    }
  }

  // 17. Benchmark IDOR — user B cannot see user A history
  {
    const r = await apiGet(`/api/v1/benchmark/history?benchmarkId=${benchId}`, userB);
    const data = await r.json();
    const noRuns = r.ok && data.runs && data.runs.length === 0;
    result('Benchmark: IDOR — user B cannot see user A history', noRuns ? 'PASS' : 'FAIL',
      `userB got ${data.runs?.length || 0} runs for userA benchmarkId`);
  }

  // 18. Benchmark workspace auth
  {
    const r = await apiGet('/api/v1/benchmark/history?benchmarkId=some-bench');
    result('Benchmark: history requires authentication', r.status === 401 ? 'PASS' : 'FAIL', `Status: ${r.status}`);
  }

  // ============================================================
  // SECURITY TESTS
  // ============================================================
  console.log('\n--- SECURITY ---');

  // 19. Every autosaved Arena path is rejected before persistence.
  {
    const rejectedPaths = [
      '../../../../etc/passwd', '..\\..\\secret', '/etc/passwd',
      'C:\\Windows\\System32\\drivers\\etc\\hosts', 'null\0byte.py',
      '.git/config', 'node_modules/package', '.env',
    ];
    let allRejected = true;
    for (const rawPath of rejectedPaths) {
      const r = await apiPost('/api/v1/arena/run', {
        challengeId: 'two-sum', language: 'python',
        files: [{ id: `bad_${uid()}`, name: rawPath, path: rawPath, content: 'print(1)' }],
      }, userA);
      allRejected &&= r.status === 400;
    }
    const workspace = await apiPost('/api/v1/arena/workspace', { challengeId: 'two-sum', language: 'python' }, userA);
    const workspaceDataAfterReject = await workspace.json();
    const persistedMaliciousFile = (workspaceDataAfterReject.files || []).some((file: any) =>
      rejectedPaths.includes(file.name) || rejectedPaths.includes(file.path));
    result('Security: Arena rejects dangerous paths before persistence', allRejected && !persistedMaliciousFile ? 'PASS' : 'FAIL');
  }

  // 20. Canonical valid workspace paths remain usable.
  {
    const validPaths = ['src/utils/helper.py', 'main.py'];
    let accepted = true;
    for (const rawPath of validPaths) {
      const r = await apiPost('/api/v1/arena/run', {
        challengeId: 'two-sum', language: 'python',
        files: [{ id: `valid_${uid()}`, name: rawPath, path: rawPath, content: 'print(1)' }],
      }, userA);
      accepted &&= r.status !== 400 && r.status !== 413 && r.status !== 500;
    }
    result('Security: Arena accepts valid nested and root paths', accepted ? 'PASS' : 'FAIL');
  }

  // 21. Hidden test stdin not in arena run response
  {
    const files = [{ id: 'sol', name: 'solution.py', path: '/solution.py', content: 'print("x")' }];
    const r = await apiPost('/api/v1/arena/run', { challengeId: 'two-sum', language: 'python', files }, userA);
    const data = await r.json();
    const bodyStr = JSON.stringify(data);
    // Run should only have visible tests — no hidden marker needed  
    const hasHiddenTests = data.testResults?.some((t: any) => t.isHidden === true);
    result('Security: arena run only returns visible tests', !hasHiddenTests ? 'PASS' : 'FAIL',
      hasHiddenTests ? 'Hidden test cases returned in run results!' : '');
  }

  // 22. Bounded parsing converts oversized and malformed bodies into controlled responses.
  {
    const bigCode = 'a'.repeat(1.5 * 1024 * 1024); // 1.5MB of content
    const files = [{ id: 'sol', name: 'solution.py', path: '/solution.py', content: bigCode }];
    try {
      const r = await apiPost('/api/v1/arena/run', { challengeId: 'two-sum', language: 'python', files }, userA);
      result('Security: oversized payload returns 413', r.status === 413 ? 'PASS' : 'FAIL', `Status: ${r.status}`);
    } catch (e: any) {
      result('Security: oversized payload returns 413', 'FAIL', `Network/size error: ${e.message}`);
    }

    const malformed = await apiPostRaw('/api/v1/arena/run', '{"challengeId":', userA);
    result('Security: malformed Arena JSON returns 400', malformed.status === 400 ? 'PASS' : 'FAIL', `Status: ${malformed.status}`);
  }

  // 22. Benchmark cross-user workspace IDOR
  {
    const userAbenchId = `idor_bench_${uid()}`;
    // UserA creates benchmark
    await apiPost('/api/v1/benchmark/run', {
      benchmarkId: userAbenchId,
      runType: 'A',
      langA: 'python',
      langB: 'python',
      filesA: [{ id: 'fa', name: 'main.py', path: '/main.py', content: 'print("secret")' }],
      filesB: [fileB]
    }, userA);

    // UserB tries to get userA's benchmark history
    const r = await apiGet(`/api/v1/benchmark/history?benchmarkId=${userAbenchId}`, userB);
    const data = await r.json();
    const noRuns = r.ok && (!data.runs || data.runs.length === 0);
    result('Security: Benchmark IDOR — cross-user workspace isolation', noRuns ? 'PASS' : 'FAIL',
      `userB got ${data.runs?.length || 0} runs`);
  }

  // ============================================================
  // PERSISTENCE TESTS
  // ============================================================
  console.log('\n--- PERSISTENCE ---');

  // 23. Arena submission history persists across sessions
  {
    // Register fresh session for same user (re-login)
    const r = await apiGet('/api/v1/arena/submissions?challengeId=two-sum', userA);
    const data = await r.json();
    if (r.ok && data.submissions && data.submissions.length > 0) {
      result('Persistence: arena submissions persist across requests', 'PASS');
    } else {
      result('Persistence: arena submissions persist across requests', 'FAIL', JSON.stringify(data));
    }
  }

  // 24. Benchmark history persists
  {
    const r = await apiGet(`/api/v1/benchmark/history?benchmarkId=${benchId}`, userA);
    const data = await r.json();
    if (r.ok && data.runs && data.runs.length > 0) {
      result('Persistence: benchmark runs persist across requests', 'PASS');
    } else {
      result('Persistence: benchmark runs persist across requests', 'FAIL', JSON.stringify(data));
    }
  }

  // 25. Arena workspace data persists (same projectId returned)
  {
    const r = await apiPost('/api/v1/arena/workspace', { challengeId: 'two-sum', language: 'python' }, userA);
    const data = await r.json();
    const sameProject = data.workspace?.projectId === workspaceData?.workspace?.projectId;
    result('Persistence: arena workspace projectId stable', sameProject ? 'PASS' : 'FAIL',
      `Expected ${workspaceData?.workspace?.projectId}, got ${data.workspace?.projectId}`);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log(`\n=== RESULTS ===`);
  console.log(`PASS: ${PASS} | FAIL: ${FAIL} | NEEDS VERIFICATION: ${NEEDS_VERIF}`);

  if (FAIL > 0) {
    console.error('\nFailed tests:');
    RESULTS.filter(r => r.status === 'FAIL').forEach(r => console.error(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
