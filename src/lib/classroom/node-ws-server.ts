import * as Y from 'yjs';
import { ClassroomRoomManager } from './room-manager';
import { classroomDb } from './db';
import { realtimeCoordinator, WsClientSession } from './realtime';
import { ClassroomAuth } from './auth';
import {
  RealtimeMessage,
  ClassroomRealtimeEvent,
  parseRealtimeMessage,
  serializeRealtimeMessage,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from './protocol';

declare global {
  var __cortex_node_ws_server: any | undefined;
  var __cortex_node_ws_port: number | undefined;
  var __cortex_room_ydocs: Map<string, Map<string, Y.Doc>> | undefined;
}

if (!globalThis.__cortex_room_ydocs) {
  globalThis.__cortex_room_ydocs = new Map();
}
const roomYDocs = globalThis.__cortex_room_ydocs;

/**
 * Authoritative server Y.Doc for dual-workspace collaborative coding
 */
export function getServerYDoc(roomId: string, documentId: string, initialContent?: string): Y.Doc {
  const normRoom = roomId.toUpperCase().trim();
  if (!roomYDocs.has(normRoom)) {
    roomYDocs.set(normRoom, new Map());
  }
  const roomDocs = roomYDocs.get(normRoom)!;
  if (!roomDocs.has(documentId)) {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('monaco');
    if (initialContent) {
      ytext.insert(0, initialContent);
    }
    roomDocs.set(documentId, ydoc);
  }
  return roomDocs.get(documentId)!;
}

interface ClientMeta {
  ws: any;
  roomId: string;
  classroomId: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  isAlive: boolean;
  unregisterRealtime?: () => void;
}

const connectedClients = new Set<ClientMeta>();

/**
 * Broadcast message to other clients in the same room with DM privacy protection
 */
export function broadcastToRoom(roomId: string, message: RealtimeMessage, excludeClientId?: string) {
  const normRoom = roomId.toUpperCase().trim();
  const raw = serializeRealtimeMessage(message);

  const isDirectMessage =
    (message.type === 'event' && message.payload?.event?.type === 'message.created' && message.payload?.event?.payload?.message?.recipientType === 'direct') ||
    (message.payload?.type === 'message.created' && message.payload?.message?.recipientType === 'direct');

  const dmMsg = message.payload?.event?.payload?.message || message.payload?.message;
  const recipientId = dmMsg?.recipientId;
  const senderId = dmMsg?.senderId;

  connectedClients.forEach((client) => {
    if (
      (client.roomId === normRoom || client.classroomId === normRoom) &&
      client.ws.readyState === 1 /* OPEN */
    ) {
      if (isDirectMessage) {
        const isRecipient = client.participantId === recipientId;
        const isSender = client.participantId === senderId;
        const isInstructor = client.participantRole === 'teacher' || client.participantRole === 'admin';
        if (!isRecipient && !isSender && !isInstructor) {
          return;
        }
      }
      if (!excludeClientId || client.participantId !== excludeClientId) {
        try {
          client.ws.send(raw);
        } catch (e) {
          console.error('[NodeWSServer] broadcast error', e);
        }
      }
    }
  });
}

/**
 * Ensures the Node.js WebSocket server is started and running
 */
export async function ensureNodeWsServer(desiredPort = 3002): Promise<number | null> {
  if (typeof window !== 'undefined') return null;
  if (globalThis.__cortex_node_ws_server && globalThis.__cortex_node_ws_port) {
    try {
      const addr = globalThis.__cortex_node_ws_server.address();
      if (addr) return globalThis.__cortex_node_ws_port;
    } catch {}
  }

  try {
    const { WebSocketServer } = await import('ws');

    let wss: any = null;
    let actualPort = desiredPort;

    try {
      wss = new WebSocketServer({ port: desiredPort });
    } catch {
      wss = new WebSocketServer({ port: 0 });
    }

    await new Promise<void>((resolve, reject) => {
      wss.on('listening', () => {
        const addr = wss.address();
        if (typeof addr === 'object' && addr?.port) {
          actualPort = addr.port;
        }
        globalThis.__cortex_node_ws_port = actualPort;
        globalThis.__cortex_node_ws_server = wss;
        resolve();
      });

      wss.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          try {
            const fallbackWss = new WebSocketServer({ port: 0 });
            fallbackWss.on('listening', () => {
              const addr = fallbackWss.address();
              actualPort = typeof addr === 'object' && addr?.port ? addr.port : 3003;
              globalThis.__cortex_node_ws_port = actualPort;
              globalThis.__cortex_node_ws_server = fallbackWss;
              resolve();
            });
          } catch (e) {
            reject(e);
          }
        } else {
          reject(err);
        }
      });
    });

    // Connection handler
    globalThis.__cortex_node_ws_server.on('connection', (ws: any, req: any) => {
      const url = new URL(req.url || '/', 'http://localhost');
      
      // Parse classroom ID from path (e.g., /api/v1/classrooms/CLS-123/ws) or query param
      let pathClassroomId = '';
      const parts = url.pathname.split('/');
      const wsIdx = parts.indexOf('ws');
      if (wsIdx > 0) {
        pathClassroomId = parts[wsIdx - 1];
      }
      const classroomId = (pathClassroomId || url.searchParams.get('classroomId') || url.searchParams.get('roomId') || '').toUpperCase().trim();
      const requestedUserId = url.searchParams.get('userId') || url.searchParams.get('participantId');

      // 1. Validate Classroom existence
      if (!classroomId) {
        ws.send(serializeRealtimeMessage({
          type: 'error',
          payload: { code: 'BAD_REQUEST', message: 'Missing classroomId' },
          timestamp: Date.now(),
        }));
        ws.close(4400, 'Bad Request: Missing classroomId');
        return;
      }

      // 2. Authoritative User Authentication via ClassroomAuth
      const user = ClassroomAuth.authenticateRequest(req);
      if (!user) {
        console.warn(`[Security Alert] Rejected unauthenticated connection attempt to classroom ${classroomId}`);
        ws.send(serializeRealtimeMessage({
          type: 'error',
          classroomId,
          payload: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing or invalid credentials.' },
          timestamp: Date.now(),
        }));
        ws.close(4401, 'Unauthorized: Missing or invalid credentials');
        return;
      }

      // 3. Server-Side Classroom Membership & Role Verification
      const membership = ClassroomAuth.verifyClassroomMembership(user, classroomId);
      if (!membership.authorized) {
        const isNotFound = membership.error?.toLowerCase().includes('not found');
        const code = isNotFound ? 'NOT_FOUND' : 'FORBIDDEN';
        const closeCode = isNotFound ? 4404 : 4403;
        console.warn(`[Security Alert] Access Denied: User ${user.id} (${user.name}) is not authorized for classroom ${classroomId}. ${membership.error}`);
        ws.send(serializeRealtimeMessage({
          type: 'error',
          classroomId,
          payload: { code, message: membership.error || `Access denied. You are not enrolled in classroom ${classroomId}.` },
          timestamp: Date.now(),
        }));
        ws.close(closeCode, membership.error || 'Forbidden: Not enrolled in classroom');
        return;
      }

      const authoritativeRole = membership.role!;

      const clientMeta: ClientMeta = {
        ws,
        roomId: classroomId,
        classroomId,
        participantId: user.id,
        participantName: user.name,
        participantRole: authoritativeRole, // Strictly from server-derived membership
        isAlive: true,
      };

      connectedClients.add(clientMeta);

      // Register with RealtimeCoordinator
      const session: WsClientSession = {
        id: `ws_${user.id}_${Date.now()}`,
        userId: user.id,
        userName: user.name,
        role: authoritativeRole,
        classroomId,
        send: (raw: string) => {
          if (ws.readyState === 1) {
            try { ws.send(raw); } catch {}
          }
        },
        isAlive: true,
        lastActive: Date.now(),
      };

      clientMeta.unregisterRealtime = realtimeCoordinator.registerWsClient(classroomId, session);

      // Send initial auth_ok handshake immediately with current authoritative sequence
      const currentSeq = classroomDb.getNextEventSequence(classroomId) - 1;
      const members = classroomDb.listMembers(classroomId);

      ws.send(
        serializeRealtimeMessage({
          type: 'auth_ok',
          classroomId,
          sequence: Math.max(0, currentSeq),
          payload: {
            currentSequence: Math.max(0, currentSeq),
            userId: user.id,
            role: authoritativeRole,
            members: members.map((m) => ({
              id: m.userId,
              name: m.userName,
              role: m.role,
              isOnline: m.isOnline,
            })),
            onlineCount: realtimeCoordinator.getOnlineCount(classroomId),
          },
          timestamp: Date.now(),
        })
      );

      // Broadcast student.joined
      realtimeCoordinator.broadcast(
        classroomId,
        'student.joined',
        {
          userId: user.id,
          userName: user.name,
          role: authoritativeRole,
          onlineCount: realtimeCoordinator.getOnlineCount(classroomId),
        },
        { id: user.id, name: user.name }
      );

      ws.on('pong', () => {
        clientMeta.isAlive = true;
      });

      ws.on('message', (data: any) => {
        try {
          const rawStr = data.toString('utf-8');
          const msg = parseRealtimeMessage(rawStr);
          if (!msg) return;

          handleClientMessage(clientMeta, msg);
        } catch (err) {
          console.error('[NodeWSServer] Message error', err);
        }
      });

      ws.on('close', () => {
        connectedClients.delete(clientMeta);
        if (clientMeta.unregisterRealtime) {
          clientMeta.unregisterRealtime();
        }

        if (clientMeta.classroomId) {
          realtimeCoordinator.broadcast(
            clientMeta.classroomId,
            'student.left',
            {
              userId: clientMeta.participantId,
              userName: clientMeta.participantName,
              onlineCount: realtimeCoordinator.getOnlineCount(clientMeta.classroomId),
            },
            { id: clientMeta.participantId, name: clientMeta.participantName }
          );
        }
      });

      ws.on('error', (err: any) => {
        console.error('[NodeWSServer] Socket error', err);
      });
    });

    // 15s Heartbeat Ping
    const pingInterval = setInterval(() => {
      connectedClients.forEach((client) => {
        if (!client.isAlive) {
          try { client.ws.terminate(); } catch {}
          connectedClients.delete(client);
          return;
        }
        client.isAlive = false;
        try { client.ws.ping(); } catch {}
      });
    }, 15000);

    globalThis.__cortex_node_ws_server.on('close', () => {
      clearInterval(pingInterval);
    });

    return globalThis.__cortex_node_ws_port || actualPort;
  } catch (err) {
    console.warn('[NodeWSServer] Could not start WebSocket server', err);
    return null;
  }
}

export function getNodeWsPort(): number | null {
  return globalThis.__cortex_node_ws_port || null;
}

/**
 * Handle incoming parsed message from WebSocket client
 */
function handleClientMessage(client: ClientMeta, msg: RealtimeMessage) {
  const normRoom = (msg.classroomId || msg.roomId || client.classroomId || '').toUpperCase().trim();

  switch (msg.type) {
    case 'auth': {
      // Re-verify auth but NEVER allow client to escalate role or spoof identity
      const currentSeq = classroomDb.getNextEventSequence(normRoom) - 1;
      client.ws.send(
        serializeRealtimeMessage({
          type: 'auth_ok',
          classroomId: normRoom,
          sequence: Math.max(0, currentSeq),
          payload: {
            currentSequence: Math.max(0, currentSeq),
            userId: client.participantId,
            role: client.participantRole,
            members: classroomDb.listMembers(normRoom).map((m) => ({
              id: m.userId,
              name: m.userName,
              role: m.role,
              isOnline: m.isOnline,
            })),
            onlineCount: realtimeCoordinator.getOnlineCount(normRoom),
          },
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'ping': {
      client.ws.send(
        serializeRealtimeMessage({
          type: 'pong',
          classroomId: normRoom,
          roomId: normRoom,
          clientId: 'server',
          payload: { clientTimestamp: msg.timestamp, serverTimestamp: Date.now() },
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'resync_request': {
      const currentSeq = classroomDb.getNextEventSequence(normRoom) - 1;
      const since = typeof msg.payload?.sinceSequence === 'number' ? msg.payload.sinceSequence : (msg.sequence || 0);
      const missed = realtimeCoordinator.getMissedEvents(normRoom, since);

      const isInstructor = client.participantRole === 'teacher' || client.participantRole === 'admin';
      const filteredMissed = missed.filter((e) => {
        if (e.type === 'message.created' && (e.payload?.message?.recipientType === 'direct' || e.payload?.message?.recipientType === 'teacher')) {
          const dmSender = e.payload?.message?.senderId || e.actorId;
          const dmRecipient = e.payload?.message?.recipientId;
          return isInstructor || dmSender === client.participantId || dmRecipient === client.participantId;
        }
        if (e.type === 'grade.updated' || e.type === 'submission.graded') {
          const gradeStudentId = e.payload?.submission?.studentId || e.payload?.studentId;
          return isInstructor || gradeStudentId === client.participantId;
        }
        return true;
      });

      // Check if client sequence is older than available ring-buffer / event retention
      const isBufferOverflow = since > 0 && currentSeq - since > 500;

      if (isBufferOverflow || since === 0) {
        // Authoritative full state snapshot
        const announcements = classroomDb.listAnnouncements(normRoom);
        const rawAssignments = classroomDb.listAssignments(normRoom);
        const assignments = isInstructor
          ? rawAssignments
          : rawAssignments.map((a) => ({
              ...a,
              testCases: (a.testCases || []).map((tc: any) => {
                if (tc.visibility === 'hidden' || tc.isHidden === true || tc.hidden === true) {
                  return { ...tc, visibility: 'hidden', isHidden: true, hidden: true, input: '[HIDDEN]', expectedOutput: '[HIDDEN]' };
                }
                return tc;
              }),
            }));
        const members = classroomDb.listMembers(normRoom);
        const allMessages = classroomDb.listMessages(normRoom, 50);
        const filteredMessages = allMessages.filter((m) => {
          if (m.recipientType === 'direct') {
            return isInstructor || m.senderId === client.participantId || m.recipientId === client.participantId;
          }
          return true;
        });

        client.ws.send(
          serializeRealtimeMessage({
            type: 'resync_response',
            classroomId: normRoom,
            sequence: Math.max(0, currentSeq),
            payload: {
              isFullSnapshot: true,
              currentSequence: Math.max(0, currentSeq),
              sinceSequence: since,
              events: filteredMissed,
              snapshot: {
                announcements,
                assignments,
                members: members.map((m) => ({
                  id: m.userId,
                  name: m.userName,
                  role: m.role,
                  isOnline: m.isOnline,
                })),
                recentMessages: filteredMessages,
              },
            },
            timestamp: Date.now(),
          })
        );
      } else {
        client.ws.send(
          serializeRealtimeMessage({
            type: 'resync_response',
            classroomId: normRoom,
            sequence: Math.max(0, currentSeq),
            payload: {
              isFullSnapshot: false,
              events: filteredMissed,
              sinceSequence: since,
            },
            timestamp: Date.now(),
          })
        );
      }
      break;
    }

    case 'event': {
      const eventData = msg.payload?.event || msg.payload;
      if (!eventData || !eventData.type) return;

      const teacherOnlyEvents = new Set([
        'announcement.created',
        'announcement.deleted',
        'assignment.published',
        'assignment.updated',
        'assignment.deleted',
        'grade.updated',
        'submission.graded',
        'student.removed',
        'rollcall.started',
        'rollcall.closed',
        'session.started',
        'session.ended',
        'session.created',
        'session.updated',
        'session.recording.started',
        'session.recording.stopped',
        'teacher.code.snapshot',
        'teacher.code.changed',
        'teacher.file.created',
        'teacher.file.updated',
        'teacher.file.deleted',
        'teacher.cursor.updated',
        'teacher.output.created',
        'question.answered',
        'question.pinned',
      ]);

      const isInstructor = client.participantRole === 'teacher' || client.participantRole === 'admin';
      if (teacherOnlyEvents.has(eventData.type) && !isInstructor) {
        console.warn(`[Security Alert] Non-teacher user ${client.participantId} attempted forbidden event: ${eventData.type}`);
        client.ws.send(
          serializeRealtimeMessage({
            type: 'error',
            classroomId: normRoom,
            payload: {
              code: 'FORBIDDEN_EVENT',
              message: `Unauthorized: Only instructors are permitted to emit '${eventData.type}'.`,
            },
            timestamp: Date.now(),
          })
        );
        return;
      }

      // Overwrite actor identity authoritatively
      eventData.actorId = client.participantId;
      eventData.actorName = client.participantName;

      // Prevent payload spoofing
      if (eventData.payload && typeof eventData.payload === 'object') {
        if (eventData.payload.userId && eventData.payload.userId !== client.participantId) {
          console.warn(`[Security Alert] Overwriting spoofed payload.userId ${eventData.payload.userId} with ${client.participantId}`);
          eventData.payload.userId = client.participantId;
        }
        if (eventData.payload.actorId && eventData.payload.actorId !== client.participantId) {
          eventData.payload.actorId = client.participantId;
        }
        if (eventData.payload.senderId && eventData.payload.senderId !== client.participantId) {
          eventData.payload.senderId = client.participantId;
        }

        if (eventData.type === 'message.created' && eventData.payload.message) {
          eventData.payload.message.senderId = client.participantId;
          eventData.payload.message.senderName = client.participantName;
          eventData.payload.message.senderRole = client.participantRole;
          if (eventData.payload.message.recipientType === 'direct') {
            if (!eventData.payload.message.recipientId) {
              client.ws.send(
                serializeRealtimeMessage({
                  type: 'error',
                  classroomId: normRoom,
                  payload: { code: 'INVALID_DM', message: 'Direct message requires a recipientId' },
                  timestamp: Date.now(),
                })
              );
              return;
            }
          }
        }
      }

      const recorded = realtimeCoordinator.handleIncomingClientEvent(
        normRoom,
        eventData,
        { id: client.participantId, name: client.participantName, role: client.participantRole }
      );

      if (recorded) {
        client.ws.send(
          serializeRealtimeMessage({
            type: 'ack',
            eventId: recorded.id,
            sequence: recorded.sequence,
            timestamp: Date.now(),
          })
        );
      }
      break;
    }

    case 'doc_sync_step1': {
      const docId = msg.documentId || 'default';
      const initialContent = msg.payload?.initialContent;
      const ydoc = getServerYDoc(normRoom, docId, initialContent);

      let clientVector: Uint8Array | undefined = undefined;
      if (msg.payload?.vector) {
        clientVector = base64ToUint8Array(msg.payload.vector);
      }

      const serverUpdate = Y.encodeStateAsUpdate(ydoc, clientVector);
      const serverVector = Y.encodeStateVector(ydoc);

      client.ws.send(
        serializeRealtimeMessage({
          type: 'doc_sync_step2',
          roomId: normRoom,
          documentId: docId,
          clientId: 'server',
          payload: {
            update: uint8ArrayToBase64(serverUpdate),
            vector: uint8ArrayToBase64(serverVector),
          },
          timestamp: Date.now(),
        })
      );
      break;
    }

    case 'doc_sync_step2':
    case 'doc_update': {
      const docId = msg.documentId || 'default';
      const ydoc = getServerYDoc(normRoom, docId);

      if (msg.payload?.update) {
        const binaryUpdate = base64ToUint8Array(msg.payload.update);
        Y.applyUpdate(ydoc, binaryUpdate, client.participantId);

        broadcastToRoom(
          normRoom,
          {
            type: 'doc_update',
            roomId: normRoom,
            workspaceId: msg.workspaceId,
            documentId: docId,
            clientId: msg.clientId,
            senderName: msg.senderName,
            payload: { update: msg.payload.update },
            timestamp: Date.now(),
          },
          client.participantId
        );
      }
      break;
    }

    default: {
      broadcastToRoom(normRoom, msg, client.participantId);
      break;
    }
  }
}
