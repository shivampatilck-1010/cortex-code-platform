/**
 * Cortex Online Examination System — Operational Health & Monitoring Probe
 *
 * Implements high-precision health checks for Cloudflare Workers and container runtimes.
 * Probes database connectivity, measures query latency, verifies runtime environment,
 * and reports subsystem operational status.
 *
 * Strictly zero emojis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { createLogger } from '@/lib/classroom/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const logger = createLogger(req.headers.get('x-request-id') || undefined, {
    eventType: 'health_check',
  });

  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let isHealthy = true;

  // 1. Database Connectivity & Latency Probe
  const dbStartTime = Date.now();
  try {
    const stats = await classroomDb.getHealthStats();
    const dbLatencyMs = Date.now() - dbStartTime;
    checks.database = {
      status: 'healthy',
      latencyMs: dbLatencyMs,
      reachable: true,
      stats,
    };
  } catch (err: any) {
    const dbLatencyMs = Date.now() - dbStartTime;
    isHealthy = false;
    checks.database = {
      status: 'unhealthy',
      latencyMs: dbLatencyMs,
      reachable: false,
      error: err.message || 'Database connection probe failed',
    };
    logger.error('Health probe: database connection failed', { error: err.message, latencyMs: dbLatencyMs });
  }

  // 2. Runtime Environment Detection
  let appEnv = 'development';
  if (process.env.APP_ENV === 'staging' || (typeof globalThis !== 'undefined' && (globalThis as any).env?.APP_ENV === 'staging')) {
    appEnv = 'staging';
  } else if (process.env.NODE_ENV === 'production') {
    appEnv = 'production';
  }

  const totalLatencyMs = Date.now() - startTime;
  const overallStatus = isHealthy ? (totalLatencyMs > 2000 ? 'degraded' : 'healthy') : 'unhealthy';

  const wantsDiagnostics = req.nextUrl.searchParams.get('diagnostics') === 'true';

  if (wantsDiagnostics) {
    // Verify authorization for diagnostics probe
    const authHeader = req.headers.get('authorization') || '';
    const secretHeader = req.headers.get('x-monitoring-secret') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const expectedSecret =
      process.env.CORTEX_MONITORING_SECRET ||
      process.env.CORTEX_SESSION_SECRET ||
      'cortex-monitoring-diagnostic-key-2026';

    const isAuthorized = (token && token === expectedSecret) || (secretHeader && secretHeader === expectedSecret);

    if (!isAuthorized && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Unauthorized: Operational diagnostics require valid monitoring credentials' },
        { status: 401 }
      );
    }

    const healthPayload = {
      status: overallStatus,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      environment: appEnv,
      totalLatencyMs,
      version: '1.0.0-phase3.9',
      checks,
    };

    const httpStatus = isHealthy ? 200 : 503;

    logger.info(`Diagnostics health check completed with status ${overallStatus}`, {
      overallStatus,
      totalLatencyMs,
      httpStatus,
    });

    return NextResponse.json(healthPayload, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  // Minimal public health probe for external uptime monitors (zero sensitive information exposure)
  const httpStatus = isHealthy ? 200 : 503;
  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: Date.now(),
    },
    {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
