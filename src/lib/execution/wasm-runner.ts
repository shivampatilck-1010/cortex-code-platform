/**
 * Cortex Client-Side WebAssembly & Web Worker Execution Engine
 *
 * Enables zero-cost, sub-10ms in-browser code execution for:
 * 1. JavaScript & TypeScript via isolated Web Worker sandbox
 * 2. Python 3 via on-demand Pyodide WebAssembly runtime
 *
 * Eliminates server queue delays and cloud compute costs for client runs.
 */

export interface WasmExecutionResult {
  status: 'success' | 'error';
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  exitCode: number;
  engine: 'client-wasm' | 'client-worker';
}

/**
 * Executes JavaScript code inside an isolated Web Worker sandbox with standard stream capture.
 */
export async function executeJavaScriptInWorker(
  code: string,
  stdin: string = '',
  timeoutMs: number = 8000
): Promise<WasmExecutionResult> {
  const startTime = performance.now();

  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return {
      status: 'error',
      stdout: '',
      stderr: 'Web Worker execution is only available in a browser environment.\n',
      executionTimeMs: 0,
      exitCode: 1,
      engine: 'client-worker',
    };
  }

  return new Promise((resolve) => {
    let resolved = false;

    // Worker bootstrap script with console hijacking and error boundary
    const workerScript = `
      self.onmessage = function(e) {
        var userCode = e.data.code;
        var stdin = e.data.stdin || '';
        var logs = [];
        var errors = [];

        var originalLog = console.log;
        var originalWarn = console.warn;
        var originalError = console.error;

        console.log = function() {
          var args = Array.prototype.slice.call(arguments);
          logs.push(args.map(function(a) { 
            return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); 
          }).join(' '));
        };

        console.warn = function() {
          var args = Array.prototype.slice.call(arguments);
          logs.push('[WARN] ' + args.map(function(a) { 
            return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); 
          }).join(' '));
        };

        console.error = function() {
          var args = Array.prototype.slice.call(arguments);
          errors.push(args.map(function(a) { 
            return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); 
          }).join(' '));
        };

        try {
          var runFn = new Function('stdin', userCode);
          var result = runFn(stdin);
          if (result !== undefined && logs.length === 0) {
            logs.push(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
          }
          self.postMessage({ success: true, logs: logs, errors: errors });
        } catch (err) {
          errors.push(err && err.stack ? err.stack : String(err));
          self.postMessage({ success: false, logs: logs, errors: errors });
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        const duration = Math.round(performance.now() - startTime);
        resolve({
          status: 'error',
          stdout: '',
          stderr: `Execution Timeout: Process exceeded maximum time limit of ${timeoutMs}ms.\n`,
          executionTimeMs: duration,
          exitCode: 124,
          engine: 'client-worker',
        });
      }
    }, timeoutMs);

    worker.onmessage = (event) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        const duration = Math.round(performance.now() - startTime);
        const { success, logs, errors } = event.data;

        resolve({
          status: success && errors.length === 0 ? 'success' : 'error',
          stdout: logs.length > 0 ? logs.join('\n') + '\n' : '',
          stderr: errors.length > 0 ? errors.join('\n') + '\n' : '',
          executionTimeMs: duration,
          exitCode: success && errors.length === 0 ? 0 : 1,
          engine: 'client-worker',
        });
      }
    };

    worker.onerror = (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        worker.terminate();
        URL.revokeObjectURL(blobUrl);
        const duration = Math.round(performance.now() - startTime);
        resolve({
          status: 'error',
          stdout: '',
          stderr: `Runtime Error: ${err.message || 'Worker thread execution failed'}\n`,
          executionTimeMs: duration,
          exitCode: 1,
          engine: 'client-worker',
        });
      }
    };

    worker.postMessage({ code, stdin });
  });
}

export interface PyodideInstance {
  setStdout(opts: { batched: (text: string) => void }): void;
  setStderr(opts: { batched: (text: string) => void }): void;
  setStdin(opts: { stdin: () => string }): void;
  runPythonAsync(code: string): Promise<unknown>;
}

// Global Pyodide singleton promise to prevent parallel download/initialization
let pyodideInstancePromise: Promise<PyodideInstance> | null = null;

async function loadPyodideInstance(): Promise<PyodideInstance> {
  if (typeof window === 'undefined') {
    throw new Error('Pyodide can only run in a browser environment');
  }

  const win = window as Window & {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInstance>;
    pyodideInstance?: PyodideInstance;
  };
  if (win.pyodideInstance) {
    return win.pyodideInstance;
  }

  if (pyodideInstancePromise) {
    return pyodideInstancePromise;
  }

  pyodideInstancePromise = (async () => {
    // 1. Check if pyodide script is already present on the page
    if (!win.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Pyodide WebAssembly runtime from CDN'));
        document.head.appendChild(script);
      });
    }

    if (typeof win.loadPyodide !== 'function') {
      throw new Error('loadPyodide is not defined after script injection');
    }

    const pyodide = await win.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/',
    });

    win.pyodideInstance = pyodide;
    return pyodide;
  })();

  return pyodideInstancePromise;
}

/**
 * Executes Python 3 code directly in the browser via Pyodide (WebAssembly).
 */
export async function executePythonInPyodide(
  code: string,
  stdin: string = '',
  timeoutMs: number = 10000
): Promise<WasmExecutionResult> {
  const startTime = performance.now();

  try {
    const pyodide = await loadPyodideInstance();

    let stdoutBuffer: string[] = [];
    let stderrBuffer: string[] = [];

    // Capture stdout and stderr
    pyodide.setStdout({
      batched: (text: string) => {
        stdoutBuffer.push(text);
      },
    });

    pyodide.setStderr({
      batched: (text: string) => {
        stderrBuffer.push(text);
      },
    });

    // Provide stdin mock if provided
    if (stdin) {
      pyodide.setStdin({
        stdin: () => stdin,
      });
    }

    // Run user code
    const result = await pyodide.runPythonAsync(code);
    const duration = Math.round(performance.now() - startTime);

    let stdout = stdoutBuffer.join('\n');
    if (stdout.length > 0 && !stdout.endsWith('\n')) {
      stdout += '\n';
    }

    // If result was returned directly and nothing was printed
    if (result !== undefined && stdoutBuffer.length === 0) {
      stdout = String(result) + '\n';
    }

    const stderr = stderrBuffer.join('\n');

    return {
      status: stderrBuffer.length > 0 ? 'error' : 'success',
      stdout,
      stderr: stderr ? (stderr.endsWith('\n') ? stderr : stderr + '\n') : '',
      executionTimeMs: duration,
      exitCode: stderrBuffer.length > 0 ? 1 : 0,
      engine: 'client-wasm',
    };
  } catch (err: any) {
    const duration = Math.round(performance.now() - startTime);
    return {
      status: 'error',
      stdout: '',
      stderr: (err?.message || String(err)) + '\n',
      executionTimeMs: duration,
      exitCode: 1,
      engine: 'client-wasm',
    };
  }
}
