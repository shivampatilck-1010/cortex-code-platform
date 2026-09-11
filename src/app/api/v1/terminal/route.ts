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

    // Handle 'pwd'
    if (trimmedCmd === 'pwd') {
      return NextResponse.json({ stdout: '/home/cortex/workspace\n', stderr: '', exitCode: 0 });
    }

    // Handle 'whoami'
    if (trimmedCmd === 'whoami') {
      return NextResponse.json({ stdout: 'cortex\n', stderr: '', exitCode: 0 });
    }

    // Handle 'date'
    if (trimmedCmd === 'date') {
      return NextResponse.json({ stdout: `${new Date().toUTCString()}\n`, stderr: '', exitCode: 0 });
    }

    // Handle 'help'
    if (trimmedCmd === 'help') {
      const helpMsg = [
        'Cortex Cloud Terminal v1.0 (Cloudflare Edge Worker)',
        'Available built-in commands:',
        '  run [file]            Execute the current file or specified script',
        '  python [file]         Run Python file via cloud isolate',
        '  node [file]           Run JavaScript file via cloud isolate',
        '  gcc / g++ [file]      Compile and run C / C++ code',
        '  ls [-la]              List directory files and folders',
        '  cat <file>            Display file contents',
        '  touch <file>          Create a new file in workspace',
        '  mkdir <dir>           Create a new directory in workspace',
        '  rm [-rf] <file>       Delete a file or folder from workspace',
        '  echo <text>           Print text to console',
        '  pwd                   Print current working directory',
        '  whoami                Show current terminal session user',
        '  clear                 Clear the terminal screen',
      ].join('\n') + '\n';
      return NextResponse.json({ stdout: helpMsg, stderr: '', exitCode: 0 });
    }

    // Handle 'ls' / 'dir'
    if (trimmedCmd === 'ls' || trimmedCmd === 'ls -la' || trimmedCmd === 'ls -l' || trimmedCmd === 'dir') {
      if (currentFiles.length === 0) {
        return NextResponse.json({ stdout: 'total 0\n', stderr: '', exitCode: 0 });
      }
      const lines = [`total ${currentFiles.length * 4}`];
      for (const f of currentFiles) {
        const typeChar = f.isFolder ? 'd' : '-';
        const perms = f.isFolder ? 'rwxr-xr-x' : 'rw-r--r--';
        const size = (f.content?.length || 0).toString().padStart(6);
        const name = f.isFolder ? `${f.name}/` : f.name;
        lines.push(`${typeChar}${perms} 1 cortex cortex ${size} Sep 05 16:00 ${name}`);
      }
      return NextResponse.json({ stdout: lines.join('\n') + '\n', stderr: '', exitCode: 0 });
    }

    // Handle 'cat <filename>'
    if (trimmedCmd.startsWith('cat ')) {
      const targetName = trimmedCmd.replace(/^cat\s+/, '').trim();
      const pathCheck = validateAndSanitizePath(targetName);
      if (!pathCheck.valid) {
        return NextResponse.json({ stdout: '', stderr: `cat: ${pathCheck.error}\n`, exitCode: 1 });
      }
      const found = currentFiles.find((f) => !f.isFolder && (f.name === targetName || f.path === `/${targetName}` || f.path === `/${pathCheck.sanitizedPath}`));
      if (found) {
        return NextResponse.json({ stdout: `${found.content || ''}\n`, stderr: '', exitCode: 0 });
      } else {
        return NextResponse.json({ stdout: '', stderr: `cat: ${targetName}: No such file or directory\n`, exitCode: 1 });
      }
    }

    // Handle 'echo <text>'
    if (trimmedCmd.startsWith('echo ')) {
      const text = trimmedCmd.replace(/^echo\s+/, '');
      return NextResponse.json({ stdout: `${text}\n`, stderr: '', exitCode: 0 });
    }

    // Handle 'touch <filename>'
    if (trimmedCmd.startsWith('touch ')) {
      const filename = trimmedCmd.replace(/^touch\s+/, '').trim();
      const pathCheck = validateAndSanitizePath(filename);
      if (!pathCheck.valid) {
        return NextResponse.json({ stdout: '', stderr: `touch: ${pathCheck.error}\n`, exitCode: 1 });
      }
      const safeName = pathCheck.sanitizedPath!;
      if (!currentFiles.some((f) => f.name === safeName || f.path === `/${safeName}`)) {
        currentFiles.push({
          id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: safeName,
          path: `/${safeName}`,
          content: '',
          isFolder: false,
        });
        syncFiles = currentFiles;
      }
      return NextResponse.json({ stdout: '', stderr: '', exitCode: 0, files: syncFiles });
    }

    // Handle 'mkdir [-p] <dirname>'
    if (trimmedCmd.startsWith('mkdir ')) {
      const dirname = trimmedCmd.replace(/^mkdir\s+(-p\s+)?/, '').trim();
      const pathCheck = validateAndSanitizePath(dirname);
      if (!pathCheck.valid) {
        return NextResponse.json({ stdout: '', stderr: `mkdir: ${pathCheck.error}\n`, exitCode: 1 });
      }
      const safeDir = pathCheck.sanitizedPath!;
      if (!currentFiles.some((f) => f.name === safeDir || f.path === `/${safeDir}`)) {
        currentFiles.push({
          id: `d_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: safeDir,
          path: `/${safeDir}`,
          content: '',
          isFolder: true,
        });
        syncFiles = currentFiles;
      }
      return NextResponse.json({ stdout: '', stderr: '', exitCode: 0, files: syncFiles });
    }

    // Handle 'rm [-rf] <target>'
    if (trimmedCmd.startsWith('rm ')) {
      const target = trimmedCmd.replace(/^rm\s+(-[rf]+\s+)?/, '').trim();
      const pathCheck = validateAndSanitizePath(target);
      if (!pathCheck.valid) {
        return NextResponse.json({ stdout: '', stderr: `rm: ${pathCheck.error}\n`, exitCode: 1 });
      }
      const safeTarget = pathCheck.sanitizedPath!;
      const updated = currentFiles.filter((f) => f.name !== safeTarget && f.path !== `/${safeTarget}` && !f.path?.startsWith(`/${safeTarget}/`));
      syncFiles = updated;
      return NextResponse.json({ stdout: '', stderr: '', exitCode: 0, files: syncFiles });
    }

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
