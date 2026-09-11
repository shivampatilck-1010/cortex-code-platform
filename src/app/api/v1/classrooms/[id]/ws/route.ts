import { NextRequest, NextResponse } from 'next/server';
import { ensureNodeWsServer, getNodeWsPort } from '@/lib/classroom/node-ws-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const upgrade = req.headers.get('Upgrade');

  // Cloudflare Workers Native WebSocket forwarding to Durable Object
  // @ts-ignore
  if (upgrade === 'websocket' && typeof process.env.CLASSROOM_ROOM_DO !== 'undefined') {
    // @ts-ignore
    const doId = process.env.CLASSROOM_ROOM_DO.idFromName(id);
    // @ts-ignore
    const stub = process.env.CLASSROOM_ROOM_DO.get(doId);
    // @ts-ignore
    return stub.fetch(req);
  }

  // Node.js Development & Production Environment
  if (typeof window === 'undefined') {
    await ensureNodeWsServer(3002);
  }

  const wsPort = getNodeWsPort() || 3002;

  return NextResponse.json({
    status: 'ws_ready',
    classroomId: id,
    port: wsPort,
    upgradeSupported: true,
    protocol: 'cortex-classroom-ws-v1',
    endpoint: `/api/v1/classrooms/${id}/ws`,
  });
}
