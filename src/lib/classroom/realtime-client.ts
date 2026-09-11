'use client';

import {
  ClassroomEventType,
  ClassroomRealtimeEvent,
  RealtimeMessage,
  parseRealtimeMessage,
  serializeRealtimeMessage,
} from './protocol';

export type ConnectionState = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'DISCONNECTED';

export interface RealtimeClientOptions {
  classroomId: string;
  userId: string;
  userName: string;
  role?: string;
  onStateChange?: (state: ConnectionState) => void;
  onEvent?: (event: ClassroomRealtimeEvent) => void;
  autoConnect?: boolean;
}

export class ClassroomRealtimeClient {
  public readonly classroomId: string;
  public readonly userId: string;
  public readonly userName: string;
  public readonly role: string;

  private state: ConnectionState = 'DISCONNECTED';
  private ws: WebSocket | null = null;
  private isExplicitlyClosed: boolean = false;
  private simulatedOffline: boolean = false;

  // Sequences & Deduplication
  private lastReceivedSequence: number = 0;
  private seenEventIds: Set<string> = new Set();

  // Reconnection backoff
  private reconnectAttempt: number = 0;
  private reconnectTimer: any = null;
  private maxReconnectAttempts: number = 10;
  private baseReconnectDelay: number = 600; // ms
  private connectionGeneration: number = 0;

  // Heartbeat & Latency
  private heartbeatInterval: any = null;
  private pingSentTimestamp: number = 0;
  public latencyMs: number = 0;

  // Listeners
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private eventListeners: Map<string, Set<(event: ClassroomRealtimeEvent) => void>> = new Map();
  private allEventListeners: Set<(event: ClassroomRealtimeEvent) => void> = new Set();

  constructor(options: RealtimeClientOptions) {
    this.classroomId = options.classroomId.toUpperCase().trim();
    this.userId = options.userId;
    this.userName = options.userName;
    this.role = options.role || 'student';

    if (options.onStateChange) {
      this.stateListeners.add(options.onStateChange);
    }
    if (options.onEvent) {
      this.allEventListeners.add(options.onEvent);
    }

    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getLastSequence(): number {
    return this.lastReceivedSequence;
  }

  public onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  public on(eventType: ClassroomEventType | string, handler: (event: ClassroomRealtimeEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    const set = this.eventListeners.get(eventType)!;
    set.add(handler);
    return () => set.delete(handler);
  }

  public onAny(handler: (event: ClassroomRealtimeEvent) => void): () => void {
    this.allEventListeners.add(handler);
    return () => this.allEventListeners.delete(handler);
  }

  private setState(newState: ConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach((l) => {
      try { l(newState); } catch (e) { console.error('State listener error', e); }
    });
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.simulatedOffline) return;

    // A second connect while a socket is opening/open used to replace the
    // socket without closing the first one. That produced duplicate events,
    // competing reconnect timers, and a visibly unstable connection badge.
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.clearTimers();
    const generation = ++this.connectionGeneration;

    const isReconnecting = this.reconnectAttempt > 0;
    this.setState(isReconnecting ? 'RECONNECTING' : 'CONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Production identity is derived server-side from the signed session cookie.
    // The development-only identity hint keeps the local, no-login prototype
    // usable without weakening the production trust boundary.
    const developmentHint = process.env.NODE_ENV !== 'production'
      ? `?userId=${encodeURIComponent(this.userId)}`
      : '';
    const wsUrl = `${protocol}//${host}/api/v1/classrooms/${this.classroomId}/ws${developmentHint}`;

    try {
      this.ws = new WebSocket(wsUrl);
      const socket = this.ws;

      const connTimeout = setTimeout(() => {
        if (generation === this.connectionGeneration && this.state === 'CONNECTING' && socket.readyState !== WebSocket.OPEN) {
          this.ws = null;
          try { socket.close(); } catch {}
          this.handleDisconnect();
        }
      }, 4000);

      this.ws.onopen = () => {
        if (generation !== this.connectionGeneration || socket !== this.ws) {
          socket.close();
          return;
        }
        clearTimeout(connTimeout);
        this.reconnectAttempt = 0;
        this.setState('CONNECTED');

        // Send auth handshake
        this.sendRaw({
          type: 'auth',
          classroomId: this.classroomId,
          clientId: this.userId,
          senderName: this.userName,
          sequence: this.lastReceivedSequence,
          payload: {
            role: this.role,
            lastReceivedSequence: this.lastReceivedSequence,
          },
          timestamp: Date.now(),
        });

        // If we had a prior sequence, request resync to catch up on any missed events
        if (this.lastReceivedSequence > 0) {
          this.requestResync(this.lastReceivedSequence);
        }

        this.startHeartbeat();
      };

      this.ws.onmessage = (msgEvent) => {
        if (generation !== this.connectionGeneration || socket !== this.ws) return;
        this.handleMessage(msgEvent.data);
      };

      this.ws.onerror = (err) => {
        clearTimeout(connTimeout);
        // Error will trigger onclose
      };

      this.ws.onclose = () => {
        clearTimeout(connTimeout);
        if (generation !== this.connectionGeneration || socket !== this.ws) return;
        this.ws = null;
        this.handleDisconnect();
      };
    } catch {
      this.handleDisconnect();
    }
  }

  private handleDisconnect() {
    this.clearHeartbeat();
    if (this.isExplicitlyClosed || this.simulatedOffline) {
      this.setState('DISCONNECTED');
      return;
    }

    this.setState('RECONNECTING');
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempt += 1;
    if (this.reconnectAttempt > this.maxReconnectAttempts) {
      this.setState('DISCONNECTED');
      return;
    }
    // Exponential backoff with random jitter (cap at 8s)
    const delay = Math.min(8000, this.baseReconnectDelay * Math.pow(1.5, Math.min(this.reconnectAttempt, 5)) + Math.random() * 300);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingSentTimestamp = Date.now();
        this.sendRaw({
          type: 'ping',
          classroomId: this.classroomId,
          clientId: this.userId,
          timestamp: this.pingSentTimestamp,
        });
      }
    }, 15000);
  }

  private clearHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private clearTimers() {
    this.clearHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private handleMessage(rawData: any) {
    const msg = parseRealtimeMessage(rawData);
    if (!msg) return;

    switch (msg.type) {
      case 'pong': {
        if (this.pingSentTimestamp > 0) {
          this.latencyMs = Math.max(1, Date.now() - this.pingSentTimestamp);
        }
        break;
      }

      case 'auth_ok': {
        if (typeof msg.sequence === 'number' && msg.sequence > this.lastReceivedSequence) {
          this.lastReceivedSequence = msg.sequence;
        }
        break;
      }

      case 'error': {
        console.warn('[RealtimeClient] Server error event received:', msg.payload);
        const errEvent: ClassroomRealtimeEvent = {
          id: `err_${Date.now()}`,
          classroomId: this.classroomId,
          sequence: this.lastReceivedSequence,
          type: 'client.error',
          actorId: 'server',
          actorName: 'System',
          timestamp: Date.now(),
          payload: msg.payload,
        };
        this.processEvent(errEvent);
        break;
      }

      case 'resync_response': {
        if (msg.payload?.isFullSnapshot) {
          // Authoritative full state snapshot received (buffer overflow or cold start)
          if (typeof msg.sequence === 'number') {
            this.lastReceivedSequence = msg.sequence;
          }
          const snapshotEvent: ClassroomRealtimeEvent = {
            id: `snap_${Date.now()}_${msg.sequence || 0}`,
            classroomId: this.classroomId,
            sequence: msg.sequence || this.lastReceivedSequence,
            type: 'classroom.snapshot',
            actorId: 'server',
            actorName: 'Authoritative Store',
            timestamp: Date.now(),
            payload: msg.payload?.snapshot || {},
          };
          this.processEvent(snapshotEvent);
        }

        const events: ClassroomRealtimeEvent[] = msg.payload?.events || [];
        // Replay missed events in sequence order
        events.sort((a, b) => a.sequence - b.sequence);
        for (const evt of events) {
          this.processEvent(evt);
        }
        break;
      }

      case 'event': {
        const event: ClassroomRealtimeEvent = msg.payload?.event;
        if (event) {
          this.processEvent(event);
        }
        break;
      }

      default: {
        // Handle direct event types if passed at root
        if (msg.payload && typeof msg.type === 'string' && msg.type.includes('.')) {
          this.processEvent({
            id: msg.eventId || `evt_${Date.now()}_${msg.sequence || 0}`,
            classroomId: this.classroomId,
            sequence: msg.sequence || this.lastReceivedSequence + 1,
            type: msg.type,
            actorId: msg.senderId || msg.clientId || 'system',
            actorName: msg.senderName || 'User',
            timestamp: msg.timestamp,
            payload: msg.payload,
          });
        }
        break;
      }
    }
  }

  private processEvent(event: ClassroomRealtimeEvent) {
    // 1. Duplicate-event protection
    if (event.id && this.seenEventIds.has(event.id)) {
      return;
    }
    if (event.id) {
      this.seenEventIds.add(event.id);
      // Keep set bounded
      if (this.seenEventIds.size > 2000) {
        const first = this.seenEventIds.values().next().value;
        if (first) this.seenEventIds.delete(first);
      }
    }

    // 2. Monotonic sequence tracking & Gap detection
    if (typeof event.sequence === 'number') {
      if (this.lastReceivedSequence > 0 && event.sequence > this.lastReceivedSequence + 1) {
        // Gap detected: missed one or more intermediate events!
        console.warn(`[RealtimeClient] Gap detected: last=${this.lastReceivedSequence}, incoming=${event.sequence}. Triggering catch-up resync.`);
        this.requestResync(this.lastReceivedSequence);
      }
      if (event.sequence > this.lastReceivedSequence) {
        this.lastReceivedSequence = event.sequence;
      }
    }

    // 3. Dispatch to type-specific handlers
    const specificHandlers = this.eventListeners.get(event.type);
    if (specificHandlers) {
      specificHandlers.forEach((handler) => {
        try { handler(event); } catch (err) { console.error('Event handler error', err); }
      });
    }

    // 4. Dispatch to global handlers
    this.allEventListeners.forEach((handler) => {
      try { handler(event); } catch (err) { console.error('Global event handler error', err); }
    });
  }

  public requestResync(sinceSequence?: number) {
    const seq = sinceSequence ?? this.lastReceivedSequence;
    this.sendRaw({
      type: 'resync_request',
      classroomId: this.classroomId,
      clientId: this.userId,
      sequence: seq,
      payload: { sinceSequence: seq },
      timestamp: Date.now(),
    });
  }

  public sendEvent(eventType: ClassroomEventType | string, payload: any = {}) {
    const eventId = `evt_client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.seenEventIds.add(eventId);

    this.sendRaw({
      type: 'event',
      classroomId: this.classroomId,
      clientId: this.userId,
      senderName: this.userName,
      payload: {
        event: {
          id: eventId,
          classroomId: this.classroomId,
          type: eventType,
          payload,
          actorId: this.userId,
          actorName: this.userName,
          timestamp: Date.now(),
        },
      },
      timestamp: Date.now(),
    });
  }

  public sendMessage(content: string) {
    this.sendEvent('message.created', {
      message: {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        classroomId: this.classroomId,
        senderId: this.userId,
        senderName: this.userName,
        senderRole: this.role,
        recipientType: 'all',
        content,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    });
  }

  public sendPresence(isOnline: boolean) {
    this.sendEvent('student.presence.updated', {
      userId: this.userId,
      userName: this.userName,
      isOnline,
    });
  }

  private sendRaw(msg: RealtimeMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(serializeRealtimeMessage(msg));
      } catch (err) {
        console.error('Failed to send raw message', err);
      }
    }
  }

  /**
   * For testing disconnect and automatic reconnection / resynchronization
   */
  public simulateNetworkDisconnect() {
    this.simulatedOffline = true;
    this.clearTimers();
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.setState('DISCONNECTED');
  }

  public restoreNetworkConnection() {
    this.simulatedOffline = false;
    this.reconnectAttempt = 1; // Trigger reconnect logic
    this.connect();
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.connectionGeneration += 1;
    this.clearTimers();
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.setState('DISCONNECTED');
  }
}
