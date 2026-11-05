declare module '*/signalingServer.mjs' {
  export const PROTOCOL_VERSION: string;
  export const DEFAULT_PORT: number;
  export const DEFAULT_HOST: string;
  export const DEFAULT_MAX_PAYLOAD: number;
  export const DEFAULT_RATE_LIMIT_MAX: number;

  export function isOriginAllowed(origin?: string, customAllowlist?: string[] | null): boolean;
  export function validateEnvelope(envelope: any): {
    valid: boolean;
    code?: string;
    message?: string;
  };
  export function createSignalingServer(options?: {
    port?: number;
    host?: string;
    maxPayload?: number;
    rateLimitMax?: number;
    allowedOrigins?: string[];
    teacherKey?: string;
  }): {
    start: () => Promise<{ port: number; host: string; httpServer: any; wss: any }>;
    stop: () => Promise<void>;
    httpServer: any;
    wss: any;
    sessions: Map<string, Set<any>>;
  };
}

declare module 'ws' {
  export class WebSocket {
    static OPEN: number;
    static CLOSED: number;
    static CLOSING: number;
    static CONNECTING: number;
    readyState: number;
    constructor(address: string, protocols?: string | string[]);
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, data?: string): void;
    terminate(): void;
    ping(): void;
  }
  export class WebSocketServer {
    clients: Set<WebSocket>;
    constructor(options?: any);
    on(event: string, listener: (...args: any[]) => void): this;
    close(cb?: (err?: Error) => void): void;
  }
}
