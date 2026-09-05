import * as Y from 'yjs';
import { ClassroomEventMessage, LiveCursor } from './types';

export type ConnectionStatus = 'online' | 'syncing' | 'offline';

export class CollaborationClient {
  private roomId: string;
  private participantId: string;
  private participantName: string;
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private listeners: Set<(event: ClassroomEventMessage) => void> = new Set();
  private cursorListeners: Set<(cursor: LiveCursor) => void> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  
  private isConnected = false;
  private currentStatus: ConnectionStatus = 'syncing';
  private wsAttemptFailed = false;
  private pollTimer: any = null;
  private isDestroyed = false;

  private ydoc: Y.Doc | null = null;
  private ytext: Y.Text | null = null;
  private isApplyingRemoteUpdate = false;

  constructor(roomId: string, participantId: string, participantName: string) {
    this.roomId = roomId.toUpperCase().trim();
    this.participantId = participantId;
    this.participantName = participantName;
    this.connect();
    this.startBackgroundHeartbeat();
  }

  public connect() {
    if (typeof window === 'undefined' || this.isDestroyed) return;

    // If WebSocket previously failed or closed with an error on this device/network, directly use robust SSE
    if (this.wsAttemptFailed) {
      this.connectSSE();
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/classroom/${this.roomId}/events?participantId=${this.participantId}`;

    let wsHandshakeTimeout: any = null;

    try {
      this.ws = new WebSocket(wsUrl);

      // Fast handshake timeout: if WS doesn't open within 2s, switch to SSE immediately
      wsHandshakeTimeout = setTimeout(() => {
        if (!this.isConnected && this.ws?.readyState !== WebSocket.OPEN) {
          this.wsAttemptFailed = true;
          try { this.ws?.close(); } catch {}
          this.ws = null;
          this.connectSSE();
        }
      }, 2000);

      this.ws.onopen = () => {
        if (wsHandshakeTimeout) clearTimeout(wsHandshakeTimeout);
        this.isConnected = true;
        this.setStatus('online');
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
        if (wsHandshakeTimeout) clearTimeout(wsHandshakeTimeout);
        if (!this.isConnected) {
          this.wsAttemptFailed = true;
          try { this.ws?.close(); } catch {}
          this.ws = null;
          this.connectSSE();
        }
      };

      this.ws.onclose = () => {
        if (wsHandshakeTimeout) clearTimeout(wsHandshakeTimeout);
        if (this.isDestroyed) return;
        this.isConnected = false;
        this.wsAttemptFailed = true;
        this.ws = null;
        // Fallback to SSE immediately without flapping
        this.connectSSE();
      };
    } catch {
      if (wsHandshakeTimeout) clearTimeout(wsHandshakeTimeout);
      this.wsAttemptFailed = true;
      this.connectSSE();
    }
  }

  private connectSSE() {
    if (typeof window === 'undefined' || this.isDestroyed || this.sse) return;

    try {
      const sseUrl = `/api/v1/classroom/${this.roomId}/events?participantId=${this.participantId}`;
      this.sse = new EventSource(sseUrl);

      this.sse.onopen = () => {
        this.isConnected = true;
        this.setStatus('online');
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
        // EventSource will automatically reconnect in the browser
        this.isConnected = false;
        this.setStatus('syncing');
      };
    } catch (err) {
      console.error('[CollabClient] SSE initialization failed', err);
      this.setStatus('syncing');
    }
  }

  /**
   * Resilient Background Polling Heartbeat
   * Ensures uninterrupted state sync even during transient drops, firewall restrictions, or edge disconnects
   */
  private startBackgroundHeartbeat() {
    if (typeof window === 'undefined' || this.isDestroyed) return;

    const poll = async () => {
      if (this.isDestroyed) return;
      try {
        const res = await fetch(`/api/v1/classroom/${this.roomId}?requesterId=${this.participantId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room) {
            this.handleIncoming({
              type: 'room_state',
              roomId: this.roomId,
              senderId: 'server',
              payload: { room: data.room },
              timestamp: Date.now(),
            });
            if (this.currentStatus === 'offline') {
              this.setStatus(this.isConnected ? 'online' : 'syncing');
            }
          }
        }
      } catch {
        if (!this.isConnected) {
          this.setStatus('offline');
        }
      }
    };

    // Heartbeat every 2.5 seconds
    this.pollTimer = setInterval(poll, 2500);
  }

  private handleIncoming(msg: ClassroomEventMessage) {
    // 1. CRDT synchronization updates
    if (msg.type === 'crdt_sync' && msg.senderId !== this.participantId) {
      if (this.ydoc && msg.payload?.update) {
        try {
          this.isApplyingRemoteUpdate = true;
          const binary = Uint8Array.from(atob(msg.payload.update), (c) => c.charCodeAt(0));
          Y.applyUpdate(this.ydoc, binary);
        } catch (e) {
          console.error('[CollabClient] CRDT update error', e);
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

  private setStatus(status: ConnectionStatus) {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.statusListeners.forEach((cb) => cb(status));
    this.emitStatus(status);
  }

  private emitStatus(status: ConnectionStatus) {
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

  public getStatus(): ConnectionStatus {
    return this.currentStatus;
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
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
      try {
        this.ws.send(JSON.stringify(fullMsg));
        return;
      } catch {}
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
    this.isDestroyed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    if (this.sse) {
      try { this.sse.close(); } catch {}
      this.sse = null;
    }
    if (this.ydoc) {
      try { this.ydoc.destroy(); } catch {}
      this.ydoc = null;
    }
  }
}
