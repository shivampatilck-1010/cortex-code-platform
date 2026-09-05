import * as Y from 'yjs';
import { ClassroomEventMessage, LiveCursor } from './types';

export class CollaborationClient {
  private roomId: string;
  private participantId: string;
  private participantName: string;
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private listeners: Set<(event: ClassroomEventMessage) => void> = new Set();
  private cursorListeners: Set<(cursor: LiveCursor) => void> = new Set();
  private isConnected = false;
  private reconnectTimer: any = null;
  private ydoc: Y.Doc | null = null;
  private ytext: Y.Text | null = null;
  private isApplyingRemoteUpdate = false;

  constructor(roomId: string, participantId: string, participantName: string) {
    this.roomId = roomId.toUpperCase().trim();
    this.participantId = participantId;
    this.participantName = participantName;
    this.connect();
  }

  public connect() {
    if (typeof window === 'undefined') return;
    this.cleanup();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/classroom/${this.roomId}/events?participantId=${this.participantId}`;

    // Try WebSocket first
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emitStatus('online');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: ClassroomEventMessage = JSON.parse(event.data);
          this.handleIncoming(msg);
        } catch (e) {
          console.error('[CollabClient] WS parse error', e);
        }
      };

      this.ws.onerror = () => {
        // Fallback to Server-Sent Events if WebSocket fails
        if (!this.isConnected) {
          this.connectSSE();
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emitStatus('reconnecting');
        this.scheduleReconnect();
      };
    } catch {
      this.connectSSE();
    }
  }

  private connectSSE() {
    try {
      const sseUrl = `/api/v1/classroom/${this.roomId}/events?participantId=${this.participantId}`;
      this.sse = new EventSource(sseUrl);

      this.sse.onopen = () => {
        this.isConnected = true;
        this.emitStatus('online');
      };

      this.sse.onmessage = (event) => {
        try {
          const msg: ClassroomEventMessage = JSON.parse(event.data);
          this.handleIncoming(msg);
        } catch (e) {
          console.error('[CollabClient] SSE parse error', e);
        }
      };

      this.sse.onerror = () => {
        this.isConnected = false;
        this.emitStatus('reconnecting');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[CollabClient] SSE connection failed', err);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  private handleIncoming(msg: ClassroomEventMessage) {
    // 1. CRDT synchronization updates
    if (msg.type === 'crdt_sync' && msg.senderId !== this.participantId) {
      if (this.ydoc && msg.payload?.update) {
        try {
          this.isApplyingRemoteUpdate = true;
          const binary = Uint8Array.from(atob(msg.payload.update), (c) => c.charCodeAt(0));
          Y.applyUpdate(this.ydoc, binary);
        } finally {
          this.isApplyingRemoteUpdate = false;
        }
      }
    }

    // 2. Cursor updates
    if (msg.type === 'cursor_update' && msg.senderId !== this.participantId) {
      this.cursorListeners.forEach((cb) => cb(msg.payload));
    }

    // 3. General message bus
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('[CollabClient] listener error', err);
      }
    });
  }

  private emitStatus(status: 'online' | 'reconnecting' | 'offline') {
    this.listeners.forEach((listener) => {
      listener({
        type: 'presence',
        roomId: this.roomId,
        senderId: this.participantId,
        senderName: this.participantName,
        payload: { participantId: this.participantId, status, online: status === 'online' },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Initialize or attach Yjs CRDT document for a collaboration session
   */
  public initSharedDocument(initialContent: string, onTextChange: (newText: string) => void): Y.Doc {
    if (this.ydoc) {
      this.ydoc.destroy();
    }

    this.ydoc = new Y.Doc();
    this.ytext = this.ydoc.getText('monaco');

    if (this.ytext.length === 0 && initialContent) {
      this.ytext.insert(0, initialContent);
    }

    // Listen to local CRDT changes
    this.ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (!this.isApplyingRemoteUpdate) {
        // Encode binary update to base64 for network transport
        let binaryStr = '';
        for (let i = 0; i < update.length; i++) {
          binaryStr += String.fromCharCode(update[i]);
        }
        const b64 = btoa(binaryStr);

        this.sendEvent({
          type: 'crdt_sync',
          roomId: this.roomId,
          senderId: this.participantId,
          senderName: this.participantName,
          payload: { update: b64 },
          timestamp: Date.now(),
        });
      }

      onTextChange(this.ytext?.toString() || '');
    });

    return this.ydoc;
  }

  /**
   * Send live cursor coordinates
   */
  public sendCursor(lineNumber: number, column: number, color = '#ff9100') {
    this.sendEvent({
      type: 'cursor_update',
      roomId: this.roomId,
      senderId: this.participantId,
      senderName: this.participantName,
      payload: {
        participantId: this.participantId,
        name: this.participantName,
        color,
        lineNumber,
        column,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Send an event over WebSocket or POST fallback
   */
  public async sendEvent(event: Partial<ClassroomEventMessage>) {
    const fullMsg: ClassroomEventMessage = {
      type: event.type || 'presence',
      roomId: this.roomId,
      senderId: this.participantId,
      senderName: this.participantName,
      payload: event.payload,
      timestamp: Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(fullMsg));
      return;
    }

    // HTTP POST fallback
    try {
      await fetch(`/api/v1/classroom/${this.roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: fullMsg.type,
          participantId: this.participantId,
          ...fullMsg.payload,
        }),
      });
    } catch (e) {
      console.error('[CollabClient] fallback send error', e);
    }
  }

  public onEvent(callback: (event: ClassroomEventMessage) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public onCursor(callback: (cursor: LiveCursor) => void): () => void {
    this.cursorListeners.add(callback);
    return () => this.cursorListeners.delete(callback);
  }

  public cleanup() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
    if (this.ydoc) {
      this.ydoc.destroy();
      this.ydoc = null;
    }
  }
}
