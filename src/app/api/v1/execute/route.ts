import { NextRequest, NextResponse } from 'next/server';
import { executeInLocalSandbox } from '@/lib/execution/local-sandbox';
import { ExecutionRequest } from '@/lib/execution/types';
import { getLanguageConfig } from '@/config/languages';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { language, code, files, stdin, args, version, entrypoint } = body;

    if (!language) {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }

    const langConfig = getLanguageConfig(language);

    // Normalize files
    let projectFiles = files;
    if (!projectFiles || projectFiles.length === 0) {
      projectFiles = [
        {
          id: 'main',
          name: langConfig.defaultFileName,
          path: `/${langConfig.defaultFileName}`,
          content: code || langConfig.starterCode,
        },
      ];
    }

    const execReq: ExecutionRequest = {
      language: langConfig.id,
      version: version || langConfig.version,
      files: projectFiles,
      stdin: stdin || '',
      args: args || [],
      entrypoint: entrypoint || langConfig.defaultFileName,
    };

    // Execute in sandboxed worker
    const result = await executeInLocalSandbox(execReq);

    return NextResponse.json(
      {
        status: result.status,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        execution_time: result.executionTimeMs,
        memory: result.memoryUsageMb,
        diagnostics: result.diagnostics,
        provider: result.provider,
        timestamp: result.timestamp,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Execution failed' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    },
  });
}
