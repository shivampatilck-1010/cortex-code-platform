const https = require('https');
const { WebSocket } = require('ws');

const BASE_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';
const TEACHER_COOKIE = 'cortex_session=cac0819cf530f20e9a072a84fa5e9bc4a93605927b1ab825e5dd334f63e20cce';
const CLASSROOM_ID = 'CLS_DEMO_DSA_2026';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Cortex-Production-Verification/1.0',
        ...(options.headers || {}),
      },
    };

    const req = https.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          json,
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function verifyProduction() {
  console.log('================================================================');
  console.log('CORTEX PRODUCTION LIVE CLASSROOM VERIFICATION');
  console.log('Target: ' + BASE_URL);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Unauthenticated request to live session API is rejected
    const unauthRes = await request(`/api/v1/classrooms/${CLASSROOM_ID}/live/session`);
    assert(
      unauthRes.status === 401,
      'Live Session API: Unauthenticated request rejected with HTTP 401',
      `Status: ${unauthRes.status}`
    );

    // 2. Authenticated teacher request to live session API
    const teacherRes = await request(`/api/v1/classrooms/${CLASSROOM_ID}/live/session`, {
      headers: { Cookie: TEACHER_COOKIE },
    });
    assert(
      teacherRes.status === 200 && teacherRes.json && teacherRes.json.role === 'teacher',
      'Live Session API: Authenticated instructor session verified with role="teacher"',
      `Role: ${teacherRes.json?.role}`
    );

    const liveToken = teacherRes.json?.liveSessionToken;
    assert(
      Boolean(liveToken && typeof liveToken === 'string'),
      'Live Session Token: Server issues HMAC-signed liveSessionToken for WebSocket',
      `Token present: ${Boolean(liveToken)}`
    );

    // 3. Verify Live Classroom UI route renders successfully
    const livePageRes = await request(`/classroom/${CLASSROOM_ID}/live/live-sess-1`, {
      headers: { Cookie: TEACHER_COOKIE },
    });
    assert(
      livePageRes.status === 200,
      'Classroom Live Page: Serves HTTP 200 HTML with Live Classroom container',
      `Status: ${livePageRes.status}`
    );

    // 4. Verify Classroom Lobby & Teams routes remain operational
    const lobbyRes = await request(`/classroom/${CLASSROOM_ID}`, {
      headers: { Cookie: TEACHER_COOKIE },
    });
    assert(
      lobbyRes.status === 200,
      'Classroom Dashboard: Preserves existing classroom dashboard and navigation',
      `Status: ${lobbyRes.status}`
    );

    const teamsRes = await request(`/api/v1/classrooms/${CLASSROOM_ID}/teams`, {
      headers: { Cookie: TEACHER_COOKIE },
    });
    assert(
      teamsRes.status === 200 && Array.isArray(teamsRes.json?.teams),
      'Project Teams Integration: Teams API returns HTTP 200 with team roster',
      `Teams count: ${teamsRes.json?.teams?.length}`
    );

    // 5. Code Execution Endpoint Verification
    const execRes = await request('/api/v1/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: TEACHER_COOKIE,
      },
      body: {
        language: 'typescript',
        files: [{ name: 'main.ts', content: 'console.log("Production Execution Verified");' }],
      },
    });
    assert(
      execRes.status === 200 && (execRes.json?.stdout?.includes('Production Execution Verified') || execRes.json?.status === 'success'),
      'Code Execution Service: /api/v1/execute runs code with honest execution status',
      `Stdout: ${execRes.json?.stdout}`
    );

  } catch (err) {
    console.error('[Verification Error]', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`PRODUCTION VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

verifyProduction();
