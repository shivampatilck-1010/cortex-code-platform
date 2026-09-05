import { ExecutionRequest, ExecutionResult, DiagnosticError } from './types';
import { getLanguageConfig } from '@/config/languages';
import { parseDiagnostics } from './diagnostics-parser';

export const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  python: 92,      // Python 3.11.2
  javascript: 102,  // Node.js 22.08.0
  typescript: 101,  // TypeScript 5.6.2
  cpp: 105,         // C++ (GCC 14.1.0)
  c: 103,           // C (GCC 14.1.0)
  java: 91,         // Java (JDK 17.0.6)
  csharp: 51,       // C# (Mono 6.6.0.161)
  go: 107,          // Go (1.23.5)
  rust: 108,        // Rust (1.85.0)
  php: 98,          // PHP (8.3.11)
  ruby: 72,         // Ruby (2.7.0)
  kotlin: 111,      // Kotlin (2.1.10)
  swift: 83,        // Swift (5.2.3)
  r: 80,            // R (4.0.0)
  dart: 90,         // Dart (2.19.2)
  sql: 82,          // SQL (SQLite 3.27.2)
};

/**
 * Prepares the unified source code from a multi-file project for single-payload execution.
 */
function prepareSourceCode(req: ExecutionRequest): string {
  const nonFolderFiles = req.files.filter((f) => !f.isFolder);
  if (nonFolderFiles.length === 0) return '';
  if (nonFolderFiles.length === 1) return nonFolderFiles[0].content;

  const langConfig = getLanguageConfig(req.language);
  const mainFile =
    nonFolderFiles.find(
      (f) => f.name === req.entrypoint || f.name === langConfig.defaultFileName || f.id === 'main'
    ) || nonFolderFiles[0];

  const otherFiles = nonFolderFiles.filter((f) => f !== mainFile);

  // For Python: inline other modules before main code
  if (req.language === 'python') {
    let combined = '';
    for (const file of otherFiles) {
      const moduleName = file.name.replace(/\.py$/, '');
      combined += `# === Module: ${file.name} ===\n`;
      combined += `class __module_${moduleName}:\n`;
      combined += file.content
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n');
      combined += `\nimport sys\nsys.modules['${moduleName}'] = __module_${moduleName}()\n\n`;
    }
    combined += `# === Entrypoint: ${mainFile.name} ===\n`;
    combined += mainFile.content;
    return combined;
  }

  // For C/C++: prepend headers and helper source files
  if (req.language === 'c' || req.language === 'cpp') {
    let combined = '';
    const headers = otherFiles.filter((f) => f.name.endsWith('.h') || f.name.endsWith('.hpp'));
    const sources = otherFiles.filter((f) => !f.name.endsWith('.h') && !f.name.endsWith('.hpp'));

    for (const h of headers) {
      combined += `// === Header: ${h.name} ===\n${h.content}\n\n`;
    }
    for (const s of sources) {
      combined += `// === Source: ${s.name} ===\n${s.content}\n\n`;
    }
    combined += `// === Main: ${mainFile.name} ===\n${mainFile.content}`;
    return combined;
  }

  // Default: return main entrypoint
  return mainFile.content;
}

/**
 * Executes code using Cloudflare-compatible HTTP execution runner (Judge0 CE).
 * Does NOT rely on Node.js child_process.spawn, making it 100% compatible with
 * Cloudflare Workers edge runtime.
 */
export async function executeInCloudRunner(req: ExecutionRequest): Promise<ExecutionResult> {
  const startTime = Date.now();
  const langConfig = getLanguageConfig(req.language);
  const languageId = JUDGE0_LANGUAGE_IDS[langConfig.id] || JUDGE0_LANGUAGE_IDS['python'];

  const sourceCode = prepareSourceCode(req);
  const timeLimit = Math.min(10, Math.max(1, Math.ceil((req.runTimeoutMs || langConfig.timeoutSec * 1000) / 1000)));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://ce.judge0.com/submissions?wait=true', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId,
        stdin: req.stdin || '',
        cpu_time_limit: timeLimit,
        wall_time_limit: timeLimit * 2,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloud runner returned HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const elapsedMs = Date.now() - startTime;

    const statusId = data.status?.id ?? 3;
    let status: ExecutionResult['status'] = 'success';
    let exitCode = 0;

    if (statusId === 3) {
      status = 'success';
      exitCode = 0;
    } else if (statusId === 6) {
      status = 'compilation_error';
      exitCode = 1;
    } else if (statusId === 5) {
      status = 'timeout';
      exitCode = 124;
    } else if (statusId >= 7 && statusId <= 12) {
      status = 'runtime_error';
      exitCode = 1;
    } else {
      status = 'runtime_error';
      exitCode = 1;
    }

    const stdout = data.stdout || '';
    const stderr = data.stderr || (status === 'compilation_error' ? data.compile_output || '' : '');
    const compileOutput = data.compile_output || '';
    const executionTimeMs = data.time ? Math.round(parseFloat(data.time) * 1000) : elapsedMs;
    const memoryUsageMb = data.memory ? Math.max(1, Math.round(data.memory / 1024)) : 16;
    const diagnostics = parseDiagnostics(stderr || compileOutput, langConfig.id);

    return {
      status,
      exitCode,
      stdout,
      stderr,
      executionTimeMs,
      memoryUsageMb,
      compileOutput,
      diagnostics,
      timestamp: new Date().toISOString(),
      provider: 'cloud_sandbox',
    };
  } catch (err: any) {
    const elapsedMs = Date.now() - startTime;
    return {
      status: 'runtime_error',
      exitCode: 1,
      stdout: '',
      stderr: `Cloud execution error: ${err.message || String(err)}`,
      executionTimeMs: elapsedMs,
      memoryUsageMb: 0,
      diagnostics: [],
      timestamp: new Date().toISOString(),
      provider: 'cloud_sandbox',
    };
  }
}
