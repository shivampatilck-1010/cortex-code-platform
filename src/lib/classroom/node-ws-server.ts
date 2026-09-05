import * as Y from 'yjs';
import { ClassroomRoomManager } from './room-manager';
import {
  RealtimeMessage,
  parseRealtimeMessage,
  serializeRealtimeMessage,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from './protocol';

declare global {
  var __cortex_node_ws_server: any | undefined;
  var __cortex_node_ws_port: number | undefined;
  var __cortex_room_ydocs: Map<string, Map<string, Y.Doc>> | undefined;
}

if (!globalThis.__cortex_room_ydocs) {
  globalThis.__cortex_room_ydocs = new Map();
}
const roomYDocs = globalThis.__cortex_room_ydocs;

/**
 * Get or initialize authoritative Y.Doc on the server
 */
export function getServerYDoc(roomId: string, documentId: string, initialContent?: string): Y.Doc {
  const normRoom = roomId.toUpperCase().trim();
  if (!roomYDocs.has(normRoom)) {
    roomYDocs.set(normRoom, new Map());
  }
  const roomDocs = roomYDocs.get(normRoom)!;
  if (!roomDocs.has(documentId)) {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('monaco');
    if (initialContent) {
      ytext.insert(0, initialContent);
    }
    roomDocs.set(documentId, ydoc);
  }
  return roomDocs.get(documentId)!;
}

interface ClientMeta {
  ws: any;
  roomId: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  isAlive: boolean;
}

const connectedClients = new Set<ClientMeta>();

/**
 * Broadcast message to other clients in the same room
 */
export function broadcastToRoom(roomId: string, message: RealtimeMessage, excludeClientId?: string) {
  const normRoom = roomId.toUpperCase().trim();
  const raw = serializeRealtimeMessage(message);

  connectedClients.forEach((client) => {
    if (client.roomId === normRoom && client.ws.readyState === 1 /* OPEN */) {
      if (!excludeClientId || client.participantId !== excludeClientId) {
        try {
          client.ws.send(raw);
        } catch (e) {
          console.error('[NodeWSServer] broadcast error', e);
        }
      }
    }
  });
}

// Subscribe ClassroomRoomManager broadcasts directly to connected Node WebSockets
ClassroomRoomManager.setExternalBroadcaster((roomId: string, event: any) => {
  broadcastToRoom(roomId, {
    type: event.type as any,
    roomId,
    clientId: event.senderId,
    senderName: event.senderName,
    payload: event.payload,
    timestamp: event.timestamp || Date.now(),
  });
});

/**
 * Ensures the Node.js WebSocket server is started and running
 */
export async function ensureNodeWsServer(desiredPort = 3002): Promise<number | null> {
  if (typeof window !== 'undefined') return null;
  if (globalThis.__cortex_node_ws_port) {
    return globalThis.__cortex_node_ws_port;
  }

  try {
    const { WebSocketServer } = await import('ws');
    
    // Attempt desired port, fallback to port 0 (OS assigned) if occupied
    let wss: any = null;
    let actualPort = desiredPort;

    try {
      wss = new WebSocketServer({ port: desiredPort });
    } catch {
      wss = new WebSocketServer({ port: 0 });
    }

    await new Promise<void>((resolve, reject) => {
      wss.on('listening', () => {
        const addr = wss.address();
        if (typeof addr === 'object' && addr?.port) {
          actualPort = addr.port;
        }
        globalThis.__cortex_node_ws_port = actualPort;
        globalThis.__cortex_node_ws_server = wss;
        resolve();
      });
      wss.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Fallback to random free port
          try {
            const fallbackWss = new WebSocketServer({ port: 0 });
            fallbackWss.on('listening', () => {
              const addr = fallbackWss.address();
              actualPort = typeof addr === 'object' && addr?.port ? addr.port : 3003;
              globalThis.__cortex_node_ws_port = actualPort;
              globalThis.__cortex_node_ws_server = fallbackWss;
              resolve();
            });
          } catch (e) {
            reject(e);
          }
        } else {
          reject(err);
        }
      });
    });

    // Connection handler
    globalThis.__cortex_node_ws_server.on('connection', (ws: any, req: any) => {
      let clientMeta: ClientMeta = {
        ws,
        roomId: '',
        participantId: '',
        participantName: '',
        participantRole: 'user',
        isAlive: true,
      };

      connectedClients.add(clientMeta);

      ws.on('pong', () => {
        clientMeta.isAlive = true;
      });

      ws.on('message', (data: any) => {
        try {
          const rawStr = data.toString('utf-8');
          const msg = parseRealtimeMessage(rawStr);
          if (!msg) return;

          handleClientMessage(clientMeta, msg);
        } catch (err) {
          console.error('[NodeWSServer] Message handling error', err);
        }
      });

      ws.on('close', () => {
        connectedClients.delete(clientMeta);
        if (clientMeta.roomId && clientMeta.participantId) {
          ClassroomRoomManager.leaveRoom(clientMeta.roomId, clientMeta.participantId);
          broadcastToRoom(clientMeta.roomId, {
            type: 'presence',
            roomId: clientMeta.roomId,
            clientId: clientMeta.participantId,
            senderName: clientMeta.participantName,
            payload: { participantId: clientMeta.participantId, online: false, status: 'offline' },
            timestamp: Date.now(),
          });
        }
      });

      ws.on('error', (err: any) => {
        console.error('[NodeWSServer] Socket error', err);
      });
    });

    // Heartbeat ping interval every 15s to prune ghost sockets
    const pingInterval = setInterval(() => {
      connectedClients.forEach((client) => {
        if (!client.isAlive) {
          try { client.ws.terminate(); } catch {}
          connectedClients.delete(client);
          return;
        }
        client.isAlive = false;
        try { client.ws.ping(); } catch {}
      });
    }, 15000);

    globalThis.__cortex_node_ws_server.on('close', () => {
      clearInterval(pingInterval);
    });

    return globalThis.__cortex_node_ws_port || actualPort;
  } catch (err) {
    console.warn('[NodeWSServer] Could not start native WebSocket server, using SSE fallback', err);
    return null;
  }
}

export function getNodeWsPort(): number | null {
  return globalThis.__cortex_node_ws_port || null;
}

/**
 * Handle incoming parsed message from client
 */
function handleClientMessage(client: ClientMeta, msg: RealtimeMessage) {
  const normRoom = msg.roomId.toUpperCase().trim();

  switch (msg.type) {
    case 'join': {
      client.roomId = normRoom;
      client.participantId = msg.clientId;
      client.participantName = msg.senderName || msg.payload?.participantName || 'Anonymous';
      client.participantRole = msg.payload?.role || 'user';

      const room = ClassroomRoomManager.getRoom(normRoom, true);
      if (room) {
        // Reply with full authoritative room state
        client.ws.send(
          serializeRealtimeMessage({
            type: 'room_state',
            roomId: normRoom,
            clientId: 'server',
            payload: { room },
            timestamp: Date.now(),
          })
        );
      }
      break;
    }

    case 'ping': {
      client.ws.send(
        serializeRealtimeMessage({
          type: 'pong',
          roomId: normRoom,
          clientId: 'server',
          payload: { clientTimestamp: msg.timestamp },
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'doc_sync_step1': {
      // Yjs sync step 1: client sent state vector, server replies with missing updates
      const docId = msg.documentId || 'default';
      const initialContent = msg.payload?.initialContent;
      const ydoc = getServerYDoc(normRoom, docId, initialContent);

      let clientVector: Uint8Array | undefined = undefined;
      if (msg.payload?.vector) {
        clientVector = base64ToUint8Array(msg.payload.vector);
      }

      // Compute updates that client is missing
      const serverUpdate = Y.encodeStateAsUpdate(ydoc, clientVector);
      const serverVector = Y.encodeStateVector(ydoc);

      client.ws.send(
        serializeRealtimeMessage({
          type: 'doc_sync_step2',
          roomId: normRoom,
          documentId: docId,
          clientId: 'server',
          payload: {
            update: uint8ArrayToBase64(serverUpdate),
            vector: uint8ArrayToBase64(serverVector),
          },
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'doc_sync_step2':
    case 'doc_update': {
      // Client sent CRDT update
      const docId = msg.documentId || 'default';
      const ydoc = getServerYDoc(normRoom, docId);

      if (msg.payload?.update) {
        const binaryUpdate = base64ToUint8Array(msg.payload.update);
        Y.applyUpdate(ydoc, binaryUpdate, client.participantId);

        // Synchronize in-memory participant activeCode in room manager
        const textContent = ydoc.getText('monaco').toString();
        const room = ClassroomRoomManager.getRoom(normRoom);
        if (room && msg.clientId && room.participants[msg.clientId]) {
          room.participants[msg.clientId].activeCode = textContent;
          room.participants[msg.clientId].lastActive = Date.now();
        }

        // Broadcast CRDT delta to all other peers in the room
        broadcastToRoom(
          normRoom,
          {
            type: 'doc_update',
            roomId: normRoom,
            workspaceId: msg.workspaceId,
            documentId: docId,
            clientId: msg.clientId,
            senderName: msg.senderName,
            payload: { update: msg.payload.update },
            timestamp: Date.now(),
          },
          client.participantId
        );
      }
      break;
    }

    case 'awareness_update': {
      // Broadcast user presence / selection / cursor changes without modifying document
      broadcastToRoom(
        normRoom,
        {
          type: 'awareness_update',
          roomId: normRoom,
          documentId: msg.documentId,
          clientId: msg.clientId,
          senderName: msg.senderName,
          payload: msg.payload,
          timestamp: Date.now(),
        },
        client.participantId
      );
      break;
    }

    case 'cursor_update': {
      broadcastToRoom(normRoom, msg, client.participantId);
      break;
    }

    case 'code_update': {
      // Legacy code update fallback
      const targetId = msg.payload?.participantId || msg.payload?.targetUserId || msg.clientId;
      if (targetId && msg.payload?.code !== undefined) {
        ClassroomRoomManager.updateParticipantCode(normRoom, targetId, {
          code: msg.payload.code,
          language: msg.payload.language,
        });
      }
      broadcastToRoom(normRoom, msg, client.participantId);
      break;
    }

    case 'select_workspaces':
    case 'collaboration_request':
    case 'collaboration_response':
    case 'end_collaboration':
    case 'file_download_request':
    case 'file_download_response':
    case 'admin_action':
    case 'chat_message': {
      // Forward to room-manager pub/sub and broadcast to room
      ClassroomRoomManager.broadcast(normRoom, {
        type: msg.type as any,
        roomId: normRoom,
        senderId: msg.clientId,
        senderName: msg.senderName,
        payload: msg.payload,
        timestamp: Date.now(),
      });
      broadcastToRoom(normRoom, msg, client.participantId);
      break;
    }

    case 'start_classroom':
    case 'arena_started': {
      const room = ClassroomRoomManager.startClassroom(normRoom, client.participantId);
      broadcastToRoom(normRoom, {
        type: 'room_state',
        roomId: normRoom,
        clientId: 'server',
        payload: { room },
        timestamp: Date.now(),
      });
      break;
    }

    default: {
      broadcastToRoom(normRoom, msg, client.participantId);
      break;
    }
  }
}
