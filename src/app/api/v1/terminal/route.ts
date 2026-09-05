import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { ProjectFile } from '@/lib/execution/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { command, files = [] } = body;

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const trimmedCmd = command.trim();
    const tmpDir = path.join(os.tmpdir(), `cortex_term_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Write all project files preserving nested directories
    for (const file of files as ProjectFile[]) {
      if (!file.isFolder) {
        const relPath = file.path ? file.path.replace(/^\/+/, '') : file.name;
        const targetPath = path.join(tmpDir, relPath);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, file.content || '', 'utf-8');
      }
    }

    // Map common bash/terminal commands for cross-platform execution
    let cmdToRun = trimmedCmd;
    if (cmdToRun.startsWith('run')) {
      const arg = cmdToRun.replace(/^run\s*/, '').trim();
      const target = arg || (files.find((f: any) => !f.isFolder && (f.id === 'main' || f.name.startsWith('main.') || f.name.startsWith('index.')))?.name) || 'main.py';
      if (target.endsWith('.py')) {
        cmdToRun = `python "${target}"`;
      } else if (target.endsWith('.js') || target.endsWith('.ts')) {
        cmdToRun = `node "${target}"`;
      } else if (target.endsWith('.cpp') || target.endsWith('.cc')) {
        cmdToRun = `g++ -O1 -std=c++20 -I. "${target}" -o main.exe; if ($?) { .\\main.exe }`;
      } else if (target.endsWith('.c')) {
        cmdToRun = `gcc -O1 -I. "${target}" -o main.exe; if ($?) { .\\main.exe }`;
      } else {
        cmdToRun = `python "${target}"`;
      }
    } else if (cmdToRun.startsWith('touch ')) {
      const target = cmdToRun.replace(/^touch\s+/, '').trim();
      cmdToRun = `New-Item -ItemType File -Force "${target}" | Out-Null`;
    } else if (cmdToRun.startsWith('mkdir ')) {
      const target = cmdToRun.replace(/^mkdir\s+(-p\s+)?/, '').trim();
      cmdToRun = `New-Item -ItemType Directory -Force "${target}" | Out-Null`;
    } else if (cmdToRun.startsWith('rm -rf ') || cmdToRun.startsWith('rm -r ')) {
      const target = cmdToRun.replace(/^rm\s+-[rf]+\s+/, '').trim();
      cmdToRun = `Remove-Item -Recurse -Force "${target}" -ErrorAction SilentlyContinue`;
    } else if (cmdToRun.startsWith('rm ')) {
      const target = cmdToRun.replace(/^rm\s+/, '').trim();
      cmdToRun = `Remove-Item -Force "${target}" -ErrorAction SilentlyContinue`;
    } else if (cmdToRun === 'ls' || cmdToRun === 'ls -la' || cmdToRun === 'ls -l') {
      cmdToRun = `Get-ChildItem | ForEach-Object { "$($_.Mode)  $($_.Length.ToString().PadLeft(8))  $($_.LastWriteTime.ToString('MMM dd HH:mm'))  $($_.Name)" }`;
    } else if (cmdToRun === 'pwd') {
      cmdToRun = `Write-Output "/home/sandbox/workspace"`;
    } else if (cmdToRun === 'whoami') {
      cmdToRun = `Write-Output "sandbox"`;
    } else if (cmdToRun === 'date') {
      cmdToRun = `Get-Date -Format "ddd MMM dd HH:mm:ss UTC yyyy"`;
    } else if (cmdToRun.startsWith('./main') || cmdToRun.startsWith('./a.out')) {
      cmdToRun = `.\\main.exe`;
    }

    // Execute the command in the isolated workspace
    const execPromise = new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      exec(
        cmdToRun,
        {
          cwd: tmpDir,
          shell: 'powershell.exe',
          timeout: 15000,
          maxBuffer: 1024 * 1024 * 4,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        },
        (error, stdout, stderr) => {
          const exitCode = error ? (error.code || 1) : 0;
          resolve({
            stdout: stdout ? stdout.toString() : '',
            stderr: stderr ? stderr.toString() : '',
            exitCode,
          });
        }
      );
    });

    const result = await execPromise;

    // Scan for created/updated files in tmpDir to sync back to IDE
    const syncFiles: ProjectFile[] = [];
    const scanDir = (dir: string, baseDir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              syncFiles.push({
                id: `f_${relPath.replace(/\W/g, '_')}`,
                name: entry.name,
                path: `/${relPath}`,
                content: '',
                isFolder: true,
              });
              scanDir(fullPath, baseDir);
            }
          } else {
            // Ignore compiled binary outputs
            if (!entry.name.endsWith('.exe') && !entry.name.endsWith('.o') && !entry.name.endsWith('.obj')) {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                syncFiles.push({
                  id: `f_${relPath.replace(/\W/g, '_')}`,
                  name: entry.name,
                  path: `/${relPath}`,
                  content,
                  isFolder: false,
                });
              } catch {
                // Ignore binary read errors
              }
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    };

    scanDir(tmpDir, tmpDir);

    // Cleanup temp dir
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Non-blocking cleanup
    }

    return NextResponse.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      files: syncFiles.length > 0 ? syncFiles : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Terminal execution failed' }, { status: 500 });
  }
}
