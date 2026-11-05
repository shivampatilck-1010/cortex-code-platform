import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { ExecutionRequest, ExecutionResult } from '@/lib/execution/types';
import { getLanguageConfig } from '@/config/languages';
import { ALLOWED_LANGUAGES, getExecutionMode, SAFE_SYSTEM_ERROR_MESSAGE } from '@/lib/execution/config';
import { validateProjectFiles } from '@/lib/execution/path-sanitizer';
import { executionRateLimiter } from '@/lib/execution/rate-limiter';
import { getAdapter, hasTracingSupport, LANGUAGE_SUPPORT_MATRIX } from '@/lib/visualization/registry';
import '@/lib/visualization/adapters'; // Auto-registers adapters

function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'anonymous_client';
}

export async function POST(req: NextRequest) {
  const clientKey = getClientIdentifier(req);

  // Rate Limiting Check
  const rateLimit = executionRateLimiter.checkRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many trace execution requests. Please wait a moment.',
        resetMs: rateLimit.resetMs,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rateLimit.resetMs / 1000)) },
      }
    );
  }

  if (!executionRateLimiter.acquireSlot(clientKey)) {
    return NextResponse.json(
      {
        error: 'CONCURRENCY_LIMIT_EXCEEDED',
        message: 'Maximum concurrent executions reached.',
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

    const { projectId, language, stdin, args, version, entrypoint, files: bodyFiles } = body || {};

    let rawFiles: any[] = [];

    if (projectId) {
      const user = await ClassroomAuth.authenticateRequest(req);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const project = await projectDb.getProject(projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      if (project.ownerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
      }

      const dbFiles = await projectDb.listFilesForProject(projectId);
      rawFiles = dbFiles.map((f) => ({
        id: f.id,
        name: f.name,
        path: f.path,
        content: f.content,
        isFolder: f.isFolder,
      }));
    } else if (bodyFiles && Array.isArray(bodyFiles)) {
      rawFiles = bodyFiles;
    } else {
      return NextResponse.json(
        { error: 'Either projectId or files array is required for trace execution' },
        { status: 400 }
      );
    }

    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required and must be a string' }, { status: 400 });
    }

    const normalizedLang = language.toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.has(normalizedLang)) {
      return NextResponse.json(
        { error: `Language "${language}" is not supported.` },
        { status: 400 }
      );
    }

    // Check adapter capability
    const adapter = getAdapter(normalizedLang);
    if (!adapter || !hasTracingSupport(normalizedLang)) {
      const matrixRow = LANGUAGE_SUPPORT_MATRIX.find((m) => m.language === normalizedLang);
      return NextResponse.json(
        {
          error: 'VISUALIZATION_UNAVAILABLE',
          message: 'Program execution is available; internal visualization is not supported by this runtime yet.',
          language: normalizedLang,
          matrix: matrixRow,
        },
        { status: 200 }
      );
    }

    const langConfig = getLanguageConfig(normalizedLang);

    if (rawFiles.length === 0) {
      return NextResponse.json({ error: 'Project has no files' }, { status: 400 });
    }

    // Validation & Path Traversal Protection
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

    // Prepare traced execution payload via language adapter
    const tracedSetup = adapter.prepareTracedExecution(
      validation.sanitizedFiles!,
      entrypoint || langConfig.defaultFileName,
      stdin
    );

    const execReq: ExecutionRequest = {
      language: langConfig.id,
      version: version || langConfig.version,
      files: tracedSetup.tracedFiles,
      stdin: typeof tracedSetup.stdin === 'string' ? tracedSetup.stdin : '',
      args: Array.isArray(args) ? args.filter((a) => typeof a === 'string').slice(0, 10) : [],
      entrypoint: tracedSetup.entrypoint,
      runTimeoutMs: 12000,
    };

    const mode = getExecutionMode();
    let result: ExecutionResult;

    if (mode === 'docker') {
      const { executeInDockerSandbox } = await import('@/lib/execution/docker-sandbox');
      result = await executeInDockerSandbox(execReq);
    } else if (mode === 'development') {
      const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
      result = await executeInLocalSandbox(execReq);
    } else {
      result = await executeInCloudRunner(execReq);
      if (result.status === 'system_error' && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'SYSTEM_ERROR', message: SAFE_SYSTEM_ERROR_MESSAGE }, { status: 503 });
      }
    }

    // Parse trace events
    const traceSession = adapter.parseTraceOutput(
      result.stdout || '',
      result.stderr || '',
      result.exitCode,
      result.executionTimeMs
    );

    return NextResponse.json(
      {
        session: traceSession,
        execution: {
          status: result.status,
          exitCode: result.exitCode,
          stdout: traceSession.stdout,
          stderr: traceSession.stderr,
          executionTimeMs: result.executionTimeMs,
          provider: result.provider,
        },
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (err: any) {
    console.error('[Visualization Route Error]', err);
    return NextResponse.json({ error: SAFE_SYSTEM_ERROR_MESSAGE }, { status: 500 });
  } finally {
    executionRateLimiter.releaseSlot(clientKey);
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'Cortex Universal Live Code Visualization Engine API',
    version: '1.0.0',
    matrix: LANGUAGE_SUPPORT_MATRIX,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
