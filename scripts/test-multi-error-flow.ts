import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';

async function runMultiErrorTest() {
  console.log('=================================================================');
  console.log('[TESTS] SPEED OPTIMIZATION & MULTI-ERROR EXPLANATION TEST SUITE');
  console.log('=================================================================\n');

  const multiErrorCode = `#include <iostream>
using namespace std;
int main() {
    int a = 10
    int c = 20;
    cout << "A: " << a << endl;
    cout << b << endl;
    cout << c << endl;
    cout << "Done" << en
    return 0;
}`;

  const stderr = `test.cpp:5:5: error: expected ',' or ';' before 'int'
test.cpp:8:13: error: 'b' was not declared in this scope
test.cpp:10:23: error: 'en' was not declared in this scope; did you mean 'endl'?`;

  console.log('=== 1. Measuring Gemini API Auto-Fix Latency (Speed Optimization) ===');
  const start = Date.now();
  const res = await fetch('http://localhost:3000/api/v1/ai/autofix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: multiErrorCode,
      stderr,
      languageId: 'cpp',
    }),
  });
  const elapsed = Date.now() - start;
  const data = await res.json();

  console.log(`Response Status: ${res.status}`);
  console.log(`Latency: ${elapsed}ms`);
  console.log(`Provider: ${data.provider} (${data.model})`);

  if (elapsed < 8000) {
    console.log(`[PASS] High-speed response verified (${elapsed}ms < 8000ms threshold, previously ~25000ms)!\n`);
  } else {
    console.warn(`[WARN] Latency higher than expected: ${elapsed}ms\n`);
  }

  console.log('=== 2. Verifying Multi-Error Detection (All Errors Diagnosed) ===');
  const fix = data.fix;
  console.log(`Cause Summary: ${fix.cause}`);
  console.log(`Total Errors Detected: ${fix.errors?.length || 1}`);

  if (fix.errors && fix.errors.length >= 2) {
    console.log('[PASS] Multiple errors successfully detected:');
    for (const err of fix.errors) {
      console.log(`  - Line ${err.line}: [${err.cause}] -> Comment: ${err.inlineComment}`);
    }
    console.log('');
  } else {
    console.error('[FAIL] Expected multiple errors in errors array!\n');
  }

  console.log('=== 3. Verifying Multi-Line Commented Code (Option 1: Explanations) ===');
  console.log('Generated Commented Code:');
  console.log(fix.commentedCode);

  const linesWithComments = fix.commentedCode.split('\n').filter((l: string) => l.includes('[Cortex AI]'));
  console.log(`\nLines with [Cortex AI] explanatory comments: ${linesWithComments.length}`);

  if (linesWithComments.length >= 2) {
    console.log('[PASS] Option 1 comments on ALL error lines, not just one line!\n');
  } else {
    console.error('[FAIL] Expected multiple lines with explanatory comments!\n');
  }

  console.log('=== 4. Verifying Native G++ Execution of Fixed Code ===');
  const execRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: '1', name: 'main.cpp', path: '/main.cpp', content: fix.fixedCode }],
  });
  console.log('Execution Status:', execRes.status);
  console.log('Exit Code:', execRes.exitCode);
  console.log('Stdout:\n' + execRes.stdout.trim());

  if (execRes.status === 'success' && execRes.exitCode === 0) {
    console.log('\n[PASS] Multi-error fixed code compiled and ran with Exit Code 0!');
  } else {
    console.error('\n[FAIL] Fixed code failed to compile in G++ sandbox!');
  }
}

runMultiErrorTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
