'use client';

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { ClassroomEventMessage, LiveCursor } from './types';
import {
  RealtimeMessage,
  parseRealtimeMessage,
  serializeRealtimeMessage,
  uint8ArrayToBase64,
  base64ToUint8Array,
  toClassroomEventMessage,
} from './protocol';

export type ConnectionLifecycle = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type ConnectionStatus = 'online' | 'syncing' | 'offline';

export class CollaborationClient {
  public readonly roomId: string;
  public readonly participantId: string;
  public readonly participantName: string;
  public readonly participantRole: string;

  private lifecycle: ConnectionLifecycle = 'connecting';
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private isDestroyed = false;

  // Reconnection backoff state
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private lastPingSent = 0;
  private roundTripTimeMs = 0;

  // Multi-document Yjs state
  private ydocs: Map<string, Y.Doc> = new Map();
  private awarenessMap: Map<string, Awareness> = new Map();
  private docListeners: Map<string, Set<(text: string) => void>> = new Map();

  // Throttled cursor state
  private lastCursorSentTime = 0;
  private pendingCursorUpdate: any = null;
  private cursorThrottleTimer: any = null;

  // Listeners
  private eventListeners: Set<(event: ClassroomEventMessage) => void> = new Set();
  private cursorListeners: Set<(cursor: LiveCursor) => void> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private lifecycleListeners: Set<(lifecycle: ConnectionLifecycle) => void> = new Set();

  // Gossip & room tracking
  private lastKnownParticipants: any[] = [];
  private lastRoomSig = '';
  private lastRoomState = 'created';
  private lastAdminEntered = false;

  constructor(roomId: string, participantId: string, participantName: string, participantRole = 'user') {
    this.roomId = roomId.toUpperCase().trim();
    this.participantId = participantId;
    this.participantName = participantName;
    this.participantRole = participantRole;

    if (participantRole === 'admin') {
      this.lastAdminEntered = true;
      this.lastRoomState = 'active';
    }

    this.initConnection();
    this.startHeartbeat();
  }

  // =========================================================================
  // CONNECTION MANAGEMENT & WEBSOCKET LIFECYCLE
  // =========================================================================

  private async initConnection() {
    if (typeof window === 'undefined' || this.isDestroyed) return;

    this.setLifecycle('connecting');

    // 1. Discover active WebSocket endpoint
    let wsUrl: string | null = null;
    try {
      const res = await fetch(`/api/v1/classroom/${this.roomId}/events?info=true`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (data.wsPort) {
          // Node.js development or standalone WebSocket hub
          wsUrl = `${protocol}//${window.location.hostname}:${data.wsPort}`;
        } else if (data.hasCloudflareWs) {
          // Cloudflare Workers Native WebSocket
          wsUrl = `${protocol}//${window.location.host}/api/v1/classroom/${this.roomId}/events?participantId=${this.participantId}&participantName=${encodeURIComponent(this.participantName)}&participantRole=${this.participantRole}`;
        }
      }
    } catch {
      // Ignore discovery error, fallback to standard path
    }

    if (!wsUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/api/v1/classroom/${this.roomId}/events?participantId=${this.participantId}&participantName=${encodeURIComponent(this.participantName)}&participantRole=${this.participantRole}`;
    }

    this.connectWebSocket(wsUrl);
  }

  private connectWebSocket(wsUrl: string) {
    if (this.isDestroyed) return;

    try {
      this.ws = new WebSocket(wsUrl);

      const connectTimeout = setTimeout(() => {
        if (this.lifecycle === 'connecting' && this.ws?.readyState !== WebSocket.OPEN) {
          try { this.ws?.close(); } catch {}
          this.fallbackToSSE();
        }
      }, 3000);

      this.ws.onopen = () => {
        clearTimeout(connectTimeout);
        this.reconnectAttempts = 0;
        this.setLifecycle('connected');

        // Send Join handshake
        this.sendRaw({
          type: 'join',
          roomId: this.roomId,
          clientId: this.participantId,
          senderName: this.participantName,
          payload: { role: this.participantRole },
          timestamp: Date.now(),
        });

        // Resynchronize all active Yjs documents immediately upon connection/reconnection
        this.resyncAllDocs();
      };

      this.ws.onmessage = (event) => {
        this.handleMessageData(event.data);
      };

      this.ws.onerror = () => {
        clearTimeout(connectTimeout);
        if (this.lifecycle === 'connecting') {
          this.fallbackToSSE();
        }
      };

      this.ws.onclose = () => {
        clearTimeout(connectTimeout);
        if (this.isDestroyed) return;
        this.setLifecycle('reconnecting');
        this.scheduleReconnect();
      };
    } catch {
      this.fallbackToSSE();
    }
  }

  private fallbackToSSE() {
    if (this.isDestroyed || this.sse) return;

    try {
      const sseUrl = `/api/v1/classroom/${this.roomId}/events?participantId=${this.participantId}`;
      this.sse = new EventSource(sseUrl);

      this.sse.onopen = () => {
        this.setLifecycle('connected');
        this.resyncAllDocs();
      };

      this.sse.onmessage = (event) => {
        this.handleMessageData(event.data);
      };

      this.sse.onerror = () => {
        if (!this.isDestroyed) {
          this.setLifecycle('reconnecting');
        }
      };
    } catch (e) {
      console.error('[CollabClient] SSE fallback failed', e);
      this.setLifecycle('disconnected');
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;

    this.reconnectAttempts++;
    // Exponential backoff with random jitter: min(1000 * 2^attempts, 16000) + random(500)
    const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    const jitter = Math.floor(Math.random() * 500);
    const delay = baseDelay + jitter;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isDestroyed) {
        this.initConnection();
      }
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.isDestroyed) return;

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSent = Date.now();
        this.sendRaw({
          type: 'ping',
          roomId: this.roomId,
          clientId: this.participantId,
          timestamp: this.lastPingSent,
        });
      }
    }, 15000);
  }

  private setLifecycle(newLifecycle: ConnectionLifecycle) {
    if (this.lifecycle === newLifecycle) return;
    this.lifecycle = newLifecycle;
    this.lifecycleListeners.forEach((cb) => cb(newLifecycle));

    const statusMap: Record<ConnectionLifecycle, ConnectionStatus> = {
      connecting: 'syncing',
      connected: 'online',
      reconnecting: 'syncing',
      disconnected: 'offline',
    };
    const mapped = statusMap[newLifecycle];
    this.statusListeners.forEach((cb) => cb(mapped));
  }

  public getStatus(): ConnectionStatus {
    return this.lifecycle === 'connected' ? 'online' : this.lifecycle === 'disconnected' ? 'offline' : 'syncing';
  }

  public getLifecycle(): ConnectionLifecycle {
    return this.lifecycle;
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => this.statusListeners.delete(callback);
  }

  public onLifecycleChange(callback: (lifecycle: ConnectionLifecycle) => void): () => void {
    this.lifecycleListeners.add(callback);
    callback(this.lifecycle);
    return () => this.lifecycleListeners.delete(callback);
  }

  // =========================================================================
  // MESSAGE PROCESSING & PROTOCOL PARSER
  // =========================================================================

  private handleMessageData(data: any) {
    try {
      const raw = typeof data === 'string' ? data : new TextDecoder().decode(data);
      const msg = parseRealtimeMessage(raw);
      if (!msg) return;

      this.handleIncoming(msg);
    } catch (err) {
      console.error('[CollabClient] Parse error', err);
    }
  }

  private handleIncoming(msg: RealtimeMessage) {
    switch (msg.type) {
      case 'pong': {
        if (this.lastPingSent) {
          this.roundTripTimeMs = Date.now() - this.lastPingSent;
        }
        break;
      }

      case 'doc_sync_step1': {
        // Server or peer requests our document delta
        const docId = msg.documentId || 'default';
        const ydoc = this.ydocs.get(docId);
        if (ydoc) {
          const clientVector = msg.payload?.vector ? base64ToUint8Array(msg.payload.vector) : undefined;
          const update = Y.encodeStateAsUpdate(ydoc, clientVector);
          const localVector = Y.encodeStateVector(ydoc);

          this.sendRaw({
            type: 'doc_sync_step2',
            roomId: this.roomId,
            documentId: docId,
            clientId: this.participantId,
            payload: {
              update: uint8ArrayToBase64(update),
              vector: uint8ArrayToBase64(localVector),
            },
            timestamp: Date.now(),
          });
        }
        break;
      }

      case 'doc_sync_step2':
      case 'doc_update': {
        const docId = msg.documentId || 'default';
        const ydoc = this.ydocs.get(docId);
        if (ydoc && msg.payload?.update) {
          try {
            const binary = base64ToUint8Array(msg.payload.update);
            // Apply with 'remote' origin so local listeners never re-broadcast back!
            Y.applyUpdate(ydoc, binary, 'remote');
          } catch (e) {
            console.error('[CollabClient] Failed to apply CRDT delta', e);
          }
        }
        break;
      }

      case 'awareness_update': {
        const docId = msg.documentId || 'default';
        const awareness = this.awarenessMap.get(docId);
        if (awareness && msg.payload?.update) {
          try {
            // Forward cursor awareness
            if (msg.payload.cursor && msg.clientId !== this.participantId) {
              this.cursorListeners.forEach((cb) => cb(msg.payload.cursor));
            }
          } catch (e) {
            console.error('[CollabClient] Awareness error', e);
          }
        }
        break;
      }

      case 'cursor_update': {
        if (msg.clientId !== this.participantId && msg.payload) {
          this.cursorListeners.forEach((cb) => cb(msg.payload));
        }
        break;
      }

      default: {
        // Convert to ClassroomEventMessage and notify listeners
        const eventMsg = toClassroomEventMessage(msg);
        this.eventListeners.forEach((cb) => {
          try {
            cb(eventMsg);
          } catch (e) {
            console.error('[CollabClient] Event listener error', e);
          }
        });
        break;
      }
    }
  }

  // =========================================================================
  // MULTI-DOCUMENT YJS SYNCHRONIZATION
  // =========================================================================

  /**
   * Retrieves or initializes a synchronized Y.Doc for a workspace or session file
   */
  public getOrCreateDoc(docId: string, initialContent?: string): { doc: Y.Doc; ytext: Y.Text; awareness: Awareness } {
    if (!this.ydocs.has(docId)) {
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText('monaco');
      const awareness = new Awareness(ydoc);

      // Seed initial content if brand new
      if (ytext.length === 0 && initialContent) {
        ydoc.transact(() => {
          ytext.insert(0, initialContent);
        }, 'init');
      }

      // 1. Broadcast local Yjs CRDT changes asynchronously
      ydoc.on('update', (update: Uint8Array, origin: any) => {
        // PREVENT ECHO LOOPS: Only broadcast if change originated locally (not from 'remote' or 'init')
        if (origin !== 'remote' && origin !== 'init') {
          const b64 = uint8ArrayToBase64(update);
          this.sendRaw({
            type: 'doc_update',
            roomId: this.roomId,
            documentId: docId,
            clientId: this.participantId,
            senderName: this.participantName,
            payload: { update: b64 },
            timestamp: Date.now(),
          });
        }

        // Notify text listeners
        const text = ytext.toString();
        const listeners = this.docListeners.get(docId);
        if (listeners) {
          listeners.forEach((cb) => cb(text));
        }
      });

      // 2. Broadcast local awareness / cursor changes
      awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
        if (origin !== 'remote') {
          const localState = awareness.getLocalState();
          this.sendRaw({
            type: 'awareness_update',
            roomId: this.roomId,
            documentId: docId,
            clientId: this.participantId,
            senderName: this.participantName,
            payload: { localState },
            timestamp: Date.now(),
          });
        }
      });

      this.ydocs.set(docId, ydoc);
      this.awarenessMap.set(docId, awareness);

      // Request authoritative server updates for this document
      this.requestDocSync(docId, initialContent);
    }

    const doc = this.ydocs.get(docId)!;
    const ytext = doc.getText('monaco');
    const awareness = this.awarenessMap.get(docId)!;

    return { doc, ytext, awareness };
  }

  /**
   * Performs Yjs Step 1 handshake: sends local state vector to server
   */
  private requestDocSync(docId: string, initialContent?: string) {
    const ydoc = this.ydocs.get(docId);
    if (!ydoc) return;

    const vector = Y.encodeStateVector(ydoc);
    this.sendRaw({
      type: 'doc_sync_step1',
      roomId: this.roomId,
      documentId: docId,
      clientId: this.participantId,
      payload: {
        vector: uint8ArrayToBase64(vector),
        initialContent,
      },
      timestamp: Date.now(),
    });
  }

  private resyncAllDocs() {
    this.ydocs.forEach((_, docId) => {
      this.requestDocSync(docId);
    });
  }

  public subscribeToDocText(docId: string, callback: (text: string) => void): () => void {
    if (!this.docListeners.has(docId)) {
      this.docListeners.set(docId, new Set());
    }
    const set = this.docListeners.get(docId)!;
    set.add(callback);

    const doc = this.ydocs.get(docId);
    if (doc) {
      callback(doc.getText('monaco').toString());
    }

    return () => set.delete(callback);
  }

  // =========================================================================
  // THROTTLED LIVE CURSOR & PRESENCE
  // =========================================================================

  /**
   * Transmits live cursor position with strict 25ms throttling (~40fps max)
   */
  public sendCursor(docIdOrLine: string | number, lineOrCol?: number, colOrColor?: number | string) {
    let documentId: string | undefined;
    let lineNumber: number;
    let column: number;
    let color = '#ff9100';

    if (typeof docIdOrLine === 'string') {
      documentId = docIdOrLine;
      lineNumber = typeof lineOrCol === 'number' ? lineOrCol : 1;
      column = typeof colOrColor === 'number' ? colOrColor : 1;
    } else {
      lineNumber = docIdOrLine;
      column = typeof lineOrCol === 'number' ? lineOrCol : 1;
      if (typeof colOrColor === 'string') color = colOrColor;
    }

    if (documentId) {
      const awareness = this.awarenessMap.get(documentId);
      if (awareness) {
        awareness.setLocalStateField('cursor', {
          lineNumber,
          column,
          user: { name: this.participantName, id: this.participantId, role: this.participantRole },
          updatedAt: Date.now(),
        });
      }
    }

    const now = Date.now();
    const cursorData: LiveCursor = {
      participantId: this.participantId,
      name: this.participantName,
      color,
      lineNumber,
      column,
    };

    if (now - this.lastCursorSentTime >= 25) {
      this.lastCursorSentTime = now;
      this.sendRaw({
        type: 'cursor_update',
        roomId: this.roomId,
        documentId,
        clientId: this.participantId,
        senderName: this.participantName,
        payload: cursorData,
        timestamp: now,
      });
    } else {
      this.pendingCursorUpdate = cursorData;
      if (!this.cursorThrottleTimer) {
        this.cursorThrottleTimer = setTimeout(() => {
          this.cursorThrottleTimer = null;
          if (this.pendingCursorUpdate) {
            this.lastCursorSentTime = Date.now();
            this.sendRaw({
              type: 'cursor_update',
              roomId: this.roomId,
              documentId,
              clientId: this.participantId,
              senderName: this.participantName,
              payload: this.pendingCursorUpdate,
              timestamp: this.lastCursorSentTime,
            });
            this.pendingCursorUpdate = null;
          }
        }, 25);
      }
    }
  }

  // =========================================================================
  // SENDER & EVENT HELPERS
  // =========================================================================

  public async sendRaw(msg: RealtimeMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(serializeRealtimeMessage(msg));
        return;
      } catch (e) {
        console.error('[CollabClient] WS send error', e);
      }
    }

    // Low-latency HTTP fallback if WebSocket is not open
    try {
      await fetch(`/api/v1/classroom/${this.roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: msg.type,
          participantId: this.participantId,
          ...msg.payload,
          documentId: msg.documentId,
          workspaceId: msg.workspaceId,
        }),
      });
    } catch {}
  }

  public sendCodeUpdate(code?: string, language?: string, targetUserId?: string) {
    this.sendRaw({
      type: 'code_update',
      roomId: this.roomId,
      clientId: this.participantId,
      senderName: this.participantName,
      payload: {
        participantId: targetUserId || this.participantId,
        targetUserId: targetUserId || this.participantId,
        ...(code !== undefined ? { code } : {}),
        ...(language !== undefined ? { language } : {}),
      },
      timestamp: Date.now(),
    });
  }

  public async sendEvent(event: Partial<ClassroomEventMessage>) {
    await this.sendRaw({
      type: (event.type || 'presence') as any,
      roomId: this.roomId,
      clientId: this.participantId,
      senderName: this.participantName,
      payload: event.payload,
      timestamp: Date.now(),
    });
  }

  public onEvent(callback: (event: ClassroomEventMessage) => void): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  public onCursor(callback: (cursor: LiveCursor) => void): () => void {
    this.cursorListeners.add(callback);
    return () => this.cursorListeners.delete(callback);
  }

  public updateKnownParticipants(participants: any[]) {
    this.lastKnownParticipants = participants;
  }

  public getKnownParticipants(): any[] {
    return this.lastKnownParticipants;
  }

  public triggerImmediateSync() {
    if (typeof window === 'undefined' || this.isDestroyed) return;
    this.resyncAllDocs();
    fetch(`/api/v1/classroom/${this.roomId}?requesterId=${this.participantId}&requesterName=${encodeURIComponent(this.participantName)}&requesterRole=${this.participantRole}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.room) {
          this.handleIncoming({
            type: 'room_state',
            roomId: this.roomId,
            clientId: 'server',
            payload: { room: data.room },
            timestamp: Date.now(),
          });
        }
      })
      .catch(() => {});
  }

  public cleanup() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cursorThrottleTimer) clearTimeout(this.cursorThrottleTimer);

    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.sse) {
      try { this.sse.close(); } catch {}
      this.sse = null;
    }

    this.ydocs.forEach((doc) => {
      try { doc.destroy(); } catch {}
    });
    this.ydocs.clear();
    this.awarenessMap.clear();
    this.docListeners.clear();
  }
}
