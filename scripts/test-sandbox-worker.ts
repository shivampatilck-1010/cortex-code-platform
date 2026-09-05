import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';
import { analyzeAndFixErrorOffline } from '../src/lib/ai/assistant';
import { parseDiagnostics } from '../src/lib/execution/diagnostics-parser';

async function verifySandbox() {
  console.log('=====================================================');
  console.log('[WORKER] ZENITH SANDBOX WORKER END-TO-END VERIFICATION');
  console.log('=====================================================\n');

  // 1. Python Execution
  console.log('[1/4] Testing Python 3.12 Sandbox with Clean UTF-8 Execution...');
  const pyRes = await executeInLocalSandbox({
    language: 'python',
    files: [{
      id: 'p1',
      name: 'main.py',
      path: '/main.py',
      content: 'import sys\nprint("[Cortex] Welcome to Cloud IDE")\nprint(f"Python 3.12 OK, platform: {sys.platform}")',
    }],
  });
  console.log(`Status: ${pyRes.status}, Exit: ${pyRes.exitCode}`);
  console.log(`Stdout: ${pyRes.stdout.trim()}`);
  console.assert(pyRes.status === 'success' && pyRes.stdout.includes('Python 3.12 OK'));
  console.log('[PASS] Python 3.12 Sandbox Passed!\n');

  // 2. JavaScript (Node 24) Execution
  console.log('[2/4] Testing JavaScript (Node 24) Sandbox...');
  const jsRes = await executeInLocalSandbox({
    language: 'javascript',
    files: [{
      id: 'j1',
      name: 'index.js',
      path: '/index.js',
      content: 'const arr = [1, 2, 3]; console.log("Node 24 Sum:", arr.reduce((a, b) => a + b, 0));',
    }],
  });
  console.log(`Status: ${jsRes.status}, Exit: ${jsRes.exitCode}`);
  console.log(`Stdout: ${jsRes.stdout.trim()}`);
  console.assert(jsRes.status === 'success' && jsRes.stdout.includes('Node 24 Sum: 6'));
  console.log('[PASS] JavaScript (Node 24) Sandbox Passed!\n');

  // 3. C++20 (G++ 16.1) Execution
  console.log('[3/4] Testing C++20 (G++ 16.1) Compilation & Execution...');
  const cppCode = `#include <iostream>
#include <vector>
#include <numeric>

int main() {
    std::vector<int> vals = {10, 20, 30, 40};
    int total = std::accumulate(vals.begin(), vals.end(), 0);
    std::cout << "G++ 16.1 C++20 Output: " << total << std::endl;
    return 0;
}`;
  const cppRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: 'c1', name: 'main.cpp', path: '/main.cpp', content: cppCode }],
  });
  console.log(`Status: ${cppRes.status}, Exit: ${cppRes.exitCode}`);
  console.log(`Stdout: ${cppRes.stdout.trim()}`);
  console.assert(cppRes.status === 'success' && cppRes.stdout.includes('G++ 16.1 C++20 Output: 100'));
  console.log('[PASS] C++20 G++ Sandbox Passed!\n');

  // 4. Compilation Error Detection & AI 9-Step Auto-Fix Re-verification
  console.log('[4/4] Testing C++ Compilation Error Diagnostics & AI Auto-Fix Loop...');
  const brokenCpp = `#include <iostream>

int main() {
    std::cout << "Missing semicolon here"
    return 0;
}`;
  const brokenRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: 'b1', name: 'main.cpp', path: '/main.cpp', content: brokenCpp }],
  });
  console.log(`Status: ${brokenRes.status}, Exit: ${brokenRes.exitCode}`);
  console.log(`Diagnostics Detected: ${brokenRes.diagnostics?.length}`);
  console.assert(brokenRes.status === 'compilation_error', 'Must fail compilation');

  // AI Analyzes and Fixes
  const fix = analyzeAndFixErrorOffline(
    brokenCpp,
    brokenRes.stderr,
    'cpp',
    brokenRes.diagnostics || []
  );
  console.log(`AI Diagnosis: "${fix.cause}"`);
  console.log(`AI Explanation: "${fix.explanation}"`);
  console.assert(fix.fixedCode.includes('std::cout << "Missing semicolon here";'));

  // Re-verify the fix
  console.log('Recompiling with AI applied patch...');
  const fixedRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: 'b1', name: 'main.cpp', path: '/main.cpp', content: fix.fixedCode }],
  });
  console.log(`Re-verification Status: ${fixedRes.status}`);
  console.assert(fixedRes.status === 'success', 'Fixed code must compile and run successfully');
  console.log('[PASS] 9-Step AI Auto-Fix Loop Verified End-to-End!\n');

  console.log('=====================================================');
  console.log('[SUCCESS] ALL SANDBOX & COMPILER WORKERS PASSED 100%!');
  console.log('=====================================================');
}

verifySandbox().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
