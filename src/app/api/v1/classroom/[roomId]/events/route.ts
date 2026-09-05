import { NextRequest } from 'next/server';
import { ClassroomRoomManager } from '@/lib/classroom/room-manager';
import { ClassroomEventMessage } from '@/lib/classroom/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const normRoomId = roomId.toUpperCase().trim();
  const room = ClassroomRoomManager.getRoom(normRoomId);

  if (!room) {
    return new Response(JSON.stringify({ error: 'Room not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Cloudflare Workers Native WebSocket Upgrade
  const upgradeHeader = req.headers.get('Upgrade');
  if (upgradeHeader === 'websocket') {
    // Check if WebSocketPair is available in the Cloudflare runtime
    // @ts-ignore
    if (typeof WebSocketPair !== 'undefined') {
      // @ts-ignore
      const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      
      // Accept websocket on the server end
      // @ts-ignore
      server.accept();

      // Send initial snapshot
      server.send(
        JSON.stringify({
          type: 'room_state',
          roomId: normRoomId,
          senderId: 'server',
          payload: { room },
          timestamp: Date.now(),
        })
      );

      // Subscribe to room broadcast events
      const unsubscribe = ClassroomRoomManager.subscribe(normRoomId, (event: ClassroomEventMessage) => {
        try {
          server.send(JSON.stringify(event));
        } catch {
          unsubscribe();
        }
      });

      // Handle incoming messages from client
      server.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'code_update') {
            const targetId = data.payload?.participantId || data.payload?.targetUserId || data.senderId;
            if (targetId && data.payload?.code !== undefined) {
              ClassroomRoomManager.updateParticipantCode(normRoomId, targetId, {
                code: data.payload.code,
                language: data.payload.language,
              });
            }
          }
          if (data.type === 'crdt_sync' || data.type === 'cursor_update' || data.type === 'code_update') {
            ClassroomRoomManager.broadcast(normRoomId, {
              ...data,
              roomId: normRoomId,
              timestamp: Date.now(),
            });
          }
        } catch (err) {
          console.error('[WS Server message parse error]', err);
        }
      });

      server.addEventListener('close', () => {
        unsubscribe();
      });

      // Return 101 Switching Protocols response
      return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
      });
    }
  }

  // 2. Universal Server-Sent Events (SSE) Stream
  // Works flawlessly in local development (next dev / vinext dev) & cloud proxies
  let unsubscribe: (() => void) | null = null;
  let keepAliveTimer: any = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial room connection acknowledgment
      const initialPayload = JSON.stringify({
        type: 'room_state',
        roomId: normRoomId,
        senderId: 'server',
        payload: { room },
        timestamp: Date.now(),
      });
      controller.enqueue(encoder.encode(`data: ${initialPayload}\n\n`));

      // Subscribe to room event bus
      unsubscribe = ClassroomRoomManager.subscribe(normRoomId, (event: ClassroomEventMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch (e) {
          if (unsubscribe) unsubscribe();
        }
      });

      // Keepalive heartbeat every 15s to prevent proxy timeouts
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(keepAliveTimer);
          if (unsubscribe) unsubscribe();
        }
      }, 15000);
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
