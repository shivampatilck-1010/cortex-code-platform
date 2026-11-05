import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { ExecutionRequest, ExecutionResult } from '@/lib/execution/types';
import { getLanguageConfig } from '@/config/languages';
import { TestCase, SubmissionTestCaseResult } from './models';
import { getExecutionMode } from '@/lib/execution/config';

export interface TestOutcome {
  passed: number;
  total: number;
  score: number;
  results: SubmissionTestCaseResult[];
  allPassed: boolean;
}

function prepareHarnessCode(code: string, language: string): string {
  if (language === 'python' || language === 'py') {
    if (code.includes('def two_sum(') && !code.includes('sys.stdin.read')) {
      return `${code}

if __name__ == '__main__':
    import sys, json
    _raw = sys.stdin.read().strip()
    if _raw:
        try:
            if '],' in _raw:
                _parts = _raw.split('],')
                _nums = json.loads(_parts[0].strip() + ']')
                _target = int(_parts[1].strip())
                print(json.dumps(two_sum(_nums, _target)))
            else:
                _data = json.loads(_raw)
                print(json.dumps(two_sum(_data[0], _data[1])))
        except Exception:
            pass
`;
    }
    if (code.includes('def is_valid_bst(') && !code.includes('sys.stdin.read')) {
      return `${code}

if __name__ == '__main__':
    import sys, json
    _raw = sys.stdin.read().strip()
    if _raw:
        try:
            _vals = json.loads(_raw)
            def _build_tree(nodes):
                if not nodes or nodes[0] is None:
                    return None
                root = TreeNode(nodes[0])
                queue = [root]
                i = 1
                while queue and i < len(nodes):
                    curr = queue.pop(0)
                    if i < len(nodes) and nodes[i] is not None:
                        curr.left = TreeNode(nodes[i])
                        queue.append(curr.left)
                    i += 1
                    if i < len(nodes) and nodes[i] is not None:
                        curr.right = TreeNode(nodes[i])
                        queue.append(curr.right)
                    i += 1
                return root
            _tree = _build_tree(_vals)
            print(str(is_valid_bst(_tree)))
        except Exception:
            pass
`;
    }
  }
  return code;
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

  const mode = getExecutionMode();

  async function executeCode(execReq: ExecutionRequest): Promise<ExecutionResult> {
    if (mode === 'docker') {
      try {
        const { executeInDockerSandbox } = await import('@/lib/execution/docker-sandbox');
        return await executeInDockerSandbox(execReq);
      } catch {
        // Fallback to cloud runner
      }
    }

    let execRes = await executeInCloudRunner(execReq);

    // Development-only fallback: only allowed in local non-production environments
    if (execRes.status === 'system_error' && mode === 'development' && process.env.NODE_ENV !== 'production') {
      try {
        const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
        const localRes = await executeInLocalSandbox(execReq);
        if (localRes) execRes = localRes;
      } catch {
        // ignore
      }
    }

    return execRes;
  }

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

    const res = await executeCode(execReq);
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

  const executableCode = prepareHarnessCode(code, language);

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
          content: executableCode,
        },
      ],
      stdin: tc.input || '',
      args: [],
      entrypoint: langConfig.defaultFileName,
    };

    let execRes: ExecutionResult;
    try {
      execRes = await executeCode(execReq);
    } catch (err: any) {
      execRes = {
        status: 'runtime_error',
        stdout: '',
        stderr: 'Execution error occurred',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      };
    }

    const normActual = (execRes.stdout || '').trim().replace(/\r\n/g, '\n');
    const normExpected = (tc.expectedOutput || '').trim().replace(/\r\n/g, '\n');

    let isMatch = false;
    let status: 'passed' | 'failed' | 'timeout' | 'error' = 'failed';

    if (execRes.status === 'timeout') {
      status = 'timeout';
    } else if (execRes.status === 'compilation_error' || execRes.status === 'runtime_error' || execRes.status === 'memory_limit_exceeded' || execRes.status === 'system_error') {
      status = 'error';
    } else if (normActual === normExpected) {
      isMatch = true;
      status = 'passed';
      passedCount++;
      earnedScore += tc.weight;
    }

    // STRICT HIDDEN TEST PRIVACY:
    // When visibility === 'hidden' or isHidden is true, input, expectedOutput, and actualOutput are NEVER exposed.
    const isHidden = tc.visibility === 'hidden' || (tc as any).isHidden === true || (tc as any).hidden === true;
    const isPublic = !isHidden;
    results.push({
      testCaseId: tc.id,
      status,
      visibility: isHidden ? 'hidden' : 'public',
      input: isPublic ? tc.input : undefined,
      expectedOutput: isPublic ? tc.expectedOutput : undefined,
      actualOutput: isPublic ? execRes.stdout : undefined,
      error: isPublic ? (execRes.stderr || undefined) : (isMatch ? undefined : 'Hidden test evaluation failed'),
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
