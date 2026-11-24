import { NextRequest, NextResponse } from 'next/server';
import { ProjectFile, ExecutionRequest, ExecutionResult } from '@/lib/execution/types';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { validateAndSanitizePath } from '@/lib/execution/path-sanitizer';
import { executionRateLimiter } from '@/lib/execution/rate-limiter';
import { getExecutionMode } from '@/lib/execution/config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, files = [], stdin = '', entrypoint } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    let trimmedCmd = command.trim();
    const currentFiles: ProjectFile[] = [...(files as ProjectFile[])];
    let syncFiles: ProjectFile[] | undefined = undefined;
    let resolvedStdin: string = typeof stdin === 'string' ? stdin : '';

    // Handle 'clear' command
    if (trimmedCmd === 'clear') {
      return NextResponse.json({ stdout: '\x1b[2J\x1b[H', stderr: '', exitCode: 0, stdin: '' });
    }

    // Support piped input: e.g. echo "hello" | python main.py or cat file.txt | run
    if (trimmedCmd.includes('|')) {
      const pipeParts = trimmedCmd.split('|');
      if (pipeParts.length >= 2) {
        const left = pipeParts[0].trim();
        const right = pipeParts.slice(1).join('|').trim();

        if (left.startsWith('echo ')) {
          let echoContent = left.replace(/^echo\s+/, '').trim();
          if ((echoContent.startsWith('"') && echoContent.endsWith('"')) ||
              (echoContent.startsWith("'") && echoContent.endsWith("'"))) {
            echoContent = echoContent.slice(1, -1);
          }
          resolvedStdin = echoContent + '\n';
          trimmedCmd = right;
        } else if (left.startsWith('cat ')) {
          const catFile = left.replace(/^cat\s+/, '').trim();
          const found = currentFiles.find((f) => !f.isFolder && f.name === catFile);
          if (found) {
            resolvedStdin = found.content || '';
          }
          trimmedCmd = right;
        }
      }
    }

    // Support input redirection: e.g. run < input.txt or python main.py < data.in
    if (trimmedCmd.includes('<')) {
      const redirParts = trimmedCmd.split('<');
      if (redirParts.length === 2) {
        const cmdPart = redirParts[0].trim();
        const inFile = redirParts[1].trim();
        const found = currentFiles.find((f) => !f.isFolder && f.name === inFile);
        if (found) {
          resolvedStdin = found.content || '';
        }
        trimmedCmd = cmdPart;
      }
    }

    // Support input flag: e.g. run -i "42" or python main.py --stdin="data"
    const inputFlagMatch = trimmedCmd.match(/(?:-i|--stdin=)\s*(?:"([^"]*)"|'([^']*)'|(\S+))/);
    if (inputFlagMatch) {
      resolvedStdin = (inputFlagMatch[1] ?? inputFlagMatch[2] ?? inputFlagMatch[3] ?? '') + '\n';
      trimmedCmd = trimmedCmd.replace(/(?:-i|--stdin=)\s*(?:"[^"]*"|'[^']*'|\S+)/, '').trim();
    }

    // Only Execution Commands ('run', 'python ...', 'node ...', 'gcc ...', 'g++ ...', './main') are supported via Cloudflare sandbox
    // Interactive persistent shell is NOT SUPPORTED over stateless HTTP execution engine.

    // Handle Execution Commands ('run', 'python ...', 'node ...', 'gcc ...', 'g++ ...', './main')
    let runLang = 'python';
    let targetFile = '';

    if (trimmedCmd.startsWith('run')) {
      const arg = trimmedCmd.replace(/^run\s*/, '').trim();
      targetFile =
        arg ||
        (typeof entrypoint === 'string' && entrypoint ? entrypoint : '') ||
        currentFiles.find((f) => !f.isFolder && (f.name.startsWith('main.') || f.name.startsWith('index.')))?.name ||
        currentFiles.find((f) => !f.isFolder)?.name ||
        'main.py';
    } else if (trimmedCmd.startsWith('python ') || trimmedCmd === 'python') {
      targetFile = trimmedCmd.replace(/^python\s*/, '').trim() || 'main.py';
      runLang = 'python';
    } else if (trimmedCmd.startsWith('node ') || trimmedCmd === 'node') {
      targetFile = trimmedCmd.replace(/^node\s*/, '').trim() || 'index.js';
      runLang = 'javascript';
    } else if (trimmedCmd.startsWith('gcc ') || trimmedCmd.startsWith('g++ ') || trimmedCmd === './main' || trimmedCmd === './a.out') {
      const isCpp = trimmedCmd.startsWith('g++');
      runLang = isCpp ? 'cpp' : 'c';
      targetFile = trimmedCmd.replace(/^(gcc|g\+\+)\s*/, '').replace(/-o\s+\S+/, '').trim() || (isCpp ? 'main.cpp' : 'main.c');
    }

    if (targetFile) {
      const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
      const rateLimit = executionRateLimiter.checkRateLimit(clientIp);
      if (!rateLimit.allowed) {
        return NextResponse.json({
          stdout: '',
          stderr: 'cortex: execution rate limit exceeded. Please wait a moment before running again.\n',
          exitCode: 129,
        }, { status: 429 });
      }

      if (targetFile.endsWith('.py')) runLang = 'python';
      else if (targetFile.endsWith('.js') || targetFile.endsWith('.mjs')) runLang = 'javascript';
      else if (targetFile.endsWith('.ts')) runLang = 'typescript';
      else if (targetFile.endsWith('.cpp') || targetFile.endsWith('.cc') || targetFile.endsWith('.cxx')) runLang = 'cpp';
      else if (targetFile.endsWith('.c')) runLang = 'c';
      else if (targetFile.endsWith('.java')) runLang = 'java';
      else if (targetFile.endsWith('.go')) runLang = 'go';
      else if (targetFile.endsWith('.rs')) runLang = 'rust';
      else if (targetFile.endsWith('.sql')) runLang = 'sql';
      else if (targetFile.endsWith('.cs')) runLang = 'csharp';
      else if (targetFile.endsWith('.rb')) runLang = 'ruby';
      else if (targetFile.endsWith('.php')) runLang = 'php';

      const mode = getExecutionMode();
      let result: ExecutionResult;

      const execReq: ExecutionRequest = {
        language: runLang,
        version: '*',
        files: currentFiles,
        stdin: resolvedStdin,
        args: [],
        entrypoint: targetFile,
      };

      const isNonProduction = process.env.NODE_ENV !== 'production';

      if (mode === 'docker') {
        const { executeInDockerSandbox } = await import('@/lib/execution/docker-sandbox');
        result = await executeInDockerSandbox(execReq);
      } else if (mode === 'development' || isNonProduction) {
        const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
        result = await executeInLocalSandbox(execReq);
      } else {
        result = await executeInCloudRunner(execReq);
      }

      return NextResponse.json({
        stdout: result.stdout || (result.compileOutput ? `${result.compileOutput}\n` : ''),
        stderr: result.stderr,
        exitCode: result.exitCode,
        stdin: resolvedStdin,
        files: syncFiles,
      });
    }

    // Default: Unrecognized command
    return NextResponse.json({
      stdout: '',
      stderr: `cortex: command not found: ${trimmedCmd}. Type 'help' for available commands or 'run' to execute code.\n`,
      exitCode: 127,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Terminal execution failed' }, { status: 500 });
  }
}
