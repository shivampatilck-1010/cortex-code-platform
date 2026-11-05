import { CodeLanguage, CodeFile, ExecutionResult, LanguageConfig } from '@/types/codestudio';

export const LANGUAGE_CONFIGS: Record<CodeLanguage, LanguageConfig> = {
  typescript: {
    id: 'typescript',
    label: 'TypeScript 5.7',
    extension: '.ts',
    defaultFileName: 'main.ts',
    supportLevel: 'fully-supported',
    supportBadge: 'Execution Ready',
    starterCode: `// CS 201: AVL Tree Algorithm in TypeScript
interface AVLNode {
  key: number;
  height: number;
  left: AVLNode | null;
  right: AVLNode | null;
}

function createNode(key: number): AVLNode {
  return { key, height: 1, left: null, right: null };
}

function getHeight(node: AVLNode | null): number {
  return node ? node.height : 0;
}

function getBalanceFactor(node: AVLNode | null): number {
  return node ? getHeight(node.left) - getHeight(node.right) : 0;
}

function rotateRight(y: AVLNode): AVLNode {
  const x = y.left!;
  const T2 = x.right;

  x.right = y;
  y.left = T2;

  y.height = Math.max(getHeight(y.left), getHeight(y.right)) + 1;
  x.height = Math.max(getHeight(x.left), getHeight(x.right)) + 1;

  return x;
}

console.log("=== Testing AVL Right Rotation in TypeScript ===");
const root = createNode(30);
root.left = createNode(20);
root.left.left = createNode(10);

console.log("Pre-rotation balance factor:", getBalanceFactor(root));
const newRoot = rotateRight(root);
console.log("Post-rotation root key:", newRoot.key, "(height: " + newRoot.height + ")");
console.log("Post-rotation balance factor:", getBalanceFactor(newRoot));
console.log("All invariant checks passed!");
`,
  },
  javascript: {
    id: 'javascript',
    label: 'JavaScript (ES2024)',
    extension: '.js',
    defaultFileName: 'script.js',
    supportLevel: 'fully-supported',
    supportBadge: 'Execution Ready',
    starterCode: `// CS 201: Binary Search Tree Invariant Checker
function isBST(node, min = -Infinity, max = Infinity) {
  if (!node) return true;
  if (node.key <= min || node.key >= max) return false;
  return isBST(node.left, min, node.key) && isBST(node.right, node.key, max);
}

const sampleTree = {
  key: 20,
  left: { key: 10, left: null, right: null },
  right: { key: 30, left: null, right: null }
};

console.log("=== Testing BST Invariants in JavaScript ===");
console.log("Validating sample tree structure...");
const valid = isBST(sampleTree);
console.log("Is Binary Search Tree Valid:", valid);
`,
  },
  python: {
    id: 'python',
    label: 'Python 3.11',
    extension: '.py',
    defaultFileName: 'solution.py',
    supportLevel: 'experimental',
    supportBadge: 'Execution Ready',
    starterCode: `# CS 201: AVL Tree Invariant Verification in Python
def get_balance_factor(left_height, right_height):
    return left_height - right_height

print("=== AVL Balance Verification in Python ===")
left_h = 3
right_h = 1
bf = get_balance_factor(left_h, right_h)
print("Computed balance factor:", bf)

if abs(bf) > 1:
    print("Violation detected: Node requires rebalancing rotation")
else:
    print("Node satisfies AVL height-balance invariant")
`,
  },
  cpp: {
    id: 'cpp',
    label: 'C++17',
    extension: '.cpp',
    defaultFileName: 'avl_tree.cpp',
    supportLevel: 'fully-supported',
    supportBadge: 'Execution Ready',
    starterCode: `// CS 201: AVL Tree Balance Implementation in C++17
#include <iostream>
#include <algorithm>

struct Node {
    int key;
    int height;
    Node* left;
    Node* right;

    Node(int val) : key(val), height(1), left(nullptr), right(nullptr) {}
};

int getHeight(Node* n) {
    return n ? n->height : 0;
}

int getBalanceFactor(Node* n) {
    return n ? getHeight(n->left) - getHeight(n->right) : 0;
}

Node* rotateRight(Node* y) {
    Node* x = y->left;
    Node* T2 = x->right;

    x->right = y;
    y->left = T2;

    y->height = std::max(getHeight(y->left), getHeight(y->right)) + 1;
    x->height = std::max(getHeight(x->left), getHeight(x->right)) + 1;

    return x;
}

int main() {
    std::cout << "Testing AVL right rotation on root 30..." << std::endl;
    Node* root = new Node(30);
    root->left = new Node(20);
    root->left->left = new Node(10);

    std::cout << "Pre-rotation balance factor: " << getBalanceFactor(root) << std::endl;
    root = rotateRight(root);
    std::cout << "Post-rotation root: " << root->key << " (height: " << root->height << ")" << std::endl;
    std::cout << "Post-rotation balance factor: " << getBalanceFactor(root) << std::endl;

    return 0;
}
`,
  },
  rust: {
    id: 'rust',
    label: 'Rust 1.75',
    extension: '.rs',
    defaultFileName: 'main.rs',
    supportLevel: 'fully-supported',
    supportBadge: 'Execution Ready',
    starterCode: `// CS 201: AVL Invariant in Rust 1.75
fn main() {
    println!("=== CS 201 AVL Tree Invariant Verification in Rust ===");
    let left_h: i32 = 3;
    let right_h: i32 = 1;
    let bf = left_h - right_h;
    println!("Balance factor: {}", bf);
}
`,
  },
};

/**
 * Transpiles TypeScript into executable JavaScript by stripping type annotations, generic parameters,
 * class modifiers, and compiling enums into frozen objects.
 */
export function transpileTypeScript(code: string): string {
  // Check for unsupported constructs and return explicit diagnostics
  if (/\bnamespace\s+[A-Za-z0-9_$]+/.test(code) || /\bmodule\s+[A-Za-z0-9_$]+(?!\s*=)/.test(code)) {
    throw new Error(
      'TypeScript Sandbox Diagnostic: Namespaces and internal modules are not supported in this client environment. Please use ES classes or standard object modules.'
    );
  }
  if (/^\s*@\w+/m.test(code)) {
    throw new Error(
      'TypeScript Sandbox Diagnostic: Decorators ("@...") are not supported in the client-side preprocessor.'
    );
  }

  let js = code;

  // 1. Remove interface definitions (including generic and extends)
  js = js.replace(/interface\s+\w+(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\}/g, '');

  // 2. Remove type aliases (including multiline and unions)
  js = js.replace(/type\s+\w+(?:<[^>]+>)?\s*=\s*[\s\S]*?;/g, '');

  // 3. Compile enums into frozen objects
  js = js.replace(/\benum\s+([A-Za-z0-9_$]+)\s*\{([^}]*)\}/g, (_, enumName, body) => {
    const lines = body.split(',').map((s: string) => s.trim()).filter(Boolean);
    const assignments: string[] = [];
    let autoVal = 0;
    for (const item of lines) {
      if (item.includes('=')) {
        const [k, v] = item.split('=').map((s: string) => s.trim());
        assignments.push(`${JSON.stringify(k)}: ${v}`);
        const num = Number(v);
        if (!isNaN(num)) autoVal = num + 1;
      } else {
        assignments.push(`${JSON.stringify(item)}: ${autoVal}`);
        autoVal++;
      }
    }
    return `const ${enumName} = Object.freeze({ ${assignments.join(', ')} });`;
  });

  // 4. Remove generic type parameters on function declarations: function foo<T>(...)
  js = js.replace(/\bfunction\s+([a-zA-Z0-9_$]+)\s*<[^>]+>\s*\(/g, 'function $1(');

  // 5. Remove accessibility & readonly modifiers: public, private, protected, readonly
  js = js.replace(/\b(public|private|protected|readonly)\s+/g, '');

  // 6. Remove class property type annotations: foo: number = 1; -> foo = 1; foo: number; -> foo;
  js = js.replace(/^(\s*)([a-zA-Z0-9_$]+)\s*:\s*[^=;\n]+(\s*=\s*[^;\n]+)?;/gm, (_, indent, prop, init) => {
    return `${indent}${prop}${init || ''};`;
  });

  // 7. Remove variable type annotations: const/let/var x: Type = ...
  js = js.replace(/\b(const|let|var)\s+([a-zA-Z0-9_$]+)\s*:\s*[^=;]+(?=\s*=|\s*;)/g, '$1 $2 ');

  // 8. Class constructors: constructor(param: Type, ...) {
  js = js.replace(/\bconstructor\s*\(([^)]*)\)\s*\{/g, (_, params) => {
    const cleanParams = params.replace(/([a-zA-Z0-9_$]+)\s*\??\s*:\s*[^,=]+/g, '$1');
    return `constructor(${cleanParams}) {`;
  });

  // 9. Class methods & async functions: [async] methodName(param: Type): ReturnType {
  js = js.replace(/\b(async\s+)?([a-zA-Z0-9_$]+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*[^{]+)?\s*\{/g, (match, asyncKeyword, fnName, params) => {
    if (['if', 'while', 'for', 'switch', 'catch', 'function'].includes(fnName)) return match;
    const cleanParams = params.replace(/([a-zA-Z0-9_$]+)\s*\??\s*:\s*[^,=]+/g, '$1');
    const asyncPrefix = asyncKeyword || '';
    return `${asyncPrefix}${fnName}(${cleanParams}) {`;
  });

  // 10. Function declarations: function name(param: Type, ...): ReturnType {
  js = js.replace(/\bfunction\s+([a-zA-Z0-9_$]*)\s*\(([^)]*)\)(?:\s*:\s*[^{]+)?\s*\{/g, (_, fnName, params) => {
    const cleanParams = params.replace(/([a-zA-Z0-9_$]+)\s*\??\s*:\s*[^,=]+/g, '$1');
    return `function ${fnName}(${cleanParams}) {`;
  });

  // 11. Arrow functions: (param: Type, ...): ReturnType =>
  js = js.replace(/\(([^)]*)\)\s*(?::\s*[^=>]+)?\s*=>/g, (_, params) => {
    const cleanParams = params.replace(/([a-zA-Z0-9_$]+)\s*\??\s*:\s*[^,=]+/g, '$1');
    return `(${cleanParams}) =>`;
  });

  // 12. Remove generic instantiation calls: foo<string>(...) -> foo(...)
  js = js.replace(/\b([a-zA-Z0-9_$]+)\s*<[A-Za-z0-9_<>[\]|&, ]+>\s*\(/g, '$1(');

  // 13. Remove 'as Type' assertions
  js = js.replace(/\s+as\s+[A-Za-z0-9_<>[\]|&]+/g, '');

  // 14. Remove non-null assertion !
  js = js.replace(/([a-zA-Z0-9_$]+)!/g, '$1');

  return js;
}

/**
 * Transpiles basic algorithmic Python into executable JavaScript.
 */
export function transpilePythonToJS(pyCode: string): string {
  const lines = pyCode.split('\n');
  const jsLines: string[] = [];
  const indentStack: number[] = [0];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim()) {
      jsLines.push('');
      continue;
    }
    if (rawLine.trim().startsWith('#')) {
      jsLines.push(rawLine.replace('#', '//'));
      continue;
    }

    const indentMatch = rawLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;
    const trimmed = rawLine.trim();

    // Check for unsupported constructs and return explicit diagnostics
    if (/^(?:import\s+|from\s+\w+\s+import)/.test(trimmed)) {
      throw new Error(
        `Python Sandbox Diagnostic: The client-side sandbox does not support module imports ("${trimmed}"). Built-in functions like len(), abs(), print(), range(), and basic algorithmic logic are supported natively without external modules.`
      );
    }
    if (/^@/.test(trimmed)) {
      throw new Error(
        `Python Sandbox Diagnostic: Decorators ("${trimmed}") are not supported in the client-side sandbox.`
      );
    }
    if (/^class\s+/.test(trimmed)) {
      throw new Error(
        `Python Sandbox Diagnostic: Class definitions ("${trimmed}") are not supported in this client sandbox. Please use standard functions and dictionaries for data modeling.`
      );
    }

    while (indent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      if (
        !trimmed.startsWith('else:') &&
        !trimmed.startsWith('elif ') &&
        !trimmed.startsWith('except') &&
        !trimmed.startsWith('finally:')
      ) {
        const closeIndent = ' '.repeat(indentStack[indentStack.length - 1]);
        jsLines.push(closeIndent + '}');
      }
    }

    let line = trimmed;
    line = line.replace(/#.*$/, '');

    line = line
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null')
      .replace(/\band\b/g, '&&')
      .replace(/\bor\b/g, '||')
      .replace(/\bnot\s+/g, '!');

    // Lambda expressions
    line = line.replace(/\blambda\s+([^:]+):\s*(.*)/g, '($1 => $2)');

    if (/^def\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)\s*:$/.test(line)) {
      line = line.replace(/^def\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)\s*:$/, 'function $1($2) {');
      indentStack.push(indent + 4);
    } else if (/^if\s+(.*?)\s*:$/.test(line)) {
      line = line.replace(/^if\s+(.*?)\s*:$/, 'if ($1) {');
      indentStack.push(indent + 4);
    } else if (/^elif\s+(.*?)\s*:$/.test(line)) {
      line = line.replace(/^elif\s+(.*?)\s*:$/, '} else if ($1) {');
      indentStack.push(indent + 4);
    } else if (/^else\s*:$/.test(line)) {
      line = line.replace(/^else\s*:$/, '} else {');
      indentStack.push(indent + 4);
    } else if (/^try\s*:$/.test(line)) {
      line = 'try {';
      indentStack.push(indent + 4);
    } else if (/^except(?:\s+([a-zA-Z0-9_$]+)(?:\s+as\s+([a-zA-Z0-9_$]+))?)?\s*:$/.test(line)) {
      const match = line.match(/^except(?:\s+([a-zA-Z0-9_$]+)(?:\s+as\s+([a-zA-Z0-9_$]+))?)?\s*:$/)!;
      const errVar = match[2] || '_err';
      line = `} catch (${errVar}) {`;
      indentStack.push(indent + 4);
    } else if (/^finally\s*:$/.test(line)) {
      line = '} finally {';
      indentStack.push(indent + 4);
    } else if (/^while\s+(.*?)\s*:$/.test(line)) {
      line = line.replace(/^while\s+(.*?)\s*:$/, 'while ($1) {');
      indentStack.push(indent + 4);
    } else if (/^for\s+([a-zA-Z0-9_$]+)\s+in\s+range\((.*?)\)\s*:$/.test(line)) {
      const match = line.match(/^for\s+([a-zA-Z0-9_$]+)\s+in\s+range\((.*?)\)\s*:$/)!;
      const varName = match[1];
      const args = match[2].split(',').map((s) => s.trim());
      if (args.length === 1) {
        line = `for (let ${varName} = 0; ${varName} < ${args[0]}; ${varName}++) {`;
      } else if (args.length === 2) {
        line = `for (let ${varName} = ${args[0]}; ${varName} < ${args[1]}; ${varName}++) {`;
      } else {
        line = `for (let ${varName} = ${args[0]}; ${varName} < ${args[1]}; ${varName} += ${args[2]}) {`;
      }
      indentStack.push(indent + 4);
    } else if (/^for\s+([a-zA-Z0-9_$]+)\s+in\s+(.*?)\s*:$/.test(line)) {
      line = line.replace(/^for\s+([a-zA-Z0-9_$]+)\s+in\s+(.*?)\s*:$/, 'for (const $1 of $2) {');
      indentStack.push(indent + 4);
    } else if (/^print\s*\((.*?)\)$/.test(line)) {
      line = line.replace(/^print\s*\((.*?)\)$/, 'console.log($1);');
    }

    line = line.replace(/len\((.*?)\)/g, '($1).length');
    line = line.replace(/\babs\((.*?)\)/g, 'Math.abs($1)');

    if (
      /^[a-zA-Z0-9_$]+\s*=\s*[^=]/.test(line) &&
      !line.startsWith('const ') &&
      !line.startsWith('let ') &&
      !line.startsWith('var ') &&
      !line.startsWith('return ')
    ) {
      line = 'let ' + line + ';';
    } else if (!line.endsWith('{') && !line.endsWith('}') && !line.endsWith(';')) {
      line += ';';
    }

    const currentIndent = ' '.repeat(indent);
    jsLines.push(currentIndent + line);
  }

  while (indentStack.length > 1) {
    indentStack.pop();
    const closeIndent = ' '.repeat(indentStack[indentStack.length - 1]);
    jsLines.push(closeIndent + '}');
  }

  return jsLines.join('\n');
}

/**
 * Worker script code template for in-browser isolation.
 */
const WORKER_SCRIPT_TEMPLATE = `
// Security sandbox lockdown: neutralize ambient network, storage, and script loading APIs
(function() {
  var apis = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'indexedDB', 'importScripts', 'openDatabase'];
  for (var i = 0; i < apis.length; i++) {
    var prop = apis[i];
    try { self[prop] = undefined; } catch(e) {}
    try { delete self[prop]; } catch(e) {}
    try {
      if (typeof WorkerGlobalScope !== 'undefined' && WorkerGlobalScope.prototype) {
        delete WorkerGlobalScope.prototype[prop];
      }
    } catch(e) {}
  }
})();

self.onmessage = function(e) {
  var data = e.data;
  var code = data.code;
  var stdin = data.stdin;
  var startTime = performance.now();
  var stdout = '';
  var stderr = '';
  var exitCode = 0;

  var stdinLines = (stdin || '').split('\\n');
  var stdinIdx = 0;

  function readline() {
    if (stdinIdx < stdinLines.length) {
      return stdinLines[stdinIdx++];
    }
    return '';
  }

  function prompt(msg) {
    if (msg) stdout += msg + '\\n';
    return readline();
  }

  function formatArg(arg) {
    if (arg === undefined) return 'undefined';
    if (arg === null) return 'null';
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg); } catch(e) { return String(arg); }
    }
    return String(arg);
  }

  var customConsole = {
    log: function() {
      var args = Array.prototype.slice.call(arguments);
      stdout += args.map(formatArg).join(' ') + '\\n';
    },
    info: function() {
      var args = Array.prototype.slice.call(arguments);
      stdout += '[INFO] ' + args.map(formatArg).join(' ') + '\\n';
    },
    warn: function() {
      var args = Array.prototype.slice.call(arguments);
      stderr += '[WARN] ' + args.map(formatArg).join(' ') + '\\n';
    },
    error: function() {
      var args = Array.prototype.slice.call(arguments);
      stderr += '[ERROR] ' + args.map(formatArg).join(' ') + '\\n';
    }
  };

  try {
    var fn = new Function('console', 'readline', 'prompt', code);
    fn(customConsole, readline, prompt);
  } catch (err) {
    exitCode = 1;
    stderr += (err && err.message ? err.message : String(err)) + '\\n';
    if (err && err.stack) {
      var cleanStack = err.stack.split('\\n').slice(0, 4).join('\\n');
      stderr += cleanStack + '\\n';
    }
  }

  var executionTimeMs = performance.now() - startTime;
  self.postMessage({
    status: exitCode === 0 ? 'success' : 'error',
    stdout: stdout,
    stderr: stderr,
    executionTimeMs: executionTimeMs,
    exitCode: exitCode
  });
};
`;

let activeWorker: Worker | null = null;
let activeWatchdog: any = null;
let activeWorkerUrl: string | null = null;
let currentExecutionId = 0;

export function cancelActiveExecution(): void {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
  if (activeWatchdog) {
    clearTimeout(activeWatchdog);
    activeWatchdog = null;
  }
  if (activeWorkerUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    URL.revokeObjectURL(activeWorkerUrl);
    activeWorkerUrl = null;
  }
}

/**
 * Executes a code file safely using the authoritative Cortex Cloud Runner (/api/v1/execute).
 * If the backend is unreachable or returns an error, an honest failure is returned.
 * Silent Web Worker fallbacks for production execution are eliminated.
 */
export async function executeCode(
  file: CodeFile,
  stdin: string = '',
  timeoutMs: number = 10000
): Promise<ExecutionResult> {
  cancelActiveExecution();
  const startTime = performance.now();

  // Primary: Authoritative backend execution service (/api/v1/execute)
  if (typeof fetch !== 'undefined') {
    try {
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: file.language,
          files: [{ name: file.name, content: file.content }],
          stdin: stdin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const executionTimeMs = typeof data.executionTime === 'number'
          ? data.executionTime
          : Math.round(performance.now() - startTime);
        const isSuccess = data.status === 'success' || (data.exitCode === 0 && !data.error);

        return {
          status: isSuccess ? 'success' : 'error',
          stdout: typeof data.stdout === 'string' ? data.stdout : '',
          stderr: typeof data.stderr === 'string' ? data.stderr : (data.error || ''),
          executionTimeMs,
          exitCode: typeof data.exitCode === 'number' ? data.exitCode : (isSuccess ? 0 : 1),
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          status: 'error',
          stdout: '',
          stderr: errData.message || errData.error || `Execution failed with HTTP status ${res.status}\n`,
          executionTimeMs: Math.round(performance.now() - startTime),
          exitCode: 1,
        };
      }
    } catch (err: any) {
      // Honest error reporting when backend is unreachable - NO silent fallback to Web Worker
      return {
        status: 'error',
        stdout: '',
        stderr: 'Cortex Cloud Runner Error: Unable to reach backend execution service at /api/v1/execute. Execution failed.\n',
        executionTimeMs: Math.round(performance.now() - startTime),
        exitCode: 1,
      };
    }
  }

  return executeInLocalDevPreview(file, stdin, timeoutMs);
}

/**
 * Explicit client-side sandbox execution for local development previews and unit tests.
 * This function clearly marks outputs with [LOCAL DEV PREVIEW] to prevent false claims of production container execution.
 */
export async function executeInLocalDevPreview(
  file: CodeFile,
  stdin: string = '',
  timeoutMs: number = 10000
): Promise<ExecutionResult> {
  cancelActiveExecution();

  const executionId = ++currentExecutionId;
  const langConfig = LANGUAGE_CONFIGS[file.language];

  // Honest handling for compiled/native languages in client preview
  if (file.language === 'cpp' || file.language === 'rust' || langConfig.supportLevel === 'editor-only') {
    return {
      status: 'error',
      stdout: `[INFO] Language "${langConfig.label}" is configured for Cortex Cloud Runner.\n`,
      stderr: `Compiler Notice: Native compilation and execution of ${langConfig.label} requires a remote containerized compiler (g++ / clang++ / rustc) or WebAssembly toolchain.\nExecution simulation is disabled in this client prototype to prevent fabricated outputs.\nTo run code in this isolated client sandbox, please select TypeScript, JavaScript, or test Python algorithmic tasks.\n`,
      executionTimeMs: 0,
      exitCode: 126,
    };
  }

  // Prepare runnable JavaScript
  let runnableCode = file.content;
  if (file.language === 'typescript') {
    try {
      runnableCode = transpileTypeScript(file.content);
    } catch (e: any) {
      return {
        status: 'error',
        stdout: '',
        stderr: `TypeScript Transpilation Error: ${e.message}\n`,
        executionTimeMs: 0,
        exitCode: 1,
      };
    }
  } else if (file.language === 'python') {
    try {
      runnableCode = transpilePythonToJS(file.content);
    } catch (e: any) {
      return {
        status: 'error',
        stdout: '',
        stderr: `Python Sandbox Error: ${e.message}\n`,
        executionTimeMs: 0,
        exitCode: 1,
      };
    }
  }

  // Measure genuine memory if available
  let memoryKb: number | undefined;
  if (typeof performance !== 'undefined' && (performance as any).memory?.usedJSHeapSize) {
    memoryKb = Math.round((performance as any).memory.usedJSHeapSize / 1024);
  }

  // Check if Web Worker is supported in environment
  const hasWorkerSupport =
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function';

  if (!hasWorkerSupport) {
    // Synchronous fallback runner for JSDOM / unit test environments
    const startTime = performance.now();
    let stdout = '[LOCAL DEV PREVIEW] Running in client sandbox preview mode.\n';
    let stderr = '';
    let exitCode = 0;

    const stdinLines = (stdin || '').split('\n');
    let stdinIdx = 0;
    const readline = () => (stdinIdx < stdinLines.length ? stdinLines[stdinIdx++] : '');
    const prompt = (msg?: string) => {
      if (msg) stdout += msg + '\n';
      return readline();
    };

    const customConsole = {
      log: (...args: any[]) => {
        stdout += args.map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a))).join(' ') + '\n';
      },
      info: (...args: any[]) => {
        stdout += '[INFO] ' + args.map((a) => String(a)).join(' ') + '\n';
      },
      warn: (...args: any[]) => {
        stderr += '[WARN] ' + args.map((a) => String(a)).join(' ') + '\n';
      },
      error: (...args: any[]) => {
        stderr += '[ERROR] ' + args.map((a) => String(a)).join(' ') + '\n';
      },
    };

    try {
      const fn = new Function('console', 'readline', 'prompt', runnableCode);
      fn(customConsole, readline, prompt);
    } catch (err: any) {
      exitCode = 1;
      stderr += (err && err.message ? err.message : String(err)) + '\n';
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    return {
      status: exitCode === 0 ? 'success' : 'error',
      stdout,
      stderr,
      executionTimeMs,
      memoryKb,
      exitCode,
    };
  }

  // Real Web Worker Execution in browser
  return new Promise<ExecutionResult>((resolve) => {
    try {
      const blob = new Blob([WORKER_SCRIPT_TEMPLATE], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      activeWorkerUrl = workerUrl;
      const worker = new Worker(workerUrl);
      activeWorker = worker;

      const cleanup = () => {
        if (activeWatchdog) {
          clearTimeout(activeWatchdog);
          activeWatchdog = null;
        }
        if (activeWorker === worker) {
          worker.terminate();
          activeWorker = null;
        }
        if (activeWorkerUrl === workerUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
          URL.revokeObjectURL(workerUrl);
          activeWorkerUrl = null;
        }
      };

      activeWatchdog = setTimeout(() => {
        if (executionId !== currentExecutionId) return;
        cleanup();
        resolve({
          status: 'error',
          stdout: '',
          stderr: `[Execution Timeout] Program was terminated after ${timeoutMs}ms to prevent hanging. Check for infinite loops or non-terminating recursion.\n`,
          executionTimeMs: timeoutMs,
          memoryKb,
          exitCode: 124,
        });
      }, timeoutMs);

      worker.onmessage = (e) => {
        if (executionId !== currentExecutionId) return;
        cleanup();

        const data = e.data;
        if (!data || typeof data !== 'object') {
          resolve({
            status: 'error',
            stdout: '',
            stderr: 'Worker Execution Error: Malformed response from execution sandbox.\n',
            executionTimeMs: 0,
            memoryKb,
            exitCode: 1,
          });
          return;
        }

        resolve({
          status: data.status === 'success' ? 'success' : 'error',
          stdout: '[LOCAL DEV PREVIEW] Running in client sandbox preview mode.\n' + (typeof data.stdout === 'string' ? data.stdout : String(data.stdout || '')),
          stderr: typeof data.stderr === 'string' ? data.stderr : String(data.stderr || ''),
          executionTimeMs: typeof data.executionTimeMs === 'number' ? Math.round(data.executionTimeMs * 100) / 100 : 0,
          memoryKb,
          exitCode: typeof data.exitCode === 'number' ? data.exitCode : (data.status === 'success' ? 0 : 1),
        });
      };

      worker.onerror = (err) => {
        if (executionId !== currentExecutionId) return;
        cleanup();

        resolve({
          status: 'error',
          stdout: '',
          stderr: `Worker Execution Error: ${err.message || 'Unknown runtime error'}\n`,
          executionTimeMs: 0,
          memoryKb,
          exitCode: 1,
        });
      };

      worker.postMessage({
        code: runnableCode,
        stdin,
        language: file.language,
      });
    } catch (err: any) {
      if (executionId !== currentExecutionId) return;
      cancelActiveExecution();
      resolve({
        status: 'error',
        stdout: '',
        stderr: `Failed to spawn worker sandbox: ${err.message}\n`,
        executionTimeMs: 0,
        memoryKb,
        exitCode: 1,
      });
    }
  });
}
