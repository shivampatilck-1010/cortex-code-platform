import { NextRequest, NextResponse } from 'next/server';
import { ClassroomRoomManager } from '@/lib/classroom/room-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const { searchParams } = new URL(req.url);

    const fileId = searchParams.get('fileId');
    const token = searchParams.get('token');
    const requesterId = searchParams.get('requesterId');

    if (!fileId || !token || !requesterId) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileId, token, and requesterId are required.' },
        { status: 400 }
      );
    }

    const { fileName, content } = ClassroomRoomManager.verifyAndConsumeDownload(
      roomId,
      fileId,
      token,
      requesterId
    );

    // Return the downloaded file content as an attachment
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Download authorization failed' }, { status: 403 });
  }
}
