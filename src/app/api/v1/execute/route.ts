import { NextRequest, NextResponse } from 'next/server';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { ExecutionRequest, ExecutionResult } from '@/lib/execution/types';
import { getLanguageConfig } from '@/config/languages';
import { ALLOWED_LANGUAGES, getExecutionMode, SAFE_SYSTEM_ERROR_MESSAGE } from '@/lib/execution/config';
import { validateProjectFiles } from '@/lib/execution/path-sanitizer';
import { executionRateLimiter } from '@/lib/execution/rate-limiter';

function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'anonymous_client';
}

export async function POST(req: NextRequest) {
  const clientKey = getClientIdentifier(req);

  // 1. Rate Limiting Check
  const rateLimit = executionRateLimiter.checkRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many code execution requests. Please wait a moment before trying again.',
        resetMs: rateLimit.resetMs,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)),
        },
      }
    );
  }

  // 2. Concurrency Limit Check
  if (!executionRateLimiter.acquireSlot(clientKey)) {
    return NextResponse.json(
      {
        error: 'CONCURRENCY_LIMIT_EXCEEDED',
        message: 'Maximum concurrent executions reached. Please wait for previous requests to complete.',
      },
      { status: 429 }
    );
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const { language, code, files, stdin, args, version, entrypoint } = body || {};

    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required and must be a string' }, { status: 400 });
    }

    const normalizedLang = language.toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.has(normalizedLang)) {
      return NextResponse.json(
        { error: `Language "${language}" is not supported or prohibited for execution.` },
        { status: 400 }
      );
    }

    const langConfig = getLanguageConfig(normalizedLang);

    // Normalize files
    let rawFiles = files;
    if (!rawFiles || !Array.isArray(rawFiles) || rawFiles.length === 0) {
      rawFiles = [
        {
          id: 'main',
          name: langConfig.defaultFileName,
          path: `/${langConfig.defaultFileName}`,
          content: typeof code === 'string' ? code : langConfig.starterCode,
        },
      ];
    }

    // 3. Project Validation & Path Traversal Protection
    const validation = validateProjectFiles(rawFiles);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'VALIDATION_FAILED',
          message: validation.error || 'Project files failed security validation',
        },
        { status: 400 }
      );
    }

    const execReq: ExecutionRequest = {
      language: langConfig.id,
      version: version || langConfig.version,
      files: validation.sanitizedFiles!,
      stdin: typeof stdin === 'string' ? stdin : '',
      args: Array.isArray(args) ? args.filter((a) => typeof a === 'string').slice(0, 10) : [],
      entrypoint: entrypoint || langConfig.defaultFileName,
    };

    // 4. Resolve Execution Mode
    const mode = getExecutionMode();
    let result: ExecutionResult;

    if (mode === 'docker') {
      const { executeInDockerSandbox } = await import('@/lib/execution/docker-sandbox');
      result = await executeInDockerSandbox(execReq);
    } else if (mode === 'development') {
      // Strictly gated to development only (guaranteed non-production)
      const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
      result = await executeInLocalSandbox(execReq);
    } else {
      // Production Mode: Hardened Cloud Sandbox (Judge0)
      result = await executeInCloudRunner(execReq);

      // FAIL CLOSED: Never fallback to host execution in production!
      if (result.status === 'system_error' && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          {
            error: 'SYSTEM_ERROR',
            message: SAFE_SYSTEM_ERROR_MESSAGE,
          },
          { status: 503 }
        );
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
        securityViolation: result.securityViolation,
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
    console.error('[Execution Route Error]', err);
    return NextResponse.json(
      { error: SAFE_SYSTEM_ERROR_MESSAGE },
      { status: 500 }
    );
  } finally {
    executionRateLimiter.releaseSlot(clientKey);
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
