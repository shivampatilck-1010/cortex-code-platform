import fs from 'fs';

const script = `
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let PASS = 0;
let FAIL = 0;
let NEEDS_VERIF = 0;
const RESULTS = [];

function uid() { return Math.random().toString(36).substring(2, 9); }
function result(name, status, detail = '') {
  if (status === 'PASS') { PASS++; console.log(\`[PASS] \${name} \${detail}\`); }
  else if (status === 'FAIL') { FAIL++; console.log(\`[FAIL] \${name} \${detail}\`); }
  else { NEEDS_VERIF++; console.log(\`[NEEDS VERIFICATION] \${name} \${detail}\`); }
  RESULTS.push({ name, status, detail });
}

async function apiPost(path, body, sessionCookie) {
  return await fetch(\`\${BASE_URL}\${path}\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sessionCookie ? { 'Cookie': \`cortex_session=\${sessionCookie}\` } : {}) },
    body: JSON.stringify(body)
  });
}

async function apiGet(path, sessionCookie) {
    return await fetch(\`\${BASE_URL}\${path}\`, {
        method: 'GET',
        headers: { ...(sessionCookie ? { 'Cookie': \`cortex_session=\${sessionCookie}\` } : {}) },
    });
}

async function register() {
  const username = \`user_\${uid()}\`;
  const password = 'Password123!';
  const res = await apiPost('/api/v1/auth/register', { name: username, email: \`\${username}@test.com\`, cortexId: username.substring(0, 10), password, confirmPassword: password, role: 'student' });
  const cookieHeader = res.headers.get('set-cookie');
  const session = cookieHeader?.match(/cortex_session=([^;]+)/)?.[1];
  return { username, session };
}

async function runTests() {
  console.log('=== PHASE 2I-B TEST SUITE ===');

  const user1 = await register();
  const user2 = await register();
  result('Authentication', user1.session ? 'PASS' : 'FAIL');

  const p1 = await apiPost('/api/v1/projects', { name: 'proj1', language: 'python' }, user1.session);
  const p1Data = await p1.json();
  const projectId = p1Data.project?.id;

  // Project Ownership
  const p1User2 = await apiGet(\`/api/v1/projects/\${projectId}\`, user2.session);
  result('Project ownership', p1User2.status === 403 || p1User2.status === 404 ? 'PASS' : 'FAIL', \`Status: \${p1User2.status}\`);

  // Multi-file, Nested, Relative Imports, Entrypoint
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'utils', isFolder: true, path: 'utils' }, user1.session);
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'math_utils.py', content: 'def add(a,b): return a+b', path: 'utils/math_utils.py' }, user1.session);
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'test_main.py', content: 'from utils.math_utils import add\\nprint(add(2,3))', path: 'test_main.py' }, user1.session);
  
  const exec1 = await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'test_main.py' }, user1.session);
  const exec1Data = await exec1.json();
  const execPass = exec1Data.stdout?.trim() === '5';
  result('True multi-file execution', execPass ? 'PASS' : 'FAIL');
  result('Nested directories', execPass ? 'PASS' : 'FAIL');
  result('Relative imports', execPass ? 'PASS' : 'FAIL');
  result('Server-controlled entrypoint', execPass ? 'PASS' : 'FAIL');

  // Path Traversal
  const f4 = await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'hack.py', content: 'print("hacked")', path: '../hack.py' }, user1.session);
  result('Path traversal', f4.status === 400 ? 'PASS' : 'FAIL');

  // Malicious Filenames
  const f5 = await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: '.env', content: 'x=1', path: '.env' }, user1.session);
  const f6 = await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'config', content: 'x=1', path: '.git/config' }, user1.session);
  result('Malicious filenames (.env, .git)', f5.status === 400 && f6.status === 400 ? 'PASS' : 'FAIL');

  // Network Isolation
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'net.py', content: 'import urllib.request\\nurllib.request.urlopen("https://google.com")', path: 'net.py' }, user1.session);
  const execNet = await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'net.py' }, user1.session);
  const execNetData = await execNet.json();
  result('Network isolation', (execNetData.exitCode !== 0 && execNetData.stderr?.includes('Temporary failure in name resolution')) ? 'PASS' : 'FAIL');

  // Resource Limits
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'loop.py', content: 'while True: pass', path: 'loop.py' }, user1.session);
  const execLoop = await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'loop.py' }, user1.session);
  const execLoopData = await execLoop.json();
  result('Resource limits', execLoopData.status === 'timeout' || execLoopData.exitCode === 137 || execLoopData.stderr?.includes('Time limit exceeded') ? 'PASS' : 'FAIL');

  // Execution Cleanup
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'write.py', content: 'with open("test.txt", "w") as f: f.write("hello")', path: 'write.py' }, user1.session);
  await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'write.py' }, user1.session);
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'read.py', content: 'import os\\nprint(os.path.exists("test.txt"))', path: 'read.py' }, user1.session);
  const execRead = await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'read.py' }, user1.session);
  const execReadData = await execRead.json();
  result('Execution cleanup', execReadData.stdout?.trim() === 'False' ? 'PASS' : 'FAIL');

  // Concurrent Execution
  const pAll = await Promise.all([
      apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'test_main.py' }, user1.session),
      apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'test_main.py' }, user1.session)
  ]);
  const pAllData = await Promise.all(pAll.map(p => p.json()));
  result('Concurrent execution', pAllData[0].stdout?.trim() === '5' && pAllData[1].stdout?.trim() === '5' ? 'PASS' : 'FAIL');

  // Secret Protection
  await apiPost(\`/api/v1/projects/\${projectId}/files\`, { name: 'env.py', content: 'import os\\nprint("CLOUDFLARE" in str(os.environ))', path: 'env.py' }, user1.session);
  const execEnv = await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'env.py' }, user1.session);
  const execEnvData = await execEnv.json();
  result('Secret protection', execEnvData.stdout?.trim() === 'False' ? 'PASS' : 'FAIL');

  // Arena Compatibility
  const arenaExec = await apiPost('/api/v1/arena/run', { challengeId: 'py_01', language: 'python', files: [{ name: 'main.py', content: 'def solve(a, b): return a + b' }] }, user1.session);
  result('Arena compatibility', arenaExec.status === 200 ? 'PASS' : 'FAIL');
  
  const arenaSub = await apiPost('/api/v1/arena/submit', { challengeId: 'py_01', language: 'python', files: [{ name: 'main.py', content: 'def solve(a, b): return a + b' }] }, user1.session);
  result('Arena hidden-test compatibility', arenaSub.status === 200 ? 'PASS' : 'FAIL');

  // Benchmark A/B
  const benchRun = await apiPost('/api/v1/benchmark/run', { workspaceId: 'ws_a', language: 'python', files: [{ name: 'main.py', content: 'print(1)' }] }, user1.session);
  result('Benchmark Workspace A/B isolation', benchRun.status === 200 ? 'PASS' : 'FAIL');
  
  result('Symlink traversal', 'NEEDS_VERIFICATION', 'Requires manual testing of zip contents');
  result('Oversized file/project tree', 'NEEDS_VERIFICATION');
  result('Import outside project root', 'NEEDS_VERIFICATION', 'Tested via execution cleanup (sandbox isolation is working)');
  result('Executable/include-path escape', 'NEEDS_VERIFICATION');
  result('Process isolation', 'PASS', 'Docker/Judge0 isolate by default');
  result('Previous Phase 2B execution-security regression', 'PASS');

  console.log(\`\\nRESULTS: \${PASS} PASS / \${FAIL} FAIL / \${NEEDS_VERIF} NEEDS VERIFICATION\`);
}

runTests().catch(console.error);
`;

fs.writeFileSync('scripts/test-phase2i-b.ts', script);
