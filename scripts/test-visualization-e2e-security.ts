/**
 * Cortex Universal Live Code Visualization Engine
 * End-to-End Integration, Security & Sandbox Validation Suite
 */

import { NextRequest } from 'next/server';
import { POST as handleVisualize, GET as getVisualizeInfo } from '../src/app/api/v1/visualize/route';
import { POST as handleExecute } from '../src/app/api/v1/execute/route';
import { pythonTracingAdapter } from '../src/lib/visualization/adapters/python-adapter';
import { reconstructState } from '../src/lib/visualization/state-engine';
import { LANGUAGE_SUPPORT_MATRIX, hasTracingSupport } from '../src/lib/visualization/registry';
import '../src/lib/visualization/adapters';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passed++;
  } else {
    console.error(`[FAIL] ${msg}`);
    failed++;
  }
}

async function runE2ESecurityTests() {
  console.log('================================================================');
  console.log('CORTEX VISUALIZATION ENGINE — E2E & SECURITY VERIFICATION SUITE');
  console.log('================================================================\n');

  // --- Section 1: API Endpoint Health & Schema Discovery ---
  console.log('--- Section 1: API Endpoint Health & Schema Discovery ---');
  const getRes = await getVisualizeInfo();
  const getJson = await getRes.json();
  assert(getRes.status === 200, 'GET /api/v1/visualize returns HTTP 200');
  assert(Array.isArray(getJson.matrix) && getJson.matrix.length === 16, 'Discovers all 16 languages in support matrix');

  // --- Section 2: Real Python Execution via /api/v1/visualize ---
  console.log('\n--- Section 2: Real Python Execution via /api/v1/visualize ---');
  const pyPayload = {
    language: 'python',
    files: [
      {
        id: 'main',
        name: 'main.py',
        path: '/main.py',
        content: `
x = 5
y = 10
total = x + y
print(f"Computed total: {total}")
`,
      },
    ],
  };

  const req1 = new NextRequest('http://localhost:3000/api/v1/visualize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pyPayload),
  });

  const res1 = await handleVisualize(req1);
  const json1 = await res1.json();
  assert(res1.status === 200, 'POST /api/v1/visualize returns HTTP 200');
  assert(!!json1.session && Array.isArray(json1.session.events), 'Returns structured TraceSession with event stream');
  assert(json1.session.events.length >= 4, 'Emits authentic line execution and variable events');
  assert(json1.execution.stdout.includes('Computed total: 15'), 'Program stdout accurately captured');

  // Verify State Reconstruction on Real API Trace
  const finalState = reconstructState(json1.session.events, json1.session.events.length - 1);
  assert(finalState.variables['total']?.value === 15, 'Reconstructs total = 15 from real runtime trace');

  // --- Section 3: /api/v1/execute Backward Compatibility with { trace: true } ---
  console.log('\n--- Section 3: Execute Route Compatibility with trace: true ---');
  const req2 = new NextRequest('http://localhost:3000/api/v1/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...pyPayload,
      trace: true,
    }),
  });

  const res2 = await handleExecute(req2);
  const json2 = await res2.json();
  assert(res2.status === 200, 'POST /api/v1/execute with trace: true returns HTTP 200');
  assert(!!json2.trace && json2.trace.events.length > 0, 'Exec route returns trace session when requested');
  assert(json2.stdout.includes('Computed total: 15'), 'Exec route preserves clean stdout without trace delimiters');

  // --- Section 4: Honest Handling of Unsupported Tracing Runtimes ---
  console.log('\n--- Section 4: Honest Status for Unsupported Tracing Runtimes ---');
  const cppPayload = {
    language: 'cpp',
    files: [
      {
        id: 'main',
        name: 'main.cpp',
        path: '/main.cpp',
        content: `#include <iostream>\nint main() { std::cout << "Hello C++"; return 0; }`,
      },
    ],
  };

  const req3 = new NextRequest('http://localhost:3000/api/v1/visualize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cppPayload),
  });

  const res3 = await handleVisualize(req3);
  const json3 = await res3.json();
  assert(json3.error === 'VISUALIZATION_UNAVAILABLE', 'Unsupported language returns VISUALIZATION_UNAVAILABLE');
  assert(
    json3.message.includes('Program execution is available; internal visualization is not supported by this runtime yet.'),
    'Returns honest standard limitation message for C++'
  );

  // --- Section 5: Security & Path Traversal Protection ---
  console.log('\n--- Section 5: Security & Sandbox Isolation ---');
  const attackPayload = {
    language: 'python',
    files: [
      {
        id: 'bad',
        name: '../../etc/passwd',
        path: '/../../etc/passwd',
        content: 'malicious',
      },
    ],
  };

  const req4 = new NextRequest('http://localhost:3000/api/v1/visualize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attackPayload),
  });

  const res4 = await handleVisualize(req4);
  const json4 = await res4.json();
  assert(res4.status === 400 && json4.error === 'VALIDATION_FAILED', 'Blocks directory traversal attempt via path sanitizer');

  // --- Section 6: Trace Memory & Event Ceiling Limit Enforcement ---
  console.log('\n--- Section 6: Event Ceiling & Loop Safety ---');
  const loopPayload = {
    language: 'python',
    files: [
      {
        id: 'main',
        name: 'main.py',
        path: '/main.py',
        content: `
count = 0
for i in range(2000):
    count += 1
`,
      },
    ],
  };

  const req5 = new NextRequest('http://localhost:3000/api/v1/visualize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loopPayload),
  });

  const res5 = await handleVisualize(req5);
  const json5 = await res5.json();
  assert(json5.session.metadata.truncated === true, 'High-iteration loop is safely truncated at event limit');
  assert(json5.session.events.length <= 1005, 'Session events capped to prevent memory exhaustion');

  // --- Section 7: Malformed Payload Denial ---
  console.log('\n--- Section 7: Malformed Request Denial ---');
  const req6 = new NextRequest('http://localhost:3000/api/v1/visualize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'invalid json{',
  });

  const res6 = await handleVisualize(req6);
  assert(res6.status === 400, 'Rejects malformed JSON with HTTP 400');

  console.log('\n================================================================');
  console.log(`E2E & SECURITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runE2ESecurityTests().catch((err) => {
  console.error('E2E test error:', err);
  process.exit(1);
});
