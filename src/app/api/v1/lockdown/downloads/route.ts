import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getEmbeddedBinaryBuffer } from '@/lib/lockdown/embedded-binaries';

export const dynamic = 'force-dynamic';

const ARTIFACTS_MAP: Record<string, { relativePath: string; filename: string; contentType: string; sha256: string; sizeBytes: number }> = {
  'windows-zip': {
    relativePath: 'apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip',
    filename: 'CortexLockdown-Windows-x64.zip',
    contentType: 'application/zip',
    sha256: '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30',
    sizeBytes: 18700,
  },
  'CortexLockdown-Windows-x64.zip': {
    relativePath: 'apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip',
    filename: 'CortexLockdown-Windows-x64.zip',
    contentType: 'application/zip',
    sha256: '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30',
    sizeBytes: 18700,
  },
  'hardened-exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown-Hardened.exe',
    filename: 'CortexLockdown-Hardened.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895',
    sizeBytes: 35840,
  },
  'CortexLockdown-Hardened.exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown-Hardened.exe',
    filename: 'CortexLockdown-Hardened.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895',
    sizeBytes: 35840,
  },
  'setup-exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown-Setup.exe',
    filename: 'CortexLockdown-Setup.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '726E4618990C614DF6AF947F72167244BD51C37F21396D0889A3F0CD62FCF0C6',
    sizeBytes: 60928,
  },
  'CortexLockdown-Setup.exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown-Setup.exe',
    filename: 'CortexLockdown-Setup.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '726E4618990C614DF6AF947F72167244BD51C37F21396D0889A3F0CD62FCF0C6',
    sizeBytes: 60928,
  },
  'baseline-exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown.exe',
    filename: 'CortexLockdown.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466',
    sizeBytes: 33280,
  },
  'CortexLockdown.exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown.exe',
    filename: 'CortexLockdown.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466',
    sizeBytes: 33280,
  },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fileKey = searchParams.get('file') || searchParams.get('artifact');

  // If a specific file is requested, stream the binary
  if (fileKey) {
    const artifact = ARTIFACTS_MAP[fileKey];
    if (!artifact) {
      return NextResponse.json(
        { error: `Unknown artifact '${fileKey}'. Available: windows-zip, hardened-exe, baseline-exe` },
        { status: 404 }
      );
    }

    // 1. Check local host filesystem (Node.js runtime environment)
    try {
      const absolutePath = path.resolve(process.cwd(), artifact.relativePath);
      if (fs.existsSync(absolutePath)) {
        const stat = fs.statSync(absolutePath);
        const fileStream = fs.createReadStream(absolutePath);
        const webStream = Readable.toWeb(fileStream);

        return new Response(webStream as any, {
          status: 200,
          headers: {
            'Content-Type': artifact.contentType,
            'Content-Disposition': `attachment; filename="${artifact.filename}"`,
            'Content-Length': stat.size.toString(),
            'X-Artifact-SHA256': artifact.sha256,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }
    } catch (err) {
      // Filesystem check bypassed in serverless / edge environments
    }

    // 2. Serverless / Cloudflare Worker Edge Isolate Fallback
    const embeddedBuffer = getEmbeddedBinaryBuffer(artifact.filename);
    if (embeddedBuffer) {
      return new Response(embeddedBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': artifact.contentType,
          'Content-Disposition': `attachment; filename="${artifact.filename}"`,
          'Content-Length': embeddedBuffer.length.toString(),
          'X-Artifact-SHA256': artifact.sha256,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    return NextResponse.json(
      { error: `Artifact file not found: ${artifact.filename}` },
      { status: 404 }
    );
  }

  // Return authoritative release metadata JSON
  return NextResponse.json({
    version: '1.0.0-rc1.2',
    releaseDate: '2026-11-03',
    customProtocol: 'cortex-lockdown://',
    trustStatus: {
      isDigitallySigned: false,
      signingNotice: 'Unsigned binary built under INR 0 budget constraint. Requires campus IT pre-authorization via AppLocker or WDAC hash rule.',
      smartScreenInstruction: 'Do NOT instruct students or faculty to click "Run Anyway". Campus IT must pre-authorize hash or deployment path.',
    },
    artifacts: {
      installerExe: {
        id: 'setup-exe',
        filename: 'CortexLockdown-Setup.exe',
        downloadUrl: '/api/v1/lockdown/downloads/CortexLockdown-Setup.exe',
        sizeBytes: 60928,
        sha256: '726E4618990C614DF6AF947F72167244BD51C37F21396D0889A3F0CD62FCF0C6',
        minOsVersion: 'Windows 10 Version 1809 (Build 17763) or Windows 11 x64',
        architecture: 'x64',
        status: 'OFFICIAL SINGLE-FILE WINDOWS INSTALLER',
        embeddedPayloadSha256: '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895',
      },
      portableZip: {
        id: 'windows-zip',
        filename: 'CortexLockdown-Windows-x64.zip',
        downloadUrl: '/api/v1/lockdown/downloads/CortexLockdown-Windows-x64.zip',
        sizeBytes: 18700,
        sha256: '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30',
        minOsVersion: 'Windows 10 Version 1809 (Build 17763) or Windows 11 x64',
        architecture: 'x64',
        status: 'QUALIFIED FOR STAGING PILOT & FACULTY DEMO',
      },
      hardenedExe: {
        id: 'hardened-exe',
        filename: 'CortexLockdown-Hardened.exe',
        downloadUrl: '/api/v1/lockdown/downloads/CortexLockdown-Hardened.exe',
        sizeBytes: 35840,
        sha256: '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895',
        minOsVersion: 'Windows 10 Version 1809 (Build 17763) or Windows 11 x64',
        architecture: 'x64',
        status: 'QUALIFIED FOR STAGING PILOT & FACULTY DEMO',
      },
      baselineExe: {
        id: 'baseline-exe',
        filename: 'CortexLockdown.exe',
        downloadUrl: '/api/v1/lockdown/downloads/CortexLockdown.exe',
        sizeBytes: 33280,
        sha256: '68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466',
        minOsVersion: 'Windows 10 Version 1809 (Build 17763) or Windows 11 x64',
        architecture: 'x64',
        status: 'BASELINE DEMONSTRATION ONLY',
      },
    },
    platforms: {
      windows: {
        name: 'Cortex Lockdown for Windows',
        status: 'SUPPORTED (Windows 10/11 x64)',
        features: [
          'Native Win32 Low-Level Keyboard Hook (WH_KEYBOARD_LL = 13: Alt+Tab, WinKey, Alt+F4 suppressed)',
          'Hardware Display Capture Shielding (SetWindowDisplayAffinity / WDA_EXCLUDEFROMCAPTURE = 0x11)',
          'Process Watchdog with Process Name & Window Title Evasion Detection',
          'Clipboard Sandbox & Automatic Buffer Sanitization',
          'Custom Protocol Handler cortex-lockdown:// for Browser Launch',
          'Single-Monitor Kiosk Confinement with Multi-Display Guard',
          'AES-256-GCM Encrypted Local Answer Persistence with 100,000 PBKDF2 Iterations',
          'Cryptographic Proctor Emergency Exit Hotkey (Ctrl+Alt+F10 with 6-digit challenge code)',
        ],
      },
      macos: {
        name: 'Cortex Lockdown for macOS',
        status: 'BLOCKED (NON-GOAL / NOT IMPLEMENTED)',
        reason: 'Cortex Lockdown utilizes native Windows Win32 API subsystems. macOS Cocoa/Quartz architecture is not implemented.',
        downloadUrl: null,
      },
    },
  });
}
