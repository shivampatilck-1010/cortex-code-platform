import { setEnv } from '../env';
import type { Env } from '../../worker';
import * as Y from 'yjs';
import {
  RealtimeMessage,
  ClassroomRealtimeEvent,
  parseRealtimeMessage,
  serializeRealtimeMessage,
  base64ToUint8Array,
  uint8ArrayToBase64,
  ParticipantAVPresence,
  SessionHydrationSnapshotPayload,
} from './protocol';
import { AuthenticatedClassroomUser, ClassroomAuth } from './auth';

export interface SessionAttachment {
  auth: AuthenticatedClassroomUser;
  participantId: string;
  name: string;
  role: string;
  authenticated: boolean;
  lastActive: number;
  eventRateCount: number;
  eventRateWindowStart: number;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  currentModule?: string;
}

/**
 * Cloudflare Durable Object for authoritative Cortex Classroom rooms
 * Provides persistent event sequencing, duplicate-event deduplication,
 * real-time broadcast, presence management, WebSocket hibernation,
 * targeted WebRTC unicast signaling, and session hydration snapshots.
 */
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
  'TEACHER_START_BROADCAST',
  'TEACHER_PAUSE_BROADCAST',
  'TEACHER_RESUME_BROADCAST',
  'TEACHER_STOP_BROADCAST',
  'TEACHER_CODE_BROADCAST',
  'TEACHER_SHARE_OUTPUT',
  'OBSERVE_STUDENT_SUBSCRIBE',
  'OBSERVE_STUDENT_UNSUBSCRIBE',
]);

export class ClassroomRoomDO {
  state: DurableObjectState;
  env: Env;
  sessions: Map<WebSocket | any, SessionAttachment>;
  yDocs: Map<string, Y.Doc>;
  private currentSequence: number = 0;
  private eventLog: ClassroomRealtimeEvent[] = [];
  private processedEventIds: Set<string> = new Set();

  private initialized: boolean = false;
  private latestTeacherCode: string | null = null;
  private latestTeacherOutput: any | null = null;
  private broadcastState: 'stopped' | 'broadcasting' | 'paused' = 'stopped';
  private publishedTeacherFiles: any[] = [];
  private publishedActiveFileId: string = '';
  private publishedOutput: any = null;
  private observedSubscriptions: Map<string, string> = new Map();
  private studentWorkspaces: Map<string, { files: any[]; activeFileId: string; timestamp: number }> = new Map();

  private whiteboardPages: Array<{
    id: string;
    title?: string;
    background?: string;
    elements: any[];
    viewport?: { zoom: number; pan: { x: number; y: number } };
  }> = [
    {
      id: 'page_1',
      title: 'Page 1',
      background: 'plain-white',
      elements: [],
      viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    },
  ];
  private activeWhiteboardPageIndex: number = 0;
  private activeSlideIndex: number = 0;
  private isPresenting: boolean = false;
  private laserPos: { x: number; y: number } = { x: 50, y: 50 };
  private laserActive: boolean = false;
  private permissions: {
    allowStudentMicrophone: boolean;
    allowStudentCamera: boolean;
    allowStudentScreenShare: boolean;
    allowStudentChat: boolean;
    allowIndependentMode: boolean;
  } = {
    allowStudentMicrophone: true,
    allowStudentCamera: true,
    allowStudentScreenShare: false,
    allowStudentChat: true,
    allowIndependentMode: true,
  };

  constructor(state: DurableObjectState | any, env: Env | any) {
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
        const storedBState = await this.state.storage.get('broadcastState');
        if (typeof storedBState === 'string' && (storedBState === 'broadcasting' || storedBState === 'paused' || storedBState === 'stopped')) {
          this.broadcastState = storedBState;
        }
        const storedPubFiles = await this.state.storage.get('publishedTeacherFiles');
        if (Array.isArray(storedPubFiles)) {
          this.publishedTeacherFiles = storedPubFiles;
        }
        const storedPubFileId = await this.state.storage.get('publishedActiveFileId');
        if (typeof storedPubFileId === 'string') {
          this.publishedActiveFileId = storedPubFileId;
        }
        const storedWb = await this.state.storage.get('whiteboardPages');
        if (Array.isArray(storedWb) && storedWb.length > 0) {
          this.whiteboardPages = storedWb;
        }
        const storedWbIdx = await this.state.storage.get('activeWhiteboardPageIndex');
        if (typeof storedWbIdx === 'number') {
          this.activeWhiteboardPageIndex = storedWbIdx;
        }
        const storedSlideIdx = await this.state.storage.get('activeSlideIndex');
        if (typeof storedSlideIdx === 'number') {
          this.activeSlideIndex = storedSlideIdx;
        }
        const storedPerms = await this.state.storage.get('permissions');
        if (storedPerms && typeof storedPerms === 'object') {
          this.permissions = { ...this.permissions, ...storedPerms };
        }
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
      if (initialContent) {
        ydoc.getText('monaco').insert(0, initialContent);
      }
      this.yDocs.set(documentId, ydoc);
    }
    return this.yDocs.get(documentId)!;
  }

  getSessionMeta(ws: any): SessionAttachment | null {
    let meta = this.sessions.get(ws);
    if (!meta) {
      try {
        if (typeof ws.deserializeAttachment === 'function') {
          meta = ws.deserializeAttachment();
          if (meta) {
            this.sessions.set(ws, meta);
          }
        }
      } catch (e) {
        console.warn('[ClassroomRoomDO] Failed to deserialize attachment', e);
      }
    }
    return meta || null;
  }

  updateSessionMeta(ws: any, meta: SessionAttachment) {
    this.sessions.set(ws, meta);
    try {
      if (typeof ws.serializeAttachment === 'function') {
        ws.serializeAttachment(meta);
      }
    } catch (e) {
      console.warn('[ClassroomRoomDO] Failed to serialize attachment', e);
    }
  }

  getActiveSockets(tag?: string): any[] {
    const sockets: any[] = [];
    const seen = new Set<any>();

    if (this.state && typeof this.state.getWebSockets === 'function') {
      try {
        const cfSockets = tag ? this.state.getWebSockets(tag) : this.state.getWebSockets();
        if (Array.isArray(cfSockets)) {
          for (const s of cfSockets) {
            if (!seen.has(s) && (s.readyState === undefined || s.readyState === 1)) {
              sockets.push(s);
              seen.add(s);
            }
          }
        }
      } catch (err) {
        console.warn('[ClassroomRoomDO] Failed to retrieve hibernated WebSockets for tag:', err);
      }
    }

    if (tag) {
      for (const [ws, meta] of this.sessions.entries()) {
        if (
          meta.participantId === tag ||
          `user:${meta.participantId}` === tag ||
          meta.role === tag ||
          `role:${meta.role}` === tag
        ) {
          if (!seen.has(ws)) {
            sockets.push(ws);
            seen.add(ws);
          }
        }
      }
    } else {
      for (const ws of this.sessions.keys()) {
        if (!seen.has(ws)) {
          sockets.push(ws);
          seen.add(ws);
        }
      }
    }

    return sockets;
  }

  getSocketsForUser(userId: string): any[] {
    const matched: any[] = [];
    const seen = new Set<any>();

    // 1. Tag lookup by participant ID
    const byId = this.getActiveSockets(userId);
    for (const ws of byId) {
      if (!seen.has(ws)) {
        matched.push(ws);
        seen.add(ws);
      }
    }

    // 2. Tag lookup with user: prefix
    const byPrefix = this.getActiveSockets(`user:${userId}`);
    for (const ws of byPrefix) {
      if (!seen.has(ws)) {
        matched.push(ws);
        seen.add(ws);
      }
    }

    // 3. Fallback: attachment inspection / in-memory sessions map
    if (matched.length === 0) {
      const allSockets = this.getActiveSockets();
      for (const ws of allSockets) {
        const meta = this.getSessionMeta(ws);
        if (meta && (meta.participantId === userId || meta.auth?.userId === userId)) {
          if (!seen.has(ws)) {
            matched.push(ws);
            seen.add(ws);
          }
        }
      }
    }

    return matched;
  }

  sendToUser(targetUserId: string, message: string): boolean {
    const sockets = this.getSocketsForUser(targetUserId);
    if (!sockets || sockets.length === 0) {
      return false;
    }
    let delivered = 0;
    for (const ws of sockets) {
      if (ws.readyState === 1 /* WebSocket.OPEN */) {
        try {
          ws.send(message);
          delivered++;
        } catch (err) {
          console.warn(`[ClassroomRoomDO] Failed to deliver unicast packet to user ${targetUserId}:`, err);
        }
      }
    }
    return delivered > 0;
  }

  getActiveParticipants(): Array<{ id: string; name: string; role: string; connectedAt: number }> {
    const sockets = this.getActiveSockets();
    const map = new Map<string, { id: string; name: string; role: string; connectedAt: number }>();
    for (const ws of sockets) {
      const meta = this.getSessionMeta(ws);
      if (meta) {
        map.set(meta.participantId, {
          id: meta.participantId,
          name: meta.name,
          role: meta.role,
          connectedAt: meta.lastActive,
        });
      }
    }
    return Array.from(map.values());
  }

  getParticipantAVPresenceList(): ParticipantAVPresence[] {
    const sockets = this.getActiveSockets();
    const map = new Map<string, ParticipantAVPresence>();
    for (const ws of sockets) {
      const meta = this.getSessionMeta(ws);
      if (meta) {
        map.set(meta.participantId, {
          userId: meta.participantId,
          name: meta.name,
          role: meta.role || 'student',
          connectedAt: meta.lastActive,
          isMuted: meta.isMuted ?? true,
          isVideoOff: meta.isVideoOff ?? true,
          isScreenSharing: meta.isScreenSharing ?? false,
          isHandRaised: meta.isHandRaised ?? false,
          currentModule: meta.currentModule || 'code',
          connectionStatus: 'connected',
        });
      }
    }
    return Array.from(map.values());
  }

  buildHydrationSnapshot(sessionId: string): SessionHydrationSnapshotPayload {
    const yjsDocs: Array<{ fileId: string; stateVector: string; update: string }> = [];
    if (this.publishedActiveFileId && this.yDocs.has(this.publishedActiveFileId)) {
      const ydoc = this.yDocs.get(this.publishedActiveFileId)!;
      yjsDocs.push({
        fileId: this.publishedActiveFileId,
        stateVector: uint8ArrayToBase64(Y.encodeStateVector(ydoc)),
        update: uint8ArrayToBase64(Y.encodeStateAsUpdate(ydoc)),
      });
    }

    return {
      sessionId,
      sequence: this.currentSequence,
      timestamp: Date.now(),
      code: {
        broadcastState: this.broadcastState,
        activeFileId: this.publishedActiveFileId,
        files: (this.broadcastState === 'broadcasting' || this.broadcastState === 'paused') ? this.publishedTeacherFiles : [],
        output: this.publishedOutput || this.latestTeacherOutput || null,
        yjsDocs,
      },
      whiteboard: {
        version: 1,
        activePageIndex: this.activeWhiteboardPageIndex,
        activePageId: this.whiteboardPages[this.activeWhiteboardPageIndex]?.id || 'page_1',
        pages: this.whiteboardPages,
      },
      presentation: {
        isPresenting: this.isPresenting,
        activeSlideIndex: this.activeSlideIndex,
        laserActive: this.laserActive,
        laserPos: this.laserPos,
      },
      presence: {
        activeParticipants: this.getParticipantAVPresenceList(),
      },
      permissions: {
        allowStudentMicrophone: this.permissions.allowStudentMicrophone,
        allowStudentCamera: this.permissions.allowStudentCamera,
        allowStudentScreenShare: this.permissions.allowStudentScreenShare,
        allowStudentChat: this.permissions.allowStudentChat,
        allowIndependentMode: this.permissions.allowIndependentMode,
      },
    };
  }

  async fetch(request: Request): Promise<Response> {
    if (this.env) { setEnv(this.env); }
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
        const directUser = await ClassroomAuth.authenticateRequest(request);
        if (directUser) {
          const url = new URL(request.url);
          const parts = url.pathname.split('/');
          const wsIdx = parts.indexOf('ws');
          let reqClassroomId = url.searchParams.get('classroomId') || '';
          if (!reqClassroomId && wsIdx > 0 && parts[wsIdx - 1]) {
            reqClassroomId = parts[wsIdx - 1];
          }
          reqClassroomId = reqClassroomId.toUpperCase().trim();
          const membership = await ClassroomAuth.verifyClassroomMembership(directUser!, reqClassroomId);
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

      let client: any;
      let server: any;
      const WsPairClass = typeof WebSocketPair !== 'undefined'
        ? WebSocketPair
        : (globalThis as any).WebSocketPair;

      if (typeof WsPairClass === 'function') {
        const pair = new WsPairClass();
        [client, server] = Object.values(pair) as [any, any];
      } else {
        console.warn('[ClassroomRoomDO] WebSocketPair not available -- using mock pair (test environment only)');
        const makeMockWs = () => ({
          readyState: 1,
          send: () => {},
          close: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          serializeAttachment: () => {},
          deserializeAttachment: () => null,
        });
        client = makeMockWs();
        server = makeMockWs();
      }

      const sessionMeta: SessionAttachment = {
        auth,
        participantId: auth.userId,
        name: auth.displayName || 'Participant',
        role: auth.role, // Derived authoritatively from server membership
        authenticated: true,
        lastActive: Date.now(),
        eventRateCount: 0,
        eventRateWindowStart: Date.now(),
      };

      // 1. Serialize attachment before acceptance
      if (typeof server.serializeAttachment === 'function') {
        try {
          server.serializeAttachment(sessionMeta);
        } catch (err) {
          console.warn('[ClassroomRoomDO] Failed to serialize session attachment:', err);
        }
      }

      // 2. Accept into hibernation runtime with tags
      const tags = [
        sessionMeta.participantId,
        `user:${sessionMeta.participantId}`,
        `role:${sessionMeta.role}`,
      ];

      if (typeof this.state?.acceptWebSocket === 'function') {
        this.state.acceptWebSocket(server, tags);
      } else {
        // Test / fallback environment
        if (typeof server.accept === 'function') {
          server.accept();
        }
        server.addEventListener('message', async (ev: any) => {
          await this.webSocketMessage(server, ev.data);
        });
        server.addEventListener('close', async (ev: any) => {
          await this.webSocketClose(server, ev.code || 1000, ev.reason || '', ev.wasClean ?? true);
        });
        server.addEventListener('error', async (ev: any) => {
          await this.webSocketError(server, ev.error || ev);
        });
      }

      this.sessions.set(server, sessionMeta);

      const classroomId = auth.classroomId;

      // Send initial auth_ok with current sequence and presence
      const activeMembers = this.getActiveParticipants().map((s) => ({
        id: s.id,
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
            onlineCount: activeMembers.length,
          },
          timestamp: Date.now(),
        })
      );

      // Emit SERVER_HELLO for Live Class protocol clients
      try {
        server.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'hello-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
            type: 'SERVER_HELLO',
            sessionId: classroomId,
            timestamp: Date.now(),
            payload: {
              serverVersion: '1.0',
              protocol: '1.0',
              connectionId: 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
              serverTime: Date.now(),
            },
          })
        );
      } catch (err) {
        console.warn('[ClassroomRoomDO] Failed to send initial connected message:', err);
      }

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
          onlineCount: this.getActiveSockets().length,
        },
      };
      this.recordAndStoreEvent(joinEvent);
      this.broadcastEvent(joinEvent);

      try {
        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      } catch (err) {
        // Fallback for Node.js test environments where Response disallows 101
        console.warn('[ClassroomRoomDO] Response 101 status failed, falling back to 200 for test environment:', err);
        return new Response(null, {
          status: 200,
          webSocket: client,
        });
      }
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
        connections: this.getActiveSockets().length,
        currentSequence: this.currentSequence,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  async webSocketMessage(ws: any, message: string | ArrayBuffer): Promise<void> {
    try {
      const meta = this.getSessionMeta(ws);
      if (!meta) return;

      const raw = typeof message === 'string' ? message : new TextDecoder().decode(message);

      // Validate payload size (max 512KB)
      if (raw.length > 512 * 1024) {
        console.warn(`[Security Alert] Rejected oversized payload (${raw.length} bytes) from user ${meta.participantId}`);
        ws.send(
          serializeRealtimeMessage({
            type: 'error',
            classroomId: meta.auth.classroomId,
            payload: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Payload exceeds maximum allowed size of 512KB',
            },
            timestamp: Date.now(),
          })
        );
        return;
      }

      // Rate limit: max 5000 events per 10s window (Increased heavily for Yjs typing)
      const now = Date.now();
      if (now - meta.eventRateWindowStart > 10_000) {
        meta.eventRateWindowStart = now;
        meta.eventRateCount = 0;
      }
      meta.eventRateCount++;
      meta.lastActive = now;
      if (meta.eventRateCount > 5000) {
        console.warn(`[Security Alert] Rate limit exceeded by user ${meta.participantId}`);
        ws.send(
          serializeRealtimeMessage({
            type: 'error',
            classroomId: meta.auth.classroomId,
            payload: {
              code: 'RATE_LIMITED',
              message: 'Rate limit exceeded. Please throttle your requests.',
            },
            timestamp: Date.now(),
          })
        );
        return;
      }
      this.updateSessionMeta(ws, meta);

      // Live Class Protocol 1.0 Interceptor
      let parsedLiveMsg: any = null;
      try {
        parsedLiveMsg = JSON.parse(raw);
      } catch (err) {
        console.warn('[ClassroomRoomDO] Failed to parse incoming message as JSON:', err);
      }

      if (
        parsedLiveMsg &&
        (parsedLiveMsg.version === '1.0' ||
          parsedLiveMsg.type === 'JOIN_CLASSROOM' ||
          parsedLiveMsg.type === 'PING' ||
          parsedLiveMsg.type === 'CLASSROOM_EVENT' ||
          parsedLiveMsg.type === 'WEBRTC_OFFER' ||
          parsedLiveMsg.type === 'WEBRTC_ANSWER' ||
          parsedLiveMsg.type === 'WEBRTC_ICE_CANDIDATE')
      ) {
        await this.handleLiveClassProtocol(ws, meta, parsedLiveMsg);
        return;
      }

      const msg = parseRealtimeMessage(raw);
      if (!msg) {
        ws.send(
          serializeRealtimeMessage({
            type: 'error',
            classroomId: meta.auth.classroomId,
            payload: {
              code: 'MALFORMED_EVENT',
              message: 'Invalid message JSON structure',
            },
            timestamp: Date.now(),
          })
        );
        return;
      }

      await this.handleMessage(ws, meta, msg);
    } catch (err) {
      console.error('[ClassroomRoomDO message error]', err);
    }
  }

  async webSocketClose(ws: any, code: number, reason: string, wasClean: boolean): Promise<void> {
    const meta = this.getSessionMeta(ws);
    this.sessions.delete(ws);
    if (!meta) return;

    const classroomId = meta.auth.classroomId;
    const leaveSeq = this.getNextSequence();
    const remainingCount = this.getActiveSockets().filter((s) => s !== ws).length;

    const leaveEvent: ClassroomRealtimeEvent = {
      id: `evt_leave_${Date.now()}_${leaveSeq}`,
      classroomId,
      sequence: leaveSeq,
      type: 'student.left',
      actorId: meta.participantId,
      actorName: meta.name,
      timestamp: Date.now(),
      payload: {
        reason: reason || 'disconnected',
        remainingParticipants: remainingCount,
      },
    };

    this.recordAndStoreEvent(leaveEvent);
    this.broadcastEvent(leaveEvent);

    // Broadcast PARTICIPANT_LEFT for Live Class protocol clients
    try {
      const leaveMsg = JSON.stringify({
        version: '1.0',
        messageId: 'leave-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
        type: 'PARTICIPANT_LEFT',
        sessionId: classroomId,
        timestamp: Date.now(),
        payload: {
          participantId: meta.participantId,
          name: meta.name,
        },
      });
      this.broadcastRaw(leaveMsg);
    } catch (err) {
      console.warn('[ClassroomRoomDO] Failed to broadcast participant leave message:', err);
    }

    if (remainingCount === 0) {
      await this.flushToD1(classroomId);
    }
  }

  async webSocketError(ws: any, error: unknown): Promise<void> {
    console.warn('[ClassroomRoomDO] WebSocket error:', error);
    this.sessions.delete(ws);
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    const allSockets = this.getActiveSockets();
    const firstWs = allSockets[0];
    const meta = firstWs ? this.getSessionMeta(firstWs) : null;
    const room = meta?.auth?.classroomId;
    if (room) {
      await this.flushToD1(room);
    }
  }

  async handleLiveClassProtocol(senderWs: any, meta: SessionAttachment, msg: any) {
    const { type, sessionId, payload } = msg;
    const targetSessionId = sessionId || meta.auth.classroomId;

    switch (type) {
      case 'PING': {
        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'pong-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
            type: 'PONG',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: { echo: payload?.echo || Date.now() },
          })
        );
        return;
      }

      case 'JOIN_CLASSROOM': {
        const participantId = meta.auth?.userId || meta.participantId;
        const finalName = (payload?.participantName && typeof payload.participantName === 'string' && payload.participantName.trim())
          ? payload.participantName.trim().slice(0, 50)
          : meta.name || 'Participant';

        meta.participantId = participantId;
        meta.name = finalName;
        this.updateSessionMeta(senderWs, meta);

        const activeParticipants = this.getActiveParticipants();

        // 1. Send authoritative JOIN_ACCEPTED
        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'acc-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
            type: 'JOIN_ACCEPTED',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              assignedParticipantId: participantId,
              assignedRole: meta.role,
              sessionId: targetSessionId,
              activeParticipants,
            },
          })
        );

        // 2. Send Atomic SESSION_HYDRATION_SNAPSHOT strictly to joining participant
        const hydrationSnapshot = this.buildHydrationSnapshot(targetSessionId);
        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'snap-' + Date.now(),
            type: 'SESSION_HYDRATION_SNAPSHOT',
            sessionId: targetSessionId,
            senderId: 'server',
            timestamp: Date.now(),
            payload: hydrationSnapshot,
          })
        );

        // 3. Send WHITEBOARD_SNAPSHOT for canvas catch-up
        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'wb-snap-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'WHITEBOARD_SNAPSHOT',
              data: {
                version: 1,
                activePageIndex: this.activeWhiteboardPageIndex,
                pages: this.whiteboardPages,
              },
            },
          })
        );

        // 4. Send legacy BROADCAST_STATE_CHANGED for backward compatibility
        senderWs.send(
          JSON.stringify({
            version: '1.0',
            messageId: 'bcast-init-' + Date.now(),
            type: 'CLASSROOM_EVENT',
            sessionId: targetSessionId,
            timestamp: Date.now(),
            payload: {
              eventName: 'BROADCAST_STATE_CHANGED',
              data: {
                state: this.broadcastState,
                files: (this.broadcastState === 'broadcasting' || this.broadcastState === 'paused') ? this.publishedTeacherFiles : [],
                activeFileId: (this.broadcastState === 'broadcasting' || this.broadcastState === 'paused') ? this.publishedActiveFileId : '',
              },
            },
          })
        );

        // 5. Broadcast PARTICIPANT_JOINED to existing peers (exclude joining socket)
        const joinNotice = JSON.stringify({
          version: '1.0',
          messageId: 'join-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
          type: 'PARTICIPANT_JOINED',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload: {
            participant: {
              id: participantId,
              name: finalName,
              role: meta.role,
            },
          },
        });
        this.broadcastRaw(joinNotice, senderWs);
        return;
      }

      // Top-level direct WebRTC Signaling Envelopes
      case 'WEBRTC_OFFER':
      case 'WEBRTC_ANSWER':
      case 'WEBRTC_ICE_CANDIDATE': {
        const effectivePayload = payload || msg;
        const targetUserId = effectivePayload?.targetUserId || msg?.targetUserId || effectivePayload?.data?.targetUserId;
        if (!targetUserId || typeof targetUserId !== 'string' || targetUserId === meta.participantId) {
          return;
        }
        // Authoritative sender attribution
        effectivePayload.senderId = meta.participantId;

        const unicastMsg = JSON.stringify({
          version: '1.0',
          messageId: msg.messageId || `sig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          type,
          sessionId: targetSessionId,
          senderId: meta.participantId,
          senderRole: meta.role,
          timestamp: Date.now(),
          payload: effectivePayload,
        });

        this.sendToUser(targetUserId, unicastMsg);
        return; // Deliver strictly to recipient; do not broadcast!
      }

      case 'CLASSROOM_EVENT': {
        const eventName = payload?.eventName;
        const data = payload?.data;
        const requiresTeacher = Boolean(payload?.requiresTeacher);
        const isModerationEvent = requiresTeacher || (typeof eventName === 'string' && TEACHER_MODERATION_EVENTS.has(eventName));

        if (isModerationEvent) {
          const isInstructor = meta.role === 'teacher' || meta.role === 'admin';
          if (!isInstructor) {
            senderWs.send(
              JSON.stringify({
                version: '1.0',
                messageId: 'err-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
                type: 'PROTOCOL_ERROR',
                sessionId: targetSessionId,
                timestamp: Date.now(),
                payload: {
                  code: 'FORBIDDEN_EVENT',
                  message: 'Unauthorized: Only instructors are permitted to emit moderation event: ' + eventName,
                },
              })
            );
            return;
          }
        }

        // Targeted Unicast Routing for WebRTC Signaling Envelopes inside CLASSROOM_EVENT
        if (eventName === 'WEBRTC_OFFER' || eventName === 'WEBRTC_ANSWER' || eventName === 'WEBRTC_ICE_CANDIDATE') {
          const targetUserId = data?.targetUserId || payload?.targetUserId;
          if (targetUserId && typeof targetUserId === 'string' && targetUserId !== meta.participantId) {
            if (data && typeof data === 'object') {
              data.senderId = meta.participantId;
              data.actorId = meta.participantId;
              data.senderRole = meta.role;
            }
            payload.senderId = meta.participantId;

            const unicastEnvelope = JSON.stringify({
              version: '1.0',
              messageId: msg.messageId || `sig-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              type: 'CLASSROOM_EVENT',
              sessionId: targetSessionId,
              senderId: meta.participantId,
              senderRole: meta.role,
              timestamp: Date.now(),
              payload: {
                eventName,
                data,
                senderId: meta.participantId,
              },
            });

            this.sendToUser(targetUserId, unicastEnvelope);
            return; // Deliver strictly to recipient; do not broadcast!
          }
          return;
        }

        // Monaco CRDT Update Brokerage
        if (eventName === 'MONACO_CRDT_UPDATE' && data?.update) {
          try {
            const fileId = data.fileId || 'default';
            const ydoc = this.getYDoc(fileId);
            const binaryUpdate = base64ToUint8Array(data.update);
            Y.applyUpdate(ydoc, binaryUpdate, meta.participantId);
          } catch (e) {
            console.warn('[ClassroomRoomDO] Failed to broker Yjs CRDT update', e);
          }
        }

        // Vector Whiteboard Delta Streaming & Snapshotting
        if (eventName === 'WHITEBOARD_STROKE_END' && data?.element) {
          const pageIndex = typeof data.pageIndex === 'number' ? data.pageIndex : this.activeWhiteboardPageIndex;
          while (this.whiteboardPages.length <= pageIndex) {
            this.whiteboardPages.push({
              id: `page_${this.whiteboardPages.length + 1}`,
              title: `Page ${this.whiteboardPages.length + 1}`,
              elements: [],
              background: 'plain-white',
              viewport: { zoom: 1, pan: { x: 0, y: 0 } },
            });
          }
          this.whiteboardPages[pageIndex].elements.push(data.element);
          if (this.state?.storage) {
            this.state.storage.put('whiteboardPages', this.whiteboardPages).catch(() => {});
          }
        } else if (eventName === 'WHITEBOARD_ELEMENT_DELTA') {
          const pageIndex = typeof data?.pageIndex === 'number' ? data.pageIndex : this.activeWhiteboardPageIndex;
          if (this.whiteboardPages[pageIndex]) {
            if (data.action === 'DELETE') {
              const removeIds = new Set(data.elementIds || (data.elementId ? [data.elementId] : []));
              this.whiteboardPages[pageIndex].elements = this.whiteboardPages[pageIndex].elements.filter(
                (el: any) => !removeIds.has(el.id)
              );
            } else if (data.action === 'UPDATE' && data.elementId && data.patch) {
              this.whiteboardPages[pageIndex].elements = this.whiteboardPages[pageIndex].elements.map((el: any) =>
                el.id === data.elementId ? { ...el, ...data.patch } : el
              );
            }
            if (this.state?.storage) {
              this.state.storage.put('whiteboardPages', this.whiteboardPages).catch(() => {});
            }
          }
        } else if (eventName === 'WHITEBOARD_PAGE_CHANGED') {
          if (typeof data?.pageIndex === 'number') {
            this.activeWhiteboardPageIndex = data.pageIndex;
            if (this.state?.storage) {
              this.state.storage.put('activeWhiteboardPageIndex', this.activeWhiteboardPageIndex).catch(() => {});
            }
          }
        }

        // Presentation & Laser updates
        if (eventName === 'SLIDE_CHANGED') {
          if (typeof data?.slideIndex === 'number') {
            this.activeSlideIndex = data.slideIndex;
            this.isPresenting = true;
            if (this.state?.storage) {
              this.state.storage.put('activeSlideIndex', this.activeSlideIndex).catch(() => {});
            }
          }
        } else if (eventName === 'LASER_MOVED') {
          if (data?.position) {
            this.laserPos = data.position;
            this.laserActive = Boolean(data.active);
          }
        }

        // Media & Presence tracking
        if (eventName === 'PARTICIPANT_MEDIA_CHANGED' && data) {
          if (typeof data.isMuted === 'boolean') meta.isMuted = data.isMuted;
          if (typeof data.isVideoOff === 'boolean') meta.isVideoOff = data.isVideoOff;
          this.updateSessionMeta(senderWs, meta);
        } else if (eventName === 'HAND_RAISED' && data) {
          if (typeof data.isRaised === 'boolean') meta.isHandRaised = data.isRaised;
          this.updateSessionMeta(senderWs, meta);
        } else if (eventName === 'SCREEN_SHARE_CHANGED' && data) {
          if (typeof data.isScreenSharing === 'boolean') meta.isScreenSharing = data.isScreenSharing;
          this.updateSessionMeta(senderWs, meta);
        } else if (eventName === 'MODULE_CHANGED' && data) {
          if (typeof data.currentModule === 'string') meta.currentModule = data.currentModule;
          this.updateSessionMeta(senderWs, meta);
        } else if (eventName === 'PERMISSIONS_UPDATED' && data) {
          this.permissions = { ...this.permissions, ...data };
          if (this.state?.storage) {
            this.state.storage.put('permissions', this.permissions).catch(() => {});
          }
        }

        // Teacher broadcast state transitions
        if (eventName === 'TEACHER_START_BROADCAST') {
          this.broadcastState = 'broadcasting';
          if (this.state?.storage) this.state.storage.put('broadcastState', this.broadcastState).catch(() => {});
        } else if (eventName === 'TEACHER_PAUSE_BROADCAST') {
          this.broadcastState = 'paused';
          if (this.state?.storage) this.state.storage.put('broadcastState', this.broadcastState).catch(() => {});
        } else if (eventName === 'TEACHER_RESUME_BROADCAST') {
          this.broadcastState = 'broadcasting';
          if (this.state?.storage) this.state.storage.put('broadcastState', this.broadcastState).catch(() => {});
        } else if (eventName === 'TEACHER_STOP_BROADCAST') {
          this.broadcastState = 'stopped';
          if (this.state?.storage) this.state.storage.put('broadcastState', this.broadcastState).catch(() => {});
        } else if (eventName === 'TEACHER_CODE_BROADCAST') {
          if (Array.isArray(data?.files)) {
            this.publishedTeacherFiles = data.files;
            if (this.state?.storage) this.state.storage.put('publishedTeacherFiles', this.publishedTeacherFiles).catch(() => {});
          }
          if (data?.activeFileId) {
            this.publishedActiveFileId = data.activeFileId;
            if (this.state?.storage) this.state.storage.put('publishedActiveFileId', this.publishedActiveFileId).catch(() => {});
          }
          if (data?.code !== undefined) {
            this.latestTeacherCode = data.code;
            if (this.state?.storage) this.state.storage.put('latestTeacherCode', this.latestTeacherCode).catch(() => {});
          }
        } else if (eventName === 'TEACHER_SHARE_OUTPUT') {
          if (data?.output !== undefined) {
            this.publishedOutput = data.output;
            this.latestTeacherOutput = data.output;
            if (this.state?.storage) this.state.storage.put('latestTeacherOutput', this.latestTeacherOutput).catch(() => {});
          }
        }

        if (payload && typeof payload === 'object') {
          if (payload.data && typeof payload.data === 'object') {
            payload.data.senderId = meta.participantId;
            payload.data.actorId = meta.participantId;
            payload.data.senderRole = meta.role;
          }
          payload.senderId = meta.participantId;
        }

        const broadcastEnvelope = JSON.stringify({
          version: '1.0',
          messageId: 'evt-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
          type: 'CLASSROOM_EVENT',
          sessionId: targetSessionId,
          timestamp: Date.now(),
          payload,
        });

        this.broadcastRaw(broadcastEnvelope, senderWs);
        return;
      }

      default:
        this.broadcastRaw(JSON.stringify(msg), senderWs);
        return;
    }
  }

  async handleMessage(senderWs: any, meta: SessionAttachment, msg: RealtimeMessage) {
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

    const sockets = this.getActiveSockets();
    for (const ws of sockets) {
      if (ws.readyState === 1 /* OPEN */) {
        const meta = this.getSessionMeta(ws);
        if (!meta) continue;

        if (isDirectMessage) {
          const isRecipient = meta.auth.userId === recipientId;
          const isSender = meta.auth.userId === senderId;
          const isInstructor = meta.auth.role === 'teacher' || meta.auth.role === 'admin';
          if (!isRecipient && !isSender && !isInstructor) {
            continue;
          }
        }
        if (isGradeEvent) {
          const isTargetStudent = meta.auth.userId === gradeStudentId;
          const isInstructor = meta.auth.role === 'teacher' || meta.auth.role === 'admin';
          if (!isTargetStudent && !isInstructor) {
            continue;
          }
        }
        try {
          ws.send(raw);
        } catch (err) {
          console.warn('[ClassroomRoomDO] Failed to send broadcast message to socket:', err);
        }
      }
    }
  }

  broadcastRaw(raw: string, excludeWs?: any) {
    const sockets = this.getActiveSockets();
    for (const ws of sockets) {
      if (ws !== excludeWs && ws.readyState === 1 /* OPEN */) {
        try {
          ws.send(raw);
        } catch (err) {
          console.warn('[ClassroomRoomDO] Failed to send broadcast message to socket:', err);
        }
      }
    }
  }

  async flushToD1(classroomId: string) {
    if (!this.env?.DB) return;
    try {
      const db = this.env.DB;
      const normId = classroomId.toUpperCase().trim();
      const now = Date.now();
      const stateRaw = JSON.stringify({
        latestTeacherCode: this.latestTeacherCode,
        latestTeacherOutput: this.latestTeacherOutput,
        broadcastState: this.broadcastState,
        publishedTeacherFiles: this.publishedTeacherFiles,
        publishedActiveFileId: this.publishedActiveFileId,
        whiteboardPages: this.whiteboardPages,
        activeSlideIndex: this.activeSlideIndex,
        permissions: this.permissions,
        recentEvents: this.eventLog.slice(-50),
        flushedAt: now,
      });

      const res = await db
        .prepare('UPDATE live_sessions SET state_json = ?, updated_at = ? WHERE classroom_id = ? AND status = ?')
        .bind(stateRaw, now, normId, 'active')
        .run();

      if (!res?.meta?.changes || res.meta.changes === 0) {
        const fallbackId = `sess_${normId}_${now}`;
        await db
          .prepare(`
            INSERT INTO live_sessions (
              id, classroom_id, teacher_id, teacher_name, title, topic, language,
              starter_code, shared_code, is_broadcasting_code, started_at, status,
              state_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            fallbackId,
            normId,
            'system',
            'Instructor',
            'Live Session',
            'Collaborative Session',
            'typescript',
            this.latestTeacherCode || '',
            this.latestTeacherCode || '',
            1,
            now,
            'active',
            stateRaw,
            now
          )
          .run();
      }
    } catch (e) {
      console.error('[DO FlushToD1 Error]', e);
    }
  }
}
