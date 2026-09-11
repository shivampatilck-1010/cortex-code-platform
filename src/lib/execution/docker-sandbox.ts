import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { ExecutionRequest, ExecutionResult } from './types';
import { getLanguageConfig } from '@/config/languages';
import { parseDiagnostics } from './diagnostics-parser';
import { EXECUTION_LIMITS, SAFE_SYSTEM_ERROR_MESSAGE } from './config';
import { validateProjectFiles } from './path-sanitizer';

// Minimal language container images
const DOCKER_IMAGES: Record<string, string> = {
  python: 'python:3.12-slim',
  javascript: 'node:22-slim',
  typescript: 'node:22-slim',
  c: 'gcc:14-slim',
  cpp: 'gcc:14-slim',
};

/**
 * Executes untrusted code inside an isolated Docker container with strict resource,
 * filesystem, and network constraints.
 */
export async function executeInDockerSandbox(req: ExecutionRequest): Promise<ExecutionResult> {
  const startTime = Date.now();
  const langConfig = getLanguageConfig(req.language);

  // Validate files
  const validation = validateProjectFiles(req.files);
  if (!validation.valid) {
    return {
      status: 'runtime_error',
      exitCode: 1,
      stdout: '',
      stderr: `Validation error: ${validation.error}`,
      executionTimeMs: 0,
      memoryUsageMb: 0,
      timestamp: new Date().toISOString(),
      provider: 'docker_isolated',
      securityViolation: {
        code: 'PROJECT_VALIDATION_FAILED',
        message: validation.error || 'Invalid project files',
      },
    };
  }

  const image = DOCKER_IMAGES[langConfig.id] || DOCKER_IMAGES['python'];
  const tmpDir = path.join(os.tmpdir(), `cortex_docker_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
  const containerName = `cortex_sbx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const file of validation.sanitizedFiles!) {
      if (!file.isFolder) {
        const relPath = file.path.replace(/^\/+/, '');
        const targetPath = path.join(tmpDir, relPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, file.content, 'utf-8');
      }
    }

    const mainFile =
      validation.sanitizedFiles!.find((f) => !f.isFolder && (f.name === req.entrypoint || f.name === langConfig.defaultFileName)) ||
      validation.sanitizedFiles![0];

    const entryRel = mainFile.path.replace(/^\/+/, '');
    const timeoutSec = Math.min(EXECUTION_LIMITS.maxCpuTimeSec, Math.max(1, Math.ceil((req.runTimeoutMs || langConfig.timeoutSec * 1000) / 1000)));

    let runCmd = '';
    if (langConfig.id === 'python') {
      runCmd = `python3 -X utf8 /workspace/${entryRel}`;
    } else if (langConfig.id === 'javascript' || langConfig.id === 'typescript') {
      runCmd = `node /workspace/${entryRel}`;
    } else if (langConfig.id === 'c' || langConfig.id === 'cpp') {
      const compiler = langConfig.id === 'cpp' ? 'g++' : 'gcc';
      const flags = langConfig.id === 'cpp' ? '-O1 -std=c++20' : '-O1';
      runCmd = `${compiler} ${flags} /workspace/${entryRel} -o /tmp/main && /tmp/main`;
    } else {
      throw new Error(`Docker execution not configured for language: ${langConfig.id}`);
    }

    const dockerArgs = [
      'run',
      '--name', containerName,
      '--rm',
      '--network', 'none',                       // ZERO network access
      '--user', '1000:1000',                     // Non-root execution
      '--read-only',                             // Read-only container root
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m', // Isolated writable tmpfs
      '--volume', `${tmpDir}:/workspace:ro`,     // Read-only project mount
      '--workdir', '/workspace',
      '--memory', `${EXECUTION_LIMITS.maxMemoryMb}m`,
      '--memory-swap', `${EXECUTION_LIMITS.maxMemoryMb}m`,
      '--cpus', '1.0',                           // 1 CPU core limit
      '--pids-limit', `${EXECUTION_LIMITS.maxProcesses}`, // Fork bomb protection
      '--cap-drop', 'ALL',                       // Drop all Linux capabilities
      '--security-opt', 'no-new-privileges:true', // Prevent privilege escalation
      image,
      'sh', '-c', runCmd,
    ];

    const execOutcome = await new Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean }>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const timer = setTimeout(() => {
        timedOut = true;
        try {
          spawn('docker', ['kill', containerName]).on('close', () => {
            proc.kill('SIGKILL');
          });
        } catch {}
      }, timeoutSec * 1000);

      if (req.stdin && proc.stdin) {
        proc.stdin.write(req.stdin);
        proc.stdin.end();
      }

      proc.stdout?.on('data', (d) => {
        if (stdout.length < EXECUTION_LIMITS.maxOutputSizeBytes) {
          stdout += d.toString();
        }
      });

      proc.stderr?.on('data', (d) => {
        if (stderr.length < EXECUTION_LIMITS.maxOutputSizeBytes) {
          stderr += d.toString();
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: timedOut ? 124 : (code ?? 1),
          timedOut,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout: '',
          stderr: `Docker invocation error: ${err.message}`,
          exitCode: 1,
          timedOut: false,
        });
      });
    });

    cleanupDir(tmpDir);

    let status: ExecutionResult['status'] = 'success';
    if (execOutcome.timedOut) {
      status = 'timeout';
    } else if (execOutcome.exitCode !== 0) {
      status = 'runtime_error';
    }

    let stdout = execOutcome.stdout;
    let stderr = execOutcome.stderr;
    if (stdout.length >= EXECUTION_LIMITS.maxOutputSizeBytes) {
      stdout = stdout.slice(0, EXECUTION_LIMITS.maxOutputSizeBytes) + '\n[Output truncated: exceeded maximum limit]';
    }
    if (stderr.length >= EXECUTION_LIMITS.maxOutputSizeBytes) {
      stderr = stderr.slice(0, EXECUTION_LIMITS.maxOutputSizeBytes) + '\n[Output truncated: exceeded maximum limit]';
    }

    return {
      status,
      exitCode: execOutcome.exitCode,
      stdout,
      stderr,
      executionTimeMs: Date.now() - startTime,
      memoryUsageMb: 32,
      timestamp: new Date().toISOString(),
      provider: 'docker_isolated',
    };
  } catch (err: any) {
    cleanupDir(tmpDir);
    console.error('[Docker Sandbox Exception]', err.message || err);
    return {
      status: 'system_error',
      exitCode: 1,
      stdout: '',
      stderr: SAFE_SYSTEM_ERROR_MESSAGE,
      executionTimeMs: Date.now() - startTime,
      memoryUsageMb: 0,
      timestamp: new Date().toISOString(),
      provider: 'docker_isolated',
    };
  }
}

function cleanupDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}
