import { NextRequest, NextResponse } from 'next/server';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { ExecutionRequest, ExecutionResult } from '@/lib/execution/types';
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

    // Primary: Cloud Runner (Judge0 CE - 100% compatible with Cloudflare Workers V8 isolates)
    let result: ExecutionResult = await executeInCloudRunner(execReq);

    // If cloud runner had a network error and we are in local dev with child_process, attempt local sandbox
    if (result.status === 'runtime_error' && result.stderr.includes('Cloud execution error')) {
      try {
        const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
        const localResult = await executeInLocalSandbox(execReq);
        if (localResult) {
          result = localResult;
        }
      } catch {
        // Keep cloud runner error if local sandbox is not available (e.g. on Cloudflare Workers)
      }
    }

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
