import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const videoPath = path.join(process.cwd(), 'public', 'videos', 'finalcortex.mp4');
  const part0Path = path.join(process.cwd(), 'public', 'videos', 'finalcortex.part0.mp4');
  const part1Path = path.join(process.cwd(), 'public', 'videos', 'finalcortex.part1.mp4');

  let fileBuffer: Buffer | null = null;
  if (fs.existsSync(videoPath)) {
    fileBuffer = fs.readFileSync(videoPath);
  } else if (fs.existsSync(part0Path) && fs.existsSync(part1Path)) {
    const b0 = fs.readFileSync(part0Path);
    const b1 = fs.readFileSync(part1Path);
    fileBuffer = Buffer.concat([b0, b1]);
  }

  if (!fileBuffer) {
    return new NextResponse('Video not found', { status: 404 });
  }

  const totalSize = fileBuffer.length;
  const rangeHeader = req.headers.get('range');

  if (!rangeHeader) {
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(totalSize),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10) || 0;
  const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
  const clampedEnd = Math.min(end, totalSize - 1);
  const chunkSize = clampedEnd - start + 1;

  const slice = fileBuffer.subarray(start, clampedEnd + 1);

  return new NextResponse(new Uint8Array(slice), {
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${clampedEnd}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(chunkSize),
      'Content-Type': 'video/mp4',
    },
  });
}
