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

import { zipSync, strToU8 } from 'fflate';

/**
 * Prepares the unified source code from a multi-file project for single-payload execution.
 * Uses Judge0's native additional_files via base64 encoded zip for true multi-file execution.
 */
function getMultiFilePayload(req: ExecutionRequest): { source_code: string; additional_files?: string } {
  const nonFolderFiles = req.files.filter((f) => !f.isFolder);
  if (nonFolderFiles.length === 0) return { source_code: '' };

  const langConfig = getLanguageConfig(req.language);
  let mainFile = req.entrypoint ? nonFolderFiles.find((f) => f.name === req.entrypoint) : undefined;
  if (!mainFile) {
    mainFile = nonFolderFiles.find((f) => f.name === langConfig.defaultFileName || f.id === 'main') ||
               nonFolderFiles.find((f) => f.name.endsWith(langConfig.fileExtension)) ||
               nonFolderFiles[0];
  }

  if (!mainFile) return { source_code: '' };

  const additionalFiles = nonFolderFiles.filter((f) => f.id !== mainFile.id);

  if (additionalFiles.length === 0) {
    return { source_code: mainFile.content };
  }

  // Create zip for Judge0 additional_files
  const zipData: Record<string, Uint8Array> = {};
  for (const f of additionalFiles) {
    let filePath = f.path || f.name;
    // Strip leading slashes to prevent traversal outside extraction dir
    filePath = filePath.replace(/^\/+/, '');
    if (!filePath) continue;
    
    zipData[filePath] = strToU8(f.content || '');
  }

  const zipped = zipSync(zipData);
  
  // Convert Uint8Array to base64
  let binary = '';
  const bytes = new Uint8Array(zipped);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const additionalFilesBase64 = btoa(binary);

  return {
    source_code: mainFile.content,
    additional_files: additionalFilesBase64
  };
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

  const payload = getMultiFilePayload(req);
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
        source_code: payload.source_code,
        additional_files: payload.additional_files,
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
