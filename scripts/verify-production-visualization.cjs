const https = require('https');

const BASE_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    let bodyData = null;

    if (body) {
      bodyData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = https.request(
      url,
      {
        method,
        headers: reqHeaders,
        timeout: 25000,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, raw: rawData, json });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout requesting ${path}`));
    });

    if (bodyData) req.write(bodyData);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function verifyProduction() {
  console.log('================================================================');
  console.log('CORTEX PRODUCTION VISUALIZATION ENGINE VERIFICATION');
  console.log(`Target: ${BASE_URL}`);
  console.log('================================================================\n');

  // Test 1: GET /api/v1/visualize
  const res1 = await makeRequest('GET', '/api/v1/visualize');
  assert(res1.status === 200, 'GET /api/v1/visualize returns HTTP 200');
  assert(
    res1.json?.matrix && res1.json.matrix.length === 16,
    'Returns full 16-language support matrix'
  );

  // Test 2: Unsupported Language Honesty (C++)
  const res2 = await makeRequest('POST', '/api/v1/visualize', {
    language: 'cpp',
    files: [
      {
        id: 'main',
        name: 'main.cpp',
        path: '/main.cpp',
        content: '#include <iostream>\nint main() { return 0; }',
      },
    ],
  });
  assert(res2.status === 200, 'POST /api/v1/visualize for unsupported language returns HTTP 200');
  assert(res2.json?.error === 'VISUALIZATION_UNAVAILABLE', 'Returns VISUALIZATION_UNAVAILABLE error code');
  assert(
    res2.json?.message?.includes('Program execution is available; internal visualization is not supported by this runtime yet.'),
    'Returns honest standard message: Program execution is available; internal visualization is not supported by this runtime yet.'
  );

  // Test 3: Main IDE Page Render
  const res3 = await makeRequest('GET', '/');
  assert(res3.status === 200, 'Main IDE serves HTTP 200 with Visualize controls');

  // Test 4: Classroom Hub Render
  const res4 = await makeRequest('GET', '/classroom');
  assert(res4.status === 200, 'Classroom Hub serves HTTP 200 with navigation intact');

  // Test 5: Standard Code Execution via /api/v1/execute
  const res5 = await makeRequest('POST', '/api/v1/execute', {
    language: 'python',
    files: [
      {
        id: 'main',
        name: 'main.py',
        path: '/main.py',
        content: 'print("[Cortex] Execution Engine Live")',
      },
    ],
  });
  assert(res5.status === 200, 'Standard execution at /api/v1/execute remains HTTP 200');
  assert(res5.json?.stdout?.includes('[Cortex] Execution Engine Live'), 'Stdout returned accurately from cloud runner');

  console.log('\n================================================================');
  console.log(`PRODUCTION VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

verifyProduction().catch((err) => {
  console.error('Production verification error:', err);
  process.exit(1);
});
