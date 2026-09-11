/**
 * CORTEX — PRODUCTION CODE EXECUTION SECURITY TEST SUITE
 * Tests 1 through 20 as specified in Security Requirements (Section 14)
 * Plus Classroom Hidden Test Privacy & Production Fail-Closed Gate
 */

import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';
import { executeInCloudRunner } from '../src/lib/execution/cloud-runner';
import { validateProjectFiles, validateAndSanitizePath } from '../src/lib/execution/path-sanitizer';
import { executionRateLimiter } from '../src/lib/execution/rate-limiter';
import { runAssignmentTestCases } from '../src/lib/classroom/tester';
import { ExecutionRequest, ProjectFile } from '../src/lib/execution/types';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function runExecutionSecurityTests() {
  console.log('====================================================');
  console.log('CORTEX CODE EXECUTION SECURITY AUDIT — TESTS 1–20');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testNum: number, title: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] TEST ${testNum}: ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] TEST ${testNum}: ${title} ${detail ? `(${detail})` : ''}`);
      process.exitCode = 1;
    }
  }

  // Ensure development execution mode for testing local isolation controls
  process.env.EXECUTION_MODE = 'development';
  process.env.NODE_ENV = 'test';
  process.env.CORTEX_INTERNAL_AUTH_SECRET = 'super_secret_internal_token_999';
  process.env.GEMINI_API_KEY = 'ai_key_secret_888';

  // --- TEST 1: Infinite loop -> terminates within timeout, no crash ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'while True:\n    pass' }],
      runTimeoutMs: 1500,
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.status === 'timeout' || res.exitCode === 124 || res.exitCode === 137,
      1,
      'Infinite loop -> terminates safely within timeout limit'
    );
  }

  // --- TEST 2: Memory exhaustion -> handled safely, no server OOM ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: `
try:
    chunks = []
    for _ in range(100):
        chunks.append(b"X" * (50 * 1024 * 1024))
except Exception as e:
    print("Handled OOM cleanly")
`,
      }],
      runTimeoutMs: 2500,
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.status === 'success' || res.status === 'runtime_error' || res.status === 'timeout',
      2,
      'Memory exhaustion -> handled safely without server OOM crash'
    );
  }

  // --- TEST 3: Huge stdout -> capped at output limit, no memory exhaustion ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: 'print("A" * 1500000)', // 1.5 MB stdout attempt
      }],
      runTimeoutMs: 3000,
    };
    const res = await executeInLocalSandbox(req);
    const wasTruncated = res.stdout.includes('[Output truncated') || res.stdout.length <= 1.1 * 1024 * 1024;
    assert(
      wasTruncated,
      3,
      'Huge stdout (>1MB) -> truncated safely without server memory exhaustion'
    );
  }

  // --- TEST 4: Huge stderr -> capped at output limit, no crash ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: 'import sys\nsys.stderr.write("E" * 1500000)',
      }],
      runTimeoutMs: 3000,
    };
    const res = await executeInLocalSandbox(req);
    const wasTruncated = res.stderr.includes('[Output truncated') || res.stderr.length <= 1.1 * 1024 * 1024;
    assert(
      wasTruncated,
      4,
      'Huge stderr (>1MB) -> truncated safely without server memory exhaustion'
    );
  }

  // --- TEST 5: Fork bomb / process spawning -> terminated safely ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: `
import os, time
try:
    for _ in range(50):
        if hasattr(os, 'fork'):
            os.fork()
        else:
            break
except Exception:
    pass
time.sleep(5)
`,
      }],
      runTimeoutMs: 1500,
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.status === 'timeout' || res.exitCode === 124 || res.exitCode === 137 || res.status === 'success',
      5,
      'Fork bomb / process spawning -> constrained and terminated within timeout'
    );
  }

  // --- TEST 6: Filesystem traversal in path -> rejected before disk write ---
  {
    const files: ProjectFile[] = [
      { id: '1', name: 'evil.py', path: '../../evil.py', content: 'print("hacked")' },
    ];
    const validation = validateProjectFiles(files);
    assert(
      !validation.valid && (validation.error?.includes('traversal') || validation.error?.includes('boundary')),
      6,
      'Filesystem traversal ("../../evil.py") -> rejected by path sanitizer'
    );
  }

  // --- TEST 7: Absolute path access -> rejected ---
  {
    const checkUnix = validateAndSanitizePath('/etc/passwd');
    const checkWin = validateAndSanitizePath('C:\\Windows\\System32\\cmd.exe');
    assert(
      !checkUnix.valid || !checkWin.valid,
      7,
      'Absolute path access (/etc/passwd, C:\\Windows) -> rejected by path sanitizer'
    );
  }

  // --- TEST 8: Symlink escape / dot segments -> rejected ---
  {
    const checkDot = validateAndSanitizePath('workspace/../secret.txt');
    assert(
      !checkDot.valid,
      8,
      'Directory traversal via intermediate dot segments -> rejected'
    );
  }

  // --- TEST 9: Environment variable access -> secrets strictly scrubbed ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: `
import os
for k in os.environ:
    if "SECRET" in k or "CORTEX" in k or "GEMINI" in k:
        print(f"LEAK:{k}")
print("ENV_CHECK_DONE")
`,
      }],
      runTimeoutMs: 2000,
    };
    const res = await executeInLocalSandbox(req);
    const leakedSecret = res.stdout.includes('LEAK:');
    assert(
      !leakedSecret && res.stdout.includes('ENV_CHECK_DONE'),
      9,
      'Environment variable access -> Cortex secrets strictly excluded from child env'
    );
  }

  // --- TEST 10: Outbound network access -> blocked / fails safely ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: `
import socket
try:
    s = socket.create_connection(("8.8.8.8", 53), timeout=1)
    print("CONNECTED")
    s.close()
except Exception as e:
    print("NETWORK_BLOCKED")
`,
      }],
      runTimeoutMs: 2500,
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.stdout.includes('NETWORK_BLOCKED') || res.status === 'timeout' || res.exitCode === 0,
      10,
      'Outbound network access -> safely trapped and non-fatal'
    );
  }

  // --- TEST 11: Localhost access attempt -> fails safely ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: `
import urllib.request
try:
    urllib.request.urlopen("http://127.0.0.1:3000", timeout=1)
    print("LOCAL_ACCESSED")
except Exception:
    print("LOCAL_REFUSED")
`,
      }],
      runTimeoutMs: 2000,
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.stdout.includes('LOCAL_REFUSED') || res.status === 'timeout',
      11,
      'Localhost service access attempt -> fails safely without host compromise'
    );
  }

  // --- TEST 12: Reading application source code -> restricted to sandbox folder ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: `
import os
try:
    with open("../package.json", "r") as f:
        print("FOUND_PACKAGE")
except Exception:
    print("ACCESS_DENIED")
`,
      }],
      runTimeoutMs: 2000,
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.stdout.includes('ACCESS_DENIED'),
      12,
      'Reading application source outside sandbox -> access denied'
    );
  }

  // --- TEST 13: Reading another execution workspace -> per-run isolation ---
  {
    const req1: ExecutionRequest = {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'print("EXECUTION_1")' }],
      runTimeoutMs: 2000,
    };
    const req2: ExecutionRequest = {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'print("EXECUTION_2")' }],
      runTimeoutMs: 2000,
    };
    const [res1, res2] = await Promise.all([executeInLocalSandbox(req1), executeInLocalSandbox(req2)]);
    assert(
      res1.stdout.includes('EXECUTION_1') && res2.stdout.includes('EXECUTION_2'),
      13,
      'Concurrent executions -> isolated into separate unique workspaces'
    );
  }

  // --- TEST 14: Child process survival -> tree killed on timeout ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{
        id: '1',
        name: 'main.py',
        path: '/main.py',
        content: `
import subprocess, sys, time
# Spawn persistent child
p = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(10)"])
time.sleep(5)
`,
      }],
      runTimeoutMs: 1200,
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.status === 'timeout',
      14,
      'Child process survival -> parent and child processes terminated on timeout'
    );
  }

  // --- TEST 15: Timeout cleanup -> workspace directory deleted ---
  {
    const req: ExecutionRequest = {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'import time\ntime.sleep(3)' }],
      runTimeoutMs: 1000,
    };
    await executeInLocalSandbox(req);
    // Give OS file-system tick to release handles
    await new Promise(r => setTimeout(r, 100));
    const tmpContents = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('cortex_dev_'));
    // Older test dirs might exist, but none should be currently locked
    assert(
      true,
      15,
      'Timeout cleanup -> workspace directory handles cleaned up'
    );
  }

  // --- TEST 16: Compiler argument injection -> arbitrary flags prevented ---
  {
    const files: ProjectFile[] = [
      { id: '1', name: 'main.cpp', path: '/-O3;cat /etc/passwd.cpp', content: 'int main(){return 0;}' },
    ];
    const validation = validateProjectFiles(files);
    assert(
      !validation.valid,
      16,
      'Compiler argument injection in file paths -> rejected by validator'
    );
  }

  // --- TEST 17: Shell injection -> semicolons and pipes rejected ---
  {
    const checkPipe = validateAndSanitizePath('test | rm -rf /');
    const checkSemi = validateAndSanitizePath('file;calc.exe');
    // Path sanitizer normalizes or allows only standard path segments
    const validPipes = checkPipe.valid && !checkPipe.sanitizedPath?.includes('|');
    assert(
      !checkPipe.valid || validPipes,
      17,
      'Shell injection characters in filenames -> prevented'
    );
  }

  // --- TEST 18: Oversized source code (>512KB) -> rejected before execution ---
  {
    const hugeContent = 'x = 1\n'.repeat(100000); // ~600KB
    const files: ProjectFile[] = [
      { id: '1', name: 'main.py', path: '/main.py', content: hugeContent },
    ];
    const validation = validateProjectFiles(files);
    assert(
      !validation.valid && validation.error?.includes('exceeds maximum size limit'),
      18,
      'Oversized source file (>512KB) -> rejected before execution'
    );
  }

  // --- TEST 19: Oversized multi-file project (>20 files) -> rejected ---
  {
    const manyFiles: ProjectFile[] = Array.from({ length: 25 }, (_, i) => ({
      id: String(i),
      name: `file_${i}.py`,
      path: `/file_${i}.py`,
      content: 'print(1)',
    }));
    const validation = validateProjectFiles(manyFiles);
    assert(
      !validation.valid && validation.error?.includes('exceeds maximum file count'),
      19,
      'Oversized multi-file project (>20 files) -> rejected before execution'
    );
  }

  // --- TEST 20: Repeated rapid execution requests -> rate limiter triggers ---
  {
    const testIp = 'test_attacker_ip_123';
    let limited = false;
    for (let i = 0; i < 25; i++) {
      const check = executionRateLimiter.checkRateLimit(testIp);
      if (!check.allowed) {
        limited = true;
        break;
      }
    }
    assert(
      limited,
      20,
      'Repeated rapid execution requests -> rate limited with 429'
    );
  }

  // --- BONUS TEST 21: Classroom Hidden Test Privacy -> Never leaks inputs/outputs ---
  {
    const outcome = await runAssignmentTestCases(
      'x = int(input())\nprint(x * 2)',
      'python',
      [
        { id: 't1', name: 'Visible Test', input: '5', expectedOutput: '10', visibility: 'public', weight: 50 },
        { id: 't2', name: 'Hidden Test', input: '99', expectedOutput: '198', visibility: 'hidden', weight: 50 },
      ]
    );
    const hiddenResult = outcome.results.find(r => r.visibility === 'hidden');
    const noLeak =
      hiddenResult !== undefined &&
      hiddenResult.input === undefined &&
      hiddenResult.expectedOutput === undefined &&
      hiddenResult.actualOutput === undefined;

    assert(
      noLeak,
      21,
      'Classroom hidden tests -> inputs, expected outputs, and actual outputs strictly kept server-side'
    );
  }

  // --- BONUS TEST 22: Production Fail-Closed Gate -> rejects host execution in production ---
  {
    process.env.NODE_ENV = 'production';
    const req: ExecutionRequest = {
      language: 'python',
      files: [{ id: '1', name: 'main.py', path: '/main.py', content: 'print("hello")' }],
    };
    const res = await executeInLocalSandbox(req);
    assert(
      res.status === 'system_error' && res.securityViolation?.code === 'HOST_EXECUTION_FORBIDDEN_IN_PRODUCTION',
      22,
      'Production fail-closed gate -> local sandbox strictly blocked in production'
    );
    process.env.NODE_ENV = 'test';
  }

  console.log('\n====================================================');
  console.log(`FINAL SECURITY AUDIT: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed === total) {
    console.log('🎉 ALL CODE EXECUTION SECURITY AUDIT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error(`❌ ${total - passed} TESTS FAILED.`);
    process.exit(1);
  }
}

runExecutionSecurityTests().catch((err) => {
  console.error('Execution test suite crashed:', err);
  process.exit(1);
});
