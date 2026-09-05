import { ClassroomEventMessage } from './types';

export type RealtimeMessageType =
  | 'join'
  | 'leave'
  | 'presence'
  | 'room_state'
  | 'doc_sync_step1'
  | 'doc_sync_step2'
  | 'doc_update'
  | 'awareness_update'
  | 'cursor_update'
  | 'code_update'
  | 'select_workspaces'
  | 'collaboration_request'
  | 'collaboration_response'
  | 'end_collaboration'
  | 'file_download_request'
  | 'file_download_response'
  | 'admin_action'
  | 'chat_message'
  | 'classroom_started'
  | 'classroom_ended'
  | 'ping'
  | 'pong'
  | 'ack'
  | 'error';

export interface RealtimeMessage {
  type: RealtimeMessageType;
  roomId: string;
  workspaceId?: string;
  documentId?: string;
  clientId: string;
  senderName?: string;
  operationId?: string;
  payload?: any;
  timestamp: number;
}

/**
 * Validates and normalizes an incoming message
 */
export function parseRealtimeMessage(raw: any): RealtimeMessage | null {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.type !== 'string' || !obj.roomId) return null;

    return {
      type: obj.type as RealtimeMessageType,
      roomId: String(obj.roomId).toUpperCase().trim(),
      workspaceId: obj.workspaceId ? String(obj.workspaceId) : undefined,
      documentId: obj.documentId ? String(obj.documentId) : undefined,
      clientId: String(obj.clientId || obj.senderId || 'unknown'),
      senderName: obj.senderName ? String(obj.senderName) : undefined,
      operationId: obj.operationId ? String(obj.operationId) : undefined,
      payload: obj.payload ?? {},
      timestamp: typeof obj.timestamp === 'number' ? obj.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Serializes a RealtimeMessage to JSON string safely
 */
export function serializeRealtimeMessage(msg: RealtimeMessage): string {
  return JSON.stringify(msg);
}

/**
 * Bridge between ClassroomEventMessage and RealtimeMessage for backwards compatibility
 */
export function toClassroomEventMessage(msg: RealtimeMessage): ClassroomEventMessage {
  return {
    type: msg.type as any,
    roomId: msg.roomId,
    senderId: msg.clientId,
    senderName: msg.senderName,
    payload: {
      ...msg.payload,
      documentId: msg.documentId,
      workspaceId: msg.workspaceId,
      operationId: msg.operationId,
    },
    timestamp: msg.timestamp,
  };
}

/**
 * Base64 encoding and decoding for Yjs binary CRDT deltas across WebSocket/HTTP
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
