import {
  ClassroomRoom,
  ClassroomParticipant,
  ClassroomSettings,
  CollaborationSession,
  CollaborationRequest,
  CollaborationDecision,
  FileDownloadRequest,
  FileDownloadDecision,
  FileDownloadPermission,
  ClassroomEventMessage,
  ChatMessage,
  ClassroomRole
} from './types';
import { ProjectFile } from '@/lib/execution/types';

// Global singleton registry
declare global {
  var __cortex_classroom_rooms: Map<string, ClassroomRoom> | undefined;
  var __cortex_classroom_listeners: Map<string, Set<(event: ClassroomEventMessage) => void>> | undefined;
}

if (!globalThis.__cortex_classroom_rooms) {
  globalThis.__cortex_classroom_rooms = new Map();
}
if (!globalThis.__cortex_classroom_listeners) {
  globalThis.__cortex_classroom_listeners = new Map();
}

const rooms = globalThis.__cortex_classroom_rooms;
const listeners = globalThis.__cortex_classroom_listeners;

const DEFAULT_SETTINGS: ClassroomSettings = {
  maxUsers: 100,
  collaborationEnabled: true,
  userToUserCollaboration: true,
  codeExecutionEnabled: true,
  fileDownloadsAllowed: true,
  chatEnabled: true,
};

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CORTEX-${code}`;
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}`;
}

function createDefaultFiles(userName: string): ProjectFile[] {
  return [
    {
      id: generateId('f'),
      name: 'main.py',
      path: '/main.py',
      content: `# Universal Cloud Workspace - ${userName}
def solve():
    print("Hello from ${userName}'s workspace!")
    numbers = [1, 2, 3, 4, 5]
    print(f"Squares: {[x**2 for x in numbers]}")

if __name__ == '__main__':
    solve()
`,
    },
    {
      id: generateId('f'),
      name: 'solution.py',
      path: '/solution.py',
      content: `# Algorithm Implementation
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1
`,
    },
  ];
}

export class ClassroomRoomManager {
  /**
   * Create a new classroom room with an Admin
   */
  public static createRoom(adminName: string, customSettings?: Partial<ClassroomSettings>): { room: ClassroomRoom; adminParticipant: ClassroomParticipant } {
    let roomId = generateRoomId();
    while (rooms.has(roomId)) {
      roomId = generateRoomId();
    }

    const adminId = generateId('admin');
    const adminFiles = createDefaultFiles(adminName);

    const adminParticipant: ClassroomParticipant = {
      id: adminId,
      name: adminName,
      role: 'admin',
      online: true,
      status: 'coding',
      currentLanguage: 'python',
      activeFileName: 'main.py',
      lastActive: Date.now(),
      isLocked: false,
      canRun: true,
      privacy: {
        workspaceVisibility: 'public',
        allowCollaboration: true,
        requireDownloadPermission: false,
      },
      files: adminFiles,
      activeCode: adminFiles[0].content,
    };

    const room: ClassroomRoom = {
      roomId,
      admin: {
        id: adminId,
        name: adminName,
      },
      participants: {
        [adminId]: adminParticipant,
      },
      settings: {
        ...DEFAULT_SETTINGS,
        ...customSettings,
      },
      activeWorkspaces: {
        slotAUserId: adminId,
      },
      collaborationSessions: {},
      collaborationRequests: {},
      downloadRequests: {},
      downloadPermissions: {},
      viewRequests: {},
      chatMessages: [
        {
          id: generateId('msg'),
          senderId: adminId,
          senderName: 'System',
          role: 'admin',
          text: `Classroom created by ${adminName}. Welcome!`,
          timestamp: Date.now(),
          isAnnouncement: true,
        },
      ],
      state: 'active',
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    return { room, adminParticipant };
  }

  /**
   * Retrieve a room by Room ID
   */
  public static getRoom(roomId: string): ClassroomRoom | null {
    return rooms.get(roomId.toUpperCase().trim()) || null;
  }

  /**
   * Join an existing classroom room
   */
  public static joinRoom(roomId: string, name: string, role: ClassroomRole = 'user', existingId?: string): { room: ClassroomRoom; participant: ClassroomParticipant } {
    const normRoomId = roomId.toUpperCase().trim();
    const room = rooms.get(normRoomId);
    if (!room) {
      throw new Error(`Classroom room "${roomId}" was not found.`);
    }
    if (room.state === 'ended') {
      throw new Error('This classroom session has ended.');
    }

    const participantCount = Object.keys(room.participants).length;
    if (participantCount >= room.settings.maxUsers && !existingId) {
      throw new Error(`Classroom has reached its capacity limit of ${room.settings.maxUsers} users.`);
    }

    // Reconnection of existing participant
    if (existingId && room.participants[existingId]) {
      const existing = room.participants[existingId];
      existing.online = true;
      existing.lastActive = Date.now();
      existing.name = name || existing.name;
      this.broadcast(normRoomId, {
        type: 'presence',
        roomId: normRoomId,
        senderId: existing.id,
        senderName: existing.name,
        payload: { participantId: existing.id, online: true, status: existing.status },
        timestamp: Date.now(),
      });
      return { room, participant: existing };
    }

    const participantId = generateId('user');
    const userFiles = createDefaultFiles(name);

    const participant: ClassroomParticipant = {
      id: participantId,
      name,
      role: role,
      online: true,
      status: 'coding',
      currentLanguage: 'python',
      activeFileName: 'main.py',
      lastActive: Date.now(),
      isLocked: false,
      canRun: room.settings.codeExecutionEnabled,
      privacy: {
        workspaceVisibility: 'private',
        allowCollaboration: true,
        requireDownloadPermission: true,
      },
      files: userFiles,
      activeCode: userFiles[0].content,
    };

    room.participants[participantId] = participant;

    // Automatically assign slot B if open
    if (!room.activeWorkspaces.slotBUserId && room.activeWorkspaces.slotAUserId !== participantId) {
      room.activeWorkspaces.slotBUserId = participantId;
    }

    this.broadcast(normRoomId, {
      type: 'join',
      roomId: normRoomId,
      senderId: participantId,
      senderName: name,
      payload: { participant, activeWorkspaces: room.activeWorkspaces },
      timestamp: Date.now(),
    });

    return { room, participant };
  }

  /**
   * Leave room or mark offline
   */
  public static leaveRoom(roomId: string, participantId: string) {
    const room = this.getRoom(roomId);
    if (!room || !room.participants[participantId]) return;

    room.participants[participantId].online = false;
    room.participants[participantId].status = 'offline';
    room.participants[participantId].lastActive = Date.now();

    this.broadcast(room.roomId, {
      type: 'presence',
      roomId: room.roomId,
      senderId: participantId,
      senderName: room.participants[participantId].name,
      payload: { participantId, online: false, status: 'offline' },
      timestamp: Date.now(),
    });
  }

  /**
   * Update a participant's workspace code or language
   */
  public static updateParticipantCode(
    roomId: string,
    participantId: string,
    updates: { code?: string; language?: string; fileName?: string; status?: 'coding' | 'testing' | 'idle' }
  ) {
    const room = this.getRoom(roomId);
    if (!room) return;
    const p = room.participants[participantId];
    if (!p) return;

    if (p.isLocked) {
      throw new Error('Workspace is currently locked by the Admin.');
    }

    if (updates.code !== undefined) {
      p.activeCode = updates.code;
      const file = p.files.find((f) => f.name === p.activeFileName);
      if (file) file.content = updates.code;
    }
    if (updates.language !== undefined) {
      p.currentLanguage = updates.language;
    }
    if (updates.fileName !== undefined) {
      p.activeFileName = updates.fileName;
      const file = p.files.find((f) => f.name === updates.fileName);
      if (file) p.activeCode = file.content;
    }
    if (updates.status !== undefined) {
      p.status = updates.status;
    }
    p.lastActive = Date.now();

    this.broadcast(room.roomId, {
      type: 'user_updated',
      roomId: room.roomId,
      senderId: participantId,
      payload: {
        participantId,
        activeCode: p.activeCode,
        currentLanguage: p.currentLanguage,
        activeFileName: p.activeFileName,
        status: p.status,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Request collaboration with another user (Mutual Permission)
   */
  public static requestCollaboration(roomId: string, fromId: string, toId: string): CollaborationRequest {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (!room.settings.collaborationEnabled) {
      throw new Error('Collaboration is currently disabled in this classroom.');
    }
    if (!room.settings.userToUserCollaboration) {
      throw new Error('User-to-user collaboration is restricted by Admin.');
    }

    const fromUser = room.participants[fromId];
    const toUser = room.participants[toId];
    if (!fromUser || !toUser) throw new Error('Participant not found');
    if (!toUser.privacy.allowCollaboration) {
      throw new Error(`${toUser.name} has disabled incoming collaboration requests.`);
    }

    const reqId = generateId('collab_req');
    const request: CollaborationRequest = {
      id: reqId,
      fromId,
      fromName: fromUser.name,
      toId,
      toName: toUser.name,
      status: 'pending',
      createdAt: Date.now(),
    };

    room.collaborationRequests[reqId] = request;

    this.broadcast(room.roomId, {
      type: 'collaboration_request',
      roomId: room.roomId,
      senderId: fromId,
      senderName: fromUser.name,
      payload: request,
      timestamp: Date.now(),
    });

    return request;
  }

  /**
   * Respond to collaboration request (Accept / Decline)
   */
  public static respondCollaboration(roomId: string, requestId: string, responderId: string, decision: CollaborationDecision): CollaborationSession | null {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    const req = room.collaborationRequests[requestId];
    if (!req) throw new Error('Collaboration request expired or not found');
    if (req.toId !== responderId) throw new Error('Unauthorized response');

    req.status = decision;

    let session: CollaborationSession | null = null;
    if (decision === 'accepted') {
      const sessionId = generateId('collab_session');
      const fromUser = room.participants[req.fromId];
      const toUser = room.participants[req.toId];

      session = {
        id: sessionId,
        participantIds: [req.fromId, req.toId],
        mode: 'shared',
        sharedDocId: `doc_${sessionId}`,
        sharedCode: fromUser?.activeCode || toUser?.activeCode || '',
        createdAt: Date.now(),
        lastSynced: Date.now(),
      };

      room.collaborationSessions[sessionId] = session;
      // Automatically mount collaborating users into Workspace A and Workspace B
      room.activeWorkspaces = {
        slotAUserId: req.fromId,
        slotBUserId: req.toId,
      };
    }

    this.broadcast(room.roomId, {
      type: 'collaboration_response',
      roomId: room.roomId,
      senderId: responderId,
      payload: { request: req, session, activeWorkspaces: room.activeWorkspaces },
      timestamp: Date.now(),
    });

    return session;
  }

  /**
   * End a collaboration session
   */
  public static endCollaboration(roomId: string, sessionId: string, endedById: string) {
    const room = this.getRoom(roomId);
    if (!room) return;
    const session = room.collaborationSessions[sessionId];
    if (!session) return;

    delete room.collaborationSessions[sessionId];

    this.broadcast(room.roomId, {
      type: 'end_collaboration',
      roomId: room.roomId,
      senderId: endedById,
      payload: { sessionId },
      timestamp: Date.now(),
    });
  }

  /**
   * Request to download another user's file
   */
  public static requestFileDownload(roomId: string, requesterId: string, ownerId: string, fileId: string): FileDownloadRequest {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (!room.settings.fileDownloadsAllowed) {
      throw new Error('File downloading is currently restricted by the classroom admin.');
    }

    const requester = room.participants[requesterId];
    const owner = room.participants[ownerId];
    if (!requester || !owner) throw new Error('User not found');

    const file = owner.files.find((f) => f.id === fileId);
    if (!file) throw new Error('File not found in owner workspace');

    const reqId = generateId('dl_req');
    const request: FileDownloadRequest = {
      id: reqId,
      requesterId,
      requesterName: requester.name,
      ownerId,
      ownerName: owner.name,
      fileId,
      fileName: file.name,
      status: 'pending',
      createdAt: Date.now(),
    };

    room.downloadRequests[reqId] = request;

    this.broadcast(room.roomId, {
      type: 'file_download_request',
      roomId: room.roomId,
      senderId: requesterId,
      senderName: requester.name,
      payload: request,
      timestamp: Date.now(),
    });

    return request;
  }

  /**
   * Authorize or deny a file download request
   */
  public static respondFileDownload(
    roomId: string,
    requestId: string,
    ownerId: string,
    decision: FileDownloadDecision
  ): { status: string; token?: string } {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    const req = room.downloadRequests[requestId];
    if (!req) throw new Error('Download request not found');
    if (req.ownerId !== ownerId) throw new Error('Only the file owner can approve downloads');

    req.status = decision;

    let token: string | undefined = undefined;
    if (decision === 'allow_once' || decision === 'allow_session') {
      token = `cortex_dl_${Math.random().toString(36).substring(2)}${Date.now()}`;
      const permission: FileDownloadPermission = {
        token,
        fileId: req.fileId,
        fileName: req.fileName,
        requesterId: req.requesterId,
        ownerId: req.ownerId,
        type: decision,
        consumed: false,
        grantedAt: Date.now(),
        expiresAt: decision === 'allow_once' ? Date.now() + 15 * 60 * 1000 : Date.now() + 24 * 60 * 60 * 1000,
      };
      room.downloadPermissions[token] = permission;
      req.token = token;
    }

    this.broadcast(room.roomId, {
      type: 'file_download_response',
      roomId: room.roomId,
      senderId: ownerId,
      payload: { request: req, decision, token },
      timestamp: Date.now(),
    });

    return { status: decision, token };
  }

  /**
   * Verify and consume a file download token
   */
  public static verifyAndConsumeDownload(
    roomId: string,
    fileId: string,
    token: string,
    requesterId: string
  ): { fileName: string; content: string } {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');

    const perm = room.downloadPermissions[token];
    if (!perm) {
      throw new Error('Invalid or expired download authorization token.');
    }
    if (perm.requesterId !== requesterId) {
      throw new Error('Download token was issued to a different user.');
    }
    if (perm.fileId !== fileId) {
      throw new Error('Download token does not match the requested file.');
    }
    if (Date.now() > perm.expiresAt) {
      throw new Error('Download authorization token has expired.');
    }
    if (perm.type === 'allow_once' && perm.consumed) {
      throw new Error('This one-time download authorization has already been consumed.');
    }

    const owner = room.participants[perm.ownerId];
    if (!owner) throw new Error('File owner no longer exists in classroom.');

    const file = owner.files.find((f) => f.id === fileId);
    if (!file) throw new Error('Requested file not found in owner workspace.');

    if (perm.type === 'allow_once') {
      perm.consumed = true;
    }

    return { fileName: file.name, content: file.content };
  }

  /**
   * Select which two users appear in Workspace A and Workspace B
   */
  public static selectWorkspaces(roomId: string, slotAUserId?: string, slotBUserId?: string) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.activeWorkspaces = {
      slotAUserId: slotAUserId || room.activeWorkspaces.slotAUserId,
      slotBUserId: slotBUserId || room.activeWorkspaces.slotBUserId,
    };

    this.broadcast(room.roomId, {
      type: 'select_workspaces',
      roomId: room.roomId,
      senderId: 'system',
      payload: room.activeWorkspaces,
      timestamp: Date.now(),
    });
  }

  /**
   * Execute Admin classroom management actions
   */
  public static adminAction(
    roomId: string,
    adminId: string,
    action: {
      type: 'lock_user' | 'unlock_user' | 'toggle_run' | 'reset_workspace' | 'remove_user' | 'update_settings' | 'end_classroom';
      targetUserId?: string;
      settings?: Partial<ClassroomSettings>;
    }
  ) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    if (room.admin.id !== adminId) throw new Error('Only the classroom Admin can perform this action');

    const targetUser = action.targetUserId ? room.participants[action.targetUserId] : null;

    switch (action.type) {
      case 'lock_user':
        if (targetUser) targetUser.isLocked = true;
        break;
      case 'unlock_user':
        if (targetUser) targetUser.isLocked = false;
        break;
      case 'toggle_run':
        if (targetUser) targetUser.canRun = !targetUser.canRun;
        break;
      case 'reset_workspace':
        if (targetUser) {
          const fresh = createDefaultFiles(targetUser.name);
          targetUser.files = fresh;
          targetUser.activeCode = fresh[0].content;
        }
        break;
      case 'remove_user':
        if (action.targetUserId && room.participants[action.targetUserId]) {
          delete room.participants[action.targetUserId];
          if (room.activeWorkspaces.slotAUserId === action.targetUserId) delete room.activeWorkspaces.slotAUserId;
          if (room.activeWorkspaces.slotBUserId === action.targetUserId) delete room.activeWorkspaces.slotBUserId;
        }
        break;
      case 'update_settings':
        if (action.settings) {
          room.settings = { ...room.settings, ...action.settings };
        }
        break;
      case 'end_classroom':
        room.state = 'ended';
        break;
    }

    this.broadcast(room.roomId, {
      type: action.type === 'end_classroom' ? 'classroom_ended' : 'admin_action',
      roomId: room.roomId,
      senderId: adminId,
      payload: { action, roomState: room.state, settings: room.settings },
      timestamp: Date.now(),
    });
  }

  /**
   * Send chat message or room announcement
   */
  public static sendChat(roomId: string, senderId: string, text: string, isAnnouncement = false): ChatMessage {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('Room not found');
    const sender = room.participants[senderId];
    if (!sender) throw new Error('Sender not recognized');

    const msg: ChatMessage = {
      id: generateId('chat'),
      senderId,
      senderName: sender.name,
      role: sender.role,
      text,
      timestamp: Date.now(),
      isAnnouncement,
    };

    room.chatMessages.push(msg);
    if (room.chatMessages.length > 200) {
      room.chatMessages.shift();
    }

    this.broadcast(room.roomId, {
      type: 'chat_message',
      roomId: room.roomId,
      senderId,
      senderName: sender.name,
      payload: msg,
      timestamp: Date.now(),
    });

    return msg;
  }

  /**
   * Event Pub/Sub for real-time WebSocket & SSE streams
   */
  public static subscribe(roomId: string, listener: (event: ClassroomEventMessage) => void): () => void {
    const norm = roomId.toUpperCase().trim();
    if (!listeners.has(norm)) {
      listeners.set(norm, new Set());
    }
    const roomListeners = listeners.get(norm)!;
    roomListeners.add(listener);

    return () => {
      roomListeners.delete(listener);
      if (roomListeners.size === 0) {
        listeners.delete(norm);
      }
    };
  }

  public static broadcast(roomId: string, event: ClassroomEventMessage) {
    const norm = roomId.toUpperCase().trim();
    const roomListeners = listeners.get(norm);
    if (roomListeners) {
      roomListeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error('[ClassroomRoomManager] listener error', err);
        }
      });
    }
  }
}
