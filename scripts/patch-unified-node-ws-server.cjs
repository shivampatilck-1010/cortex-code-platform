const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('src/lib/classroom/node-ws-server.ts');

const unifiedSource = `import * as Y from 'yjs';
import http from 'http';
import crypto from 'crypto';
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
  var __cortex_node_http_server: any | undefined;
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
  msgCount: number;
  windowStart: number;
  joinedAt: number;
  unregisterRealtime?: () => void;
}

const connectedClients = new Set<ClientMeta>();

const TEACHER_MODERATION_EVENTS = new Set([
  'TEACHER_MUTE_ALL',
  'TEACHER_STOP_ALL_CAMERAS',
  'TEACHER_MUTE_STUDENT',
  'TEACHER_REQUEST_CAMERA',
  'TEACHER_REQUEST_UNMUTE',
  'PERMISSIONS_UPDATED',
  'media.mute',
  'media.camera_off',
  'media.request_unmute',
  'media.request_camera',
  'media.lock_mic',
  'media.lock_camera',
]);

const PLATFORM_TEACHER_EVENTS = new Set([
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
  'media.mute',
  'media.camera_off',
  'media.request_unmute',
  'media.request_camera',
  'media.lock_mic',
  'media.lock_camera',
]);

/**
 * Broadcast message to other clients in the same room with DM privacy protection
 */
export function broadcastToRoom(roomId: string, message: any, excludeClientId?: string) {
  const normRoom = (typeof roomId === 'string' ? roomId : '').toUpperCase().trim();
  const raw = typeof message === 'string' ? message : (
    message.type && typeof message.type === 'string' && message.version === '1.0'
      ? JSON.stringify(message)
      : serializeRealtimeMessage(message)
  );

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
 * Helper to safely send a JSON envelope over a WebSocket
 */
function sendJson(ws: any, envelope: any) {
  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify(envelope));
    } catch {}
  }
}

/**
 * Helper to send protocol errors
 */
function sendProtocolError(ws: any, code: string, message: string, sessionId: string = 'unknown') {
  sendJson(ws, {
    version: '1.0',
    messageId: 'err-' + crypto.randomUUID(),
    type: 'PROTOCOL_ERROR',
    sessionId,
    timestamp: Date.now(),
    payload: { code, message },
  });
}

/**
 * Ensures the Node.js WebSocket server is started and running on port 3002
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

    let actualPort = desiredPort;

    // Create an HTTP server so /health endpoint is available
    const httpServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            activeClients: connectedClients.size,
            port: actualPort,
            version: '1.0',
            server: 'cortex-unified-signaling',
          })
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const wss = new WebSocketServer({ server: httpServer, maxPayload: 65536 });

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(desiredPort, () => {
        actualPort = desiredPort;
        globalThis.__cortex_node_ws_port = actualPort;
        globalThis.__cortex_node_ws_server = wss;
        globalThis.__cortex_node_http_server = httpServer;
        resolve();
      });

      httpServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // If port 3002 is occupied, pick an ephemeral port
          const fallbackServer = http.createServer((req, res) => {
            if (req.url === '/health') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok', version: '1.0' }));
              return;
            }
            res.writeHead(404);
            res.end();
          });
          fallbackServer.listen(0, () => {
            const addr = fallbackServer.address();
            actualPort = typeof addr === 'object' && addr?.port ? addr.port : 3003;
            const fallbackWss = new WebSocketServer({ server: fallbackServer, maxPayload: 65536 });
            globalThis.__cortex_node_ws_port = actualPort;
            globalThis.__cortex_node_ws_server = fallbackWss;
            globalThis.__cortex_node_http_server = fallbackServer;
            setupSocketHandlers(fallbackWss);
            resolve();
          });
        } else {
          reject(err);
        }
      });
    });

    setupSocketHandlers(wss);

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

    wss.on('close', () => {
      clearInterval(pingInterval);
    });

    return globalThis.__cortex_node_ws_port || actualPort;
  } catch (err) {
    console.warn('[NodeWSServer] Could not start WebSocket server', err);
    return null;
  }
}

function setupSocketHandlers(wss: any) {
  wss.on('connection', async (ws: any, req: any) => {
    const url = new URL(req.url || '/', 'http://localhost');
    
    // Parse classroom ID from path (e.g., /api/v1/classrooms/CLS-123/ws) or query param
    let pathClassroomId = '';
    const parts = url.pathname.split('/');
    const wsIdx = parts.indexOf('ws');
    if (wsIdx > 0) {
      pathClassroomId = parts[wsIdx - 1];
    }
    const classroomId = (pathClassroomId || url.searchParams.get('classroomId') || url.searchParams.get('roomId') || '').toUpperCase().trim();

    // Client metadata container
    const clientMeta: ClientMeta = {
      ws,
      roomId: classroomId,
      classroomId: classroomId,
      participantId: '',
      participantName: '',
      participantRole: 'student',
      isAlive: true,
      msgCount: 0,
      windowStart: Date.now(),
      joinedAt: Date.now(),
    };

    connectedClients.add(clientMeta);

    // Immediately emit SERVER_HELLO handshake (supports Live Class protocol)
    sendJson(ws, {
      version: '1.0',
      messageId: 'hello-' + crypto.randomUUID(),
      type: 'SERVER_HELLO',
      sessionId: classroomId || 'system',
      timestamp: Date.now(),
      payload: {
        serverVersion: '1.0',
        protocol: '1.0',
        connectionId: 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        serverTime: Date.now(),
      },
    });

    // If pre-authenticated via cookie or query token in URL, complete platform handshake
    if (classroomId) {
      let user = await ClassroomAuth.authenticateRequest(req);
      if (!user) {
        const token = url.searchParams.get('token') || (typeof req.headers?.authorization === 'string' ? req.headers.authorization.replace(/^Bearer\\s+/i, '') : null);
        if (token) {
          const verified = ClassroomAuth.verifyLiveSessionToken(token, { expectedClassroomId: classroomId });
          if (verified) {
            user = await classroomDb.getUser(verified.userId);
          }
        }
      }

      if (user) {
        const membership = await ClassroomAuth.verifyClassroomMembership(user, classroomId);
        if (membership.authorized && membership.role) {
          clientMeta.participantId = user.id;
          clientMeta.participantName = user.name;
          clientMeta.participantRole = membership.role;

          // Register with RealtimeCoordinator
          const session: WsClientSession = {
            id: 'ws_' + user.id + '_' + Date.now(),
            userId: user.id,
            userName: user.name,
            role: membership.role,
            classroomId,
            send: (raw: string) => {
              if (ws.readyState === 1) {
                try { ws.send(raw); } catch {}
              }
            },
            isAlive: true,
            lastActive: Date.now(),
          };
          clientMeta.unregisterRealtime = await realtimeCoordinator.registerWsClient(classroomId, session);

          // Initial platform auth_ok
          const currentSeq = (await classroomDb.getNextEventSequence(classroomId)) - 1;
          const members = await classroomDb.listMembers(classroomId);
          ws.send(
            serializeRealtimeMessage({
              type: 'auth_ok',
              classroomId,
              sequence: Math.max(0, currentSeq),
              payload: {
                currentSequence: Math.max(0, currentSeq),
                userId: user.id,
                role: membership.role,
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
        }
      }
    }

    ws.on('pong', () => {
      clientMeta.isAlive = true;
    });

    ws.on('message', (data: any) => {
      try {
        // Rate limiting: 50 messages / sec
        const now = Date.now();
        if (now - clientMeta.windowStart > 1000) {
          clientMeta.windowStart = now;
          clientMeta.msgCount = 0;
        }
        clientMeta.msgCount++;
        if (clientMeta.msgCount > 50) {
          sendProtocolError(ws, 'RATE_LIMITED', 'Message rate limit exceeded. Please throttle sending.', clientMeta.classroomId || 'system');
          return;
        }

        const rawStr = data.toString('utf-8');
        let parsed: any = null;
        try {
          parsed = JSON.parse(rawStr);
        } catch {
          sendProtocolError(ws, 'MALFORMED_JSON', 'Could not parse message as JSON', clientMeta.classroomId || 'system');
          return;
        }

        handleClientMessage(clientMeta, parsed);
      } catch (err) {
        console.error('[NodeWSServer] Message error', err);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(clientMeta);
      if (clientMeta.unregisterRealtime) {
        clientMeta.unregisterRealtime();
      }

      if (clientMeta.classroomId && clientMeta.participantId) {
        // Platform event
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

        // Live Class protocol event
        const leaveMsg = JSON.stringify({
          version: '1.0',
          messageId: 'leave-' + crypto.randomUUID(),
          type: 'PARTICIPANT_LEFT',
          sessionId: clientMeta.classroomId,
          timestamp: Date.now(),
          payload: {
            participantId: clientMeta.participantId,
            name: clientMeta.participantName,
          },
        });

        connectedClients.forEach((other) => {
          if (
            other !== clientMeta &&
            (other.classroomId === clientMeta.classroomId || other.roomId === clientMeta.classroomId) &&
            other.ws.readyState === 1
          ) {
            try { other.ws.send(leaveMsg); } catch {}
          }
        });
      }
    });

    ws.on('error', (err: any) => {
      console.error('[NodeWSServer] Socket error', err);
    });
  });
}

export function getNodeWsPort(): number | null {
  return globalThis.__cortex_node_ws_port || null;
}

/**
 * Handle incoming parsed message from WebSocket client
 */
async function handleClientMessage(client: ClientMeta, msg: any) {
  // --- 1. Live Class Protocol Envelope Branch ---
  if (msg && msg.version === '1.0') {
    const { type, sessionId, payload, messageId } = msg;
    const targetSessionId = (sessionId || client.classroomId || '').toUpperCase().trim();

    switch (type) {
      case 'PING': {
        sendJson(client.ws, {
          version: '1.0',
          messageId: 'pong-' + crypto.randomUUID(),
          type: 'PONG',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload: { echo: payload?.echo || Date.now() },
        });
        return;
      }

      case 'JOIN_CLASSROOM': {
        const { requestedRole, participantName, joinToken } = payload || {};

        if (!targetSessionId) {
          sendProtocolError(client.ws, 'INVALID_SESSION', 'Missing or empty sessionId', 'system');
          return;
        }

        // Validate presence of joinToken
        if (!joinToken || typeof joinToken !== 'string') {
          sendJson(client.ws, {
            version: '1.0',
            messageId: 'rej-' + crypto.randomUUID(),
            type: 'JOIN_REJECTED',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              code: 'UNAUTHORIZED',
              reason: 'Missing live session token. Client must authenticate first.',
            },
          });
          return;
        }

        // Cryptographically verify token and context binding
        const verified = ClassroomAuth.verifyLiveSessionToken(joinToken, {
          expectedClassroomId: targetSessionId,
        });

        if (!verified) {
          sendJson(client.ws, {
            version: '1.0',
            messageId: 'rej-' + crypto.randomUUID(),
            type: 'JOIN_REJECTED',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              code: 'INVALID_TOKEN',
              reason: 'Live session token is invalid, expired, or not bound to this classroom.',
            },
          });
          return;
        }

        // Authoritative role assignment from verified token
        const authoritativeRole = verified.role;
        const participantId = verified.userId;
        const finalName = (participantName && typeof participantName === 'string' && participantName.trim())
          ? participantName.trim().slice(0, 50)
          : (verified as any).name || 'Participant';

        client.classroomId = targetSessionId;
        client.roomId = targetSessionId;
        client.participantId = participantId;
        client.participantRole = authoritativeRole;
        client.participantName = finalName;

        // Build list of active participants in the room
        const activeParticipants = Array.from(connectedClients)
          .filter((c) => (c.classroomId === targetSessionId || c.roomId === targetSessionId) && c.ws.readyState === 1 && c.participantId)
          .map((c) => ({
            id: c.participantId,
            name: c.participantName,
            role: c.participantRole,
            connectedAt: c.joinedAt,
          }));

        // Send JOIN_ACCEPTED to caller
        sendJson(client.ws, {
          version: '1.0',
          messageId: 'acc-' + crypto.randomUUID(),
          type: 'JOIN_ACCEPTED',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload: {
            assignedParticipantId: participantId,
            assignedRole: authoritativeRole,
            sessionId: targetSessionId,
            activeParticipants,
          },
        });

        // Broadcast PARTICIPANT_JOINED to other clients
        const joinNotice = JSON.stringify({
          version: '1.0',
          messageId: 'join-' + crypto.randomUUID(),
          type: 'PARTICIPANT_JOINED',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload: {
            participant: {
              id: participantId,
              name: finalName,
              role: authoritativeRole,
            },
          },
        });

        connectedClients.forEach((other) => {
          if (
            other !== client &&
            (other.classroomId === targetSessionId || other.roomId === targetSessionId) &&
            other.ws.readyState === 1
          ) {
            try { other.ws.send(joinNotice); } catch {}
          }
        });

        return;
      }

      case 'CLASSROOM_EVENT': {
        // Enforce that client has authenticated and joined
        if (!client.participantId || !client.classroomId) {
          sendProtocolError(client.ws, 'NOT_JOINED', 'Client must join a classroom before sending events', targetSessionId || 'system');
          return;
        }

        // Enforce room isolation: cannot emit event into different classroom
        if (targetSessionId && targetSessionId !== client.classroomId) {
          sendProtocolError(client.ws, 'CROSS_CLASSROOM_FORBIDDEN', 'Cross-classroom event broadcast is prohibited', client.classroomId);
          return;
        }

        const eventName = payload?.eventName;
        const requiresTeacher = Boolean(payload?.requiresTeacher);
        const isModerationEvent = requiresTeacher || (typeof eventName === 'string' && TEACHER_MODERATION_EVENTS.has(eventName));

        // Enforce teacher-only moderation authorization on server
        if (isModerationEvent) {
          const isInstructor = client.participantRole === 'teacher' || client.participantRole === 'admin';
          if (!isInstructor) {
            sendProtocolError(
              client.ws,
              'FORBIDDEN_EVENT',
              'Unauthorized: Only instructors are permitted to emit moderation event: ' + eventName,
              client.classroomId
            );
            return;
          }
        }

        // Authoritatively overwrite spoofed sender identities in event payload
        if (payload && typeof payload === 'object') {
          if (payload.data && typeof payload.data === 'object') {
            payload.data.senderId = client.participantId;
            payload.data.actorId = client.participantId;
            payload.data.senderRole = client.participantRole;
          }
          payload.senderId = client.participantId;
        }

        // Broadcast to all other peers in the room
        const broadcastEnvelope = JSON.stringify({
          version: '1.0',
          messageId: 'evt-' + crypto.randomUUID(),
          type: 'CLASSROOM_EVENT',
          sessionId: client.classroomId,
          timestamp: Date.now(),
          payload,
        });

        connectedClients.forEach((other) => {
          if (
            other !== client &&
            (other.classroomId === client.classroomId || other.roomId === client.classroomId) &&
            other.ws.readyState === 1
          ) {
            try { other.ws.send(broadcastEnvelope); } catch {}
          }
        });

        return;
      }

      default:
        // Other Live Class envelope types
        return;
    }
  }

  // --- 2. Platform RealtimeMessage Branch ---
  const normRoom = (msg.classroomId || msg.roomId || client.classroomId || '').toUpperCase().trim();

  switch (msg.type) {
    case 'auth': {
      const currentSeq = (await classroomDb.getNextEventSequence(normRoom)) - 1;
      client.ws.send(
        serializeRealtimeMessage({
          type: 'auth_ok',
          classroomId: normRoom,
          sequence: Math.max(0, currentSeq),
          payload: {
            currentSequence: Math.max(0, currentSeq),
            userId: client.participantId,
            role: client.participantRole,
            members: (await classroomDb.listMembers(normRoom)).map((m) => ({
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
      const currentSeq = (await classroomDb.getNextEventSequence(normRoom)) - 1;
      const since = typeof msg.payload?.sinceSequence === 'number' ? msg.payload.sinceSequence : (msg.sequence || 0);
      const missed = await realtimeCoordinator.getMissedEvents(normRoom, since);

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

      const isBufferOverflow = since > 0 && currentSeq - since > 500;

      if (isBufferOverflow || since === 0) {
        const announcements = await classroomDb.listAnnouncements(normRoom);
        const rawAssignments = await classroomDb.listAssignments(normRoom);
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
        const members = await classroomDb.listMembers(normRoom);
        const allMessages = await classroomDb.listMessages(normRoom, 50);
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

      const isInstructor = client.participantRole === 'teacher' || client.participantRole === 'admin';
      if (PLATFORM_TEACHER_EVENTS.has(eventData.type) && !isInstructor) {
        console.warn('[Security Alert] Non-teacher user ' + client.participantId + ' attempted forbidden event: ' + eventData.type);
        client.ws.send(
          serializeRealtimeMessage({
            type: 'error',
            classroomId: normRoom,
            payload: {
              code: 'FORBIDDEN_EVENT',
              message: 'Unauthorized: Only instructors are permitted to emit ' + eventData.type,
            },
            timestamp: Date.now(),
          })
        );
        return;
      }

      eventData.actorId = client.participantId;
      eventData.actorName = client.participantName;

      if (eventData.payload && typeof eventData.payload === 'object') {
        if (eventData.payload.userId && eventData.payload.userId !== client.participantId) {
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

      const recorded = await realtimeCoordinator.handleIncomingClientEvent(
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
`;

fs.writeFileSync(targetPath, unifiedSource, 'utf8');
console.log('Successfully written unified node-ws-server.ts');
