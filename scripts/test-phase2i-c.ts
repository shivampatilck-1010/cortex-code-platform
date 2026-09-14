const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let PASS = 0;
let FAIL = 0;
const RESULTS: any[] = [];

function uid() { return Math.random().toString(36).substring(2, 9); }
function result(name: string, status: string, detail = '') {
  if (status === 'PASS') { PASS++; console.log(`[PASS] ${name} ${detail}`); }
  else if (status === 'FAIL') { FAIL++; console.log(`[FAIL] ${name} ${detail}`); }
  RESULTS.push({ name, status, detail });
}

async function apiPost(path: string, body: any, sessionCookie?: string) {
  return await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sessionCookie ? { 'Cookie': `cortex_session=${sessionCookie}` } : {}) },
    body: JSON.stringify(body)
  });
}

async function register() {
  const username = `user_${uid()}`;
  const password = 'Password123!';
  const res = await apiPost('/api/v1/auth/register', { name: username, email: `${username}@test.com`, cortexId: username.substring(0, 10), password, confirmPassword: password, role: 'student' });
  const cookieHeader = res.headers.get('set-cookie');
  const session = cookieHeader?.match(/cortex_session=([^;]+)/)?.[1];
  return { username, session };
}

async function runTests() {
  console.log(`\n=== CORTEX PHASE 2I-C VERIFICATION ===\nTarget: ${BASE_URL}\n`);
  const { session: sessionUser } = await register();

  // 1. Terminal fake commands removed
  try {
    const res = await apiPost('/api/v1/terminal', { command: 'ls' }, sessionUser);
    const data = await res.json();
    if (data.stderr && data.stderr.includes('cortex: command not found: ls')) {
       result('Terminal - Fake ls removed', 'PASS');
    } else {
       result('Terminal - Fake ls removed', 'FAIL', `Expected 'command not found', got: ${JSON.stringify(data)}`);
    }
  } catch (e: any) {
    result('Terminal - Fake ls removed', 'FAIL', e.message);
  }

  // 2. Project Export 
  let projectId;
  try {
    const pRes = await apiPost('/api/v1/projects', { name: 'ExportTest', language: 'python' }, sessionUser);
    const pData = await pRes.json();
    projectId = pData.project?.id;
    if (projectId) {
       const exportRes = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/export`, {
           headers: { 'Cookie': `cortex_session=${sessionUser}` }
       });
       if (exportRes.status === 200 && exportRes.headers.get('Content-Type') === 'application/zip') {
           result('Project Export API - ZIP download', 'PASS');
           
           const blob = await exportRes.blob();
           const formData = new FormData();
           formData.append('file', blob as any, 'test.zip');
           
           const importRes = await fetch(`${BASE_URL}/api/v1/projects/${projectId}/import`, {
               method: 'POST',
               headers: { 'Cookie': `cortex_session=${sessionUser}` },
               body: formData
           });
           
           if (importRes.ok) {
               result('Project Import API - ZIP upload & extract', 'PASS');
           } else {
               const errText = await importRes.text();
               result('Project Import API - ZIP upload & extract', 'FAIL', `Expected 200, got ${importRes.status}: ${errText}`);
           }
       } else {
           result('Project Export API - ZIP download', 'FAIL', `Expected 200 application/zip, got ${exportRes.status}`);
       }
    } else {
        result('Project Export API - ZIP download', 'FAIL', `Failed to create project: ${JSON.stringify(pData)}`);
    }
  } catch(e: any) {
      result('Project Export API - ZIP download', 'FAIL', e.message);
  }

  console.log(`\n--- RESULTS ---`);
  console.log(`PASS: ${PASS} | FAIL: ${FAIL}`);
  if (FAIL > 0) process.exit(1);
}

runTests().catch(console.error);
