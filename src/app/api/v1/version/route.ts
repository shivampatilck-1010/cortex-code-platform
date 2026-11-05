import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const globalEnv = (globalThis as any).env;
  let environment = globalEnv?.APP_ENV || process.env.APP_ENV;

  if (!environment) {
    try {
      const url = new URL(request.url);
      if (
        url.hostname.includes('staging') ||
        url.hostname.includes('localhost') ||
        url.hostname.includes('127.0.0.1')
      ) {
        environment = 'staging';
      } else {
        environment = process.env.NODE_ENV || 'production';
      }
    } catch {
      environment = process.env.NODE_ENV || 'production';
    }
  }

  return NextResponse.json({
    name: 'Cortex Lockdown Examination Security Platform',
    version: '1.0.0-rc1.2',
    releaseTag: 'RC1.2',
    releaseDate: '2026-11-03',
    protocol: 'cortex-lockdown://',
    environment,
    supportedPlatforms: ['win32-x64'],
    unsupportedPlatforms: ['darwin-arm64', 'darwin-x64', 'linux-x64'],
    databaseProvider: 'sqlite3-wal',
    databaseQualified: true,
    ltiVersion: '1.3.0',
    samlFederationStatus: 'BLOCKED',
    codeSigningStatus: 'UNSIGNED',
    budgetConstraint: 'INR 0',
  });
}
