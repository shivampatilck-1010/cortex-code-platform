import { NextRequest, NextResponse } from 'next/server';
import { ProjectFile } from '@/lib/execution/types';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { validateAndSanitizePath } from '@/lib/execution/path-sanitizer';
import { executionRateLimiter } from '@/lib/execution/rate-limiter';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, files = [] } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const trimmedCmd = command.trim();
    const currentFiles: ProjectFile[] = [...(files as ProjectFile[])];
    let syncFiles: ProjectFile[] | undefined = undefined;

    // Handle 'clear' command
    if (trimmedCmd === 'clear') {
      return NextResponse.json({ stdout: '\x1b[2J\x1b[H', stderr: '', exitCode: 0 });
    }

    // Only Execution Commands ('run', 'python ...', 'node ...', 'gcc ...', 'g++ ...', './main') are supported via Cloudflare sandbox
    // Interactive persistent shell is NOT SUPPORTED over stateless HTTP execution engine.

    // Handle Execution Commands ('run', 'python ...', 'node ...', 'gcc ...', 'g++ ...', './main')
    let runLang = 'python';
    let targetFile = '';

    if (trimmedCmd.startsWith('run')) {
      const arg = trimmedCmd.replace(/^run\s*/, '').trim();
      targetFile = arg || (currentFiles.find((f) => !f.isFolder && (f.id === 'main' || f.name.startsWith('main.') || f.name.startsWith('index.')))?.name) || 'main.py';
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
      else if (targetFile.endsWith('.js')) runLang = 'javascript';
      else if (targetFile.endsWith('.ts')) runLang = 'typescript';
      else if (targetFile.endsWith('.cpp') || targetFile.endsWith('.cc')) runLang = 'cpp';
      else if (targetFile.endsWith('.c')) runLang = 'c';
      else if (targetFile.endsWith('.java')) runLang = 'java';
      else if (targetFile.endsWith('.go')) runLang = 'go';
      else if (targetFile.endsWith('.rs')) runLang = 'rust';

      const result = await executeInCloudRunner({
        language: runLang,
        version: '*',
        files: currentFiles,
        stdin: '',
        args: [],
        entrypoint: targetFile,
      });

      return NextResponse.json({
        stdout: result.stdout || (result.compileOutput ? `${result.compileOutput}\n` : ''),
        stderr: result.stderr,
        exitCode: result.exitCode,
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
