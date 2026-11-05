import { executeCode, executeInLocalDevPreview } from '../src/components/live-class/modules/codestudio/codeExecutionEngine';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`PASS: ${name}`);
      passed++;
    } else {
      console.error(`FAIL: ${name}`);
      failed++;
    }
  }

  console.log('--- Starting Code Execution Honesty Verification ---');

  const originalFetch = globalThis.fetch;

  try {
    // Test 1: Unreachable backend returns honest error without silent Web Worker fallback
    globalThis.fetch = (async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:3000');
    }) as any;

    const unreachableResult = await executeCode({
      id: 'test-1',
      name: 'main.ts',
      language: 'typescript',
      content: 'console.log("Hello World");',
    });

    assert(
      unreachableResult.status === 'error',
      'Unreachable backend returns status: error'
    );
    assert(
      unreachableResult.exitCode === 1,
      'Unreachable backend returns exitCode: 1'
    );
    assert(
      unreachableResult.stderr.includes('Cortex Cloud Runner Error: Unable to reach backend execution service at /api/v1/execute'),
      'Unreachable backend provides honest stderr message without silent fallback'
    );
    assert(
      !unreachableResult.stdout.includes('Hello World'),
      'Unreachable backend does not fabricate stdout output'
    );

    // Test 2: HTTP 500 error from /api/v1/execute reports genuine server failure
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: 'Sandbox runner container crashed' }),
      };
    }) as any;

    const http500Result = await executeCode({
      id: 'test-2',
      name: 'main.ts',
      language: 'typescript',
      content: 'console.log("Should not execute");',
    });

    assert(
      http500Result.status === 'error',
      'HTTP 500 error returns status: error'
    );
    assert(
      http500Result.stderr.includes('Sandbox runner container crashed'),
      'HTTP 500 error reports exact error message from backend'
    );

    // Test 3: Backend success propagates genuine results
    globalThis.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          stdout: 'Execution output from cloud runner\n',
          stderr: '',
          exitCode: 0,
          executionTime: 42,
        }),
      };
    }) as any;

    const successResult = await executeCode({
      id: 'test-3',
      name: 'main.ts',
      language: 'typescript',
      content: 'console.log("Test Cloud Runner");',
    });

    assert(
      successResult.status === 'success',
      'Successful backend execution returns status: success'
    );
    assert(
      successResult.stdout === 'Execution output from cloud runner\n',
      'Successful backend execution returns genuine stdout'
    );
    assert(
      successResult.executionTimeMs === 42,
      'Successful backend execution preserves execution time'
    );

    // Test 4: Explicit Local Dev Preview correctly prefixes preview banner
    const previewResult = await executeInLocalDevPreview({
      id: 'test-4',
      name: 'preview.ts',
      language: 'typescript',
      content: 'console.log("Client preview ran");',
    });

    assert(
      previewResult.status === 'success',
      'Local dev preview executes successfully'
    );
    assert(
      previewResult.stdout.includes('[LOCAL DEV PREVIEW]'),
      'Local dev preview explicitly labels output with [LOCAL DEV PREVIEW]'
    );
    assert(
      previewResult.stdout.includes('Client preview ran'),
      'Local dev preview logs student stdout'
    );

    // Test 5: Editor-only languages (e.g. C++, Rust) report compiler notices honestly
    const cppResult = await executeInLocalDevPreview({
      id: 'test-5',
      name: 'solution.cpp',
      language: 'cpp',
      content: '#include <iostream>\nint main() { return 0; }',
    });

    assert(
      cppResult.status === 'error',
      'Editor-only language returns status: error'
    );
    assert(
      cppResult.exitCode === 126,
      'Editor-only language returns exitCode: 126'
    );
    assert(
      cppResult.stderr.includes('Compiler Notice: Native compilation and execution of C++17 requires a remote containerized compiler'),
      'Editor-only language provides honest compiler guidance'
    );

  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`--- Finished: ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error during execution honesty verification:', err);
  process.exit(1);
});
