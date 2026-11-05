import {
  ProtocolEnvelope,
  PROTOCOL_VERSION,
  JoinClassroomPayload,
  JoinAcceptedPayload,
  ClassroomEventPayload,
  ProtocolErrorPayload,
} from '@/types/realtime';
import { UserRole } from '@/types/classroom';

export type ClientConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type MessageHandler = (envelope: ProtocolEnvelope) => void;
export type ConnectionStateChangeHandler = (state: ClientConnectionState) => void;
export type ErrorHandler = (error: { code: string; message: string }) => void;

export interface WebSocketClientOptions {
  url?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
  heartbeatIntervalMs?: number;
}

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private state: ClientConnectionState = 'disconnected';
  private autoReconnect: boolean;
  private maxReconnectAttempts: number;
  private initialReconnectDelayMs: number;
  private maxReconnectDelayMs: number;
  private heartbeatIntervalMs: number;

  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private isExplicitlyClosed = false;

  // Registered listeners
  private messageListeners = new Set<MessageHandler>();
  private stateListeners = new Set<ConnectionStateChangeHandler>();
  private errorListeners = new Set<ErrorHandler>();

  // Active session context after joining
  private activeSessionId: string | null = null;
  private activeRole: UserRole | null = null;
  private activeParticipantId: string | null = null;
  private activeParticipantName: string | null = null;

  constructor(options: WebSocketClientOptions = {}) {
    this.url = options.url || this.resolveDefaultUrl();
    this.autoReconnect = options.autoReconnect ?? true;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
    this.initialReconnectDelayMs = options.initialReconnectDelayMs ?? 800;
    this.maxReconnectDelayMs = options.maxReconnectDelayMs ?? 10000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 25000;
  }

  private resolveDefaultUrl(): string {
    if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_WS_URL) {
      return process.env.NEXT_PUBLIC_WS_URL;
    }
    if (typeof window !== 'undefined' && (window as any).__CORTEX_WS_URL__) {
      return (window as any).__CORTEX_WS_URL__;
    }
    if (typeof window !== 'undefined' && window.location) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      if (isLocal) {
        return `${protocol}//${window.location.hostname}:3002`;
      }
      return `${protocol}//${window.location.host}/api/v1/classrooms/default/ws`;
    }
    return 'ws://localhost:3002';
  }

  public getState(): ClientConnectionState {
    return this.state;
  }

  public getParticipantId(): string | null {
    return this.activeParticipantId;
  }

  public getRole(): UserRole | null {
    return this.activeRole;
  }

  public getSessionId(): string | null {
    return this.activeSessionId;
  }

  public setUrl(url: string) {
    this.url = url;
  }

  public connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      this.cleanupSocket();
      this.ws = new WebSocket(this.url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (err) {
      this.handleClose();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.clearTimers();
    this.cleanupSocket();
    this.reconnectAttempts = 0;
    this.setState('disconnected');
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.setState('connected');
    this.startHeartbeat();

    // Auto-rejoin session if reconnected and active session context was previously established
    if (this.activeSessionId && this.activeRole && this.activeParticipantName) {
      this.joinClassroom(this.activeSessionId, {
        requestedRole: this.activeRole,
        participantName: this.activeParticipantName,
      });
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== 'string') return;

    let envelope: ProtocolEnvelope;
    try {
      envelope = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!envelope || typeof envelope !== 'object' || !envelope.type) {
      return;
    }

    // Process internal protocol events
    if (envelope.type === 'SERVER_HELLO') {
      // Handshake established
    } else if (envelope.type === 'JOIN_ACCEPTED') {
      const payload = envelope.payload as JoinAcceptedPayload;
      if (payload) {
        this.activeParticipantId = payload.assignedParticipantId;
        this.activeRole = payload.assignedRole;
        this.activeSessionId = payload.sessionId;
      }
    } else if (envelope.type === 'JOIN_REJECTED') {
      this.notifyError({
        code: envelope.payload?.code || 'JOIN_REJECTED',
        message: envelope.payload?.reason || 'Failed to join classroom',
      });
    } else if (envelope.type === 'PROTOCOL_ERROR') {
      const payload = envelope.payload as ProtocolErrorPayload;
      this.notifyError({
        code: payload?.code || 'PROTOCOL_ERROR',
        message: payload?.message || 'Server returned protocol error',
      });
    } else if (envelope.type === 'PONG') {
      // Heartbeat acknowledged
    }

    // Forward envelope to application subscribers
    this.messageListeners.forEach((listener) => {
      try {
        listener(envelope);
      } catch (err) {
        console.error('[WebSocketClient] Listener error:', err);
      }
    });
  }

  private handleClose(): void {
    this.cleanupSocket();
    this.clearTimers();

    if (this.isExplicitlyClosed) {
      this.setState('disconnected');
      return;
    }

    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.setState('reconnecting');
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
    }
  }

  private handleError(): void {
    this.notifyError({
      code: 'CONNECTION_ERROR',
      message: 'WebSocket connection encountered an error',
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;
    // Exponential backoff with ±20% jitter
    const baseDelay = Math.min(
      this.initialReconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxReconnectDelayMs
    );
    const jitter = baseDelay * (Math.random() * 0.4 - 0.2);
    const delay = Math.round(baseDelay + jitter);

    this.reconnectTimer = setTimeout(() => {
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          version: PROTOCOL_VERSION,
          messageId: `ping-${Date.now()}`,
          type: 'PING',
          sessionId: this.activeSessionId || 'system',
          timestamp: Date.now(),
          payload: { echo: Date.now() },
        });
      }
    }, this.heartbeatIntervalMs);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private cleanupSocket(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch (_) {}
      this.ws = null;
    }
  }

  private setState(nextState: ClientConnectionState): void {
    if (this.state === nextState) return;
    this.state = nextState;
    this.stateListeners.forEach((listener) => {
      try {
        listener(nextState);
      } catch (err) {
        console.error('[WebSocketClient] State listener error:', err);
      }
    });
  }

  private notifyError(error: { code: string; message: string }): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error('[WebSocketClient] Error listener error:', err);
      }
    });
  }

  // --- High-Level Application Operations ---

  public joinClassroom(sessionId: string, payload: JoinClassroomPayload): boolean {
    this.activeSessionId = sessionId;
    this.activeRole = payload.requestedRole;
    this.activeParticipantName = payload.participantName;

    return this.send({
      version: PROTOCOL_VERSION,
      messageId: `join-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'JOIN_CLASSROOM',
      sessionId,
      timestamp: Date.now(),
      payload,
    });
  }

  public emitClassroomEvent(
    arg1: string,
    arg2?: any,
    arg3?: any,
    arg4?: boolean
  ): boolean {
    let targetSessionId: string;
    let eventName: string;
    let data: any;
    let requiresTeacher: boolean;

    if (typeof arg2 === 'string') {
      // Called with (sessionId, eventName, data, requiresTeacher)
      targetSessionId = arg1;
      eventName = arg2;
      data = arg3;
      requiresTeacher = Boolean(arg4);
    } else {
      // Called with (eventName, data, requiresTeacher, overrideSessionId)
      targetSessionId = (typeof arg4 === 'string' ? arg4 : this.activeSessionId) || '';
      eventName = arg1;
      data = arg2;
      requiresTeacher = Boolean(arg3);
    }

    return this.send({
      version: PROTOCOL_VERSION,
      messageId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'CLASSROOM_EVENT',
      sessionId: targetSessionId,
      timestamp: Date.now(),
      payload: {
        eventName,
        data,
        requiresTeacher,
      } as ClassroomEventPayload,
    });
  }

  public send(envelope: ProtocolEnvelope): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(envelope));
      return true;
    } catch {
      return false;
    }
  }

  // --- Event Subscriptions ---

  public onMessage(handler: MessageHandler): () => void {
    this.messageListeners.add(handler);
    return () => this.messageListeners.delete(handler);
  }

  public onStateChange(handler: ConnectionStateChangeHandler): () => void {
    this.stateListeners.add(handler);
    return () => this.stateListeners.delete(handler);
  }

  public onError(handler: ErrorHandler): () => void {
    this.errorListeners.add(handler);
    return () => this.errorListeners.delete(handler);
  }

  public clearAllListeners(): void {
    this.messageListeners.clear();
    this.stateListeners.clear();
    this.errorListeners.clear();
  }
}
