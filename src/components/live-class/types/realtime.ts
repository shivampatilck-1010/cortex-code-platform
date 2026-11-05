import { ClassroomModule, UserRole } from './classroom';

export interface TeacherActivityContext {
  module: ClassroomModule;
  subLocation?: string; // e.g. "binary_search.cpp" or "Slide 3: Hash Ring Distribution"
  title: string;
  viewport?: {
    scrollX: number;
    scrollY: number;
    zoom: number;
  };
  cursorPosition?: {
    line?: number;
    column?: number;
    canvasX?: number;
    canvasY?: number;
    slideIndex?: number;
    laserX?: number;
    laserY?: number;
    laserActive?: boolean;
  };
  timestamp: number;
}

export type FollowMode = 'following' | 'independent';

export interface FollowTeacherState {
  mode: FollowMode;
  teacherActivity: TeacherActivityContext;
  hasUnfollowedChanges: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  timestamp: number;
  isAnnouncement?: boolean;
}

export type RealtimeEvent =
  | { type: 'TEACHER_SURFACE_BROADCAST'; payload: TeacherActivityContext }
  | { type: 'FOLLOW_MODE_CHANGED'; payload: { studentId: string; mode: FollowMode } }
  | { type: 'HAND_RAISED'; payload: { participantId: string; isRaised: boolean } }
  | { type: 'PARTICIPANT_MEDIA_CHANGED'; payload: { participantId: string; isMuted: boolean; isVideoOff: boolean } }
  | { type: 'CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'PERMISSIONS_UPDATED'; payload: Record<string, boolean> }
  | { type: 'TEACHER_MUTE_STUDENT'; payload: { targetStudentId: string } }
  | { type: 'TEACHER_STOP_CAMERA'; payload: { targetStudentId: string } }
  | { type: 'TEACHER_REQUEST_UNMUTE'; payload: { targetStudentId: string } }
  | { type: 'TEACHER_REQUEST_CAMERA'; payload: { targetStudentId: string } }
  | { type: 'TEACHER_MUTE_ALL' }
  | { type: 'TEACHER_STOP_ALL_CAMERAS' }
  | { type: 'MEDIA_REQUEST_RESPONSE'; payload: { targetStudentId: string; type: 'unmute' | 'camera'; accepted: boolean } };

// --- Step 1: WebSocket Signaling Foundation Protocol ---

export const PROTOCOL_VERSION = '1.0';

export type SignalingMessageType =
  | 'CLIENT_HELLO'
  | 'SERVER_HELLO'
  | 'JOIN_CLASSROOM'
  | 'JOIN_ACCEPTED'
  | 'JOIN_REJECTED'
  | 'PARTICIPANT_JOINED'
  | 'PARTICIPANT_LEFT'
  | 'PING'
  | 'PONG'
  | 'CLASSROOM_EVENT'
  | 'PROTOCOL_ERROR';

export interface ProtocolEnvelope<T = any> {
  version: string;
  messageId: string;
  type: SignalingMessageType;
  sessionId: string;
  senderId?: string;
  senderRole?: UserRole;
  timestamp: number;
  payload: T;
}

export interface JoinClassroomPayload {
  requestedRole: UserRole;
  participantName: string;
  joinToken?: string;
}

export interface ActiveParticipantSummary {
  id: string;
  name: string;
  role: UserRole;
  connectedAt: number;
}

export interface JoinAcceptedPayload {
  assignedParticipantId: string;
  assignedRole: UserRole;
  sessionId: string;
  sessionTitle: string;
  courseCode: string;
  activeParticipants: ActiveParticipantSummary[];
}

export interface JoinRejectedPayload {
  reason: string;
  code: string;
}

export interface ParticipantJoinedPayload {
  participant: ActiveParticipantSummary;
}

export interface ParticipantLeftPayload {
  participantId: string;
  reason?: string;
}

export interface ClassroomEventPayload {
  eventName: string;
  data: any;
  requiresTeacher?: boolean;
}

export interface ProtocolErrorPayload {
  code:
    | 'MALFORMED_JSON'
    | 'INVALID_ENVELOPE'
    | 'UNKNOWN_TYPE'
    | 'UNAUTHORIZED'
    | 'RATE_LIMITED'
    | 'PAYLOAD_TOO_LARGE'
    | 'NOT_JOINED'
    | 'INVALID_SESSION';
  message: string;
  referenceMessageId?: string;
}
