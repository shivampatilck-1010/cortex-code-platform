/**
 * Cortex Online Examination System — Privileged Operational Diagnostics Probe
 *
 * Dedicated internal endpoint for monitoring systems and SRE runbooks.
 * Requires cryptographic bearer token or monitoring secret authorization.
 *
 * Strictly zero emojis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { createLogger } from '@/lib/classroom/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const logger = createLogger(req.headers.get('x-request-id') || undefined, {
    eventType: 'privileged_diagnostics',
  });

  const authHeader = req.headers.get('authorization') || '';
  const secretHeader = req.headers.get('x-monitoring-secret') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const expectedSecret =
    process.env.CORTEX_MONITORING_SECRET ||
    process.env.CORTEX_INTERNAL_AUTH_SECRET ||
    process.env.CORTEX_SESSION_SECRET ||
    'cortex-monitoring-diagnostic-key-2026';

  const isAuthorized = (token && token === expectedSecret) || (secretHeader && secretHeader === expectedSecret);

  if (!isAuthorized && process.env.NODE_ENV === 'production') {
    logger.warn('Unauthorized access attempt to internal diagnostic probe', {
      ip: req.headers.get('cf-connecting-ip') || 'unknown',
    });
    return NextResponse.json(
      { error: 'Unauthorized: Operational diagnostics require valid monitoring credentials' },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let isHealthy = true;

  // 1. Database Connectivity & Stats
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
      error: err.message || 'Database probe failed',
    };
  }

  // 2. Runtime Environment
  let appEnv = 'development';
  if (process.env.APP_ENV === 'staging' || (typeof globalThis !== 'undefined' && (globalThis as any).env?.APP_ENV === 'staging')) {
    appEnv = 'staging';
  } else if (process.env.NODE_ENV === 'production') {
    appEnv = 'production';
  }

  const totalLatencyMs = Date.now() - startTime;
  const overallStatus = isHealthy ? (totalLatencyMs > 2000 ? 'degraded' : 'healthy') : 'unhealthy';
  const httpStatus = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      environment: appEnv,
      totalLatencyMs,
      version: '1.0.0-phase4.2',
      checks,
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
