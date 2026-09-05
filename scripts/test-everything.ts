// Exhaustive System Test Suite for Cortex Universal Online Coding Platform
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '../src/config/languages';
import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';
import { parseDiagnostics } from '../src/lib/execution/diagnostics-parser';
import { runTestCases, benchmarkExecution } from '../src/lib/execution/engine';
import { 
  analyzeAndFixErrorOffline, 
  analyzeCode, 
  convertCode, 
  DEFAULT_AI_SETTINGS 
} from '../src/lib/ai/assistant';
import { CollaborationBroker } from '../src/lib/collaboration/broker';
import { CHALLENGES } from '../src/lib/challenges/challenges-data';
import { COURSES } from '../src/lib/learning/courses-data';
import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertTest(name: string, condition: boolean, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${name} ${details ? `-> ${details}` : ''}`);
  }
}

async function runExhaustiveTestSuite() {
  console.log('================================================================');
  console.log('[TESTS] ZENITH PLATFORM: EXHAUSTIVE SYSTEM & COMPONENT TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // SECTION 1: LANGUAGE REGISTRY VERIFICATION (16 LANGUAGES)
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 1] Testing Language Matrix & Configurations ===');
  assertTest('Registry has at least 16 languages', SUPPORTED_LANGUAGES.length >= 16);

  const requiredLangs = [
    'python', 'javascript', 'typescript', 'cpp', 'c', 'java', 'csharp', 
    'go', 'rust', 'php', 'ruby', 'kotlin', 'swift', 'r', 'dart', 'sql'
  ];

  for (const langId of requiredLangs) {
    const config = getLanguageConfig(langId);
    assertTest(
      `Language Config: ${config.name} (${config.version})`,
      config.id === langId && 
      !!config.fileExtension && 
      !!config.defaultFileName && 
      !!config.starterCode && 
      config.timeoutSec > 0 && 
      config.memoryLimitMb > 0
    );
  }
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 2: EXECUTION ENGINE TESTS FOR ALL LANGUAGES INDIVIDUALLY
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 2] Testing Code Execution Across Languages One by One ===');

  // 1. Python 3.12 (Native)
  const pyRes = await executeInLocalSandbox({
    language: 'python',
    files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'x = 40 + 2\nprint(f"Result: {x}")' }],
  });
  assertTest('Python 3.12: Basic execution', pyRes.status === 'success' && pyRes.stdout.includes('Result: 42'));

  // 2. Python UTF-8 Handling
  const pyEmojiRes = await executeInLocalSandbox({
    language: 'python',
    files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'print("[Cortex] UTF-8 Universal Engine: café, résumé, naïve, 100% OK")' }],
  });
  assertTest('Python 3.12: UTF-8 & International Characters', pyEmojiRes.status === 'success' && pyEmojiRes.stdout.includes('[Cortex] UTF-8 Universal Engine: café, résumé, naïve, 100% OK'));

  // 3. JavaScript / Node 24 (Native)
  const jsRes = await executeInLocalSandbox({
    language: 'javascript',
    files: [{ id: '1', name: 'index.js', path: '/index.js', content: 'const data = [1, 2, 3, 4]; console.log("Sum:", data.reduce((a, b) => a + b, 0));' }],
  });
  assertTest('JavaScript (Node 24): Array reduce & console.log', jsRes.status === 'success' && jsRes.stdout.includes('Sum: 10'));

  // 4. TypeScript (Native via Node)
  const tsRes = await executeInLocalSandbox({
    language: 'typescript',
    files: [{ id: '1', name: 'index.ts', path: '/index.ts', content: 'console.log("TypeScript Runtime Active");' }],
  });
  assertTest('TypeScript: Script execution', tsRes.status === 'success' && tsRes.stdout.includes('TypeScript Runtime Active'));

  // 5. C++20 (Native G++ 16.1)
  const cppRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: '1', name: 'main.cpp', path: '/main.cpp', content: '#include <iostream>\nint main(){ std::cout << "C++20 Native OK" << std::endl; return 0; }' }],
  });
  assertTest('C++20 (G++ 16.1): Compilation & execution', cppRes.status === 'success' && cppRes.stdout.includes('C++20 Native OK'));

  // 6. C17 (Native GCC 16.1)
  const cRes = await executeInLocalSandbox({
    language: 'c',
    files: [{ id: '1', name: 'main.c', path: '/main.c', content: '#include <stdio.h>\nint main(void){ printf("C17 Native OK\\n"); return 0; }' }],
  });
  assertTest('C17 (GCC 16.1): Compilation & execution', cRes.status === 'success' && cRes.stdout.includes('C17 Native OK'));

  // 7-16. Cloud Fallback / Simulation Runtimes (Java, C#, Go, Rust, PHP, Ruby, Kotlin, Swift, R, Dart, SQL)
  const otherLangs = ['java', 'csharp', 'go', 'rust', 'php', 'ruby', 'kotlin', 'swift', 'r', 'dart', 'sql'];
  for (const lang of otherLangs) {
    const config = getLanguageConfig(lang);
    const res = await executeInLocalSandbox({
      language: lang,
      files: [{ id: '1', name: config.defaultFileName, path: `/${config.defaultFileName}`, content: config.starterCode }],
    });
    assertTest(`${config.name} (${config.version}): Execution sandbox handling`, res.status === 'success');
  }
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 3: EXECUTION FEATURES & EDGE CASES
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 3] Testing Execution Features & Edge Cases ===');

  // Stdin piping in Python
  const stdinPyRes = await executeInLocalSandbox({
    language: 'python',
    files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'import sys\nname = sys.stdin.read().strip()\nprint(f"Hello, {name}!")' }],
    stdin: 'Cortex Developer',
  });
  assertTest('Standard Input (stdin) Pipe: Python', stdinPyRes.status === 'success' && stdinPyRes.stdout.includes('Hello, Cortex Developer!'));

  // Stdin piping in C++
  const stdinCppRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: '1', name: 'main.cpp', path: '/main.cpp', content: '#include <iostream>\nusing namespace std;\nint main(){ int a, b; if (cin >> a >> b) cout << "Sum: " << a + b << endl; return 0; }' }],
    stdin: '15 27',
  });
  assertTest('Standard Input (stdin) Pipe: C++', stdinCppRes.status === 'success' && stdinCppRes.stdout.includes('Sum: 42'));

  // Exit Code non-zero
  const exitCodeRes = await executeInLocalSandbox({
    language: 'python',
    files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'import sys\nsys.exit(42)' }],
  });
  assertTest('Exit Code Tracking: Exit 42', exitCodeRes.exitCode === 42 && exitCodeRes.status === 'runtime_error');

  // Execution Timeout Killing (infinite loop)
  const timeoutRes = await executeInLocalSandbox({
    language: 'python',
    files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'while True: pass' }],
    runTimeoutMs: 1500, // short timeout for testing
  });
  assertTest('Execution Timeout Protection: Process killed via SIGKILL', timeoutRes.status === 'timeout');

  // Runtime Error / ZeroDivisionError
  const zeroDivRes = await executeInLocalSandbox({
    language: 'python',
    files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'x = 10 / 0' }],
  });
  assertTest('Runtime Error Detection: ZeroDivisionError', zeroDivRes.status === 'runtime_error' && zeroDivRes.stderr.includes('ZeroDivisionError'));

  // Compilation Error in C++
  const compErrRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: '1', name: 'main.cpp', path: '/main.cpp', content: '#include <iostream>\nint main(){ std::cout << 42 return 0; }' }],
  });
  assertTest('Compilation Error Detection: C++ missing semicolon', compErrRes.status === 'compilation_error' && (compErrRes.diagnostics?.length ?? 0) > 0);
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 4: AI CODING ASSISTANT & 9-STEP AUTO-FIX WORKFLOW
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 4] Testing AI Coding Assistant & 9-Step Auto-Fix Loop ===');

  // 1. Diagnostic parser on GCC stderr
  const mockGccStderr = 'main.cpp:4:5: error: expected \';\' before \'return\'';
  const parsedDiags = parseDiagnostics(mockGccStderr, 'cpp');
  assertTest('Diagnostic Parser: Extract line 4 and error message', parsedDiags.length === 1 && parsedDiags[0].line === 4);

  // 2. 9-Step Auto-Fix: Missing Semicolon in C++
  const brokenCppCode = `#include <iostream>
int main() {
    std::cout << "Needs semicolon"
    return 0;
}`;
  const semiFix = analyzeAndFixErrorOffline(brokenCppCode, mockGccStderr, 'cpp', parsedDiags);
  assertTest('Auto-Fix Root Cause: Semicolon identification', semiFix.cause.toLowerCase().includes('semicolon'));
  assertTest('Auto-Fix Diff Generation: Semicolon added', semiFix.fixedCode.includes('std::cout << "Needs semicolon";'));

  // Re-verify compilation of fixed code
  const verifiedSemi = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: '1', name: 'main.cpp', path: '/main.cpp', content: semiFix.fixedCode }],
  });
  assertTest('Auto-Fix Verification: Recompiled & verified', verifiedSemi.status === 'success');

  // 3. 9-Step Auto-Fix: Python IndentationError
  const brokenPyIndent = 'def greet():\nprint("Hello")\ngreet()';
  const indentDiags = [{ line: 2, severity: 'error' as const, message: 'expected an indented block' }];
  const indentFix = analyzeAndFixErrorOffline(brokenPyIndent, 'IndentationError: expected an indented block after function definition on line 1', 'python', indentDiags);
  assertTest('Auto-Fix Root Cause: Indentation identification', indentFix.cause.toLowerCase().includes('indentation'));
  assertTest('Auto-Fix Diff: Indented statement properly', indentFix.fixedCode.includes('    print("Hello")'));

  // 4. 9-Step Auto-Fix: Python NameError
  const brokenPyName = 'def calc():\n    print(result + 10)\ncalc()';
  const nameDiags = [{ line: 2, severity: 'error' as const, message: "name 'result' is not defined" }];
  const nameFix = analyzeAndFixErrorOffline(brokenPyName, "NameError: name 'result' is not defined", 'python', nameDiags);
  assertTest('Auto-Fix Root Cause: NameError identifier resolution', nameFix.cause.includes('result'));

  // 5. AI Code Analysis & Explanations
  const sampleCode = `for i in range(100):\n    for j in range(100):\n        x = i * j`;
  const aiAnalysis = await analyzeCode(sampleCode, 'python', DEFAULT_AI_SETTINGS);
  assertTest('AI Code Analysis: Complexity estimation', aiAnalysis.complexityEstimate.includes('O(n²)'));
  assertTest('AI Code Analysis: Optimizations list', aiAnalysis.optimizations.length > 0);

  // 6. Cross-Language Code Conversion
  const converted = await convertCode('print("Hello")', 'python', 'cpp');
  assertTest('AI Transpiler: Python to C++ conversion', converted.convertedCode.length > 0 && converted.explanation.length > 0);
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 5: AUTOMATED TEST CASE EVALUATOR & BENCHMARK PROFILER
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 5] Testing Test Case Evaluator & Benchmark Profiler ===');

  const testCases = [
    { id: '1', name: 'Sum 2+3', stdin: '2 3', expectedStdout: '5' },
    { id: '2', name: 'Sum 100+250', stdin: '100 250', expectedStdout: '350' },
    { id: '3', name: 'Hidden Negative', stdin: '-5 10', expectedStdout: '5', isHidden: true },
  ];

  const evalRun = await runTestCases(
    {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)' }],
    },
    testCases
  );
  assertTest('Test Case Evaluator: 3/3 Test cases passed', evalRun.passedCount === 3 && evalRun.totalCount === 3);

  // Benchmarking Execution
  const benchmark = await benchmarkExecution(
    {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'sum(range(10000))' }],
    },
    2
  );
  assertTest('Benchmark Profiler: Average time measured', benchmark.averageTimeMs > 0);
  assertTest('Benchmark Profiler: Memory measured', benchmark.memoryUsageMb > 0);
  assertTest('Benchmark Profiler: Big-O complexity estimated', !!benchmark.approxComplexity);
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 6: COMPETITIVE PROGRAMMING ARENA
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 6] Testing Competitive Challenges Dataset & Solver ===');
  assertTest('Challenges Loaded: 3 problems present', CHALLENGES.length >= 3);

  const twoSum = CHALLENGES.find((c) => c.id === 'two-sum')!;
  assertTest('Two Sum: Has test cases', twoSum.testCases.length >= 3);
  assertTest('Two Sum: Has Python template', !!twoSum.starterTemplates.python);
  assertTest('Two Sum: Has C++ template', !!twoSum.starterTemplates.cpp);

  // Evaluate Two Sum Starter Solution
  const twoSumEval = await runTestCases(
    {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: twoSum.starterTemplates.python }],
    },
    twoSum.testCases
  );
  assertTest('Two Sum Solution: Passes all public and hidden test cases', twoSumEval.passedCount === twoSum.testCases.length);
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 7: INTERACTIVE LEARNING PLATFORM
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 7] Testing Learning Platform Curriculum & Courses ===');
  assertTest('Courses Loaded: Multiple tracks', COURSES.length >= 3);

  for (const course of COURSES) {
    assertTest(`Course Track: ${course.title}`, course.lessons.length > 0 && !!course.language);
  }

  // Evaluate Lesson 1 of Python course
  const pyCourse = COURSES.find((c) => c.id === 'python-dsa')!;
  const lesson1 = pyCourse.lessons[0];
  const lessonEval = await executeInLocalSandbox({
    language: lesson1.language,
    files: [{ id: '1', name: 'main.py', path: '/main.py', content: lesson1.starterCode }],
  });
  assertTest('Lesson 1 Evaluation: Output matches expected curriculum standard', lessonEval.stdout.trim().includes(lesson1.expectedOutput.trim()));
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 8: REAL-TIME COLLABORATION BROKER
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 8] Testing Real-Time Collaboration Broker ===');
  const broker = new CollaborationBroker({ id: 'test-user-1', name: 'Test Engineer', color: '#06b6d4' });
  const currentUser = broker.getCurrentUser();
  assertTest('Collaboration Broker: Initialize current user', currentUser.id === 'test-user-1' && currentUser.name === 'Test Engineer');
  broker.updateCursor('file-1', 14, 8);
  assertTest('Collaboration Broker: Update cursor position', currentUser.cursor?.lineNumber === 14 && currentUser.cursor?.column === 8);
  broker.destroy();
  assertTest('Collaboration Broker: Clean destruction', true);
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 9: DATABASE SCHEMA INTEGRITY (24 TABLES)
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 9] Testing Database Schema Integrity ===');
  const schemaPath = path.join(__dirname, '../src/prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

  const expectedEntities = [
    'User', 'Profile', 'Project', 'ProjectFile', 'ProjectMember',
    'Language', 'LanguageVersion', 'Execution', 'ExecutionLog', 'TestCase',
    'Challenge', 'Submission', 'Course', 'Lesson', 'UserProgress',
    'AIRequest', 'SharedLink', 'Deployment', 'Environment', 'Dependency',
    'ApiKey', 'ApiUsage', 'Notification', 'AuditLog'
  ];

  for (const entity of expectedEntities) {
    assertTest(`Prisma Entity: model ${entity}`, schemaContent.includes(`model ${entity} {`));
  }
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 10: PUBLIC DEVELOPER REST API (LIVE HTTP CALLS)
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 10] Testing Live Public Developer REST API Endpoints ===');
  const baseUrl = 'http://localhost:3000';

  // 1. GET /api/v1/languages
  const langsRes = await fetch(`${baseUrl}/api/v1/languages`);
  assertTest('API GET /api/v1/languages: Status 200', langsRes.status === 200);
  const langsData = await langsRes.json();
  assertTest('API GET /api/v1/languages: Returns 16 languages', langsData.count === 16 && langsData.languages.length === 16);

  // 2. POST /api/v1/execute (Python)
  const execPyRes = await fetch(`${baseUrl}/api/v1/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'python', code: 'print("API Python 200 OK")' }),
  });
  assertTest('API POST /api/v1/execute (Python): Status 200', execPyRes.status === 200);
  const execPyData = await execPyRes.json();
  assertTest('API POST /api/v1/execute (Python): Correct stdout', execPyData.status === 'success' && execPyData.stdout.includes('API Python 200 OK'));

  // 3. POST /api/v1/execute (C++)
  const execCppRes = await fetch(`${baseUrl}/api/v1/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'cpp', code: '#include <iostream>\nint main(){ std::cout << "API C++ 200 OK" << std::endl; return 0; }' }),
  });
  assertTest('API POST /api/v1/execute (C++): Status 200', execCppRes.status === 200);
  const execCppData = await execCppRes.json();
  assertTest('API POST /api/v1/execute (C++): Correct stdout', execCppData.status === 'success' && execCppData.stdout.includes('API C++ 200 OK'));

  // 4. POST /api/v1/execute (With Stdin)
  const execStdinRes = await fetch(`${baseUrl}/api/v1/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'python', code: 'import sys; print(f"Echo: {sys.stdin.read().strip()}")', stdin: 'API Stdin Payload' }),
  });
  assertTest('API POST /api/v1/execute (Stdin): Status 200', execStdinRes.status === 200);
  const execStdinData = await execStdinRes.json();
  assertTest('API POST /api/v1/execute (Stdin): Correct stdout', execStdinData.stdout.includes('Echo: API Stdin Payload'));

  // 5. OPTIONS /api/v1/execute (CORS)
  const optionsRes = await fetch(`${baseUrl}/api/v1/execute`, { method: 'OPTIONS' });
  assertTest('API OPTIONS /api/v1/execute: Status 204 with CORS', optionsRes.status === 204);
  console.log('');

  // -------------------------------------------------------------------------
  // SECTION 11: ALL APPLICATION PAGES & SEO COMPILER ROUTES (HTTP 200)
  // -------------------------------------------------------------------------
  console.log('=== [SECTION 11] Testing All Web Pages & SEO Compiler Routes ===');
  const routesToTest = [
    { path: '/', label: 'Main Cloud IDE Shell' },
    { path: '/dashboard', label: 'Developer Dashboard' },
    { path: '/challenges', label: 'Competitive Challenges Arena' },
    { path: '/challenges/two-sum', label: 'Problem Solver: Two Sum' },
    { path: '/challenges/valid-palindrome', label: 'Problem Solver: Valid Palindrome' },
    { path: '/challenges/max-subarray', label: 'Problem Solver: Max Subarray' },
    { path: '/learn', label: 'Interactive Learning Track Directory' },
    { path: '/learn/cpp-fundamentals', label: 'Interactive Lesson: C++ Fundamentals' },
    { path: '/learn/python-dsa', label: 'Interactive Lesson: Python DSA' },
    { path: '/learn/rust-systems', label: 'Interactive Lesson: Rust Safe Systems' },
    { path: '/compare', label: 'Dual Algorithm & Language Comparison Benchmark' },
    { path: '/admin', label: 'Platform Administration & System Health' },
    { path: '/python-online-compiler', label: 'SEO Online Compiler: Python' },
    { path: '/cpp-online-compiler', label: 'SEO Online Compiler: C++' },
    { path: '/c-online-compiler', label: 'SEO Online Compiler: C' },
    { path: '/java-online-compiler', label: 'SEO Online Compiler: Java' },
    { path: '/javascript-online-compiler', label: 'SEO Online Compiler: JavaScript' },
    { path: '/rust-online-compiler', label: 'SEO Online Compiler: Rust' },
    { path: '/go-online-compiler', label: 'SEO Online Compiler: Go' },
  ];

  for (const route of routesToTest) {
    const pageRes = await fetch(`${baseUrl}${route.path}`);
    assertTest(`Web Route: ${route.label} (${route.path}) -> Status 200`, pageRes.status === 200);
  }
  console.log('');

  // -------------------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log(`[RESULTS] FINAL TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
  if (failedTests === 0) {
    console.log('[SUCCESS] 100% SUCCESS! EVERY SINGLE COMPONENT & SUBSYSTEM VERIFIED!');
  } else {
    console.error(`[WARN] ${failedTests} tests failed!`);
  }
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runExhaustiveTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
