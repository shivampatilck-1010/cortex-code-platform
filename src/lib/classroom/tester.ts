import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { ExecutionRequest, ExecutionResult } from '@/lib/execution/types';
import { getLanguageConfig } from '@/config/languages';
import { TestCase, SubmissionTestCaseResult } from './models';

export interface TestOutcome {
  passed: number;
  total: number;
  score: number;
  results: SubmissionTestCaseResult[];
  allPassed: boolean;
}

export async function runAssignmentTestCases(
  code: string,
  language: string,
  testCases: TestCase[]
): Promise<TestOutcome> {
  const langConfig = getLanguageConfig(language);
  const results: SubmissionTestCaseResult[] = [];
  let totalScore = 0;
  let earnedScore = 0;
  let passedCount = 0;

  if (!testCases || testCases.length === 0) {
    // Single smoke execution test
    const execReq: ExecutionRequest = {
      language: langConfig.id,
      version: langConfig.version,
      files: [
        {
          id: 'main',
          name: langConfig.defaultFileName,
          path: `/${langConfig.defaultFileName}`,
          content: code,
        },
      ],
      stdin: '',
      args: [],
      entrypoint: langConfig.defaultFileName,
    };

    const res = await executeInCloudRunner(execReq);
    const passed = res.status === 'success' && res.exitCode === 0;

    return {
      passed: passed ? 1 : 0,
      total: 1,
      score: passed ? 100 : 0,
      allPassed: passed,
      results: [
        {
          testCaseId: 'smoke_test',
          status: passed ? 'passed' : 'failed',
          visibility: 'public',
          input: '',
          expectedOutput: '',
          actualOutput: res.stdout,
          error: res.stderr || undefined,
          executionTimeMs: res.executionTimeMs || 50,
          memoryUsageMb: res.memoryUsageMb || 12,
          score: passed ? 100 : 0,
          maxScore: 100,
        },
      ],
    };
  }

  for (const tc of testCases) {
    totalScore += tc.weight;

    const execReq: ExecutionRequest = {
      language: langConfig.id,
      version: langConfig.version,
      files: [
        {
          id: 'main',
          name: langConfig.defaultFileName,
          path: `/${langConfig.defaultFileName}`,
          content: code,
        },
      ],
      stdin: tc.input || '',
      args: [],
      entrypoint: langConfig.defaultFileName,
    };

    let execRes: ExecutionResult;
    try {
      execRes = await executeInCloudRunner(execReq);

      // Fallback to local sandbox if cloud runner failed with network error
      if (execRes.status === 'runtime_error' && execRes.stderr.includes('Cloud execution error')) {
        try {
          const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
          const localRes = await executeInLocalSandbox(execReq);
          if (localRes) execRes = localRes;
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      execRes = {
        status: 'runtime_error',
        stdout: '',
        stderr: err?.message || 'Execution error',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'local_worker',
      };
    }

    const normActual = (execRes.stdout || '').trim().replace(/\r\n/g, '\n');
    const normExpected = (tc.expectedOutput || '').trim().replace(/\r\n/g, '\n');

    let isMatch = false;
    let status: 'passed' | 'failed' | 'timeout' | 'error' = 'failed';

    if (execRes.status === 'timeout') {
      status = 'timeout';
    } else if (execRes.status === 'compilation_error' || execRes.status === 'runtime_error' || execRes.status === 'memory_limit_exceeded') {
      status = 'error';
    } else if (normActual === normExpected) {
      isMatch = true;
      status = 'passed';
      passedCount++;
      earnedScore += tc.weight;
    }

    results.push({
      testCaseId: tc.id,
      status,
      visibility: tc.visibility,
      input: tc.visibility === 'public' ? tc.input : undefined,
      expectedOutput: tc.visibility === 'public' ? tc.expectedOutput : undefined,
      actualOutput: tc.visibility === 'public' ? execRes.stdout : undefined,
      error: tc.visibility === 'public' ? (execRes.stderr || undefined) : (execRes.stderr ? 'Hidden test execution error' : undefined),
      executionTimeMs: execRes.executionTimeMs || 40,
      memoryUsageMb: execRes.memoryUsageMb || 14,
      score: isMatch ? tc.weight : 0,
      maxScore: tc.weight,
    });
  }

  const finalScore = totalScore > 0 ? Math.round((earnedScore / totalScore) * 100) : 0;

  return {
    passed: passedCount,
    total: testCases.length,
    score: finalScore,
    results,
    allPassed: passedCount === testCases.length,
  };
}

// Token-based Jaccard similarity for code comparison
export function calculateCodeSimilarity(code1: string, code2: string): number {
  if (!code1 || !code2) return 0;
  if (code1.trim() === code2.trim()) return 100;

  const tokenize = (s: string): string[] => {
    // Strip comments, quotes, and tokenize keywords/identifiers
    const stripped = s
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      .replace(/#.*/g, '')
      .replace(/["'`].*?["'`]/g, '""');
    const tokens = stripped.match(/[a-zA-Z_]\w{2,}/g) || [];
    return Array.from(new Set(tokens));
  };

  const tokens1 = tokenize(code1);
  const tokens2 = tokenize(code2);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set2 = new Set(tokens2);
  let intersection = 0;
  for (let i = 0; i < tokens1.length; i++) {
    if (set2.has(tokens1[i])) intersection++;
  }

  const allUnion = new Set(tokens1.concat(tokens2));
  return allUnion.size > 0 ? Math.round((intersection / allUnion.size) * 100) : 0;
}
