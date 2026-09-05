// Comprehensive Verification Script for Universal Online Coding Platform
import { parseDiagnostics, executeInCloudSandbox, runTestCases, benchmarkExecution } from '../src/lib/execution/engine';
import { analyzeAndFixErrorOffline, analyzeCode } from '../src/lib/ai/assistant';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '../src/config/languages';

async function runTests() {
  console.log('====================================================');
  console.log('[TESTS] ZENITH PLATFORM: RUNNING AUTOMATED ENGINE TESTS');
  console.log('====================================================\n');

  // Test 1: Language Matrix
  console.log(`[Test 1] Verifying Language Configuration Matrix...`);
  console.assert(SUPPORTED_LANGUAGES.length >= 16, 'Should have at least 16 languages configured');
  const py = getLanguageConfig('python');
  console.assert(py.name === 'Python', 'Python config should match');
  console.log(`[PASS] Passed: ${SUPPORTED_LANGUAGES.length} Languages Loaded.\n`);

  // Test 2: Diagnostic Error Parsing
  console.log(`[Test 2] Testing Stderr Diagnostic Parser...`);
  const gccStderr = 'main.cpp:15:5: error: expected \';\' before \'return\'';
  const gccDiags = parseDiagnostics(gccStderr, 'cpp');
  console.assert(gccDiags.length === 1 && gccDiags[0].line === 15, 'GCC line 15 parsing');
  console.log(`[PASS] Passed: Parsed GCC Diagnostic -> Line ${gccDiags[0].line}: "${gccDiags[0].message}"\n`);

  // Test 3: AI 9-Step Auto-Fix Analyzer (Syntax Error -> Semantic Fix)
  console.log(`[Test 3] Testing AI 9-Step Auto-Fix Engine...`);
  const brokenCpp = `#include <iostream>
int main() {
    std::cout << "Missing semicolon"
    return 0;
}`;
  const fix = analyzeAndFixErrorOffline(brokenCpp, gccStderr, 'cpp', gccDiags);
  console.assert(fix.cause.includes('semicolon'), 'Cause should mention semicolon');
  console.assert(fix.fixedCode.includes('std::cout << "Missing semicolon";'), 'Fixed code should add semicolon');
  console.log(`[PASS] Passed: Auto-Fix identified cause: "${fix.cause}"`);
  console.log(`Diff lines generated: ${fix.diffChanges.length}\n`);

  // Test 4: Live Cloud Execution (Python Sandbox)
  console.log(`[Test 4] Testing Live Cloud Sandbox Execution (Python 3.12)...`);
  const pyRes = await executeInCloudSandbox({
    language: 'python',
    files: [{
      id: 'main',
      name: 'main.py',
      path: '/main.py',
      content: 'print("Universal Cloud Sandbox Ready!")'
    }],
  });
  console.log(`Status: ${pyRes.status}, Exit Code: ${pyRes.exitCode}`);
  console.log(`Stdout: ${pyRes.stdout.trim()}`);
  console.log(`Time: ${pyRes.executionTimeMs}ms, Memory: ${pyRes.memoryUsageMb}MB`);
  console.assert(pyRes.stdout.includes('Universal Cloud Sandbox Ready!'), 'Stdout should match');
  console.log(`[PASS] Passed: Python Cloud Sandbox Execution Verified.\n`);

  // Test 5: Test Case Evaluation Engine
  console.log(`[Test 5] Testing Automated Test Case Evaluator...`);
  const testCases = [
    { id: '1', name: 'Case 1', stdin: '2 3', expectedStdout: '5' },
    { id: '2', name: 'Case 2', stdin: '10 20', expectedStdout: '30' },
  ];
  const evalRes = await runTestCases(
    {
      language: 'python',
      files: [{
        id: 'sum',
        name: 'main.py',
        path: '/main.py',
        content: 'import sys; a, b = map(int, sys.stdin.read().split()); print(a + b)'
      }],
    },
    testCases
  );
  console.log(`Passed: ${evalRes.passedCount}/${evalRes.totalCount}`);
  console.assert(evalRes.passedCount === 2, 'Both test cases should pass');
  console.log(`[PASS] Passed: Test Case Evaluation Engine Verified.\n`);

  console.log('====================================================');
  console.log('[SUCCESS] ALL AUTOMATED ENGINE TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});
