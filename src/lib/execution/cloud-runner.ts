import { ExecutionRequest, ExecutionResult, DiagnosticError, ProjectFile } from './types';
import { getLanguageConfig, LanguageConfig } from '@/config/languages';
import { parseDiagnostics } from './diagnostics-parser';
import { EXECUTION_LIMITS, getJudge0Config, SAFE_SYSTEM_ERROR_MESSAGE } from './config';
import { zipSync, strToU8 } from 'fflate';
import { resolveMainFile } from './path-sanitizer';

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
  bash: 46,         // Bash 5.0.0
  lua: 64,          // Lua 5.3.5
  perl: 85,         // Perl 5.28.1
};

interface MultiFilePayload {
  source_code: string;
  additional_files?: string;
  mainFile?: ProjectFile;
}

/**
 * Prepares the unified source code from a multi-file project for single-payload execution.
 * Correctly prioritizes active entrypoint file buffer, stripping path slashes and preventing
 * stale boilerplate contamination from secondary project files.
 */
function getMultiFilePayload(req: ExecutionRequest): MultiFilePayload {
  const nonFolderFiles = req.files.filter((f) => !f.isFolder);
  if (nonFolderFiles.length === 0) return { source_code: '' };

  const langConfig = getLanguageConfig(req.language);
  const mainFile = resolveMainFile(nonFolderFiles, req.entrypoint, langConfig);

  if (!mainFile) return { source_code: '' };

  const additionalFiles = nonFolderFiles.filter((f) => f.id !== mainFile.id);

  if (additionalFiles.length === 0) {
    return {
      source_code: mainFile.content,
      mainFile,
    };
  }

  // Create zip for Judge0 additional_files
  const zipData: Record<string, Uint8Array> = {};
  for (const f of additionalFiles) {
    let filePath = f.path || f.name;
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
    additional_files: additionalFilesBase64,
    mainFile,
  };
}

/**
 * Executes code using high-availability Piston sandbox as a resilient fallback
 * when Judge0 is rate-limited, queued, or experiencing infrastructure latency.
 */
async function executeInPistonRunner(
  req: ExecutionRequest,
  langConfig: LanguageConfig,
  mainFile: ProjectFile,
  startTime: number
): Promise<ExecutionResult | null> {
  const nonFolderFiles = req.files.filter((f) => !f.isFolder);
  let pistonLang = langConfig.pistonRuntime?.language || langConfig.id;
  if (pistonLang === 'cpp') pistonLang = 'c++';
  if (pistonLang === 'sql') pistonLang = 'sqlite3';
  if (pistonLang === 'csharp') pistonLang = 'csharp.net';
  const pistonVersion = '*';

  const filesForPiston = [
    {
      name: mainFile.name.replace(/^\/+/, ''),
      content: mainFile.content,
    },
    ...nonFolderFiles
      .filter((f) => f.id !== mainFile.id)
      .map((f) => ({
        name: (f.path || f.name).replace(/^\/+/, ''),
        content: f.content,
      })),
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const pistonBase = process.env.PISTON_URL
      ? process.env.PISTON_URL.replace(/\/+$/, '')
      : 'https://emkc.org/api/v2/piston';
    const response = await fetch(`${pistonBase}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: pistonLang,
        version: pistonVersion,
        files: filesForPiston,
        stdin: req.stdin || '',
        args: req.args || [],
        run_timeout: Math.min(10000, req.runTimeoutMs || langConfig.timeoutSec * 1000),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const elapsedMs = Date.now() - startTime;

    if (!data.run && !data.compile) return null;

    const compileErr = data.compile?.stderr || data.compile?.output || '';
    const compileCode = data.compile?.code ?? 0;

    if (compileCode !== 0 && compileErr) {
      return {
        status: 'compilation_error',
        exitCode: compileCode,
        stdout: data.compile?.stdout || '',
        stderr: compileErr,
        compileOutput: compileErr,
        executionTimeMs: elapsedMs,
        memoryUsageMb: 16,
        diagnostics: parseDiagnostics(compileErr, langConfig.id),
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
        stdin: req.stdin || '',
      };
    }

    const runStdout =
      data.run?.stdout || (data.run?.code === 0 && !data.run?.stderr ? data.run?.output : '') || '';
    const runStderr = data.run?.stderr || '';
    const runCode = data.run?.code ?? 0;
    const isTimeout = data.run?.signal === 'SIGKILL' || data.run?.signal === 'SIGTERM';

    return {
      status: isTimeout ? 'timeout' : runCode === 0 ? 'success' : 'runtime_error',
      exitCode: isTimeout ? 124 : runCode,
      stdout: runStdout,
      stderr: runStderr,
      executionTimeMs: elapsedMs,
      memoryUsageMb: 16,
      diagnostics: parseDiagnostics(runStderr || compileErr, langConfig.id),
      timestamp: new Date().toISOString(),
      provider: 'cloud_sandbox',
      stdin: req.stdin || '',
    };
  } catch {
    return null;
  }
}

/**
 * Executes code using Cloudflare-compatible HTTP execution runner (Judge0 CE)
 * with automatic asynchronous queue polling and resilient multi-runtime fallback.
 */
export async function executeInCloudRunner(req: ExecutionRequest): Promise<ExecutionResult> {
  const startTime = Date.now();
  const langConfig = getLanguageConfig(req.language);

  if (langConfig.executable === false) {
    return {
      status: 'system_error',
      exitCode: 0,
      stdout: '',
      stderr: `This file format (${langConfig.name}) is for data/documentation and cannot be executed as a standalone program.`,
      executionTimeMs: 0,
      memoryUsageMb: 0,
      diagnostics: [],
      timestamp: new Date().toISOString(),
      provider: 'cloud_sandbox',
    };
  }

  const languageId = JUDGE0_LANGUAGE_IDS[langConfig.id] || JUDGE0_LANGUAGE_IDS['python'];
  const payload = getMultiFilePayload(req);

  const requestedTimeoutSec = Math.ceil((req.runTimeoutMs || langConfig.timeoutSec * 1000) / 1000);
  const cpuTimeLimit = Math.min(EXECUTION_LIMITS.maxCpuTimeSec, Math.max(1, requestedTimeoutSec));
  const wallTimeLimit = Math.min(EXECUTION_LIMITS.maxWallTimeSec, Math.max(2, cpuTimeLimit * 2));

  const { apiUrl, headers } = getJudge0Config();

  try {
    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), (wallTimeLimit + 6) * 1000);

    const submissionBody: Record<string, any> = {
      source_code: payload.source_code,
      language_id: languageId,
      stdin: req.stdin || '',
      cpu_time_limit: cpuTimeLimit,
      wall_time_limit: wallTimeLimit,
      memory_limit:
        Math.min(EXECUTION_LIMITS.maxMemoryMb, req.memoryLimitMb || EXECUTION_LIMITS.maxMemoryMb) *
        1024,
      max_processes_and_or_threads: EXECUTION_LIMITS.maxProcesses,
    };

    if (payload.additional_files) {
      submissionBody.additional_files = payload.additional_files;
    }

    const response = await fetch(`${apiUrl}/submissions?wait=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submissionBody),
      signal: controller.signal,
    });

    clearTimeout(abortTimeout);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Judge0 Cloud Runner Notice] HTTP ${response.status}: ${errText}. Attempting fallback sandbox.`);
      if (payload.mainFile) {
        const fallbackRes = await executeInPistonRunner(req, langConfig, payload.mainFile, startTime);
        if (fallbackRes) return fallbackRes;
      }
      throw new Error(SAFE_SYSTEM_ERROR_MESSAGE);
    }

    let data = await response.json();

    // If Judge0 submission is queued (status 1) or processing (status 2), poll until completion
    if ((data.status?.id === 1 || data.status?.id === 2) && data.token) {
      const pollStart = Date.now();
      const maxPollMs = Math.min(5000, wallTimeLimit * 1000);
      while (
        (data.status?.id === 1 || data.status?.id === 2) &&
        Date.now() - pollStart < maxPollMs
      ) {
        await new Promise((r) => setTimeout(r, 400));
        try {
          const pollRes = await fetch(`${apiUrl}/submissions/${data.token}?base64_encoded=false`, {
            headers,
          });
          if (pollRes.ok) {
            data = await pollRes.json();
          }
        } catch {
          break;
        }
      }
    }

    // If still queued or experiencing internal error, attempt resilient fallback
    if ((data.status?.id === 1 || data.status?.id === 2 || data.status?.id === 13) && payload.mainFile) {
      const fallbackRes = await executeInPistonRunner(req, langConfig, payload.mainFile, startTime);
      if (fallbackRes) return fallbackRes;
    }

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
      stdout =
        stdout.slice(0, EXECUTION_LIMITS.maxOutputSizeBytes) +
        '\n[Output truncated: exceeded maximum output limit]';
    }
    if (stderr.length > EXECUTION_LIMITS.maxOutputSizeBytes) {
      stderr =
        stderr.slice(0, EXECUTION_LIMITS.maxOutputSizeBytes) +
        '\n[Output truncated: exceeded maximum output limit]';
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
      stdin: req.stdin || '',
    };
  } catch (err: any) {
    // If Judge0 failed, attempt resilient fallback
    if (payload.mainFile) {
      const fallbackRes = await executeInPistonRunner(req, langConfig, payload.mainFile, startTime);
      if (fallbackRes) return fallbackRes;
    }

    const elapsedMs = Date.now() - startTime;
    console.error('[Cloud Runner Exception]', err.message || err);

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
      stdin: req.stdin || '',
    };
  }
}
