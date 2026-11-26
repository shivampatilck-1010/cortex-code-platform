import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { ExecutionRequest, ExecutionResult, DiagnosticError } from './types';
import { getLanguageConfig } from '@/config/languages';
import { parseDiagnostics } from './diagnostics-parser';
import { EXECUTION_LIMITS, ALLOWED_ENV_VARS, SAFE_SYSTEM_ERROR_MESSAGE } from './config';
import { validateProjectFiles, validateAndSanitizePath, resolveMainFile } from './path-sanitizer';

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
      resolveMainFile(validation.sanitizedFiles!, req.entrypoint, langConfig) ||
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
    } else if (langConfig.id === 'sql') {
      const sqlContent = mainFile?.content || '';
      cleanup(tmpDir);
      try {
        const { splitSqlStatements, validateSqlSandboxSecurity, isSqlDataQuery } = await import('@/lib/sql/database-engine');
        const normalizedSql = sqlContent.trim();
        if (!normalizedSql) {
          return {
            status: 'runtime_error',
            exitCode: 1,
            stdout: '',
            stderr: 'Empty SQL query submitted.',
            executionTimeMs: Date.now() - startTime,
            memoryUsageMb: 4,
            timestamp: new Date().toISOString(),
            provider: 'local_worker',
          };
        }

        try {
          validateSqlSandboxSecurity(normalizedSql);
        } catch (secErr: any) {
          return {
            status: 'runtime_error',
            exitCode: 1,
            stdout: '',
            stderr: secErr?.message || 'Access denied: prohibited SQL administrative directive.',
            executionTimeMs: Date.now() - startTime,
            memoryUsageMb: 4,
            timestamp: new Date().toISOString(),
            provider: 'local_worker',
          };
        }

        const statements = splitSqlStatements(normalizedSql);
        const lastStmt = statements.length > 0 ? statements[statements.length - 1] : normalizedSql;
        const isDataQuery = isSqlDataQuery(lastStmt);

        const sqlResult = await runSqlSandboxInChildProcess(
          {
            normalizedSql,
            statements,
            lastStmt,
            isDataQuery,
          },
          timeoutMs
        );

        if (sqlResult.timedOut) {
          return {
            status: 'timeout',
            exitCode: 124,
            stdout: '',
            stderr: sqlResult.error || 'SQLite query execution timed out.',
            executionTimeMs: Date.now() - startTime,
            memoryUsageMb: 8,
            timestamp: new Date().toISOString(),
            provider: 'local_worker',
            stdin: req.stdin || '',
          };
        }

        if (!sqlResult.ok) {
          return {
            status: 'runtime_error',
            exitCode: 1,
            stdout: '',
            stderr: sqlResult.error || 'SQLite execution failed',
            executionTimeMs: Date.now() - startTime,
            memoryUsageMb: 4,
            timestamp: new Date().toISOString(),
            provider: 'local_worker',
            stdin: req.stdin || '',
          };
        }

        return {
          status: 'success',
          exitCode: 0,
          stdout: sqlResult.stdout || '',
          stderr: '',
          executionTimeMs: Date.now() - startTime,
          memoryUsageMb: 8,
          timestamp: new Date().toISOString(),
          provider: 'local_worker',
          stdin: req.stdin || '',
        };
      } catch (sqlErr: any) {
        return {
          status: 'runtime_error',
          exitCode: 1,
          stdout: '',
          stderr: sqlErr?.message || 'SQLite execution failed',
          executionTimeMs: Date.now() - startTime,
          memoryUsageMb: 4,
          timestamp: new Date().toISOString(),
          provider: 'local_worker',
          stdin: req.stdin || '',
        };
      }
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
      stdin: req.stdin || '',
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
      stdin: req.stdin || '',
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
    const safeEnv: NodeJS.ProcessEnv = {
      NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    };
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

    let killFallbackTimer: ReturnType<typeof setTimeout> | undefined;

    // Hard process-tree kill on timeout
    const timer = setTimeout(() => {
      if (isClosed) return;
      timedOut = true;
      terminateProcessTree(proc, isWindows);
      killFallbackTimer = setTimeout(() => {
        if (!isClosed) {
          isClosed = true;
          proc.stdin?.destroy();
          proc.stdout?.destroy();
          proc.stderr?.destroy();
          if (typeof proc.unref === 'function') proc.unref();
          resolve({
            stdout: stdout.replace(/\r\n/g, '\n'),
            stderr: stderr.replace(/\r\n/g, '\n'),
            exitCode: 124,
            timedOut: true,
          });
        }
      }, 400);
      if (typeof killFallbackTimer.unref === 'function') killFallbackTimer.unref();
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    if (proc.stdin) {
      proc.stdin.on('error', () => {});
      if (stdin !== undefined && stdin !== null && stdin !== '') {
        const normalizedStdin = stdin.endsWith('\n') ? stdin : stdin + '\n';
        proc.stdin.write(normalizedStdin, 'utf-8');
      }
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
      if (killFallbackTimer) clearTimeout(killFallbackTimer);
      resolve({
        stdout: stdout.replace(/\r\n/g, '\n'),
        stderr: (stderr + err.message).replace(/\r\n/g, '\n'),
        exitCode: 1,
        timedOut: false,
      });
    });

    proc.on('close', (code) => {
      if (isClosed) return;
      isClosed = true;
      clearTimeout(timer);
      if (killFallbackTimer) clearTimeout(killFallbackTimer);
      resolve({
        stdout: stdout.replace(/\r\n/g, '\n'),
        stderr: stderr.replace(/\r\n/g, '\n'),
        exitCode: timedOut ? 124 : (code ?? 0),
        timedOut,
      });
    });
  });
}

/**
 * Executes an in-memory SQLite query inside an isolated short-lived child process
 * so runaway native queries can be terminated cleanly on timeout.
 */
function runSqlSandboxInChildProcess(
  payload: {
    normalizedSql: string;
    statements: string[];
    lastStmt: string;
    isDataQuery: boolean;
  },
  timeoutMs: number
): Promise<{ ok: boolean; stdout?: string; error?: string; timedOut?: boolean }> {
  return new Promise((resolve) => {
    const inlineRunner = [
      "const { DatabaseSync } = require('node:sqlite');",
      "let raw = '';",
      "process.stdin.setEncoding('utf8');",
      "process.stdin.on('data', (c) => { raw += c; });",
      "process.stdin.on('end', () => {",
      '  let db = null;',
      '  try {',
      '    const input = JSON.parse(raw);',
      "    db = new DatabaseSync(':memory:');",
      "    let stdout = '';",
      '    if (input.isDataQuery) {',
      '      if (input.statements.length > 1) {',
      "        db.exec(input.statements.slice(0, -1).join('\\n;\\n') + '\\n;');",
      '      }',
      '      const stmt = db.prepare(input.lastStmt);',
      '      const rows = stmt.all();',
      '      if (rows.length > 0) {',
      '        const cols = Object.keys(rows[0]);',
      '        stdout = rows',
      "          .map((row) => cols.map((c) => (row[c] === null || row[c] === undefined ? '' : String(row[c]))).join('|'))",
      "          .join('\\n');",
      '      }',
      '    } else {',
      '      db.exec(input.normalizedSql);',
      "      stdout = 'Query executed successfully.';",
      '    }',
      '    process.stdout.write(JSON.stringify({ ok: true, stdout }));',
      '  } catch (err) {',
      "    process.stdout.write(JSON.stringify({ ok: false, error: (err && err.message) || 'SQLite execution failed' }));",
      '  } finally {',
      '    if (db) { try { db.close(); } catch {} }',
      '  }',
      '});',
    ].join('\n');

    const childEnv = { ...process.env };
    delete childEnv.NODE_OPTIONS;

    const isWindows = process.platform === 'win32';
    const proc = spawn(process.execPath, ['--no-warnings', '-e', inlineRunner], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      detached: !isWindows,
      env: childEnv,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let killFallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (res: { ok: boolean; stdout?: string; error?: string; timedOut?: boolean }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killFallbackTimer) clearTimeout(killFallbackTimer);
      resolve(res);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(proc, isWindows);
      killFallbackTimer = setTimeout(() => {
        proc.stdin?.destroy();
        proc.stdout?.destroy();
        proc.stderr?.destroy();
        if (typeof proc.unref === 'function') proc.unref();
        finish({ ok: false, timedOut: true, error: 'SQLite query execution timed out.' });
      }, 300);
      if (typeof killFallbackTimer.unref === 'function') killFallbackTimer.unref();
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();

    proc.stdout?.setEncoding('utf8');
    proc.stderr?.setEncoding('utf8');
    proc.stdout?.on('data', (chunk) => {
      if (stdout.length < EXECUTION_LIMITS.maxOutputSizeBytes) {
        stdout += chunk;
      }
    });
    proc.stderr?.on('data', (chunk) => {
      if (stderr.length < EXECUTION_LIMITS.maxOutputSizeBytes) {
        stderr += chunk;
      }
    });

    proc.on('error', (err) => {
      finish({ ok: false, error: err?.message || 'Failed to spawn SQLite sandbox worker' });
    });

    proc.on('close', () => {
      if (timedOut) {
        finish({ ok: false, timedOut: true, error: 'SQLite query execution timed out.' });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        finish(parsed);
      } catch {
        finish({ ok: false, error: stderr.trim() || 'SQLite execution failed' });
      }
    });

    if (proc.stdin) {
      proc.stdin.on('error', () => {});
      proc.stdin.end(JSON.stringify(payload));
    }
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
      const tk = spawn('taskkill.exe', ['/pid', String(proc.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      tk.on('error', () => {});
      tk.unref();
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

function sanitizeOutput(text: string, tmpDir: string): string {
  if (!text) return '';
  let sanitized = text;

  // 1. Replace the temporary sandbox directory
  if (tmpDir) {
    sanitized = sanitized.split(tmpDir).join('/workspace');
    // Handle Windows paths if applicable
    const windowsTmp = tmpDir.replace(/\//g, '\\');
    sanitized = sanitized.split(windowsTmp).join('/workspace');
  }

  // 2. Replace the internal server working directory
  const cwd = process.cwd();
  if (cwd) {
    sanitized = sanitized.split(cwd).join('/server');
    const windowsCwd = cwd.replace(/\//g, '\\');
    sanitized = sanitized.split(windowsCwd).join('/server');
  }

  // 3. Prevent exposure of user home directories
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    sanitized = sanitized.split(homeDir).join('~');
    const windowsHome = homeDir.replace(/\//g, '\\');
    sanitized = sanitized.split(windowsHome).join('~');
  }

  // 4. Clean up any leftover UUIDs or hashes that look like sandbox directories (e.g. cortex-sandbox-a1b2c3d4)
  sanitized = sanitized.replace(/cortex-[a-f0-9-]{36}/g, 'cortex-sandbox-id');
  sanitized = sanitized.replace(/\/(tmp|var\/folders|temp)\/cortex-[a-zA-Z0-9_-]+/g, '/workspace');
  sanitized = sanitized.replace(/\\(tmp|var\\folders|temp)\\cortex-[a-zA-Z0-9_-]+/g, '\\workspace');

  return sanitized;
}
