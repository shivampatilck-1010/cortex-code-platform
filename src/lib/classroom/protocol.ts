import { ClassroomEventMessage } from './types';

export type ClassroomEventType =
  | 'classroom.updated'
  | 'classroom.archived'
  | 'classroom.deleted'
  | 'classroom.code_regenerated'
  | 'student.joined'
  | 'student.left'
  | 'student.removed'
  | 'student.presence.updated'
  | 'announcement.created'
  | 'announcement.updated'
  | 'announcement.deleted'
  | 'message.created'
  | 'message.deleted'
  | 'assignment.created'
  | 'assignment.updated'
  | 'assignment.published'
  | 'submission.created'
  | 'submission.started'
  | 'submission.running'
  | 'submission.completed'
  | 'submission.failed'
  | 'grade.created'
  | 'grade.updated'
  | 'feedback.created'
  | 'notification.created'
  | 'session.started'
  | 'session.ended'
  | 'code.shared'
  | 'code.updated'
  | 'session.created'
  | 'session.updated'
  | 'teacher.code.snapshot'
  | 'classroom.snapshot'
  | 'teacher.code.changed'
  | 'teacher.file.created'
  | 'teacher.file.updated'
  | 'teacher.file.deleted'
  | 'teacher.cursor.updated'
  | 'teacher.output.created'
  | 'student.follow_teacher'
  | 'student.unfollow_teacher'
  | 'student.code.shared'
  | 'student.code_share.revoked'
  | 'question.created'
  | 'question.answered'
  | 'question.pinned'
  | 'workspace.broadcast.start'
  | 'workspace.broadcast.pause'
  | 'workspace.broadcast.resume'
  | 'workspace.broadcast.stop'
  | 'workspace.broadcast.code'
  | 'workspace.broadcast.output'
  | 'workspace.observe.subscribe'
  | 'workspace.observe.unsubscribe'
  | 'workspace.student.update'
  | 'workspace.state.query';

export interface ClassroomRealtimeEvent {
  id: string;
  classroomId: string;
  sequence: number;
  type: ClassroomEventType | string;
  actorId: string;
  actorName: string;
  timestamp: number;
  payload: any;
}

export type RealtimeMessageType =
  | 'auth'
  | 'auth_ok'
  | 'auth_failed'
  | 'event'
  | 'ack'
  | 'resync_request'
  | 'resync_response'
  | 'ping'
  | 'pong'
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
  | 'start_classroom'
  | 'arena_started'
  | 'classroom_ended'
  | 'error'
  // WebRTC Signaling
  | 'webrtc_offer'
  | 'webrtc_answer'
  | 'webrtc_ice_candidate'
  | 'WEBRTC_OFFER'
  | 'WEBRTC_ANSWER'
  | 'WEBRTC_ICE_CANDIDATE'
  // Session Hydration
  | 'SESSION_HYDRATION_SNAPSHOT'
  // Monaco CRDT
  | 'MONACO_CRDT_UPDATE'
  | 'MONACO_AWARENESS_UPDATE'
  | 'TEACHER_EDITOR_VIEWPORT'
  // Whiteboard Streaming
  | 'WHITEBOARD_STROKE_START'
  | 'WHITEBOARD_STROKE_POINT'
  | 'WHITEBOARD_STROKE_END'
  | 'WHITEBOARD_ELEMENT_DELTA'
  | 'WHITEBOARD_SNAPSHOT';

// ---------------------------------------------------------------------------
// WebRTC Signaling Envelopes and Types (Milestone 1 / Milestone 3)
// ---------------------------------------------------------------------------

export interface RTCIceCandidateInitLike {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface WebRTCOfferPayload {
  targetUserId: string;
  sdp: string;
  type: 'offer';
  senderId?: string;
}

export interface WebRTCAnswerPayload {
  targetUserId: string;
  sdp: string;
  type: 'answer';
  senderId?: string;
}

export interface WebRTCIceCandidatePayload {
  targetUserId: string;
  candidate: RTCIceCandidateInitLike;
  senderId?: string;
}

// ---------------------------------------------------------------------------
// Monaco Editor CRDT Envelopes and Types (Milestone 1 / Milestone 5)
// ---------------------------------------------------------------------------

export interface MonacoCrdtUpdatePayload {
  fileId: string;
  update: string; // Base64 encoded Uint8Array
  senderId?: string;
}

export interface MonacoAwarenessUpdatePayload {
  fileId: string;
  awarenessData: string; // Base64 encoded Uint8Array
  senderId?: string;
}

export interface TeacherEditorViewportPayload {
  fileId: string;
  lineNumber: number;
  column: number;
  scrollTop?: number;
  senderId?: string;
}

// ---------------------------------------------------------------------------
// Vector Whiteboard Delta Streaming Types (Milestone 1 / Milestone 6)
// ---------------------------------------------------------------------------

export interface WhiteboardStrokeStartPayload {
  strokeId: string;
  tool: string;
  color: string;
  strokeWidth: number;
  strokeDash?: number[];
  startPoint: { x: number; y: number };
  pageIndex: number;
  senderId?: string;
}

export interface WhiteboardStrokePointPayload {
  strokeId: string;
  points: Array<{ x: number; y: number; pressure?: number }>;
  pageIndex: number;
}

export interface WhiteboardStrokeEndPayload {
  strokeId: string;
  element: any; // WhiteboardElement
  pageIndex: number;
}

export interface WhiteboardElementDeltaPayload {
  action: 'UPDATE' | 'DELETE';
  elementId?: string;
  elementIds?: string[];
  patch?: Record<string, any>;
  pageIndex: number;
}

export interface WhiteboardSnapshotPayload {
  version: number;
  activePageIndex: number;
  pages: any[]; // WhiteboardPage[]
}

// ---------------------------------------------------------------------------
// Atomic Session State Hydration Snapshot (Milestone 1)
// ---------------------------------------------------------------------------

export interface ParticipantAVPresence {
  userId: string;
  name: string;
  role: 'teacher' | 'student' | 'admin' | string;
  connectedAt: number;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  currentModule: string;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
}

export interface SessionHydrationSnapshotPayload {
  sessionId: string;
  sequence: number;
  timestamp: number;

  code: {
    broadcastState: 'stopped' | 'broadcasting' | 'paused';
    activeFileId: string;
    files: Array<{
      id: string;
      name: string;
      language: string;
      content: string;
      isReadOnly?: boolean;
    }>;
    output: any | null;
    yjsDocs?: Array<{
      fileId: string;
      stateVector: string; // Base64 encoded Uint8Array
      update: string; // Base64 encoded Uint8Array
    }>;
  };

  whiteboard: {
    version: number;
    activePageIndex: number;
    activePageId?: string;
    pages: any[];
  };

  presentation: {
    isPresenting: boolean;
    activeSlideIndex: number;
    slideId?: string;
    laserActive: boolean;
    laserPos?: { x: number; y: number };
  };

  presence: {
    activeParticipants: ParticipantAVPresence[];
  };

  permissions: {
    allowStudentMicrophone: boolean;
    allowStudentCamera: boolean;
    allowStudentScreenShare: boolean;
    allowStudentChat: boolean;
    allowIndependentMode: boolean;
  };
}

export interface RealtimeMessage {
  type: RealtimeMessageType;
  roomId?: string;
  classroomId?: string;
  sequence?: number;
  eventId?: string;
  workspaceId?: string;
  documentId?: string;
  clientId?: string;
  senderId?: string;
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
    if (typeof obj.type !== 'string') return null;

    const roomId = obj.classroomId || obj.roomId ? String(obj.classroomId || obj.roomId).toUpperCase().trim() : undefined;

    return {
      type: obj.type as RealtimeMessageType,
      roomId: roomId,
      classroomId: roomId,
      sequence: typeof obj.sequence === 'number' ? obj.sequence : undefined,
      eventId: obj.eventId || obj.id,
      workspaceId: obj.workspaceId ? String(obj.workspaceId) : undefined,
      documentId: obj.documentId ? String(obj.documentId) : undefined,
      clientId: String(obj.clientId || obj.senderId || obj.userId || 'unknown'),
      senderId: String(obj.senderId || obj.clientId || obj.userId || 'unknown'),
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
    roomId: msg.roomId || msg.classroomId || '',
    senderId: msg.clientId || msg.senderId || 'unknown',
    senderName: msg.senderName,
    payload: {
      ...msg.payload,
      documentId: msg.documentId,
      workspaceId: msg.workspaceId,
      operationId: msg.operationId,
      sequence: msg.sequence,
      eventId: msg.eventId,
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
