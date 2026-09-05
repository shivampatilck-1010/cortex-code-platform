import * as Y from 'yjs';
import {
  RealtimeMessage,
  parseRealtimeMessage,
  serializeRealtimeMessage,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from './protocol';

/**
 * Cloudflare Durable Object for authoritative Cortex Classroom rooms
 */
export class ClassroomRoomDO {
  state: any;
  env: any;
  sessions: Map<any, { participantId: string; name: string; role: string }>;
  yDocs: Map<string, Y.Doc>;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.yDocs = new Map();
  }

  getYDoc(documentId: string, initialContent?: string): Y.Doc {
    if (!this.yDocs.has(documentId)) {
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText('monaco');
      if (initialContent) {
        ytext.insert(0, initialContent);
      }
      this.yDocs.set(documentId, ydoc);
    }
    return this.yDocs.get(documentId)!;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      // @ts-ignore
      const [client, server] = Object.values(new WebSocketPair()) as [any, any];
      
      // Accept WebSocket
      if (typeof server.accept === 'function') {
        server.accept();
      }

      const url = new URL(request.url);
      const participantId = url.searchParams.get('participantId') || 'unknown';
      const participantName = url.searchParams.get('participantName') || 'Anonymous';
      const participantRole = url.searchParams.get('participantRole') || 'user';

      const sessionMeta = {
        participantId,
        name: participantName,
        role: participantRole,
      };

      this.sessions.set(server, sessionMeta);

      server.addEventListener('message', (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
          const msg = parseRealtimeMessage(raw);
          if (!msg) return;

          this.handleMessage(server, sessionMeta, msg);
        } catch (err) {
          console.error('[ClassroomRoomDO message error]', err);
        }
      });

      server.addEventListener('close', () => {
        this.sessions.delete(server);
        this.broadcast(
          serializeRealtimeMessage({
            type: 'presence',
            roomId: '',
            clientId: sessionMeta.participantId,
            senderName: sessionMeta.name,
            payload: { participantId: sessionMeta.participantId, online: false, status: 'offline' },
            timestamp: Date.now(),
          }),
          server
        );
      });

      server.addEventListener('error', () => {
        this.sessions.delete(server);
      });

      return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
      });
    }

    return new Response(JSON.stringify({ status: 'ok', connections: this.sessions.size }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  handleMessage(senderWs: any, meta: { participantId: string; name: string; role: string }, msg: RealtimeMessage) {
    switch (msg.type) {
      case 'doc_sync_step1': {
        const docId = msg.documentId || 'default';
        const initialContent = msg.payload?.initialContent;
        const ydoc = this.getYDoc(docId, initialContent);

        let clientVector: Uint8Array | undefined = undefined;
        if (msg.payload?.vector) {
          clientVector = base64ToUint8Array(msg.payload.vector);
        }

        const serverUpdate = Y.encodeStateAsUpdate(ydoc, clientVector);
        const serverVector = Y.encodeStateVector(ydoc);

        senderWs.send(
          serializeRealtimeMessage({
            type: 'doc_sync_step2',
            roomId: msg.roomId,
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
        const docId = msg.documentId || 'default';
        const ydoc = this.getYDoc(docId);

        if (msg.payload?.update) {
          const binaryUpdate = base64ToUint8Array(msg.payload.update);
          Y.applyUpdate(ydoc, binaryUpdate, meta.participantId);

          this.broadcast(
            serializeRealtimeMessage({
              type: 'doc_update',
              roomId: msg.roomId,
              workspaceId: msg.workspaceId,
              documentId: docId,
              clientId: msg.clientId,
              senderName: msg.senderName,
              payload: { update: msg.payload.update },
              timestamp: Date.now(),
            }),
            senderWs
          );
        }
        break;
      }

      case 'ping': {
        senderWs.send(
          serializeRealtimeMessage({
            type: 'pong',
            roomId: msg.roomId,
            clientId: 'server',
            payload: { clientTimestamp: msg.timestamp },
            timestamp: Date.now(),
          })
        );
        break;
      }

      default: {
        this.broadcast(serializeRealtimeMessage(msg), senderWs);
        break;
      }
    }
  }

  broadcast(raw: string, excludeWs?: any) {
    this.sessions.forEach((_, ws) => {
      if (ws !== excludeWs && ws.readyState === 1) {
        try {
          ws.send(raw);
        } catch {}
      }
    });
  }
}
