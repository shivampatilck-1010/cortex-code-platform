import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const videoPath = path.join(process.cwd(), 'public', 'videos', 'finalcortex.mp4');

  if (!fs.existsSync(videoPath)) {
    return new NextResponse('Video not found', { status: 404 });
  }

  const stat = fs.statSync(videoPath);
  const totalSize = stat.size;
  const rangeHeader = req.headers.get('range');

  if (!rangeHeader) {
    const fileBuffer = fs.readFileSync(videoPath);
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

  const fd = fs.openSync(videoPath, 'r');
  const buffer = Buffer.alloc(chunkSize);
  fs.readSync(fd, buffer, 0, chunkSize, start);
  fs.closeSync(fd);

  return new NextResponse(new Uint8Array(buffer), {
    status: 206,
    headers: {
      'Content-Range': `bytes ${start}-${clampedEnd}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(chunkSize),
      'Content-Type': 'video/mp4',
    },
  });
}
