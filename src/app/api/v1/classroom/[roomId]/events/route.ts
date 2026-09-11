import { NextRequest } from 'next/server';
import { ClassroomRoomManager } from '@/lib/classroom/room-manager';
import { ClassroomEventMessage } from '@/lib/classroom/types';
import { ensureNodeWsServer, getNodeWsPort, getServerYDoc } from '@/lib/classroom/node-ws-server';
import {
  parseRealtimeMessage,
  serializeRealtimeMessage,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from '@/lib/classroom/protocol';
import * as Y from 'yjs';

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

  const url = new URL(req.url);

  // 0. WebSocket Discovery Endpoint
  if (url.searchParams.get('info') === 'true') {
    let wsPort: number | null = null;
    try {
      wsPort = await ensureNodeWsServer();
    } catch {}

    // @ts-ignore
    const hasCloudflareWs = typeof WebSocketPair !== 'undefined';

    return new Response(
      JSON.stringify({
        success: true,
        wsPort,
        hasCloudflareWs,
        roomId: normRoomId,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 1. Cloudflare Workers Native WebSocket Upgrade
  const upgradeHeader = req.headers.get('Upgrade');
  if (upgradeHeader === 'websocket') {
    // @ts-ignore
    if (typeof WebSocketPair !== 'undefined') {
      // @ts-ignore
      const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      
      // @ts-ignore
      server.accept();

      // Send initial snapshot
      server.send(
        serializeRealtimeMessage({
          type: 'room_state',
          roomId: normRoomId,
          clientId: 'server',
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

      server.addEventListener('message', (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
          const msg = parseRealtimeMessage(raw);
          if (!msg) return;

          if (msg.type === 'doc_sync_step1') {
            const docId = msg.documentId || 'default';
            const ydoc = getServerYDoc(normRoomId, docId, msg.payload?.initialContent);
            const clientVector = msg.payload?.vector ? base64ToUint8Array(msg.payload.vector) : undefined;
            const update = Y.encodeStateAsUpdate(ydoc, clientVector);
            const vector = Y.encodeStateVector(ydoc);

            server.send(
              serializeRealtimeMessage({
                type: 'doc_sync_step2',
                roomId: normRoomId,
                documentId: docId,
                clientId: 'server',
                payload: {
                  update: uint8ArrayToBase64(update),
                  vector: uint8ArrayToBase64(vector),
                },
                timestamp: Date.now(),
              })
            );
            return;
          }

          if (msg.type === 'doc_update' || msg.type === 'doc_sync_step2') {
            const docId = msg.documentId || 'default';
            const ydoc = getServerYDoc(normRoomId, docId);
            if (msg.payload?.update) {
              const bin = base64ToUint8Array(msg.payload.update);
              Y.applyUpdate(ydoc, bin, msg.clientId);

              const text = ydoc.getText('monaco').toString();
              if (room && msg.clientId && room.participants[msg.clientId]) {
                room.participants[msg.clientId].activeCode = text;
              }

              ClassroomRoomManager.broadcast(normRoomId, {
                type: 'crdt_sync',
                roomId: normRoomId,
                senderId: msg.clientId || 'unknown',
                payload: { update: msg.payload.update, documentId: docId },
                timestamp: Date.now(),
              });
            }
            return;
          }

          if (msg.type === 'code_update') {
            const targetId = msg.payload?.participantId || msg.payload?.targetUserId || msg.clientId;
            if (targetId && msg.payload?.code !== undefined) {
              ClassroomRoomManager.updateParticipantCode(normRoomId, targetId, {
                code: msg.payload.code,
                language: msg.payload.language,
              });
            }
          }

          ClassroomRoomManager.broadcast(normRoomId, {
            type: msg.type as any,
            roomId: normRoomId,
            senderId: msg.clientId || 'unknown',
            senderName: msg.senderName,
            payload: msg.payload,
            timestamp: Date.now(),
          });
        } catch (err) {
          console.error('[Cloudflare WS Message parse error]', err);
        }
      });

      server.addEventListener('close', () => {
        unsubscribe();
      });

      return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
      });
    }
  }

  // Ensure Node WS server is started if running in Node.js environment
  try {
    await ensureNodeWsServer();
  } catch {}

  // 2. Universal Server-Sent Events (SSE) Stream
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
