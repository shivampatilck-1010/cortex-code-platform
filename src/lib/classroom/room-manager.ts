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
  public static createRoom(
    adminName: string,
    customSettings?: Partial<ClassroomSettings>,
    forcedRoomId?: string
  ): { room: ClassroomRoom; adminParticipant: ClassroomParticipant } {
    let roomId = forcedRoomId ? forcedRoomId.toUpperCase().trim() : generateRoomId();
    if (forcedRoomId && rooms.has(roomId)) {
      const existingRoom = rooms.get(roomId)!;
      const adminP =
        Object.values(existingRoom.participants).find((p) => p.role === 'admin') ||
        Object.values(existingRoom.participants)[0];
      return { room: existingRoom, adminParticipant: adminP };
    }
    if (!forcedRoomId) {
      while (rooms.has(roomId)) {
        roomId = generateRoomId();
      }
    }

    const isPlaceholder = adminName === 'Classroom Host';
    const adminId = isPlaceholder ? '' : generateId('admin');
    const adminFiles = isPlaceholder ? [] : createDefaultFiles(adminName);

    const adminParticipant: ClassroomParticipant = isPlaceholder
      ? {
          id: '',
          name: '',
          role: 'admin',
          online: false,
          status: 'offline',
          currentLanguage: 'python',
          activeFileName: 'main.py',
          lastActive: 0,
          isLocked: false,
          canRun: true,
          privacy: { workspaceVisibility: 'public', allowCollaboration: true, requireDownloadPermission: false },
          files: [],
          activeCode: '',
        }
      : {
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
        name: isPlaceholder ? '' : adminName,
        enteredArena: false,
      },
      participants: isPlaceholder ? {} : { [adminId]: adminParticipant },
      settings: {
        ...DEFAULT_SETTINGS,
        ...customSettings,
      },
      activeWorkspaces: isPlaceholder ? {} : {
        slotAUserId: adminId,
      },
      collaborationSessions: {},
      collaborationRequests: {},
      downloadRequests: {},
      downloadPermissions: {},
      viewRequests: {},
      chatMessages: isPlaceholder
        ? []
        : [
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
      state: 'created',
      createdAt: Date.now(),
    };

    rooms.set(roomId, room);
    return { room, adminParticipant };
  }

  /**
   * Retrieve a room by Room ID with automatic edge self-healing
   */
  public static getRoom(roomId: string, autoCreate = true): ClassroomRoom | null {
    if (!roomId) return null;
    const normRoomId = roomId.toUpperCase().trim();
    let room = rooms.get(normRoomId);
    if (!room && autoCreate) {
      const created = this.createRoom('Classroom Host', undefined, normRoomId);
      room = created.room;
    }
    return room || null;
  }

  /**
   * Join an existing classroom room (auto-restores if worker cold-started)
   */
  public static joinRoom(
    roomId: string,
    name: string,
    role: ClassroomRole = 'user',
    existingId?: string
  ): { room: ClassroomRoom; participant: ClassroomParticipant } {
    const normRoomId = roomId.toUpperCase().trim();
    let room = rooms.get(normRoomId);
    if (!room) {
      const created = this.createRoom(role === 'admin' ? name : 'Classroom Host', undefined, normRoomId);
      room = created.room;
    }
    if (room.state === 'ended') {
      throw new Error('This classroom session has ended.');
    }

    // Always purge any placeholder "Classroom Host" from participants
    Object.keys(room.participants).forEach((k) => {
      if (room!.participants[k].name === 'Classroom Host' || !room!.participants[k].id) {
        delete room!.participants[k];
      }
    });

    const participantCount = Object.keys(room.participants).length;
    if (participantCount >= room.settings.maxUsers && !existingId) {
      throw new Error(`Classroom has reached its capacity limit of ${room.settings.maxUsers} users.`);
    }

    // Check if room has an active human admin participant
    const hasActiveAdmin = Boolean(
      room.admin.id &&
      room.admin.name &&
      room.admin.name !== 'Classroom Host' &&
      room.participants[room.admin.id]
    );

    // Reconnection of existing participant by ID or by matching name
    const existingById = existingId ? room.participants[existingId] : null;
    const existingByName = Object.values(room.participants).find(
      (p) => p && p.name && p.name.trim().toLowerCase() === name.trim().toLowerCase() && p.name !== 'Classroom Host'
    );
    const existing = existingById || existingByName;

    if (existing) {
      existing.online = true;
      existing.lastActive = Date.now();
      existing.name = name || existing.name;
      // Admin role preservation: only the genuine room admin has admin role
      if (room.admin.id === existing.id) {
        existing.role = 'admin';
      } else {
        existing.role = 'user';
      }
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

    // New participant: only admin if explicitly requesting admin AND room has no active admin yet
    const effectiveRole: ClassroomRole = (role === 'admin' && !hasActiveAdmin) ? 'admin' : 'user';
    const participantId = existingId || (effectiveRole === 'admin' ? generateId('admin') : generateId('user'));
    const userFiles = createDefaultFiles(name);

    const participant: ClassroomParticipant = {
      id: participantId,
      name,
      role: effectiveRole,
      online: true,
      status: 'coding',
      currentLanguage: 'python',
      activeFileName: 'main.py',
      lastActive: Date.now(),
      isLocked: false,
      canRun: room.settings.codeExecutionEnabled,
      privacy: {
        workspaceVisibility: effectiveRole === 'admin' ? 'public' : 'private',
        allowCollaboration: true,
        requireDownloadPermission: effectiveRole !== 'admin',
      },
      files: userFiles,
      activeCode: userFiles[0].content,
    };

    room.participants[participantId] = participant;

    if (effectiveRole === 'admin') {
      room.admin = { id: participantId, name, enteredArena: true };
      room.state = 'active';
      if (!room.activeWorkspaces.slotAUserId) {
        room.activeWorkspaces.slotAUserId = participantId;
      }
    } else {
      // Automatically assign slot B if open and user is not slot A (only on fresh join, not reconnect)
      if (!existingId && !room.activeWorkspaces.slotBUserId && room.activeWorkspaces.slotAUserId !== participantId) {
        room.activeWorkspaces.slotBUserId = participantId;
      }
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
   * Admin enters the arena -> launches arena for everyone!
   */
  public static startClassroom(roomId: string, adminId: string): ClassroomRoom {
    const normRoomId = roomId.toUpperCase().trim();
    const room = this.getRoom(normRoomId, true)!;
    room.state = 'active';
    if (room.admin) {
      room.admin.enteredArena = true;
      if (!room.admin.id || room.admin.name === 'Classroom Host') {
        room.admin.id = adminId;
        const p = room.participants[adminId];
        if (p) {
          room.admin.name = p.name;
          p.role = 'admin';
        }
      }
    }
    this.broadcast(normRoomId, {
      type: 'classroom_started',
      roomId: normRoomId,
      senderId: adminId,
      payload: { state: 'active', room },
      timestamp: Date.now(),
    });
    this.broadcast(normRoomId, {
      type: 'arena_started',
      roomId: normRoomId,
      senderId: adminId,
      payload: { state: 'active', room },
      timestamp: Date.now(),
    });
    this.broadcast(normRoomId, {
      type: 'room_state',
      roomId: normRoomId,
      senderId: adminId,
      payload: { room },
      timestamp: Date.now(),
    });
    return room;
  }

  /**
   * Multi-isolate gossip synchronization: merges participants from all edges and prunes ghosts
   */
  public static syncParticipants(
    roomId: string,
    clientParticipants: ClassroomParticipant[],
    clientRoomState?: string,
    clientAdminEntered?: boolean,
    clientChatMessages?: ChatMessage[]
  ): ClassroomRoom | null {
    const normRoomId = roomId.toUpperCase().trim();
    const room = this.getRoom(normRoomId, true);
    if (!room) return null;

    const now = Date.now();

    // Cascading state sync: once active, always active across all isolates
    if (clientRoomState === 'active' || clientAdminEntered) {
      room.state = 'active';
      if (room.admin) {
        room.admin.enteredArena = true;
      }
    }

    // 1. Merge participants reported by client
    if (Array.isArray(clientParticipants)) {
      for (const p of clientParticipants) {
        if (!p || !p.id || !p.name) continue;
        if (p.name === 'Classroom Host') continue; // Reject placeholder phantom

        const existing = room.participants[p.id];
        const safePrivacy = p.privacy || {
          workspaceVisibility: p.role === 'admin' ? 'public' : 'private',
          allowCollaboration: true,
          requireDownloadPermission: p.role !== 'admin',
        };

        if (!existing) {
          // Never reject known classroom participants within 30 minutes
          if (now - (p.lastActive || 0) > 1800000) continue;
          room.participants[p.id] = {
            ...p,
            currentLanguage: p.currentLanguage || 'python',
            activeFileName: p.activeFileName || 'main.py',
            activeCode: p.activeCode || '',
            files: p.files || [],
            privacy: safePrivacy,
            online: now - (p.lastActive || 0) < 60000,
          };
          if (p.role === 'admin') {
            if (!room.admin.id || room.admin.name === 'Classroom Host' || room.admin.id === p.id) {
              room.admin.id = p.id;
              room.admin.name = p.name;
              room.admin.enteredArena = true;
              room.state = 'active';
            } else {
              p.role = 'user';
            }
          }
        } else {
          if (!existing.privacy) {
            existing.privacy = safePrivacy;
          }
          if (p.lastActive && p.lastActive > existing.lastActive) {
            existing.lastActive = p.lastActive;
            existing.status = p.status || existing.status;
            existing.online = now - p.lastActive < 60000;
            if (p.activeCode && p.activeCode !== existing.activeCode) {
              existing.activeCode = p.activeCode;
            }
          }
          if (p.role === 'admin') {
            if (!room.admin.id || room.admin.name === 'Classroom Host' || room.admin.id === p.id) {
              room.admin.id = p.id;
              room.admin.name = p.name;
              room.admin.enteredArena = true;
              room.state = 'active';
            } else {
              existing.role = 'user';
            }
          }
        }
      }
    }

    // Auto-activate room and arena if any admin is present in this room
    const hasAdminInRoom = Object.values(room.participants).some(
      (p) => p && p.role === 'admin' && (p.online || now - (p.lastActive || 0) < 1800000)
    );
    if (hasAdminInRoom) {
      room.admin.enteredArena = true;
      if (room.state === 'created') {
        room.state = 'active';
      }
    }

    // 2. Prune stale ghosts and update online statuses smoothly
    for (const [id, p] of Object.entries(room.participants)) {
      if (p.name === 'Classroom Host' || !p.id) {
        delete room.participants[id];
        continue;
      }
      const timeSinceActive = now - (p.lastActive || 0);
      if (timeSinceActive > 1800000) {
        // Only prune after 30 minutes of complete inactivity
        delete room.participants[id];
        if (room.activeWorkspaces.slotAUserId === id) room.activeWorkspaces.slotAUserId = undefined;
        if (room.activeWorkspaces.slotBUserId === id) room.activeWorkspaces.slotBUserId = undefined;
      } else if (timeSinceActive > 60000) {
        p.online = false;
        p.status = 'offline';
      } else {
        p.online = true;
      }
    }

    // 3. Deduplicate participants sharing the exact same name (keep most recently active)
    const seenNames = new Map<string, string>();
    for (const [id, p] of Object.entries(room.participants)) {
      if (!p || !p.name || p.name === 'Classroom Host') continue;
      const normName = p.name.trim().toLowerCase();
      if (seenNames.has(normName)) {
        const prevId = seenNames.get(normName)!;
        const prevP = room.participants[prevId];
        if ((p.lastActive || 0) >= (prevP?.lastActive || 0)) {
          delete room.participants[prevId];
          if (room.activeWorkspaces.slotAUserId === prevId) room.activeWorkspaces.slotAUserId = id;
          if (room.activeWorkspaces.slotBUserId === prevId) room.activeWorkspaces.slotBUserId = id;
          seenNames.set(normName, id);
        } else {
          delete room.participants[id];
          if (room.activeWorkspaces.slotAUserId === id) room.activeWorkspaces.slotAUserId = prevId;
          if (room.activeWorkspaces.slotBUserId === id) room.activeWorkspaces.slotBUserId = prevId;
        }
      } else {
        seenNames.set(normName, id);
      }
    }

    // 4. Merge chat messages gossiped across isolates
    if (Array.isArray(clientChatMessages) && clientChatMessages.length > 0) {
      if (!room.chatMessages) room.chatMessages = [];
      const existingMsgIds = new Set(room.chatMessages.map((m) => m.id));
      for (const m of clientChatMessages) {
        if (m && m.id && !existingMsgIds.has(m.id)) {
          room.chatMessages.push(m);
          existingMsgIds.add(m.id);
        }
      }
      room.chatMessages.sort((a, b) => a.timestamp - b.timestamp);
      if (room.chatMessages.length > 200) {
        room.chatMessages = room.chatMessages.slice(-200);
      }
    }

    return room;
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
    if (toUser.privacy && toUser.privacy.allowCollaboration === false) {
      throw new Error(`${toUser.name} has disabled incoming collaboration requests.`);
    }

    // 1. Check if already actively collaborating
    const existingSession = Object.values(room.collaborationSessions || {}).find(
      (s) => s.participantIds.includes(fromId) && s.participantIds.includes(toId)
    );
    if (existingSession) {
      throw new Error(`You are already actively collaborating with ${toUser.name}.`);
    }

    // 2. Check if a pending request already exists between these two users
    const existingPending = Object.values(room.collaborationRequests || {}).find(
      (r) => r.fromId === fromId && r.toId === toId && r.status === 'pending'
    );
    if (existingPending) {
      // Reuse existing pending request without creating duplicates
      return existingPending;
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

    // Automatically resolve ALL other pending requests between these two participants!
    // No user should ever have to accept multiple separate requests from the same user.
    Object.values(room.collaborationRequests || {}).forEach((r) => {
      if (
        ((r.fromId === req.fromId && r.toId === req.toId) ||
         (r.fromId === req.toId && r.toId === req.fromId)) &&
        r.status === 'pending'
      ) {
        r.status = decision;
      }
    });

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
  public static sendChat(
    roomId: string,
    senderId: string,
    text: string,
    isAnnouncement = false,
    senderName?: string,
    senderRole?: ClassroomRole,
    forcedMessageId?: string
  ): ChatMessage {
    const normRoomId = roomId.toUpperCase().trim();
    const room = this.getRoom(normRoomId, true);
    if (!room) throw new Error('Room not found');

    let sender = room.participants[senderId];
    if (!sender) {
      const resolvedRole = senderRole || (room.admin.id === senderId ? 'admin' : 'user');
      sender = {
        id: senderId,
        name: senderName || 'Classmate',
        role: resolvedRole,
        currentLanguage: 'python',
        activeFileName: 'main.py',
        activeCode: '',
        files: createDefaultFiles(senderName || 'Classmate'),
        lastActive: Date.now(),
        online: true,
        status: 'idle',
        isLocked: false,
        canRun: true,
        privacy: {
          workspaceVisibility: resolvedRole === 'admin' ? 'public' : 'private',
          allowCollaboration: true,
          requireDownloadPermission: resolvedRole !== 'admin',
        },
      };
      room.participants[senderId] = sender;
    } else {
      if (senderName && (sender.name === 'Classmate' || sender.name === 'Participant')) {
        sender.name = senderName;
      }
      if (senderRole) {
        sender.role = senderRole;
      }
    }

    const msg: ChatMessage = {
      id: forcedMessageId || generateId('chat'),
      senderId,
      senderName: sender.name,
      role: sender.role,
      text: (text || '').trim(),
      timestamp: Date.now(),
      isAnnouncement,
    };

    if (!room.chatMessages) room.chatMessages = [];
    const exists = room.chatMessages.some((m) => m.id === msg.id);
    if (!exists) {
      room.chatMessages.push(msg);
      if (room.chatMessages.length > 200) {
        room.chatMessages.shift();
      }
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

  private static externalBroadcaster: ((roomId: string, event: ClassroomEventMessage) => void) | null = null;

  public static setExternalBroadcaster(fn: (roomId: string, event: ClassroomEventMessage) => void) {
    this.externalBroadcaster = fn;
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

    // Bridge to active WebSocket servers (Node.js WS or Edge hub)
    if (this.externalBroadcaster) {
      try {
        this.externalBroadcaster(norm, event);
      } catch (err) {
        console.error('[ClassroomRoomManager] externalBroadcaster error', err);
      }
    }
  }
}
