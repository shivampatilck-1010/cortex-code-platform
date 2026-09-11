import * as Y from 'yjs';
import { ClassroomRoomManager } from './room-manager';
import { classroomDb } from './db';
import { realtimeCoordinator, WsClientSession } from './realtime';
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
 * Broadcast message to other clients in the same room
 */
export function broadcastToRoom(roomId: string, message: RealtimeMessage, excludeClientId?: string) {
  const normRoom = roomId.toUpperCase().trim();
  const raw = serializeRealtimeMessage(message);

  connectedClients.forEach((client) => {
    if (
      (client.roomId === normRoom || client.classroomId === normRoom) &&
      client.ws.readyState === 1 /* OPEN */
    ) {
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

      const classroom = classroomDb.getClassroom(classroomId);
      if (!classroom) {
        ws.send(serializeRealtimeMessage({
          type: 'error',
          classroomId,
          payload: { code: 'NOT_FOUND', message: `Classroom ${classroomId} not found.` },
          timestamp: Date.now(),
        }));
        ws.close(4404, 'Classroom not found');
        return;
      }

      // 2. Authenticate User
      if (!requestedUserId || requestedUserId === 'usr_anonymous') {
        ws.send(serializeRealtimeMessage({
          type: 'error',
          classroomId,
          payload: { code: 'UNAUTHORIZED', message: 'Authentication required. Missing user ID.' },
          timestamp: Date.now(),
        }));
        ws.close(4401, 'Unauthorized: Missing user ID');
        return;
      }

      const user = classroomDb.getUser(requestedUserId);
      if (!user) {
        ws.send(serializeRealtimeMessage({
          type: 'error',
          classroomId,
          payload: { code: 'UNAUTHORIZED', message: `Authentication failed: User ${requestedUserId} does not exist.` },
          timestamp: Date.now(),
        }));
        ws.close(4401, 'Unauthorized: User not found');
        return;
      }

      // 3. Authoritatively determine user role and validate classroom membership
      let authoritativeRole: 'teacher' | 'student' | 'admin' = 'student';
      let isAuthorized = false;

      if (user.role === 'admin') {
        authoritativeRole = 'admin';
        isAuthorized = true;
      } else if (classroom.teacherId === user.id) {
        authoritativeRole = 'teacher';
        isAuthorized = true;
      } else {
        const membership = classroomDb.getMember(classroomId, user.id);
        if (membership && membership.status === 'active') {
          authoritativeRole = membership.role === 'teacher' ? 'teacher' : 'student';
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        console.warn(`[Security Alert] Access Denied: User ${user.id} (${user.name}) is not enrolled in classroom ${classroomId}`);
        ws.send(serializeRealtimeMessage({
          type: 'error',
          classroomId,
          payload: { code: 'FORBIDDEN', message: `Access denied. You are not enrolled in classroom ${classroomId}.` },
          timestamp: Date.now(),
        }));
        ws.close(4403, 'Forbidden: Not enrolled in classroom');
        return;
      }

      const clientMeta: ClientMeta = {
        ws,
        roomId: classroomId,
        classroomId,
        participantId: user.id,
        participantName: user.name,
        participantRole: authoritativeRole,
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

      // Check if client sequence is older than available ring-buffer / event retention
      const isBufferOverflow = since > 0 && currentSeq - since > 500;

      if (isBufferOverflow || since === 0) {
        // Authoritative full state snapshot
        const announcements = classroomDb.listAnnouncements(normRoom);
        const assignments = classroomDb.listAssignments(normRoom);
        const members = classroomDb.listMembers(normRoom);
        const recentMessages = classroomDb.listMessages(normRoom, 50);

        client.ws.send(
          serializeRealtimeMessage({
            type: 'resync_response',
            classroomId: normRoom,
            sequence: Math.max(0, currentSeq),
            payload: {
              isFullSnapshot: true,
              currentSequence: Math.max(0, currentSeq),
              sinceSequence: since,
              events: missed,
              snapshot: {
                announcements,
                assignments,
                members: members.map((m) => ({
                  id: m.userId,
                  name: m.userName,
                  role: m.role,
                  isOnline: m.isOnline,
                })),
                recentMessages,
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
              events: missed,
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
        'session.recording.started',
        'session.recording.stopped',
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
