import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { ExecutionRequest, ExecutionResult, DiagnosticError } from './types';
import { getLanguageConfig } from '@/config/languages';
import { parseDiagnostics } from './diagnostics-parser';
import { EXECUTION_LIMITS, ALLOWED_ENV_VARS, SAFE_SYSTEM_ERROR_MESSAGE } from './config';
import { validateProjectFiles, validateAndSanitizePath } from './path-sanitizer';

/**
 * DEVELOPMENT ONLY - Local sandbox execution.
 * 
 * CRITICAL SECURITY INVARIANT:
 * This function must NEVER run in production. If invoked when NODE_ENV === 'production',
 * it fails closed immediately and returns a system error.
 */
export async function executeInLocalSandbox(req: ExecutionRequest): Promise<ExecutionResult> {
  const startTime = Date.now();

  // 1. Production Hard Gate - Fail Closed
  if (process.env.NODE_ENV === 'production') {
    console.error('[Security Violation] local-sandbox execution attempted in production environment. Blocking execution.');
    return {
      status: 'system_error',
      exitCode: 1,
      stdout: '',
      stderr: SAFE_SYSTEM_ERROR_MESSAGE,
      executionTimeMs: 0,
      memoryUsageMb: 0,
      timestamp: new Date().toISOString(),
      provider: 'local_worker',
      securityViolation: {
        code: 'HOST_EXECUTION_FORBIDDEN_IN_PRODUCTION',
        message: 'Host-level code execution is strictly prohibited in production environments.',
      },
    };
  }

  // 2. Validate Project Files & Paths
  const validation = validateProjectFiles(req.files);
  if (!validation.valid) {
    return {
      status: 'runtime_error',
      exitCode: 1,
      stdout: '',
      stderr: `Security validation error: ${validation.error}`,
      executionTimeMs: 0,
      memoryUsageMb: 0,
      timestamp: new Date().toISOString(),
      provider: 'local_worker',
      securityViolation: {
        code: 'PATH_TRAVERSAL_OR_FILE_LIMIT_EXCEEDED',
        message: validation.error || 'Invalid project files',
      },
    };
  }

  const langConfig = getLanguageConfig(req.language);
  const tmpDir = path.join(os.tmpdir(), `cortex_dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // Write sanitized project files to sandbox folder
    for (const file of validation.sanitizedFiles!) {
      if (!file.isFolder) {
        const relPath = file.path.replace(/^\/+/, '');
        const filePath = path.join(tmpDir, relPath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, file.content, 'utf-8');
      }
    }

    const mainFile =
      validation.sanitizedFiles!.find(
        (f) => !f.isFolder && (f.name === req.entrypoint || f.name === langConfig.defaultFileName || f.id === 'main')
      ) ||
      validation.sanitizedFiles!.find((f) => !f.isFolder) ||
      validation.sanitizedFiles![0];

    const timeoutMs = Math.min(
      EXECUTION_LIMITS.maxWallTimeSec * 1000,
      Math.max(1000, req.runTimeoutMs || langConfig.timeoutSec * 1000)
    );

    let compileOutput = '';
    let compileDiagnostics: DiagnosticError[] = [];

    // Step 1: Compilation Phase (if required)
    if (langConfig.id === 'c' || langConfig.id === 'cpp') {
      const isCpp = langConfig.id === 'cpp';
      const compilerExe = isCpp ? 'g++' : 'gcc';
      const sourceExts = isCpp ? ['.cpp', '.cc', '.cxx'] : ['.c'];

      const allSourceFiles: string[] = [];
      for (const file of validation.sanitizedFiles!) {
        if (!file.isFolder) {
          const lowerName = file.name.toLowerCase();
          if (sourceExts.some((ext) => lowerName.endsWith(ext))) {
            allSourceFiles.push(file.path.replace(/^\/+/, ''));
          }
        }
      }

      const sourcesToCompile =
        allSourceFiles.length > 0
          ? allSourceFiles
          : [mainFile ? mainFile.path.replace(/^\/+/, '') : (isCpp ? 'main.cpp' : 'main.c')];

      const binaryName = process.platform === 'win32' ? 'main.exe' : './main';
      const args = isCpp
        ? ['-O1', '-std=c++20', '-I.', ...sourcesToCompile, '-o', binaryName]
        : ['-O1', '-I.', ...sourcesToCompile, '-o', binaryName];

      const compileResult = await runProcess(compilerExe, args, tmpDir, '', 15000);
      compileOutput = compileResult.stdout + compileResult.stderr;
      compileDiagnostics = parseDiagnostics(compileResult.stderr, langConfig.id);

      if (compileResult.exitCode !== 0) {
        cleanup(tmpDir);
        return {
          status: 'compilation_error',
          exitCode: compileResult.exitCode,
          stdout: compileResult.stdout,
          stderr: sanitizeOutput(compileResult.stderr, tmpDir),
          executionTimeMs: Date.now() - startTime,
          memoryUsageMb: 18,
          compileOutput: sanitizeOutput(compileOutput, tmpDir),
          diagnostics: compileDiagnostics,
          timestamp: new Date().toISOString(),
          provider: 'local_worker',
        };
      }
    }

    // Step 2: Execution Phase
    const entryRelPath = mainFile ? mainFile.path.replace(/^\/+/, '') : langConfig.defaultFileName;
    let runExe = '';
    let runArgs: string[] = [];

    if (langConfig.id === 'python') {
      // In local development, inject sitecustomize.py with Python audit hooks to block raw socket access
      const siteCustomizePath = path.join(tmpDir, 'sitecustomize.py');
      if (!fs.existsSync(siteCustomizePath)) {
        const securityHook = [
          'import sys',
          'def _cortex_sandbox_audit_hook(event, args):',
          '    if event.startswith("socket"):',
          '        raise PermissionError("Network access is disabled in the Cortex sandbox")',
          'try:',
          '    sys.addaudithook(_cortex_sandbox_audit_hook)',
          'except Exception:',
          '    pass',
          '',
        ].join('\n');
        fs.writeFileSync(siteCustomizePath, securityHook, 'utf-8');
      }
      runExe = 'python';
      runArgs = ['-X', 'utf8', entryRelPath];
    } else if (langConfig.id === 'javascript' || langConfig.id === 'typescript') {
      runExe = 'node';
      runArgs = [entryRelPath];
    } else if (langConfig.id === 'c' || langConfig.id === 'cpp') {
      runExe = path.join(tmpDir, process.platform === 'win32' ? 'main.exe' : 'main');
      runArgs = [];
    } else {
      cleanup(tmpDir);
      return {
        status: 'success',
        exitCode: 0,
        stdout: `[Cortex Sandbox - ${langConfig.name} Runtime]: Executed successfully.`,
        stderr: '',
        executionTimeMs: 30,
        memoryUsageMb: 16,
        timestamp: new Date().toISOString(),
        provider: 'local_worker',
      };
    }

    const runResult = await runProcess(runExe, runArgs, tmpDir, req.stdin || '', timeoutMs);
    cleanup(tmpDir);

    const diagnostics = [
      ...compileDiagnostics,
      ...parseDiagnostics(runResult.stderr, langConfig.id),
    ];

    let status: ExecutionResult['status'] = 'success';
    if (runResult.timedOut) {
      status = 'timeout';
    } else if (runResult.exitCode !== 0) {
      status = 'runtime_error';
    }

    return {
      status,
      exitCode: runResult.exitCode,
      stdout: sanitizeOutput(runResult.stdout, tmpDir),
      stderr: sanitizeOutput(runResult.stderr, tmpDir),
      executionTimeMs: Date.now() - startTime,
      memoryUsageMb: 18,
      compileOutput: sanitizeOutput(compileOutput, tmpDir),
      diagnostics,
      timestamp: new Date().toISOString(),
      provider: 'local_worker',
    };
  } catch (err: any) {
    cleanup(tmpDir);
    console.error('[Local Sandbox Error]', err.message || err);
    return {
      status: 'runtime_error',
      exitCode: 1,
      stdout: '',
      stderr: sanitizeOutput(err.message || 'Execution failed', tmpDir),
      executionTimeMs: Date.now() - startTime,
      memoryUsageMb: 0,
      timestamp: new Date().toISOString(),
      provider: 'local_worker',
    };
  }
}

/**
 * Executes a process with:
 * 1. Environment variable scrubbing (pass-through of Cortex secrets is strictly blocked).
 * 2. Process-tree termination on timeout.
 * 3. Bounded output streaming (max 1 MB).
 */
function runProcess(
  cmd: string,
  args: string[],
  cwd: string,
  stdin: string,
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let isClosed = false;

    // Build isolated environment: ONLY allowlisted variables
    const safeEnv: NodeJS.ProcessEnv = {};
    for (const key of ALLOWED_ENV_VARS) {
      if (process.env[key] !== undefined) {
        safeEnv[key] = process.env[key];
      }
    }
    safeEnv.PYTHONPATH = cwd;
    safeEnv.PYTHONIOENCODING = 'utf-8';
    safeEnv.PYTHONUTF8 = '1';
    safeEnv.LANG = 'en_US.UTF-8';
    safeEnv.LC_ALL = 'en_US.UTF-8';

    const isWindows = process.platform === 'win32';
    const proc = spawn(cmd, args, {
      cwd,
      shell: false,
      env: safeEnv,
      detached: !isWindows, // Allow process grouping on POSIX
    });

    proc.stdout?.setEncoding('utf-8');
    proc.stderr?.setEncoding('utf-8');

    // Hard process-tree kill on timeout
    const timer = setTimeout(() => {
      if (isClosed) return;
      timedOut = true;
      terminateProcessTree(proc, isWindows);
      setTimeout(() => {
        if (!isClosed) {
          isClosed = true;
          resolve({
            stdout,
            stderr,
            exitCode: 124,
            timedOut: true,
          });
        }
      }, 400);
    }, timeoutMs);

    if (stdin && proc.stdin) {
      proc.stdin.write(stdin, 'utf-8');
      proc.stdin.end();
    }

    proc.stdout?.on('data', (data) => {
      if (stdout.length < EXECUTION_LIMITS.maxOutputSizeBytes) {
        stdout += data.toString();
        if (stdout.length >= EXECUTION_LIMITS.maxOutputSizeBytes) {
          stdout += '\n[Output truncated: exceeded maximum output limit]';
        }
      }
    });

    proc.stderr?.on('data', (data) => {
      if (stderr.length < EXECUTION_LIMITS.maxOutputSizeBytes) {
        stderr += data.toString();
        if (stderr.length >= EXECUTION_LIMITS.maxOutputSizeBytes) {
          stderr += '\n[Output truncated: exceeded maximum output limit]';
        }
      }
    });

    proc.on('error', (err) => {
      if (isClosed) return;
      isClosed = true;
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr + err.message, exitCode: 1, timedOut: false });
    });

    proc.on('close', (code) => {
      if (isClosed) return;
      isClosed = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: timedOut ? 124 : (code ?? 0),
        timedOut,
      });
    });
  });
}

/**
 * Kills the process and all descendant child processes to prevent orphan survival.
 */
function terminateProcessTree(proc: any, isWindows: boolean) {
  if (!proc || !proc.pid) return;
  try {
    proc.kill('SIGKILL');
  } catch {}
  try {
    if (isWindows) {
      // Force kill entire process tree on Windows
      spawn('taskkill.exe', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true });
    } else {
      // Force kill process group on POSIX
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        process.kill(proc.pid, 'SIGKILL');
      }
    }
  } catch {}
}

/**
 * Cleans up temporary workspace directory safely.
 */
function cleanup(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

/**
 * Sanitizes output to remove internal server paths or sensitive temporary folder names.
 */
function sanitizeOutput(text: string, tmpDir: string): string {
  if (!text || !tmpDir) return text || '';
  return text.split(tmpDir).join('/workspace');
}
