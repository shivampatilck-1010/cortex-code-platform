import { SUPPORTED_LANGUAGES, getLanguageConfig } from '@/config/languages';
import { ExecutionRequest, ExecutionResult, DiagnosticError, TestCase, BenchmarkMetrics } from './types';
import { parseDiagnostics } from './diagnostics-parser';

export { parseDiagnostics };

/**
 * Universal Execution Client
 * Calls /api/v1/execute which delegates to the isolated sandbox worker on the backend.
 * Falls back gracefully if running in SSR / offline environment.
 */
export async function executeInCloudSandbox(req: ExecutionRequest): Promise<ExecutionResult> {
  const langConfig = getLanguageConfig(req.language);
  const startTime = Date.now();

  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const response = await fetch(`${baseUrl}/api/v1/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: req.language,
        version: req.version || langConfig.version,
        files: req.files,
        stdin: req.stdin || '',
        args: req.args || [],
        entrypoint: req.entrypoint,
      }),
    });

    const executionTimeMs = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text();
      return {
        status: 'runtime_error',
        exitCode: 1,
        stdout: '',
        stderr: `API Gateway response ${response.status}: ${errText}`,
        executionTimeMs,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      };
    }

    const data = await response.json();
    return {
      status: data.status,
      exitCode: data.exitCode,
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      executionTimeMs: data.execution_time ?? executionTimeMs,
      memoryUsageMb: data.memory ?? 16,
      diagnostics: data.diagnostics || parseDiagnostics(data.stderr || '', langConfig.id),
      timestamp: data.timestamp || new Date().toISOString(),
      provider: data.provider || 'cloud_sandbox',
    };
  } catch (err: any) {
    return {
      status: 'runtime_error',
      exitCode: 1,
      stdout: '',
      stderr: `Network gateway communication error: ${err.message || String(err)}`,
      executionTimeMs: Date.now() - startTime,
      memoryUsageMb: 0,
      timestamp: new Date().toISOString(),
      provider: 'cloud_sandbox',
    };
  }
}

/**
 * Batch test case evaluation engine
 */
export async function runTestCases(
  req: ExecutionRequest,
  testCases: TestCase[]
): Promise<{ testCases: TestCase[]; passedCount: number; totalCount: number }> {
  const evaluated: TestCase[] = [];
  let passedCount = 0;

  for (const tc of testCases) {
    const singleReq: ExecutionRequest = {
      ...req,
      stdin: tc.stdin,
    };

    const res = await executeInCloudSandbox(singleReq);
    const actual = (res.stdout || '').trim();
    const expected = (tc.expectedStdout || '').trim();
    const passed = res.status === 'success' && actual === expected;

    if (passed) passedCount++;

    evaluated.push({
      ...tc,
      actualStdout: actual,
      passed,
      timeMs: res.executionTimeMs,
      memoryMb: res.memoryUsageMb,
      error: res.status !== 'success' ? (res.stderr || res.stdout) : undefined,
    });
  }

  return {
    testCases: evaluated,
    passedCount,
    totalCount: testCases.length,
  };
}

/**
 * Performance benchmarking and algorithmic complexity estimation
 */
export async function benchmarkExecution(
  req: ExecutionRequest,
  iterations: number = 3
): Promise<BenchmarkMetrics> {
  const times: number[] = [];
  let totalMemory = 0;

  for (let i = 0; i < iterations; i++) {
    const res = await executeInCloudSandbox(req);
    times.push(res.executionTimeMs);
    totalMemory += res.memoryUsageMb;
  }

  const minTimeMs = Math.min(...times);
  const maxTimeMs = Math.max(...times);
  const averageTimeMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const memoryUsageMb = Math.round(totalMemory / iterations);

  // Algorithmic complexity estimation
  let approxComplexity = 'O(1) to O(n)';
  if (averageTimeMs > 400) {
    approxComplexity = 'O(n²) or higher (Compute Intensive)';
  } else if (averageTimeMs > 150) {
    approxComplexity = 'O(n log n) or O(n)';
  } else {
    approxComplexity = 'O(1) or O(log n)';
  }

  return {
    iterations,
    averageTimeMs,
    minTimeMs,
    maxTimeMs,
    memoryUsageMb,
    approxComplexity,
  };
}
