const APP_URL = process.env.BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function logAuthAndRunTests() {
  console.log('--- STARTING CORTEX PHASE 2A TESTS ---');

  // 1. Create two test users via auth APIs (simulating login/register)
  const u1Res = await fetch(`${APP_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alice', email: 'alice.phase2.27840.' + Date.now() + Math.random() + '@example.com', password: 'Password123!', confirmPassword: 'Password123!', cortexId: 'alice' + Math.random().toString(36).substring(7), role: 'student' })
  });
  const u1Cookies = u1Res.headers.get('set-cookie');
  if (!u1Cookies) throw new Error('User 1 failed to register: ' + (await u1Res.text()));

  const u2Res = await fetch(`${APP_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bob', email: 'bob.phase2.27840.' + Date.now() + Math.random() + '@example.com', password: 'Password123!', confirmPassword: 'Password123!', cortexId: 'alice' + Math.random().toString(36).substring(7), role: 'student' })
  });
  const u2Cookies = u2Res.headers.get('set-cookie');
  if (!u2Cookies) throw new Error('User 2 failed to register: ' + (await u2Res.text()));

  console.log('? Authentication PASS');

  // 2. Create Project for User 1
  const createProjRes = await fetch(`${APP_URL}/api/v1/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': u1Cookies },
    body: JSON.stringify({ name: 'Alice Super Project', language: 'python' })
  });
  const p1Data = await createProjRes.json();
  if (!p1Data.project || p1Data.project.name !== 'Alice Super Project') {
    throw new Error('Project creation failed: ' + JSON.stringify(p1Data));
  }
  const projectId = p1Data.project.id;
  console.log('? Project Creation PASS');

  // 3. User 1 Adds a new file
  const createFileRes = await fetch(`${APP_URL}/api/v1/projects/${projectId}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': u1Cookies },
    body: JSON.stringify({ name: 'utils.py', path: '/utils.py', content: 'def helper(): pass', isFolder: false })
  });
  const fileData = await createFileRes.json();
  if (!fileData.file || fileData.file.name !== 'utils.py') {
    throw new Error('File creation failed: ' + JSON.stringify(fileData));
  }
  const fileId = fileData.file.id;
  console.log('? File Creation PASS');

  // 4. Zero Trust: User 2 tries to access User 1's project
  const u2AccessRes = await fetch(`${APP_URL}/api/v1/projects/${projectId}`, {
    headers: { 'Cookie': u2Cookies }
  });
  if (u2AccessRes.status !== 403) {
    throw new Error(`Zero-trust failed! User 2 accessed User 1 project with status ${u2AccessRes.status}`);
  }
  console.log('? Zero Trust: Cross-user Read Blocked PASS');

  // 5. Zero Trust: User 2 tries to delete User 1's file
  const u2DeleteRes = await fetch(`${APP_URL}/api/v1/projects/${projectId}/files/${fileId}`, {
    method: 'DELETE',
    headers: { 'Cookie': u2Cookies }
  });
  if (u2DeleteRes.status !== 403) {
    throw new Error(`Zero-trust failed! User 2 deleted User 1 file with status ${u2DeleteRes.status}`);
  }
  console.log('? Zero Trust: Cross-user Delete Blocked PASS');

  // 6. User 1 updates file content (debounced auto-save simulation)
  const updateFileRes = await fetch(`${APP_URL}/api/v1/projects/${projectId}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': u1Cookies },
    body: JSON.stringify({ content: 'def helper(): return 42' })
  });
  const updatedData = await updateFileRes.json();
  if (updatedData.file.content !== 'def helper(): return 42') {
    throw new Error('File update failed: ' + JSON.stringify(updatedData));
  }
  console.log('? Auto-save / File Update PASS');

  // 7. Prevent Path Traversal in Path update
  const maliciousUpdateRes = await fetch(`${APP_URL}/api/v1/projects/${projectId}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Cookie': u1Cookies },
    body: JSON.stringify({ path: '../../etc/passwd' })
  });
  if (maliciousUpdateRes.status !== 400) {
    throw new Error('Path traversal prevention failed! Expected 400, got ' + maliciousUpdateRes.status);
  }
  console.log('? Path Traversal Prevention PASS');

  console.log('\n==================================');
  console.log('PHASE 2A ALL TESTS PASSED!');
  console.log('==================================\n');
}

logAuthAndRunTests().catch(err => {
  console.error('\n!!! TEST FAILED !!!');
  console.error(err.message);
  process.exit(1);
});
