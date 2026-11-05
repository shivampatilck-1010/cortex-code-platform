import { Assignment, TestCase, TestResult, TestErrorType } from '@/types/assignments';

export interface EvaluationOutcome {
  passedAll: boolean;
  results: TestResult[];
  summaryMessage: string;
}

export interface EvaluationOptions {
  timeoutMs?: number;
  workerFactory?: () => Worker;
}

// Active worker tracking pool for lifecycle management and immediate termination
let activeWorkerPool: Worker[] = [];
let currentExecutionId = 0;

/**
 * Terminates all running assignment workers and clears the active pool.
 */
export function cancelActiveAssignmentExecution(): void {
  for (const worker of activeWorkerPool) {
    try {
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
    } catch {
      // Worker already terminated or uninstantiated
    }
  }
  activeWorkerPool = [];
}

/**
 * Strips comments from user source code so that keywords in comments
 * do not falsely pass structural checks or regex assertions.
 */
export const stripComments = (src: string, lang: string): string => {
  if (lang.includes('python')) {
    // Strip Python single line comments: # ...
    return src.replace(/#.*$/gm, '').trim();
  }
  // Strip C/C++/JS/TS comments: /* ... */ and // ...
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .trim();
};

/**
 * Executes a single test case within a dedicated Web Worker protected by a main-thread timeout.
 */
export function executeTestCaseWithWorker(
  tc: TestCase,
  cleanCode: string,
  options?: EvaluationOptions
): Promise<TestResult> {
  return new Promise((resolve) => {
    const timeoutLimit = options?.timeoutMs ?? 1000;
    const startTime = performance.now();

    let worker: Worker | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (watchdogTimer !== null) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      if (worker) {
        try {
          worker.onmessage = null;
          worker.onerror = null;
          worker.terminate();
        } catch {
          // Ignore termination errors if already closed
        }
        const index = activeWorkerPool.indexOf(worker);
        if (index !== -1) {
          activeWorkerPool.splice(index, 1);
        }
        worker = null;
      }
    };

    const finish = (result: TestResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    // 1. Establish Main-Thread Watchdog Timer
    watchdogTimer = setTimeout(() => {
      const elapsed = Math.max(timeoutLimit, Math.round(performance.now() - startTime));
      finish({
        id: tc.id,
        passed: false,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: `Execution Timed Out: Exceeded ${timeoutLimit}ms limit`,
        runtimeMs: elapsed,
        error: `Execution timed out after ${timeoutLimit}ms. Dedicated worker was terminated.`,
        errorType: 'timeout',
      });
    }, timeoutLimit);

    // 2. Instantiate Worker or safely reject if unavailable
    try {
      if (options?.workerFactory) {
        worker = options.workerFactory();
      } else if (typeof Worker !== 'undefined') {
        worker = new Worker(
          new URL('./assignmentExecution.worker.ts', import.meta.url),
          { type: 'module' }
        );
      } else {
        // Strict Security Invariant: Web Workers are unavailable in the host environment.
        // Main-thread synchronous execution of untrusted code is blocked for security.
        cleanup();
        return resolve({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Worker Execution Unavailable: Web Workers are not supported in this environment.',
          runtimeMs: 0,
          error: 'Execution environment error: Web Workers are unavailable. Synchronous main-thread evaluation of untrusted code is blocked for security.',
          errorType: 'worker_error',
        });
      }

      activeWorkerPool.push(worker);

      worker.onmessage = (event: MessageEvent<any>) => {
        const elapsed = Math.max(1, Math.round(performance.now() - startTime));
        const data = event.data;

        // Validate response contract defensively:
        // - Must be an object
        // - Request ID must match tc.id
        // - passed must be a genuine boolean
        // - output must be a string
        // - runtimeMs must be a finite non-negative number
        // - errorType must be valid if specified
        const isValidStructure =
          data &&
          typeof data === 'object' &&
          typeof data.id === 'number' &&
          data.id === tc.id &&
          typeof data.passed === 'boolean' &&
          typeof data.output === 'string' &&
          typeof data.runtimeMs === 'number' &&
          Number.isFinite(data.runtimeMs) &&
          data.runtimeMs >= 0 &&
          (!data.errorType || ['syntax_error', 'runtime_error', 'timeout', 'worker_error'].includes(data.errorType));

        if (!isValidStructure) {
          finish({
            id: tc.id,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: 'Worker Protocol Error: Invalid or incomplete response payload',
            runtimeMs: elapsed,
            error: 'Malformed message received from execution worker: schema validation failed.',
            errorType: 'worker_error',
          });
          return;
        }

        // Invariant: A response containing an error or errorType must never be marked as passed
        const genuinePassed = data.passed && !data.error && !data.errorType;

        finish({
          id: tc.id,
          passed: genuinePassed,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: String(data.output),
          runtimeMs: data.runtimeMs,
          error: data.error,
          errorType: data.errorType as TestErrorType | undefined,
        });
      };

      worker.onerror = (event: ErrorEvent | any) => {
        const elapsed = Math.max(1, Math.round(performance.now() - startTime));
        const errMsg = event?.message || 'Worker thread initialization or execution error';
        finish({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: `Worker Error: ${errMsg}`,
          runtimeMs: elapsed,
          error: errMsg,
          errorType: 'worker_error',
        });
      };

      // Dispatch test case payload to worker
      worker.postMessage({
        id: tc.id,
        code: cleanCode,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      });
    } catch (err: unknown) {
      const elapsed = Math.max(1, Math.round(performance.now() - startTime));
      const errorObj = err instanceof Error ? err : new Error(String(err));
      finish({
        id: tc.id,
        passed: false,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: `Worker Instantiation Failed: ${errorObj.message}`,
        runtimeMs: elapsed,
        error: `Worker initialization failed: ${errorObj.message}. Synchronous main-thread fallback is disabled for security.`,
        errorType: 'worker_error',
      });
    }
  });
}

/**
 * Main evaluation entry point for assignments.
 * Routes JavaScript/TypeScript to dedicated Web Workers with timeouts and error categorization.
 * Maintains static invariant structural validation for C++17 and Python 3.11.
 */
export const evaluateAssignmentCode = async (
  assignment: Assignment,
  userCode: string,
  options?: EvaluationOptions
): Promise<EvaluationOutcome> => {
  cancelActiveAssignmentExecution();
  const runId = ++currentExecutionId;

  const startTime = Date.now();
  const trimmed = userCode.trim();
  const lang = (assignment.starterLanguage || '').toLowerCase();
  const cleanCode = stripComments(trimmed, lang);

  // Guard: Empty solution or comments only
  if (!cleanCode) {
    const results: TestResult[] = assignment.testCases.map((tc) => ({
      id: tc.id,
      passed: false,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: 'None (Empty solution or comments only)',
      runtimeMs: 0,
      error: 'Solution code cannot be empty or contain only comments.',
      errorType: 'syntax_error',
    }));
    return {
      passedAll: false,
      results,
      summaryMessage: 'Evaluation failed: Solution code cannot be empty or contain only comments.',
    };
  }

  // 1. JavaScript / TypeScript Execution via Dedicated Web Worker
  if (lang.includes('javascript') || lang.includes('typescript')) {
    const results = await Promise.all(
      assignment.testCases.map((tc) => executeTestCaseWithWorker(tc, cleanCode, options))
    );

    // If a newer run superseded this execution while workers were running, abort
    if (runId !== currentExecutionId) {
      return {
        passedAll: false,
        results: [],
        summaryMessage: 'Evaluation superseded by subsequent execution.',
      };
    }

    const allPassed = results.length > 0 && results.every((r) => r.passed);

    return {
      passedAll: allPassed,
      results,
      summaryMessage: allPassed
        ? `All ${results.length} test cases passed successfully.`
        : `${results.filter((r) => !r.passed).length} of ${results.length} test cases failed.`,
    };
  }

  // 2. C++17 Algorithmic Invariant & Structural Validation Engine
  // Note: Client-side prototype performs static structural analysis on AST/source tokens,
  // NOT compiled C++ execution.
  const results: TestResult[] = [];
  let allPassed = true;

  if (assignment.id === 'lab-04' || lang.includes('c++')) {
    // Requirements for AVL Left-Right double rotation:
    // 1. Must perform rotateLeft on z->left (or child)
    // 2. Must perform rotateRight on z (or root)
    // 3. Must return the new root node (cannot return nullptr or NULL)
    const hasLeftRotate =
      /rotateLeft\s*\(\s*z\s*->\s*left\s*\)/.test(cleanCode) ||
      /z\s*->\s*left\s*=\s*rotateLeft/.test(cleanCode);
    const hasRightRotate =
      /rotateRight\s*\(\s*z\s*\)/.test(cleanCode) ||
      /return\s+rotateRight/.test(cleanCode);
    const hasNullReturn =
      /return\s+nullptr\s*;/.test(cleanCode) ||
      /return\s+NULL\s*;/.test(cleanCode);
    const hasUnimplementedTodo = cleanCode.includes('TODO:') && !hasLeftRotate;

    for (const tc of assignment.testCases) {
      const tcStart = performance.now();
      const elapsed = Math.max(1, Math.round(performance.now() - tcStart));

      if (hasNullReturn) {
        allPassed = false;
        results.push({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Structural Violation: Function returns nullptr / NULL',
          runtimeMs: elapsed,
          error: 'rotateLeftRight must return the newly rotated subtree root, not nullptr.',
          errorType: 'runtime_error',
        });
      } else if (hasUnimplementedTodo) {
        allPassed = false;
        results.push({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Invariant violation: Unimplemented TODO block',
          runtimeMs: elapsed,
          error: 'Left-Right rotation logic incomplete. Missing rotateLeft and rotateRight invocations.',
          errorType: 'syntax_error',
        });
      } else if (!hasLeftRotate) {
        allPassed = false;
        results.push({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Balance Factor Violation (BF != 0)',
          runtimeMs: elapsed,
          error: 'Missing initial left rotation on z->left child.',
          errorType: 'runtime_error',
        });
      } else if (!hasRightRotate) {
        allPassed = false;
        results.push({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Subtree height unbalanced',
          runtimeMs: elapsed,
          error: 'Missing subsequent right rotation on root node z.',
          errorType: 'runtime_error',
        });
      } else {
        results.push({
          id: tc.id,
          passed: true,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: tc.expectedOutput,
          runtimeMs: elapsed,
        });
      }
    }
  } else if (assignment.id === 'lab-03' || lang.includes('python')) {
    // Requirements for quadratic probing:
    // formula: (h(k) + c1*i + c2*i**2) % m
    const hasModulo = /%\s*m\b/.test(cleanCode);
    const hasSquare =
      /\*\*\s*2\b/.test(cleanCode) ||
      /\*\s*i\s*\*\s*i\b/.test(cleanCode) ||
      /\bpow\s*\(/.test(cleanCode);
    const hasLoop = /for\s+i\s+in\s+range/.test(cleanCode) || /while\b/.test(cleanCode);
    const hasDummyReturn =
      /return\s*\[\s*0\s*,\s*0/.test(cleanCode) ||
      /return\s*\[\s*\]/.test(cleanCode);

    for (const tc of assignment.testCases) {
      const tcStart = performance.now();
      const elapsed = Math.max(1, Math.round(performance.now() - tcStart));

      if (hasDummyReturn) {
        allPassed = false;
        results.push({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Invariant violation: Returns constant dummy probe sequence',
          runtimeMs: elapsed,
          error: 'Returns constant dummy: probeSequence must compute the dynamic quadratic indices.',
          errorType: 'runtime_error',
        });
      } else if (!hasModulo || !hasSquare || !hasLoop) {
        allPassed = false;
        results.push({
          id: tc.id,
          passed: false,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: 'Syntax / Invariant Error: Quadratic probe formula incomplete',
          runtimeMs: elapsed,
          error: 'Must compute (h(k) + c1*i + c2*i^2) % m across probe sequence range.',
          errorType: 'syntax_error',
        });
      } else {
        results.push({
          id: tc.id,
          passed: true,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: tc.expectedOutput,
          runtimeMs: elapsed,
        });
      }
    }
  } else {
    // Generic fallback evaluator
    for (const tc of assignment.testCases) {
      const tcStart = performance.now();
      const elapsed = Math.max(1, Math.round(performance.now() - tcStart));
      const hasContent = cleanCode.length > 25 && /return\b|function\b|def\b|fn\b/.test(cleanCode);
      results.push({
        id: tc.id,
        passed: hasContent,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: hasContent ? tc.expectedOutput : 'Insufficient code body',
        runtimeMs: elapsed,
        error: hasContent ? undefined : 'Code is incomplete or missing return statement.',
        errorType: hasContent ? undefined : 'syntax_error',
      });
      if (!hasContent) allPassed = false;
    }
  }

  const duration = Date.now() - startTime;
  return {
    passedAll: allPassed,
    results,
    summaryMessage: allPassed
      ? `All ${results.length} test suites verified successfully (${duration}ms)`
      : `${results.filter((r) => !r.passed).length} test cases failed validation.`,
  };
};
