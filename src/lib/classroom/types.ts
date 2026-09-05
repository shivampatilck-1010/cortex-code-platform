import { ProjectFile } from '@/lib/execution/types';

export type ClassroomRole = 'admin' | 'user';

export type ParticipantActivityStatus = 'coding' | 'testing' | 'idle' | 'offline';

export interface UserPrivacySettings {
  workspaceVisibility: 'private' | 'public';
  allowCollaboration: boolean;
  requireDownloadPermission: boolean;
}

export interface ClassroomParticipant {
  id: string;
  name: string;
  role: ClassroomRole;
  online: boolean;
  status: ParticipantActivityStatus;
  currentLanguage: string;
  activeFileName: string;
  lastActive: number;
  isLocked: boolean;
  canRun: boolean;
  privacy: UserPrivacySettings;
  files: ProjectFile[];
  activeCode: string;
}

export interface CollaborationSession {
  id: string;
  participantIds: [string, string];
  mode: 'independent' | 'shared';
  sharedDocId: string;
  sharedCode: string;
  createdAt: number;
  lastSynced: number;
}

export type CollaborationDecision = 'accepted' | 'declined';

export interface CollaborationRequest {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

export type FileDownloadDecision = 'allow_once' | 'allow_session' | 'denied';

export interface FileDownloadRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  ownerId: string;
  ownerName: string;
  fileId: string;
  fileName: string;
  status: 'pending' | 'allow_once' | 'allow_session' | 'denied';
  token?: string;
  createdAt: number;
}

export interface FileDownloadPermission {
  token: string;
  fileId: string;
  fileName: string;
  requesterId: string;
  ownerId: string;
  type: 'allow_once' | 'allow_session';
  consumed: boolean;
  grantedAt: number;
  expiresAt: number;
}

export interface WorkspaceViewRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  targetId: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: number;
}

export interface ClassroomSettings {
  maxUsers: number;
  collaborationEnabled: boolean;
  userToUserCollaboration: boolean;
  codeExecutionEnabled: boolean;
  fileDownloadsAllowed: boolean;
  chatEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  role: ClassroomRole;
  text: string;
  timestamp: number;
  isAnnouncement?: boolean;
}

export interface LiveCursor {
  participantId: string;
  name: string;
  color: string;
  lineNumber: number;
  column: number;
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface ClassroomRoom {
  roomId: string;
  admin: {
    id: string;
    name: string;
  };
  participants: Record<string, ClassroomParticipant>;
  settings: ClassroomSettings;
  activeWorkspaces: {
    slotAUserId?: string;
    slotBUserId?: string;
  };
  collaborationSessions: Record<string, CollaborationSession>;
  collaborationRequests: Record<string, CollaborationRequest>;
  downloadRequests: Record<string, FileDownloadRequest>;
  downloadPermissions: Record<string, FileDownloadPermission>;
  viewRequests: Record<string, WorkspaceViewRequest>;
  chatMessages: ChatMessage[];
  state: 'created' | 'active' | 'ended';
  createdAt: number;
}

// WebSocket / Event transport protocol
export type ClassroomEventType =
  | 'room_state'
  | 'join'
  | 'leave'
  | 'presence'
  | 'user_updated'
  | 'code_update'
  | 'select_workspaces'
  | 'collaboration_request'
  | 'collaboration_response'
  | 'end_collaboration'
  | 'crdt_sync'
  | 'cursor_update'
  | 'file_download_request'
  | 'file_download_response'
  | 'file_share'
  | 'file_update'
  | 'admin_action'
  | 'chat_message'
  | 'classroom_ended';

export interface ClassroomEventMessage {
  type: ClassroomEventType;
  roomId: string;
  senderId: string;
  senderName?: string;
  payload: any;
  timestamp: number;
}
