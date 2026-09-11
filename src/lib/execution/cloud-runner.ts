import { ExecutionRequest, ExecutionResult, DiagnosticError } from './types';
import { getLanguageConfig } from '@/config/languages';
import { parseDiagnostics } from './diagnostics-parser';
import { EXECUTION_LIMITS, getJudge0Config, SAFE_SYSTEM_ERROR_MESSAGE } from './config';

export const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  python: 100,      // Python 3.12.5
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
  r: 99,            // R (4.4.1)
  dart: 90,         // Dart (2.19.2)
  sql: 82,          // SQL (SQLite 3.27.2)
};

/**
 * Prepares the unified source code from a multi-file project for single-payload execution.
 */
function prepareSourceCode(req: ExecutionRequest): string {
  const nonFolderFiles = req.files.filter((f) => !f.isFolder);
  if (nonFolderFiles.length === 0) return '';

  const langConfig = getLanguageConfig(req.language);
  const mainFile =
    nonFolderFiles.find(
      (f) => f.name === req.entrypoint || f.name === langConfig.defaultFileName || f.id === 'main'
    ) ||
    nonFolderFiles.find((f) => f.name.endsWith(langConfig.fileExtension)) ||
    nonFolderFiles[0];

  if (!mainFile) return '';

  // For Python: only include valid Python (.py) modules, never markdown or config files
  if (req.language === 'python') {
    const pyFiles = nonFolderFiles.filter(
      (f) => f !== mainFile && f.name.endsWith('.py') && !f.name.startsWith('.')
    );

    if (pyFiles.length === 0) {
      return mainFile.content;
    }

    let combined = `import sys, types\n`;
    for (const file of pyFiles) {
      const moduleName = file.name.replace(/\.py$/, '').replace(/\W/g, '_');
      const escapedContent = JSON.stringify(file.content);
      combined += `\n# Module: ${file.name}\n`;
      combined += `_mod_${moduleName} = types.ModuleType('${moduleName}')\n`;
      combined += `exec(${escapedContent}, _mod_${moduleName}.__dict__)\n`;
      combined += `sys.modules['${moduleName}'] = _mod_${moduleName}\n`;
    }
    combined += `\n# === Entrypoint: ${mainFile.name} ===\n`;
    combined += mainFile.content;
    return combined;
  }

  // For C/C++: prepend ONLY headers and C/C++ source files (never README or other docs)
  if (req.language === 'c' || req.language === 'cpp') {
    const isCpp = req.language === 'cpp';
    const headerExts = ['.h', '.hpp', '.hxx'];
    const sourceExts = isCpp ? ['.cpp', '.cc', '.cxx'] : ['.c'];

    const headers = nonFolderFiles.filter(
      (f) => f !== mainFile && headerExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    const sources = nonFolderFiles.filter(
      (f) => f !== mainFile && sourceExts.some((ext) => f.name.toLowerCase().endsWith(ext))
    );

    if (headers.length === 0 && sources.length === 0) {
      return mainFile.content;
    }

    let combined = '';
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
  const requestedTimeoutSec = Math.ceil((req.runTimeoutMs || langConfig.timeoutSec * 1000) / 1000);
  const cpuTimeLimit = Math.min(EXECUTION_LIMITS.maxCpuTimeSec, Math.max(1, requestedTimeoutSec));
  const wallTimeLimit = Math.min(EXECUTION_LIMITS.maxWallTimeSec, Math.max(2, cpuTimeLimit * 2));

  const { apiUrl, headers } = getJudge0Config();

  try {
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), (wallTimeLimit + 5) * 1000);

    const response = await fetch(`${apiUrl}/submissions?wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: languageId,
        stdin: req.stdin || '',
        cpu_time_limit: cpuTimeLimit,
        wall_time_limit: wallTimeLimit,
        memory_limit: (req.memoryLimitMb || EXECUTION_LIMITS.maxMemoryMb) * 1024, // in KB
        max_processes_and_or_threads: EXECUTION_LIMITS.maxProcesses,
        enable_network: false, // Strict network isolation
      }),
      signal: controller.signal,
    });

    clearTimeout(abortTimeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Judge0 Cloud Runner Error] HTTP ${response.status}: ${errText}`);
      throw new Error(SAFE_SYSTEM_ERROR_MESSAGE);
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

    let stdout = data.stdout || '';
    let stderr = data.stderr || (status === 'compilation_error' ? data.compile_output || '' : '');
    const compileOutput = data.compile_output || '';
    const executionTimeMs = data.time ? Math.round(parseFloat(data.time) * 1000) : elapsedMs;
    const memoryUsageMb = data.memory ? Math.max(1, Math.round(data.memory / 1024)) : 16;

    // Enforce output size limit to prevent memory exhaustion
    if (stdout.length > EXECUTION_LIMITS.maxOutputSizeBytes) {
      stdout = stdout.slice(0, EXECUTION_LIMITS.maxOutputSizeBytes) + '\n[Output truncated: exceeded maximum output limit]';
    }
    if (stderr.length > EXECUTION_LIMITS.maxOutputSizeBytes) {
      stderr = stderr.slice(0, EXECUTION_LIMITS.maxOutputSizeBytes) + '\n[Output truncated: exceeded maximum output limit]';
    }

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
    console.error('[Judge0 Execution Exception]', err.message || err);

    return {
      status: 'system_error',
      exitCode: 1,
      stdout: '',
      stderr: SAFE_SYSTEM_ERROR_MESSAGE,
      executionTimeMs: elapsedMs,
      memoryUsageMb: 0,
      diagnostics: [],
      timestamp: new Date().toISOString(),
      provider: 'cloud_sandbox',
    };
  }
}
