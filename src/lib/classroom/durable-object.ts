import * as Y from 'yjs';
import {
  RealtimeMessage,
  ClassroomRealtimeEvent,
  parseRealtimeMessage,
  serializeRealtimeMessage,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from './protocol';
import { AuthenticatedClassroomUser, ClassroomAuth } from './auth';

interface SessionMeta {
  auth: AuthenticatedClassroomUser;
  participantId: string;
  name: string;
  role: string;
  authenticated: boolean;
  lastActive: number;
  eventRateCount: number;
  eventRateWindowStart: number;
}

/**
 * Cloudflare Durable Object for authoritative Cortex Classroom rooms
 * Provides persistent event sequencing, duplicate-event deduplication,
 * real-time broadcast, presence management, and catch-up resynchronization.
 */
export class ClassroomRoomDO {
  state: any;
  env: any;
  sessions: Map<any, SessionMeta>;
  yDocs: Map<string, Y.Doc>;
  private currentSequence: number = 0;
  private eventLog: ClassroomRealtimeEvent[] = [];
  private processedEventIds: Set<string> = new Set();

  private initialized: boolean = false;
  private latestTeacherCode: string | null = null;
  private latestTeacherOutput: any | null = null;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.yDocs = new Map();
  }

  private async ensureInitialized() {
    if (this.initialized) return;
    try {
      if (this.state?.storage) {
        const storedSeq = await this.state.storage.get('currentSequence');
        if (typeof storedSeq === 'number') {
          this.currentSequence = storedSeq;
        }

        const storedEvents = await this.state.storage.get('recentEvents');
        if (Array.isArray(storedEvents)) {
          this.eventLog = storedEvents;
          for (const ev of storedEvents) {
            if (ev.id) this.processedEventIds.add(ev.id);
          }
        }
        const storedCode = await this.state.storage.get('latestTeacherCode');
        if (typeof storedCode === 'string') this.latestTeacherCode = storedCode;
        const storedOutput = await this.state.storage.get('latestTeacherOutput');
        if (storedOutput !== undefined) this.latestTeacherOutput = storedOutput;
      }
    } catch (e) {
      console.warn('[ClassroomRoomDO] Failed to restore state from storage', e);
    }
    this.initialized = true;
  }

  private getNextSequence(): number {
    this.currentSequence += 1;
    if (this.state?.storage) {
      this.state.storage.put('currentSequence', this.currentSequence).catch(() => {});
    }
    return this.currentSequence;
  }

  private recordAndStoreEvent(event: ClassroomRealtimeEvent) {
    this.processedEventIds.add(event.id);
    this.eventLog.push(event);
    if (this.eventLog.length > 500) {
      this.eventLog.shift();
    }
    if (this.state?.storage) {
      this.state.storage.put('recentEvents', this.eventLog.slice(-100)).catch(() => {});
    }
  }

  getYDoc(documentId: string, initialContent?: string): Y.Doc {
    if (!this.yDocs.has(documentId)) {
      const ydoc = new Y.Doc();
      const ytext = ydoc.getText('monaco');
      if (initialContent) {
        ytext.insert(0, initialContent);
      }
      this.yDocs.set(documentId, ydoc);
    }
    return this.yDocs.get(documentId)!;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const upgradeHeader = request.headers.get('Upgrade');

    if (upgradeHeader === 'websocket') {
      // 1. Authenticate WebSocket upgrade: Check internal token from Worker
      const internalToken = request.headers.get('x-cortex-internal-auth');
      let auth: AuthenticatedClassroomUser | null = internalToken
        ? ClassroomAuth.verifyInternalAuthToken(internalToken)
        : null;

      // 2. Direct authentication fallback (for direct DO calls or testing)
      if (!auth) {
        const directUser = ClassroomAuth.authenticateRequest(request);
        if (directUser) {
          const url = new URL(request.url);
          const parts = url.pathname.split('/');
          const wsIdx = parts.indexOf('ws');
          let reqClassroomId = url.searchParams.get('classroomId') || '';
          if (!reqClassroomId && wsIdx > 0 && parts[wsIdx - 1]) {
            reqClassroomId = parts[wsIdx - 1];
          }
          reqClassroomId = reqClassroomId.toUpperCase().trim();
          const membership = ClassroomAuth.verifyClassroomMembership(directUser, reqClassroomId);
          if (membership.authorized && membership.role) {
            auth = {
              userId: directUser.id,
              classroomId: reqClassroomId,
              role: membership.role,
              displayName: directUser.name,
              email: directUser.email,
              authenticatedAt: Date.now(),
            };
          }
        }
      }

      // Reject unauthenticated requests before accepting WebSocket
      if (!auth) {
        console.warn('[ClassroomRoomDO Security Alert] Rejected unauthenticated WebSocket upgrade request');
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            code: 'UNAUTHORIZED_UPGRADE',
            message: 'WebSocket upgrade rejected: missing or invalid authenticated session',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // @ts-ignore
      const [client, server] = Object.values(new WebSocketPair()) as [any, any];
      
      if (typeof server.accept === 'function') {
        server.accept();
      }

      const classroomId = auth.classroomId;

      const sessionMeta: SessionMeta = {
        auth,
        participantId: auth.userId,
        name: auth.displayName,
        role: auth.role, // Derived authoritatively from server membership
        authenticated: true,
        lastActive: Date.now(),
        eventRateCount: 0,
        eventRateWindowStart: Date.now(),
      };

      this.sessions.set(server, sessionMeta);

      // Send initial auth_ok with current sequence and presence
      const activeMembers = Array.from(this.sessions.values()).map((s) => ({
        id: s.participantId,
        name: s.name,
        role: s.role,
        isOnline: true,
      }));

      server.send(
        serializeRealtimeMessage({
          type: 'auth_ok',
          classroomId,
          sequence: this.currentSequence,
          payload: {
            currentSequence: this.currentSequence,
            userId: auth.userId,
            role: auth.role,
            members: activeMembers,
            onlineCount: this.sessions.size,
          },
          timestamp: Date.now(),
        })
      );

      // Broadcast student.joined event
      const joinSeq = this.getNextSequence();
      const joinEvent: ClassroomRealtimeEvent = {
        id: `evt_join_${Date.now()}_${joinSeq}`,
        classroomId,
        sequence: joinSeq,
        type: 'student.joined',
        actorId: sessionMeta.participantId,
        actorName: sessionMeta.name,
        timestamp: Date.now(),
        payload: {
          userId: sessionMeta.participantId,
          userName: sessionMeta.name,
          role: sessionMeta.role,
          onlineCount: this.sessions.size,
        },
      };
      this.recordAndStoreEvent(joinEvent);
      this.broadcastEvent(joinEvent);

      server.addEventListener('message', async (event: any) => {
        try {
          const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
          
          // Validate payload size (max 512KB)
          if (raw.length > 512 * 1024) {
            console.warn(`[Security Alert] Rejected oversized payload (${raw.length} bytes) from user ${sessionMeta.participantId}`);
            server.send(
              serializeRealtimeMessage({
                type: 'error',
                classroomId,
                payload: {
                  code: 'PAYLOAD_TOO_LARGE',
                  message: 'Payload exceeds maximum allowed size of 512KB',
                },
                timestamp: Date.now(),
              })
            );
            return;
          }

          // Rate limit: max 100 events per 10s window
          const now = Date.now();
          if (now - sessionMeta.eventRateWindowStart > 10_000) {
            sessionMeta.eventRateWindowStart = now;
            sessionMeta.eventRateCount = 0;
          }
          sessionMeta.eventRateCount++;
          if (sessionMeta.eventRateCount > 100) {
            console.warn(`[Security Alert] Rate limit exceeded by user ${sessionMeta.participantId}`);
            server.send(
              serializeRealtimeMessage({
                type: 'error',
                classroomId,
                payload: {
                  code: 'RATE_LIMITED',
                  message: 'Rate limit exceeded. Please throttle your requests.',
                },
                timestamp: Date.now(),
              })
            );
            return;
          }

          const msg = parseRealtimeMessage(raw);
          if (!msg) {
            server.send(
              serializeRealtimeMessage({
                type: 'error',
                classroomId,
                payload: {
                  code: 'MALFORMED_EVENT',
                  message: 'Invalid message JSON structure',
                },
                timestamp: Date.now(),
              })
            );
            return;
          }

          sessionMeta.lastActive = Date.now();
          await this.handleMessage(server, sessionMeta, msg);
        } catch (err) {
          console.error('[ClassroomRoomDO message error]', err);
        }
      });

      server.addEventListener('close', () => {
        this.sessions.delete(server);

        const leaveSeq = this.getNextSequence();
        const leaveEvent: ClassroomRealtimeEvent = {
          id: `evt_leave_${Date.now()}_${leaveSeq}`,
          classroomId,
          sequence: leaveSeq,
          type: 'student.left',
          actorId: sessionMeta.participantId,
          actorName: sessionMeta.name,
          timestamp: Date.now(),
          payload: {
            userId: sessionMeta.participantId,
            userName: sessionMeta.name,
            onlineCount: this.sessions.size,
          },
        };
        this.recordAndStoreEvent(leaveEvent);
        this.broadcastEvent(leaveEvent);
      });

      server.addEventListener('error', () => {
        this.sessions.delete(server);
      });

      return new Response(null, {
        status: 101,
        // @ts-ignore
        webSocket: client,
      });
    }

    // Direct HTTP event dispatch from server / Worker to DO
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.type === 'broadcast') {
          const eventType = body.eventType;
          const payload = body.payload;
          const actor = body.actor || { id: 'system', name: 'System' };
          const classroomId = body.classroomId || '';

          const seq = this.getNextSequence();
          const evt: ClassroomRealtimeEvent = {
            id: body.id || `evt_${Date.now()}_${seq}`,
            classroomId,
            sequence: seq,
            type: eventType,
            actorId: actor.id,
            actorName: actor.name,
            timestamp: Date.now(),
            payload,
          };
          this.recordAndStoreEvent(evt);
          this.broadcastEvent(evt);

          return new Response(JSON.stringify({ success: true, event: evt }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message }), { status: 400 });
      }
    }

    return new Response(
      JSON.stringify({
        status: 'ok',
        connections: this.sessions.size,
        currentSequence: this.currentSequence,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  async handleMessage(senderWs: any, meta: SessionMeta, msg: RealtimeMessage) {
    switch (msg.type) {
      case 'auth': {
        // Re-affirm verified server-derived identity and role (ignore any client-provided role or identity)
        senderWs.send(
          serializeRealtimeMessage({
            type: 'auth_ok',
            classroomId: meta.auth.classroomId,
            roomId: meta.auth.classroomId,
            sequence: this.currentSequence,
            payload: {
              userId: meta.auth.userId,
              name: meta.auth.displayName || meta.name,
              role: meta.auth.role,
              user: meta.auth,
              currentSequence: this.currentSequence,
            },
            timestamp: Date.now(),
          })
        );
        break;
      }

      case 'ping': {
        senderWs.send(
          serializeRealtimeMessage({
            type: 'pong',
            roomId: msg.roomId,
            classroomId: msg.classroomId,
            payload: { clientTimestamp: msg.timestamp, serverTimestamp: Date.now() },
            timestamp: Date.now(),
          })
        );
        break;
      }

      case 'resync_request': {
        const since = typeof msg.payload?.sinceSequence === 'number' ? msg.payload.sinceSequence : (msg.sequence || 0);
        const oldestEvent = this.eventLog.length > 0 ? this.eventLog[0] : null;
        const isBufferOverflow = oldestEvent !== null && since < oldestEvent.sequence && this.eventLog.length >= 100;

        const isInstructor = meta.auth.role === 'teacher' || meta.auth.role === 'admin';
        const missedEvents = this.eventLog.filter((e) => {
          if (e.sequence <= since) return false;
          // Privacy Filter: students must never receive private direct messages of other students
          if (e.type === 'message.created' && (e.payload?.message?.recipientType === 'direct' || e.payload?.message?.recipientType === 'teacher')) {
            const dmSender = e.payload?.message?.senderId || e.actorId;
            const dmRecipient = e.payload?.message?.recipientId;
            return isInstructor || dmSender === meta.auth.userId || dmRecipient === meta.auth.userId;
          }
          // Privacy Filter: students must never receive grades of other students
          if (e.type === 'grade.updated' || e.type === 'submission.graded') {
            const gradeStudentId = e.payload?.submission?.studentId || e.payload?.studentId;
            return isInstructor || gradeStudentId === meta.auth.userId;
          }
          return true;
        });

        senderWs.send(
          serializeRealtimeMessage({
            type: 'resync_response',
            classroomId: meta.auth.classroomId,
            roomId: meta.auth.classroomId,
            sequence: this.currentSequence,
            payload: {
              isFullSnapshot: isBufferOverflow,
              currentSequence: this.currentSequence,
              events: missedEvents,
              sinceSequence: since,
            },
            timestamp: Date.now(),
          })
        );
        break;
      }

      case 'event': {
        const eventData = msg.payload?.event || msg.payload;
        if (!eventData || !eventData.type) return;

        // Duplicate-event protection
        if (eventData.id && this.processedEventIds.has(eventData.id)) {
          senderWs.send(
            serializeRealtimeMessage({
              type: 'ack',
              eventId: eventData.id,
              sequence: eventData.sequence,
              timestamp: Date.now(),
            })
          );
          return;
        }

        // Authorization check for teacher-only events (Strictly from connection.auth.role)
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

        const isInstructor = meta.auth.role === 'teacher' || meta.auth.role === 'admin';
        if (teacherOnlyEvents.has(eventData.type) && !isInstructor) {
          console.warn(`[Security Alert] Forbidden event attempted: user ${meta.auth.userId} (role: ${meta.auth.role}) tried to emit '${eventData.type}'`);
          senderWs.send(
            serializeRealtimeMessage({
              type: 'error',
              classroomId: meta.auth.classroomId,
              payload: {
                code: 'FORBIDDEN_EVENT',
                message: `Unauthorized: Only instructors can emit '${eventData.type}'.`,
              },
              timestamp: Date.now(),
            })
          );
          return;
        }

        const seq = this.getNextSequence();
        const payloadObj = typeof eventData.payload === 'object' && eventData.payload !== null ? { ...eventData.payload } : {};

        // Actor identity overwrite: Never trust client-provided actorId, senderId, or userId
        if (payloadObj.userId && payloadObj.userId !== meta.auth.userId) {
          console.warn(`[Security Alert] Impersonation prevented: user ${meta.auth.userId} tried to send userId ${payloadObj.userId}`);
          payloadObj.userId = meta.auth.userId;
        }
        if (payloadObj.actorId && payloadObj.actorId !== meta.auth.userId) {
          payloadObj.actorId = meta.auth.userId;
        }
        if (payloadObj.senderId && payloadObj.senderId !== meta.auth.userId) {
          payloadObj.senderId = meta.auth.userId;
        }

        // Direct message privacy: Server derives sender identity authoritatively
        if (eventData.type === 'message.created' && payloadObj.message) {
          payloadObj.message = {
            ...payloadObj.message,
            senderId: meta.auth.userId,
            senderName: meta.auth.displayName,
            senderRole: meta.auth.role,
          };
          if (payloadObj.message.recipientType === 'direct') {
            if (!payloadObj.message.recipientId || typeof payloadObj.message.recipientId !== 'string') {
              senderWs.send(
                serializeRealtimeMessage({
                  type: 'error',
                  classroomId: meta.auth.classroomId,
                  payload: { code: 'INVALID_DM', message: 'Direct message requires a valid recipientId' },
                  timestamp: Date.now(),
                })
              );
              return;
            }
          }
        }

        const fullEvent: ClassroomRealtimeEvent = {
          id: eventData.id || `evt_${Date.now()}_${seq}`,
          classroomId: meta.auth.classroomId,
          sequence: seq,
          type: eventData.type,
          actorId: meta.auth.userId, // Authoritative overwrite
          actorName: meta.auth.displayName, // Authoritative overwrite
          timestamp: Date.now(),
          payload: payloadObj,
        };
        
        if (fullEvent.type === 'teacher.code.changed' && fullEvent.payload.code !== undefined) {
          this.latestTeacherCode = fullEvent.payload.code;
          if (this.state?.storage) this.state.storage.put('latestTeacherCode', this.latestTeacherCode).catch(() => {});
        }
        if (fullEvent.type === 'teacher.output.created' && fullEvent.payload.output !== undefined) {
          this.latestTeacherOutput = fullEvent.payload.output;
          if (this.state?.storage) this.state.storage.put('latestTeacherOutput', this.latestTeacherOutput).catch(() => {});
        }

        this.recordAndStoreEvent(fullEvent);
        this.broadcastEvent(fullEvent);

        senderWs.send(
          serializeRealtimeMessage({
            type: 'ack',
            eventId: fullEvent.id,
            sequence: seq,
            timestamp: Date.now(),
          })
        );
        break;
      }

      case 'doc_sync_step1': {
        const docId = msg.documentId || 'default';
        const initialContent = msg.payload?.initialContent;
        const ydoc = this.getYDoc(docId, initialContent);

        let clientVector: Uint8Array | undefined = undefined;
        if (msg.payload?.vector) {
          clientVector = base64ToUint8Array(msg.payload.vector);
        }

        const serverUpdate = Y.encodeStateAsUpdate(ydoc, clientVector);
        const serverVector = Y.encodeStateVector(ydoc);

        senderWs.send(
          serializeRealtimeMessage({
            type: 'doc_sync_step2',
            roomId: msg.roomId,
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
        const ydoc = this.getYDoc(docId);

        if (msg.payload?.update) {
          const binaryUpdate = base64ToUint8Array(msg.payload.update);
          Y.applyUpdate(ydoc, binaryUpdate, meta.participantId);

          this.broadcastRaw(
            serializeRealtimeMessage({
              type: 'doc_update',
              roomId: msg.roomId,
              workspaceId: msg.workspaceId,
              documentId: docId,
              clientId: msg.clientId,
              senderName: msg.senderName,
              payload: { update: msg.payload.update },
              timestamp: Date.now(),
            }),
            senderWs
          );
        }
        break;
      }

      default: {
        this.broadcastRaw(serializeRealtimeMessage(msg), senderWs);
        break;
      }
    }
  }

  broadcastEvent(event: ClassroomRealtimeEvent) {
    const isDirectMessage = event.type === 'message.created' && (event.payload?.message?.recipientType === 'direct' || event.payload?.message?.recipientType === 'teacher');
    const recipientId = event.payload?.message?.recipientId;
    const senderId = event.payload?.message?.senderId;

    const isGradeEvent = event.type === 'grade.updated' || event.type === 'submission.graded';
    const gradeStudentId = event.payload?.submission?.studentId || event.payload?.studentId;

    const raw = serializeRealtimeMessage({
      type: 'event',
      classroomId: event.classroomId,
      roomId: event.classroomId,
      sequence: event.sequence,
      eventId: event.id,
      payload: { event },
      timestamp: event.timestamp,
    });

    this.sessions.forEach((session, ws) => {
      if (ws.readyState === 1 /* OPEN */) {
        if (isDirectMessage) {
          const isRecipient = session.auth.userId === recipientId;
          const isSender = session.auth.userId === senderId;
          const isInstructor = session.auth.role === 'teacher' || session.auth.role === 'admin';
          if (!isRecipient && !isSender && !isInstructor) {
            return;
          }
        }
        if (isGradeEvent) {
          const isTargetStudent = session.auth.userId === gradeStudentId;
          const isInstructor = session.auth.role === 'teacher' || session.auth.role === 'admin';
          if (!isTargetStudent && !isInstructor) {
            return;
          }
        }
        try {
          ws.send(raw);
        } catch {}
      }
    });
  }

  broadcastRaw(raw: string, excludeWs?: any) {
    this.sessions.forEach((_, ws) => {
      if (ws !== excludeWs && ws.readyState === 1 /* OPEN */) {
        try {
          ws.send(raw);
        } catch {}
      }
    });
  }
}
