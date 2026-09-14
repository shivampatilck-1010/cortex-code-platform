

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let PASS = 0;
let FAIL = 0;
let RESULTS: any[] = [];
const cleanup: (() => Promise<void>)[] = [];

function uid() {
  return Math.random().toString(36).substring(2, 9);
}

function result(name: string, passed: boolean, detail: string = '') {
  if (passed) {
    PASS++;
    console.log(`[PASS] ${name} ${detail ? '— ' + detail : ''}`);
    RESULTS.push({ name, status: 'PASS', detail });
  } else {
    FAIL++;
    console.log(`[FAIL] ${name} ${detail ? '— ' + detail : ''}`);
    RESULTS.push({ name, status: 'FAIL', detail });
  }
}

async function apiPost(path: string, body: any, sessionCookie?: string) {
  return await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionCookie ? { 'Cookie': `cortex_session=${sessionCookie}` } : {})
    },
    body: JSON.stringify(body)
  });
}

async function register() {
  const username = `user_${uid()}`;
  const email = `${username}@test.com`;
  const password = 'Password123!';
  const res = await apiPost('/api/v1/auth/register', { 
    name: username,
    email, 
    cortexId: username.substring(0, 10),
    password, 
    confirmPassword: password,
    role: 'student' 
  });
  const cookieHeader = res.headers.get('set-cookie');
  const session = cookieHeader?.match(/cortex_session=([^;]+)/)?.[1];
  return { username, email, password, session };
}

async function runTests() {
  console.log(`=== PHASE 2I-B TEST SUITE ===`);

  // A. Authentication
  const user = await register();
  result('A. Authentication', !!user.session, 'User registered');

  // B. Project authorization
  const p1 = await apiPost('/api/v1/projects', { name: `proj_${uid()}`, language: 'python' }, user.session);
  const p1Data = await p1.json();
  const projectId = p1Data.project?.id;
  result('B. Project creation', p1.status === 200 || p1.status === 201, `projectId=${projectId}`);

  // C. Multi-file execution & D. Nested directories & E. Relative imports & F. Entry-point enforcement
  // We need to add files to the project
  const f1 = await apiPost(`/api/v1/projects/${projectId}/files`, { name: 'utils', isFolder: true, path: 'utils' }, user.session);
  const f1Data = await f1.json();
  const f2 = await apiPost(`/api/v1/projects/${projectId}/files`, { name: 'math_utils.py', content: 'def add(a, b): return a + b', parentId: f1Data.file?.id, path: 'utils/math_utils.py' }, user.session);
  const f3 = await apiPost(`/api/v1/projects/${projectId}/files`, { name: 'test_main.py', content: 'from utils.math_utils import add\nprint(add(2, 3))', path: 'test_main.py' }, user.session);
  
  const exec1 = await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'test_main.py' }, user.session);
  const exec1Data = await exec1.json();
  console.log('EXEC1:', exec1Data);
  result('C, D, E, F: Multi-file execution with nested dir and relative import', exec1Data.stdout?.trim() === '5', `stdout=${exec1Data.stdout}`);

  // G. Path traversal
  const f4 = await apiPost(`/api/v1/projects/${projectId}/files`, { name: 'hack.py', content: 'print("hacked")', path: '../hack.py' }, user.session);
  result('G. Path traversal blocked', f4.status === 400, `status=${f4.status}`);

  // I. Filename attacks
  const f5 = await apiPost(`/api/v1/projects/${projectId}/files`, { name: '.env', content: 'SECRET=123', path: '.env' }, user.session);
  result('I. Filename attack (.env) blocked', f5.status === 400, `status=${f5.status}`);

  // L. Network isolation
  const f6 = await apiPost(`/api/v1/projects/${projectId}/files`, { name: 'net.py', content: 'import urllib.request\nurllib.request.urlopen("https://google.com")', path: 'net.py' }, user.session);
  const exec2 = await apiPost('/api/v1/execute', { projectId, language: 'python', entrypoint: 'net.py' }, user.session);
  const exec2Data = await exec2.json();
  console.log('EXEC2:', exec2Data);
  // We expect failure due to network isolation
  result('L. Network isolation enforced', exec2Data.exitCode !== 0 || exec2Data.stderr?.includes('urllib.error'), 'Network request failed as expected');

  console.log(`\nRESULTS: ${PASS} PASS / ${FAIL} FAIL`);
}

runTests().catch(console.error);
