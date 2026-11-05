import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { getEmbeddedBinaryBuffer } from '@/lib/lockdown/embedded-binaries';

export const dynamic = 'force-dynamic';

const ARTIFACTS_MAP: Record<string, { relativePath: string; filename: string; contentType: string; sha256: string }> = {
  'CortexLockdown-Windows-x64.zip': {
    relativePath: 'apps/cortex-lockdown-windows/dist/CortexLockdown-Windows-x64.zip',
    filename: 'CortexLockdown-Windows-x64.zip',
    contentType: 'application/zip',
    sha256: '08BD0C5AAC9C5E7466D09A11A7E1A70F4203E131097F4C843C71231772CA6B30',
  },
  'CortexLockdown-Hardened.exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown-Hardened.exe',
    filename: 'CortexLockdown-Hardened.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '82518B2D6966E3FB358892A040F148E52AA5ECDF8CAB92E0D93A2A22F3AFC895',
  },
  'CortexLockdown-Setup.exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown-Setup.exe',
    filename: 'CortexLockdown-Setup.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '726E4618990C614DF6AF947F72167244BD51C37F21396D0889A3F0CD62FCF0C6',
  },
  'CortexLockdown.exe': {
    relativePath: 'apps/cortex-lockdown-windows/bin/CortexLockdown.exe',
    filename: 'CortexLockdown.exe',
    contentType: 'application/vnd.microsoft.portable-executable',
    sha256: '68C13F5BB3409F8A7524C1FB5BA9E504A5ADDA88FAEAB09813CC9C0F292CF466',
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const artifact = ARTIFACTS_MAP[filename];

  if (!artifact) {
    return NextResponse.json(
      {
        error: `File '${filename}' not found. Available downloads: CortexLockdown-Windows-x64.zip, CortexLockdown-Hardened.exe, CortexLockdown.exe`,
      },
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
