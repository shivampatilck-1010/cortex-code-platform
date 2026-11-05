/**
 * Dedicated Web Worker for Assignment Code Execution
 * Evaluates JavaScript/TypeScript assignment solutions in an isolated background thread.
 */

export interface AssignmentWorkerRequest {
  id: number;
  code: string;
  input: string;
  expectedOutput: string;
}

export interface AssignmentWorkerResponse {
  id: number;
  passed: boolean;
  output: string;
  runtimeMs: number;
  error?: string;
  errorType?: 'syntax_error' | 'runtime_error' | 'worker_error';
}

interface WorkerExecutionContext {
  onmessage: ((event: MessageEvent<any>) => void) | null;
  postMessage: (message: any) => void;
  onerror: ((event: any) => void) | null;
}

const workerScope: WorkerExecutionContext = self as any;

/**
 * Sanitizes TypeScript types and decorators for execution in modern JavaScript runtimes.
 */
function sanitizeTypeScript(src: string): string {
  return src
    .replace(/export\s+/g, '')
    // Remove interface declarations
    .replace(/interface\s+\w+(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\}/g, '')
    // Remove type aliases
    .replace(/type\s+\w+(?:<[^>]+>)?\s*=\s*[\s\S]*?;/g, '')
    // Remove function return type annotations: ): Type {
    .replace(/\):\s*[A-Za-z0-9_<>[\]|{} ]+\s*\{/g, ') {')
    // Remove variable type annotations: const x: Type =
    .replace(/\b(const|let|var)\s+([a-zA-Z0-9_$]+)\s*:\s*[^=;]+(?=\s*=|\s*;)/g, '$1 $2')
    // Remove generic instantiation calls: fn<Type>(...) -> fn(...)
    .replace(/\b([a-zA-Z0-9_$]+)\s*<[A-Za-z0-9_<>[\]|&, ]+>\s*\(/g, '$1(')
    // Remove 'as Type' assertions
    .replace(/\s+as\s+[A-Za-z0-9_<>[\]|&]+/g, '')
    // Remove parameter type annotations
    .replace(/:\s*[A-Za-z0-9_<>[\]|{}]+/g, '');
}

/**
 * Normalizes output strings for consistent comparison across platforms.
 */
function normalizeOutput(val: unknown): string {
  return String(val ?? '').trim().replace(/\s+/g, '').replace(/["']/g, '');
}

workerScope.onmessage = (event: MessageEvent<unknown>) => {
  const startTime = performance.now();
  const data = event.data as Partial<AssignmentWorkerRequest> | null | undefined;

  // Validate message structure
  if (!data || typeof data !== 'object' || typeof data.id !== 'number' || typeof data.code !== 'string') {
    const errorResponse: AssignmentWorkerResponse = {
      id: typeof data?.id === 'number' ? data.id : -1,
      passed: false,
      output: 'Malformed message received by execution worker',
      runtimeMs: 0,
      error: 'Worker protocol error: Invalid message payload received.',
      errorType: 'worker_error',
    };
    workerScope.postMessage(errorResponse);
    return;
  }

  const { id, code, input, expectedOutput } = data as AssignmentWorkerRequest;

  try {
    const sanitizedCode = sanitizeTypeScript(code);

    // Evaluate in isolated scope with shadowed globals to prevent unauthorized
    // access to network APIs, storage, or worker communication primitives
    const runner = new Function(
      'input',
      'globalThis',
      'self',
      'postMessage',
      'importScripts',
      'addEventListener',
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'indexedDB',
      'BroadcastChannel',
      'Worker',
      'SharedWorker',
      'caches',
      `"use strict";
      ${sanitizedCode}
      try {
        if (typeof solve === 'function') return JSON.stringify(solve(input));
        if (typeof validateRedBlack === 'function') return JSON.stringify(validateRedBlack(input));
        return String(eval(input));
      } catch(e) {
        throw e;
      }`
    );

    let inputArg: unknown = input;
    try {
      if (typeof input === 'string' && (input.startsWith('[') || input.startsWith('{'))) {
        inputArg = JSON.parse(input);
      }
    } catch {
      // Retain raw input string if JSON parse does not apply
    }

    // Call runner with shadowed identifiers (13 shadowed globals)
    const rawOutput = runner(
      inputArg,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    const elapsed = Math.max(1, Math.round(performance.now() - startTime));
    const normOut = normalizeOutput(rawOutput);
    const normExp = normalizeOutput(expectedOutput);

    // Strict normalized match with length guard for substring inclusions
    const passed = normOut === normExp || (normOut.length > 5 && normOut.includes(normExp));

    const response: AssignmentWorkerResponse = {
      id,
      passed,
      output: String(rawOutput ?? ''),
      runtimeMs: elapsed,
    };
    workerScope.postMessage(response);
  } catch (err: unknown) {
    const elapsed = Math.max(1, Math.round(performance.now() - startTime));
    const errorObj = err instanceof Error ? err : new Error(String(err));
    const isSyntax =
      errorObj instanceof SyntaxError ||
      errorObj.name === 'SyntaxError' ||
      errorObj.message.includes('Unexpected token') ||
      errorObj.message.includes('Unexpected identifier');

    const response: AssignmentWorkerResponse = {
      id,
      passed: false,
      output: isSyntax ? `Syntax Error: ${errorObj.message}` : `Runtime Error: ${errorObj.message}`,
      runtimeMs: elapsed,
      error: errorObj.message,
      errorType: isSyntax ? 'syntax_error' : 'runtime_error',
    };
    workerScope.postMessage(response);
  }
};

// Handle unhandled errors inside worker context
workerScope.onerror = (event: ErrorEvent | string) => {
  const errMsg = typeof event === 'string' ? event : event?.message || 'Unknown worker runtime error';
  const response: AssignmentWorkerResponse = {
    id: -1,
    passed: false,
    output: `Worker Fatal Error: ${errMsg}`,
    runtimeMs: 0,
    error: errMsg,
    errorType: 'worker_error',
  };
  workerScope.postMessage(response);
};
