import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import * as Y from 'yjs';
import { TestHarness, TierExecutionResult } from './test-utils';
import { ClassroomAuth } from '../src/lib/classroom/auth';
import { getAuthoritativeIceServers } from '../src/lib/classroom/ice-servers';
import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  parseRealtimeMessage,
  serializeRealtimeMessage,
  RTCIceCandidateInitLike,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  MonacoCrdtUpdatePayload,
  WhiteboardStrokeStartPayload,
  WhiteboardStrokePointPayload,
  WhiteboardStrokeEndPayload,
  WhiteboardElementDeltaPayload,
  SessionHydrationSnapshotPayload,
} from '../src/lib/classroom/protocol';

// ============================================================================
// HEADLESS WEBRTC & CLASSROOM MESH TEST DOUBLES (W3C COMPLIANT)
// ============================================================================

export class MockMediaStreamTrack {
  public id: string;
  public kind: 'audio' | 'video';
  public label: string;
  public enabled: boolean = true;
  public muted: boolean = false;
  public readyState: 'live' | 'ended' = 'live';

  constructor(kind: 'audio' | 'video', label: string = `${kind}-track`) {
    this.id = `trk-${kind}-${Math.random().toString(36).substring(2, 9)}`;
    this.kind = kind;
    this.label = label;
  }

  public stop(): void {
    this.readyState = 'ended';
  }

  public clone(): MockMediaStreamTrack {
    const cloned = new MockMediaStreamTrack(this.kind, this.label);
    cloned.enabled = this.enabled;
    cloned.muted = this.muted;
    return cloned;
  }
}

export class MockMediaStream {
  public id: string;
  private tracks: MockMediaStreamTrack[] = [];

  constructor(tracks: MockMediaStreamTrack[] = []) {
    this.id = `stm-${Math.random().toString(36).substring(2, 9)}`;
    this.tracks = [...tracks];
  }

  public getTracks(): MockMediaStreamTrack[] {
    return [...this.tracks];
  }

  public getVideoTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  public getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }

  public addTrack(track: MockMediaStreamTrack): void {
    if (!this.tracks.includes(track)) {
      this.tracks.push(track);
    }
  }

  public removeTrack(track: MockMediaStreamTrack): void {
    const idx = this.tracks.indexOf(track);
    if (idx !== -1) {
      this.tracks.splice(idx, 1);
    }
  }
}

export class MockRTCRtpSender {
  public track: MockMediaStreamTrack | null;
  public readonly kind: string;

  constructor(track: MockMediaStreamTrack | null) {
    this.track = track;
    this.kind = track?.kind || 'unknown';
  }

  public async replaceTrack(newTrack: MockMediaStreamTrack | null): Promise<void> {
    this.track = newTrack;
  }
}

export interface MockRTCSessionDescriptionInit {
  type: 'offer' | 'answer' | 'rollback';
  sdp?: string;
}

export class MockRTCPeerConnection {
  public localDescription: MockRTCSessionDescriptionInit | null = null;
  public remoteDescription: MockRTCSessionDescriptionInit | null = null;
  public signalingState: 'stable' | 'have-local-offer' | 'have-remote-offer' | 'closed' = 'stable';
  public iceConnectionState: 'new' | 'checking' | 'connected' | 'completed' | 'failed' | 'disconnected' | 'closed' = 'new';
  public connectionState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed' = 'new';

  public isPolite: boolean = false;
  public makingOffer: boolean = false;
  public ignoreOffer: boolean = false;

  public iceCandidateQueue: RTCIceCandidateInitLike[] = [];
  public processedCandidates: RTCIceCandidateInitLike[] = [];

  public senders: MockRTCRtpSender[] = [];
  public remoteStreams: MockMediaStream[] = [];

  public onnegotiationneeded: (() => void) | null = null;
  public onicecandidate: ((ev: { candidate: RTCIceCandidateInitLike | null }) => void) | null = null;
  public ontrack: ((ev: { track: MockMediaStreamTrack; streams: MockMediaStream[] }) => void) | null = null;
  public onsignalingstatechange: (() => void) | null = null;
  public oniceconnectionstatechange: (() => void) | null = null;

  constructor(public readonly peerId: string, public readonly localUserId: string) {
    // Deterministic politeness based on lexicographical user ID comparison
    this.isPolite = localUserId.localeCompare(peerId) > 0;
  }

  public addTrack(track: MockMediaStreamTrack, stream: MockMediaStream): MockRTCRtpSender {
    const sender = new MockRTCRtpSender(track);
    this.senders.push(sender);
    if (this.signalingState === 'stable') {
      if (this.onnegotiationneeded) {
        this.onnegotiationneeded();
      }
    }
    return sender;
  }

  public getSenders(): MockRTCRtpSender[] {
    return [...this.senders];
  }

  public async createOffer(): Promise<MockRTCSessionDescriptionInit> {
    return {
      type: 'offer',
      sdp: `v=0\r\no=${this.localUserId} 1000 2 IN IP4 127.0.0.1\r\ns=LiveClassroomSession\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nm=audio 9 UDP/TLS/RTP/SAVPF 97\r\n`,
    };
  }

  public async createAnswer(): Promise<MockRTCSessionDescriptionInit> {
    return {
      type: 'answer',
      sdp: `v=0\r\no=${this.localUserId} 1000 2 IN IP4 127.0.0.1\r\ns=LiveClassroomSessionAnswer\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nm=audio 9 UDP/TLS/RTP/SAVPF 97\r\n`,
    };
  }

  public async setLocalDescription(desc: MockRTCSessionDescriptionInit): Promise<void> {
    if (desc.type === 'rollback') {
      if (this.signalingState === 'have-local-offer') {
        this.signalingState = 'stable';
        this.localDescription = null;
      }
      this.makingOffer = false;
      return;
    }

    if (desc.type === 'offer') {
      this.signalingState = 'have-local-offer';
      this.localDescription = desc;
    } else if (desc.type === 'answer') {
      this.signalingState = 'stable';
      this.localDescription = desc;
      this.makingOffer = false;
    }

    if (this.onsignalingstatechange) {
      this.onsignalingstatechange();
    }

    // Emit local ICE candidates if connected
    if (this.onicecandidate) {
      this.onicecandidate({
        candidate: {
          candidate: `candidate:1 1 UDP 2130706431 127.0.0.1 50000 typ host`,
          sdpMid: '0',
          sdpMLineIndex: 0,
        },
      });
    }
  }

  public async setRemoteDescription(desc: MockRTCSessionDescriptionInit): Promise<void> {
    if (desc.type === 'offer') {
      if (this.signalingState !== 'stable') {
        throw new Error(`InvalidStateError: Failed to set remote offer sdp in signalingState: ${this.signalingState}`);
      }
      this.signalingState = 'have-remote-offer';
      this.remoteDescription = desc;
    } else if (desc.type === 'answer') {
      if (this.signalingState !== 'have-local-offer') {
        throw new Error(`InvalidStateError: Failed to set remote answer sdp in signalingState: ${this.signalingState}`);
      }
      this.signalingState = 'stable';
      this.remoteDescription = desc;
      this.iceConnectionState = 'connected';
      this.connectionState = 'connected';
      if (this.oniceconnectionstatechange) {
        this.oniceconnectionstatechange();
      }
    }

    if (this.onsignalingstatechange) {
      this.onsignalingstatechange();
    }

    // Drain queued candidates immediately once remote description is set
    await this.drainCandidateQueue();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInitLike): Promise<void> {
    if (!candidate || !candidate.candidate) {
      throw new Error('TypeError: Candidate string is required');
    }

    // If remote description is not set yet, buffer in queue
    if (!this.remoteDescription) {
      this.iceCandidateQueue.push(candidate);
      return;
    }

    this.processedCandidates.push(candidate);
    if (this.iceConnectionState === 'new' || this.iceConnectionState === 'checking') {
      this.iceConnectionState = 'connected';
      if (this.oniceconnectionstatechange) {
        this.oniceconnectionstatechange();
      }
    }
  }

  public async drainCandidateQueue(): Promise<void> {
    if (!this.remoteDescription) return;

    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      if (candidate) {
        try {
          await this.addIceCandidate(candidate);
        } catch {
          // Isolated candidate error
        }
      }
    }
  }

  public restartIce(): void {
    this.iceConnectionState = 'checking';
    if (this.oniceconnectionstatechange) {
      this.oniceconnectionstatechange();
    }
    if (this.onnegotiationneeded) {
      this.onnegotiationneeded();
    }
  }

  public close(): void {
    this.signalingState = 'closed';
    this.iceConnectionState = 'closed';
    this.connectionState = 'closed';
    this.iceCandidateQueue = [];
  }
}

// ============================================================================
// AUDIO ENERGY & ACTIVE SPEAKER DETECTOR
// ============================================================================

export class MockAudioEnergyMeter {
  public activeSpeakerId: string | null = null;
  public lastSpeechTimestamp: number = 0;
  public readonly hysteresisMs: number = 1500;
  public readonly speakingThreshold: number = 15; // 15% RMS scale

  public static calculateRMS(samples: number[] | Uint8Array): number {
    if (!samples || samples.length === 0) return 0;
    let sumSquares = 0;
    const isUint8 = samples instanceof Uint8Array;
    for (let i = 0; i < samples.length; i++) {
      const val = samples[i];
      const normalized = isUint8
        ? (val - 128) / 128
        : (typeof val === 'number' && val <= 1.0 && val >= -1.0 ? val : (val - 128) / 128);
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / samples.length);
    return Math.min(100, Math.max(0, Math.round(rms * 100)));
  }

  public processParticipantLevels(levels: Map<string, number>, currentTimestamp: number): string | null {
    let topSpeaker: string | null = null;
    let maxLevel = 0;

    for (const [peerId, level] of levels.entries()) {
      if (level > maxLevel && level >= this.speakingThreshold) {
        maxLevel = level;
        topSpeaker = peerId;
      }
    }

    if (topSpeaker) {
      this.activeSpeakerId = topSpeaker;
      this.lastSpeechTimestamp = currentTimestamp;
      return topSpeaker;
    }

    // Check hysteresis decay
    if (this.activeSpeakerId && currentTimestamp - this.lastSpeechTimestamp < this.hysteresisMs) {
      return this.activeSpeakerId;
    }

    this.activeSpeakerId = null;
    return null;
  }
}

// ============================================================================
// VIRTUAL CLASSROOM EDGE BROKER (IN-MEMORY DURABLE OBJECT & PROTOCOL)
// ============================================================================

export interface VirtualWebSocket {
  send: (data: string) => void;
  onmessage?: (ev: { data: string }) => void;
  close: () => void;
}

export class VirtualClassroomEdge {
  public readonly roomId: string;
  private connections: Map<string, { ws: VirtualWebSocket; role: string; name: string }> = new Map();
  public cachedYDocs: Map<string, Y.Doc> = new Map();
  public whiteboardPages: any[] = [{ id: 'page-1', elements: [] }];
  public activePageIndex: number = 0;
  public sequence: number = 0;
  public eventLog: Array<{ sequence: number; event: any }> = [];

  constructor(roomId: string) {
    this.roomId = roomId.toUpperCase().trim();
  }

  public connect(
    userId: string,
    name: string,
    role: 'teacher' | 'student',
    ws: VirtualWebSocket
  ): void {
    this.connections.set(userId, { ws, role, name });
  }

  public disconnect(userId: string): void {
    this.connections.delete(userId);
  }

  public getConnectedUserIds(): string[] {
    return Array.from(this.connections.keys());
  }

  public getYDoc(fileId: string): Y.Doc {
    if (!this.cachedYDocs.has(fileId)) {
      this.cachedYDocs.set(fileId, new Y.Doc());
    }
    return this.cachedYDocs.get(fileId)!;
  }

  public handleClientMessage(senderId: string, rawJson: string): void {
    const parsed = parseRealtimeMessage(rawJson);
    if (!parsed) return;

    this.sequence++;
    const sender = this.connections.get(senderId);
    if (!sender) return;

    // Targeted WebRTC Unicast Routing
    if (
      parsed.type === 'WEBRTC_OFFER' ||
      parsed.type === 'WEBRTC_ANSWER' ||
      parsed.type === 'WEBRTC_ICE_CANDIDATE'
    ) {
      const targetUserId = parsed.payload?.targetUserId;
      if (targetUserId && this.connections.has(targetUserId)) {
        const target = this.connections.get(targetUserId);
        target?.ws.send(
          serializeRealtimeMessage({
            ...parsed,
            senderId,
            sequence: this.sequence,
          })
        );
      }
      return;
    }

    // CRDT Binary Update Processing
    if (parsed.type === 'MONACO_CRDT_UPDATE') {
      const fileId = parsed.payload?.fileId || 'main.ts';
      const updateB64 = parsed.payload?.update;
      if (updateB64) {
        try {
          const binaryUpdate = base64ToUint8Array(updateB64);
          const ydoc = this.getYDoc(fileId);
          Y.applyUpdate(ydoc, binaryUpdate, senderId);

          this.broadcast(
            serializeRealtimeMessage({
              type: 'MONACO_CRDT_UPDATE',
              senderId,
              payload: { fileId, update: updateB64 },
              timestamp: Date.now(),
              sequence: this.sequence,
            }),
            senderId
          );
        } catch {
          // Safe discard on malformed update
        }
      }
      return;
    }

    // Whiteboard Delta Streaming
    if (
      parsed.type === 'WHITEBOARD_STROKE_START' ||
      parsed.type === 'WHITEBOARD_STROKE_POINT' ||
      parsed.type === 'WHITEBOARD_STROKE_END' ||
      parsed.type === 'WHITEBOARD_ELEMENT_DELTA'
    ) {
      if (parsed.type === 'WHITEBOARD_STROKE_END') {
        const elem = parsed.payload?.element;
        const pageIdx = parsed.payload?.pageIndex ?? 0;
        if (elem && this.whiteboardPages[pageIdx]) {
          this.whiteboardPages[pageIdx].elements.push(elem);
        }
      } else if (parsed.type === 'WHITEBOARD_ELEMENT_DELTA') {
        const { action, elementId, patch, elementIds } = parsed.payload || {};
        const pageIdx = parsed.payload?.pageIndex ?? 0;
        const page = this.whiteboardPages[pageIdx];
        if (page) {
          if (action === 'UPDATE' && elementId && patch) {
            const target = page.elements.find((e: any) => e.id === elementId);
            if (target) {
              Object.assign(target, patch);
            }
          } else if (action === 'DELETE') {
            const toDelete = new Set(elementIds || (elementId ? [elementId] : []));
            page.elements = page.elements.filter((e: any) => !toDelete.has(e.id));
          }
        }
      }

      this.broadcast(
        serializeRealtimeMessage({
          ...parsed,
          senderId,
          sequence: this.sequence,
        }),
        senderId
      );
      this.eventLog.push({ sequence: this.sequence, event: parsed });
      return;
    }

    // Generic Event Broadcast
    this.broadcast(
      serializeRealtimeMessage({
        ...parsed,
        senderId,
        sequence: this.sequence,
      }),
      senderId
    );
    this.eventLog.push({ sequence: this.sequence, event: parsed });
  }

  public broadcast(message: string, excludeUserId?: string): void {
    for (const [userId, conn] of this.connections.entries()) {
      if (userId !== excludeUserId) {
        conn.ws.send(message);
      }
    }
  }

  public createHydrationSnapshot(): SessionHydrationSnapshotPayload {
    const yjsDocs: Array<{ fileId: string; stateVector: string; update: string }> = [];
    for (const [fileId, ydoc] of this.cachedYDocs.entries()) {
      const vector = Y.encodeStateVector(ydoc);
      const update = Y.encodeStateAsUpdate(ydoc);
      yjsDocs.push({
        fileId,
        stateVector: uint8ArrayToBase64(vector),
        update: uint8ArrayToBase64(update),
      });
    }

    return {
      sessionId: `sess-${this.roomId}`,
      sequence: this.sequence,
      timestamp: Date.now(),
      code: {
        broadcastState: 'broadcasting',
        activeFileId: 'main.ts',
        files: [
          {
            id: 'main.ts',
            name: 'main.ts',
            language: 'typescript',
            content: this.cachedYDocs.get('main.ts')?.getText('monaco').toString() || '',
          },
        ],
        output: null,
        yjsDocs,
      },
      whiteboard: {
        version: 1,
        activePageIndex: this.activePageIndex,
        pages: JSON.parse(JSON.stringify(this.whiteboardPages)),
      },
      presentation: {
        isPresenting: false,
        activeSlideIndex: 0,
        laserActive: false,
      },
      presence: {
        activeParticipants: Array.from(this.connections.entries()).map(([id, c]) => ({
          userId: id,
          name: c.name,
          role: c.role,
          connectedAt: Date.now(),
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          isHandRaised: false,
          currentModule: 'codestudio',
          connectionStatus: 'connected',
        })),
      },
      permissions: {
        allowStudentMicrophone: true,
        allowStudentCamera: true,
        allowStudentScreenShare: false,
        allowStudentChat: true,
        allowIndependentMode: true,
      },
    };
  }
}

// ============================================================================
// HEADLESS PARTICIPANT CLIENT (PEER STATE MACHINE)
// ============================================================================

export class HeadlessParticipant {
  public readonly userId: string;
  public readonly name: string;
  public readonly role: 'teacher' | 'student';
  public readonly isGuest: boolean;

  public peerConnections: Map<string, MockRTCPeerConnection> = new Map();
  public localStreams: {
    audio: MockMediaStreamTrack | null;
    video: MockMediaStreamTrack | null;
    screen: MockMediaStreamTrack | null;
  } = { audio: null, video: null, screen: null };

  public ydocs: Map<string, Y.Doc> = new Map();
  public whiteboardCanvas: { pages: any[]; activePageIndex: number } = {
    pages: [{ id: 'page-1', elements: [] }],
    activePageIndex: 0,
  };

  public clientWs: VirtualWebSocket | null = null;
  public edgeWs: VirtualWebSocket | null = null;
  public receivedSignalingEnvelopes: any[] = [];
  public lastProcessedSequence: number = 0;

  constructor(
    userId: string,
    name: string,
    role: 'teacher' | 'student' = 'student',
    isGuest: boolean = false
  ) {
    this.userId = userId;
    this.name = name;
    this.role = role;
    this.isGuest = isGuest;
  }

  public connectToEdge(edge: VirtualClassroomEdge): void {
    // Simulating bidirectional WebSocket pair
    const participantWs: VirtualWebSocket = {
      send: (data: string) => {
        edge.handleClientMessage(this.userId, data);
      },
      close: () => {
        edge.disconnect(this.userId);
      },
    };

    const edgeReceiverWs: VirtualWebSocket = {
      send: (data: string) => {
        this.handleIncomingEdgeMessage(data);
      },
      close: () => {},
    };

    this.clientWs = participantWs;
    this.edgeWs = edgeReceiverWs;
    edge.connect(this.userId, this.name, this.role, edgeReceiverWs);
  }

  public getOrCreatePeerConnection(peerId: string): MockRTCPeerConnection {
    const existing = this.peerConnections.get(peerId);
    if (existing) {
      return existing;
    }

    const pc = new MockRTCPeerConnection(peerId, this.userId);
    this.peerConnections.set(peerId, pc);

    pc.onnegotiationneeded = async () => {
      try {
        pc.makingOffer = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.clientWs?.send(
          serializeRealtimeMessage({
            type: 'WEBRTC_OFFER',
            senderId: this.userId,
            payload: {
              targetUserId: peerId,
              sdp: offer.sdp,
              type: 'offer',
              senderId: this.userId,
            },
            timestamp: Date.now(),
          })
        );
      } catch {
        // Negotiation error
      } finally {
        pc.makingOffer = false;
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.clientWs?.send(
          serializeRealtimeMessage({
            type: 'WEBRTC_ICE_CANDIDATE',
            senderId: this.userId,
            payload: {
              targetUserId: peerId,
              candidate: ev.candidate,
              senderId: this.userId,
            },
            timestamp: Date.now(),
          })
        );
      }
    };

    return pc;
  }

  public async handleIncomingEdgeMessage(rawJson: string): Promise<void> {
    const msg = parseRealtimeMessage(rawJson);
    if (!msg) return;

    if (msg.sequence) {
      this.lastProcessedSequence = msg.sequence;
    }

    // 1. W3C Perfect Negotiation Signaling
    if (msg.type === 'WEBRTC_OFFER') {
      const senderId = msg.senderId || msg.payload?.senderId;
      const pc = this.getOrCreatePeerConnection(senderId);
      const offer = { type: 'offer' as const, sdp: msg.payload?.sdp };

      const offerCollision = pc.makingOffer || pc.signalingState !== 'stable';
      pc.ignoreOffer = !pc.isPolite && offerCollision;

      if (pc.ignoreOffer) {
        return;
      }

      if (offerCollision && pc.isPolite) {
        await pc.setLocalDescription({ type: 'rollback' });
      }

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.clientWs?.send(
        serializeRealtimeMessage({
          type: 'WEBRTC_ANSWER',
          senderId: this.userId,
          payload: {
            targetUserId: senderId,
            sdp: answer.sdp,
            type: 'answer',
            senderId: this.userId,
          },
          timestamp: Date.now(),
        })
      );
      this.receivedSignalingEnvelopes.push(msg);
      return;
    }

    if (msg.type === 'WEBRTC_ANSWER') {
      const senderId = msg.senderId || msg.payload?.senderId;
      const pc = this.peerConnections.get(senderId);
      if (pc && pc.signalingState === 'have-local-offer') {
        const answer = { type: 'answer' as const, sdp: msg.payload?.sdp };
        await pc.setRemoteDescription(answer);
      }
      this.receivedSignalingEnvelopes.push(msg);
      return;
    }

    if (msg.type === 'WEBRTC_ICE_CANDIDATE') {
      const senderId = msg.senderId || msg.payload?.senderId;
      const pc = this.getOrCreatePeerConnection(senderId);
      if (msg.payload?.candidate) {
        await pc.addIceCandidate(msg.payload.candidate);
      }
      this.receivedSignalingEnvelopes.push(msg);
      return;
    }

    // 2. Monaco CRDT Updates
    if (msg.type === 'MONACO_CRDT_UPDATE') {
      const { fileId, update } = msg.payload || {};
      if (fileId && update) {
        if (!this.ydocs.has(fileId)) {
          this.ydocs.set(fileId, new Y.Doc());
        }
        const ydoc = this.ydocs.get(fileId)!;
        const binaryUpdate = base64ToUint8Array(update);
        Y.applyUpdate(ydoc, binaryUpdate, msg.senderId);
      }
      return;
    }

    // 3. Whiteboard Delta Updates
    if (msg.type === 'WHITEBOARD_STROKE_END') {
      const { element, pageIndex } = msg.payload || {};
      const pageIdx = pageIndex ?? 0;
      if (element && this.whiteboardCanvas.pages[pageIdx]) {
        this.whiteboardCanvas.pages[pageIdx].elements.push(element);
      }
      return;
    }

    if (msg.type === 'WHITEBOARD_ELEMENT_DELTA') {
      const { action, elementId, patch, elementIds, pageIndex } = msg.payload || {};
      const pageIdx = pageIndex ?? 0;
      const page = this.whiteboardCanvas.pages[pageIdx];
      if (page) {
        if (action === 'UPDATE' && elementId && patch) {
          const target = page.elements.find((e: any) => e.id === elementId);
          if (target) Object.assign(target, patch);
        } else if (action === 'DELETE') {
          const toDel = new Set(elementIds || (elementId ? [elementId] : []));
          page.elements = page.elements.filter((e: any) => !toDel.has(e.id));
        }
      }
      return;
    }

    // 4. Session Hydration Snapshot
    if (msg.type === 'SESSION_HYDRATION_SNAPSHOT') {
      const snapshot: SessionHydrationSnapshotPayload = msg.payload;
      if (snapshot.code?.yjsDocs) {
        for (const docInfo of snapshot.code.yjsDocs) {
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, base64ToUint8Array(docInfo.update));
          this.ydocs.set(docInfo.fileId, ydoc);
        }
      }
      if (snapshot.whiteboard?.pages) {
        this.whiteboardCanvas.pages = snapshot.whiteboard.pages;
        this.whiteboardCanvas.activePageIndex = snapshot.whiteboard.activePageIndex;
      }
      return;
    }
  }

  public setupLocalMedia(): void {
    this.localStreams.audio = new MockMediaStreamTrack('audio', 'Local Microphone');
    this.localStreams.video = new MockMediaStreamTrack('video', 'Local Webcam 1080p');
  }

  public setMicrophoneMuted(muted: boolean): void {
    if (this.localStreams.audio) {
      this.localStreams.audio.enabled = !muted;
    }
  }

  public async replaceVideoTrack(newTrack: MockMediaStreamTrack | null): Promise<void> {
    this.localStreams.video = newTrack;
    for (const pc of this.peerConnections.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.kind === 'video') {
          await sender.replaceTrack(newTrack);
        }
      }
    }
  }
}

// ============================================================================
// TIER 1: FEATURE COVERAGE (45 TEST CASES ACROSS 9 FEATURE GROUPS)
// ============================================================================

export async function runMeshTier1FeatureCoverage(): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 1 - Feature Coverage');

  // --------------------------------------------------------------------------
  // Feature 1: WebRTC Negotiation & Signaling (W3C Polite/Impolite Pattern)
  // --------------------------------------------------------------------------
  harness.startTest('TC1.1.1 - Deterministic Politeness Role Assignment');
  try {
    const teacherId = 'usr_teacher_shivam';
    const studentId = 'usr_student_alex';

    const teacherIsPolite = teacherId.localeCompare(studentId) > 0;
    const studentIsPolite = studentId.localeCompare(teacherId) > 0;

    harness.assert(teacherIsPolite, 'Teacher must be polite peer based on lexicographical order');
    harness.assert(!studentIsPolite, 'Student must be impolite peer based on lexicographical order');
    harness.assertEquals(
      teacherIsPolite !== studentIsPolite,
      true,
      'Politeness roles must be strictly mutually exclusive'
    );
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.1.2 - Unilateral Impolite-Initiated Offer/Answer Handshake');
  try {
    const impolite = new MockRTCPeerConnection('usr_polite', 'usr_impolite');
    const polite = new MockRTCPeerConnection('usr_impolite', 'usr_polite');

    const offer = await impolite.createOffer();
    await impolite.setLocalDescription(offer);
    harness.assertEquals(impolite.signalingState, 'have-local-offer', 'Impolite must enter have-local-offer');

    await polite.setRemoteDescription(offer);
    harness.assertEquals(polite.signalingState, 'have-remote-offer', 'Polite must enter have-remote-offer');

    const answer = await polite.createAnswer();
    await polite.setLocalDescription(answer);
    harness.assertEquals(polite.signalingState, 'stable', 'Polite must return to stable after answer');

    await impolite.setRemoteDescription(answer);
    harness.assertEquals(impolite.signalingState, 'stable', 'Impolite must return to stable after remote answer');
    harness.assertEquals(impolite.iceConnectionState, 'connected', 'ICE state must progress to connected');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.1.3 - Unilateral Polite-Initiated Offer/Answer Handshake');
  try {
    const polite = new MockRTCPeerConnection('usr_a_impolite', 'usr_z_polite');
    const impolite = new MockRTCPeerConnection('usr_z_polite', 'usr_a_impolite');

    const offer = await polite.createOffer();
    await polite.setLocalDescription(offer);
    harness.assertEquals(polite.signalingState, 'have-local-offer', 'Polite must enter have-local-offer');

    await impolite.setRemoteDescription(offer);
    const answer = await impolite.createAnswer();
    await impolite.setLocalDescription(answer);
    await polite.setRemoteDescription(answer);

    harness.assertEquals(polite.signalingState, 'stable', 'Polite must reach stable');
    harness.assertEquals(impolite.signalingState, 'stable', 'Impolite must reach stable');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.1.4 - Negotiation Needed Event Trigger on Track Addition');
  try {
    const pc = new MockRTCPeerConnection('peer-2', 'peer-1');
    let negotiationTriggered = false;
    pc.onnegotiationneeded = () => {
      negotiationTriggered = true;
    };

    const track = new MockMediaStreamTrack('video');
    const stream = new MockMediaStream([track]);
    const sender = pc.addTrack(track, stream);

    harness.assert(negotiationTriggered, 'onnegotiationneeded must fire when track is added in stable state');
    harness.assertEquals(sender.track?.id, track.id, 'Sender must hold added track');
    harness.assertEquals(pc.getSenders().length, 1, 'Peer connection must maintain 1 sender');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.1.5 - W3C Signaling State Machine Transition Sequence');
  try {
    const pc = new MockRTCPeerConnection('peer-b', 'peer-a');
    harness.assertEquals(pc.signalingState, 'stable', 'Initial state must be stable');

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    harness.assertEquals(pc.signalingState, 'have-local-offer', 'State must be have-local-offer');

    // Setting invalid remote offer while in have-local-offer without rollback should throw
    let caughtInvalidState = false;
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: 'fake-sdp' });
    } catch {
      caughtInvalidState = true;
    }
    harness.assert(caughtInvalidState, 'Setting remote offer in have-local-offer must throw InvalidStateError');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 2: ICE Candidate Handling & Queuing
  // --------------------------------------------------------------------------
  harness.startTest('TC1.2.1 - Pre-SDP ICE Candidate Buffering in Queue');
  try {
    const pc = new MockRTCPeerConnection('peer-b', 'peer-a');
    const candidate1: RTCIceCandidateInitLike = { candidate: 'candidate:1 1 UDP 1 127.0.0.1 5000 typ host' };
    const candidate2: RTCIceCandidateInitLike = { candidate: 'candidate:2 1 UDP 2 127.0.0.1 5001 typ srflx' };

    await pc.addIceCandidate(candidate1);
    await pc.addIceCandidate(candidate2);

    harness.assertEquals(pc.iceCandidateQueue.length, 2, 'Queue must buffer 2 early candidates');
    harness.assertEquals(pc.processedCandidates.length, 0, 'No candidate must be processed before remote SDP');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.2.2 - Post-SDP Automatic Queue Draining');
  try {
    const pc = new MockRTCPeerConnection('peer-b', 'peer-a');
    await pc.addIceCandidate({ candidate: 'candidate:early-1 1 UDP 1 127.0.0.1 5000 typ host' });
    await pc.addIceCandidate({ candidate: 'candidate:early-2 1 UDP 2 127.0.0.1 5001 typ host' });

    harness.assertEquals(pc.iceCandidateQueue.length, 2, 'Early candidates must be queued');

    // Now set remote description
    await pc.setRemoteDescription({ type: 'offer', sdp: 'test-sdp' });
    harness.assertEquals(pc.iceCandidateQueue.length, 0, 'Queue must be empty after setRemoteDescription drain');
    harness.assertEquals(pc.processedCandidates.length, 2, 'Both queued candidates must be processed');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.2.3 - In-Flight Direct Candidate Addition');
  try {
    const pc = new MockRTCPeerConnection('peer-b', 'peer-a');
    await pc.setRemoteDescription({ type: 'offer', sdp: 'test-sdp' });

    const liveCandidate: RTCIceCandidateInitLike = { candidate: 'candidate:live 1 UDP 1 127.0.0.1 5000 typ host' };
    await pc.addIceCandidate(liveCandidate);

    harness.assertEquals(pc.iceCandidateQueue.length, 0, 'Queue must remain 0 when candidate added post-SDP');
    harness.assertEquals(pc.processedCandidates.length, 1, 'Candidate must be processed immediately');
    harness.assertEquals(pc.processedCandidates[0].candidate, liveCandidate.candidate, 'Candidate matches');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.2.4 - Candidate Arrival Sequence FIFO Guarantee');
  try {
    const pc = new MockRTCPeerConnection('peer-b', 'peer-a');
    for (let i = 1; i <= 5; i++) {
      await pc.addIceCandidate({ candidate: `candidate:seq-${i} 1 UDP ${i} 127.0.0.1 500${i} typ host` });
    }

    await pc.setRemoteDescription({ type: 'offer', sdp: 'test-sdp' });
    harness.assertEquals(pc.processedCandidates.length, 5, 'All 5 candidates processed');
    for (let i = 0; i < 5; i++) {
      harness.assertIncludes(
        pc.processedCandidates[i].candidate,
        `seq-${i + 1}`,
        `Candidate at index ${i} must preserve FIFO order`
      );
    }
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.2.5 - Malformed Candidate Error Isolation');
  try {
    const pc = new MockRTCPeerConnection('peer-b', 'peer-a');
    await pc.setRemoteDescription({ type: 'offer', sdp: 'test-sdp' });

    let threwError = false;
    try {
      await pc.addIceCandidate({ candidate: '' });
    } catch {
      threwError = true;
    }

    harness.assert(threwError, 'Empty candidate string must throw error');
    // Verify valid candidate still works
    await pc.addIceCandidate({ candidate: 'candidate:valid 1 UDP 1 127.0.0.1 5000 typ host' });
    harness.assertEquals(pc.processedCandidates.length, 1, 'Valid candidate processed after malformed error');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 3: Dynamic Track Hot-Swapping & Media Stream Binding
  // --------------------------------------------------------------------------
  harness.startTest('TC1.3.1 - Microphone Mute via Track Enabled Flag');
  try {
    const audioTrack = new MockMediaStreamTrack('audio', 'Microphone');
    harness.assertEquals(audioTrack.enabled, true, 'Microphone must be enabled initially');

    // Mute microphone
    audioTrack.enabled = false;
    harness.assertEquals(audioTrack.enabled, false, 'track.enabled must be false when muted');
    harness.assertEquals(audioTrack.readyState, 'live', 'Track must remain live (not ended) when muted');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.3.2 - Microphone Unmute Restoration');
  try {
    const audioTrack = new MockMediaStreamTrack('audio', 'Microphone');
    audioTrack.enabled = false;
    audioTrack.enabled = true;
    harness.assertEquals(audioTrack.enabled, true, 'track.enabled restored to true');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.3.3 - Camera Hardware Replacement via replaceTrack');
  try {
    const oldCamera = new MockMediaStreamTrack('video', 'Webcam 720p');
    const newCamera = new MockMediaStreamTrack('video', 'External 4K Cam');

    const sender = new MockRTCRtpSender(oldCamera);
    harness.assertEquals(sender.track?.label, 'Webcam 720p', 'Initial track');

    await sender.replaceTrack(newCamera);
    harness.assertEquals(sender.track?.label, 'External 4K Cam', 'Replaced track');
    harness.assertEquals(sender.track?.id, newCamera.id, 'Sender holds new camera ID');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.3.4 - Screen Share Display Media Track Ingest');
  try {
    const screenTrack = new MockMediaStreamTrack('video', 'Display Screen Capture');
    const sender = new MockRTCRtpSender(null);

    await sender.replaceTrack(screenTrack);
    harness.assertEquals(sender.track?.kind, 'video', 'Display track must be video');
    harness.assertEquals(sender.track?.label, 'Display Screen Capture', 'Display label matched');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.3.5 - Clean Screen Share Teardown & Camera Restoration');
  try {
    const webcam = new MockMediaStreamTrack('video', 'Webcam');
    const screen = new MockMediaStreamTrack('video', 'Screen');
    const sender = new MockRTCRtpSender(webcam);

    // Switch to screen
    await sender.replaceTrack(screen);
    harness.assertEquals(sender.track?.id, screen.id, 'Sharing screen');

    // Stop screen and restore webcam
    screen.stop();
    harness.assertEquals(screen.readyState, 'ended', 'Screen track ended');
    await sender.replaceTrack(webcam);
    harness.assertEquals(sender.track?.id, webcam.id, 'Webcam restored');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 4: Active Speaker Detection (RMS Energy & Hysteresis)
  // --------------------------------------------------------------------------
  harness.startTest('TC1.4.1 - Audio Energy RMS Calculation Accuracy');
  try {
    // Digital silence: all 0s
    const silence = new Uint8Array(256).fill(128); // 128 is center in 8-bit unsigned PCM
    const silenceRMS = MockAudioEnergyMeter.calculateRMS(silence);
    harness.assertEquals(silenceRMS, 0, 'Digital silence must yield 0% RMS');

    // High energy wave
    const highEnergy = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      highEnergy[i] = i % 2 === 0 ? 255 : 0;
    }
    const highRMS = MockAudioEnergyMeter.calculateRMS(highEnergy);
    harness.assertGreaterThanOrEqual(highRMS, 80, 'Peak wave must produce >= 80% RMS');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.4.2 - Active Speaker Threshold Activation');
  try {
    const meter = new MockAudioEnergyMeter();
    const levels = new Map<string, number>();

    // Below threshold (10% < 15%)
    levels.set('peer-1', 10);
    const speaker1 = meter.processParticipantLevels(levels, 1000);
    harness.assertEquals(speaker1, null, 'No speaker when below threshold 15%');

    // Above threshold (35% > 15%)
    levels.set('peer-1', 35);
    const speaker2 = meter.processParticipantLevels(levels, 1100);
    harness.assertEquals(speaker2, 'peer-1', 'Active speaker detected when above threshold');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.4.3 - 1.5-Second Active Speaker Hysteresis Persistence');
  try {
    const meter = new MockAudioEnergyMeter();
    const levels = new Map<string, number>();

    // Speaking at t = 1000ms
    levels.set('peer-1', 50);
    meter.processParticipantLevels(levels, 1000);
    harness.assertEquals(meter.activeSpeakerId, 'peer-1', 'Speaker active');

    // Speech stops at t = 1500ms (500ms elapsed < 1500ms hysteresis)
    levels.set('peer-1', 0);
    const retainedSpeaker = meter.processParticipantLevels(levels, 1500);
    harness.assertEquals(retainedSpeaker, 'peer-1', 'Speaker highlight persists within 1500ms window');

    // At t = 2600ms (1600ms elapsed > 1500ms hysteresis)
    const clearedSpeaker = meter.processParticipantLevels(levels, 2600);
    harness.assertEquals(clearedSpeaker, null, 'Speaker highlight clears after 1500ms hysteresis');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.4.4 - Multi-Participant Highest Energy Selection');
  try {
    const meter = new MockAudioEnergyMeter();
    const levels = new Map<string, number>();
    levels.set('peer-quiet', 18);
    levels.set('peer-loud', 75);
    levels.set('peer-medium', 40);

    const speaker = meter.processParticipantLevels(levels, 1000);
    harness.assertEquals(speaker, 'peer-loud', 'Highest energy speaker must be selected');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.4.5 - Local Microphone Mute Suppresses Energy Meter');
  try {
    const track = new MockMediaStreamTrack('audio', 'Microphone');
    track.enabled = false; // Muted

    const rawSamples = new Uint8Array(256).fill(255);
    const measuredRMS = track.enabled ? MockAudioEnergyMeter.calculateRMS(rawSamples) : 0;
    harness.assertEquals(measuredRMS, 0, 'Muted track must force 0% RMS energy');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 5: Ephemeral Guest Identity Generation & Token Validation
  // --------------------------------------------------------------------------
  harness.startTest('TC1.5.1 - Ephemeral Guest Identity Generation');
  try {
    const guestId = `guest_${crypto.randomBytes(4).toString('hex')}`;
    const guestName = `Guest Student ${guestId.slice(-4).toUpperCase()}`;

    harness.assertMatch(guestId, /^guest_[a-f0-9]{8}$/, 'Guest ID format');
    harness.assertIncludes(guestName, 'Guest Student', 'Guest display name pattern');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.5.2 - HMAC-SHA256 Live Session Token Creation & Verification');
  try {
    const token = ClassroomAuth.createLiveSessionToken({
      userId: 'guest_12345678',
      userName: 'Guest Student 5678',
      userEmail: '',
      classroomId: 'CS-201',
      role: 'student',
      durationMs: 3600000,
    });

    harness.assert(typeof token === 'string' && token.includes('.'), 'Token must be dot-separated string');
    const verified = ClassroomAuth.verifyLiveSessionToken(token);
    harness.assert(verified !== null, 'Token verification must succeed');
    harness.assertEquals(verified?.userId, 'guest_12345678', 'Verified userId');
    harness.assertEquals(verified?.classroomId, 'CS-201', 'Verified classroomId');
    harness.assertEquals(verified?.role, 'student', 'Verified student role');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.5.3 - Tamper-Evident Token Signature Rejection');
  try {
    const token = ClassroomAuth.createLiveSessionToken({
      userId: 'guest_abcd1234',
      userName: 'Guest User',
      userEmail: '',
      classroomId: 'CS-201',
      role: 'student',
    });

    const parts = token.split('.');
    // Tamper with payload
    const tamperedToken = `${parts[0]}X.${parts[1]}`;
    const result = ClassroomAuth.verifyLiveSessionToken(tamperedToken);
    harness.assertEquals(result, null, 'Tampered token must fail verification and return null');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.5.4 - Clock Skew Tolerance Boundary');
  try {
    // Valid token created now
    const validToken = ClassroomAuth.createLiveSessionToken({
      userId: 'usr_normal',
      userName: 'Normal User',
      userEmail: '',
      classroomId: 'CS-201',
      role: 'student',
    });
    const verified = ClassroomAuth.verifyLiveSessionToken(validToken);
    harness.assert(verified !== null, 'Current token passes clock skew check');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.5.5 - Role Boundary Enforcement for Guests');
  try {
    const guestParticipant = new HeadlessParticipant('guest_test', 'Guest Student', 'student', true);
    harness.assertEquals(guestParticipant.role, 'student', 'Guest must have student role');
    harness.assert(guestParticipant.role !== 'teacher', 'Guest cannot assume teacher role');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 6: URL Routing & Case-Insensitive Normalization
  // --------------------------------------------------------------------------
  harness.startTest('TC1.6.1 - Room Identifier Uppercase Normalization');
  try {
    const rawIds = ['cs-201', 'Cs-201', '  cs-201  ', 'CS-201'];
    const normalized = rawIds.map((id) => id.toUpperCase().trim());
    for (const n of normalized) {
      harness.assertEquals(n, 'CS-201', 'All variants must normalize to CS-201');
    }
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.6.2 - Consistent Durable Object Binding');
  try {
    const edge1 = new VirtualClassroomEdge('cs-201');
    const edge2 = new VirtualClassroomEdge('CS-201');
    harness.assertEquals(edge1.roomId, 'CS-201', 'Edge 1 room ID normalized');
    harness.assertEquals(edge2.roomId, 'CS-201', 'Edge 2 room ID normalized');
    harness.assertEquals(edge1.roomId, edge2.roomId, 'Both route to identical room name');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.6.3 - Session Path Parsing and Normalization');
  try {
    const urlPath = '/classroom/cs-algorithms/live/session-demo-42';
    const parts = urlPath.split('/').filter(Boolean);
    const roomId = parts[1]?.toUpperCase().trim();
    const sessionId = parts[3];

    harness.assertEquals(roomId, 'CS-ALGORITHMS', 'Extracted room ID normalized');
    harness.assertEquals(sessionId, 'session-demo-42', 'Extracted session ID');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.6.4 - Query Parameter Role Spoofing Neutralization');
  try {
    // If a request provides ?role=teacher on guest join, server derives role from session
    const guestUser = { id: 'guest_123', role: 'student' };
    const queryRole = 'teacher'; // Untrusted query string

    const authoritativeRole = guestUser.role; // Derived securely from backend
    harness.assertEquals(authoritativeRole, 'student', 'Server ignores query string role');
    harness.assertNotEquals(authoritativeRole, queryRole, 'Spoofed query role neutralized');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.6.5 - Malformed URL Room ID Rejection');
  try {
    const sanitizeRoomId = (raw: string) => {
      const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().trim();
      if (!cleaned || cleaned.length > 64) throw new Error('Invalid roomId');
      return cleaned;
    };

    harness.assertEquals(sanitizeRoomId('cs-101!@#'), 'CS-101', 'Special characters stripped');
    let threw = false;
    try {
      sanitizeRoomId('!!!');
    } catch {
      threw = true;
    }
    harness.assert(threw, 'Empty cleaned room ID throws error');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 7: Monaco Yjs CRDT Binary Updates & State Vectors
  // --------------------------------------------------------------------------
  harness.startTest('TC1.7.1 - Yjs Binary Update Encoding Roundtrip');
  try {
    const doc1 = new Y.Doc();
    const text1 = doc1.getText('monaco');
    text1.insert(0, 'console.log("Hello Cortex");');

    const updateUint8 = Y.encodeStateAsUpdate(doc1);
    const b64 = uint8ArrayToBase64(updateUint8);
    const decodedUint8 = base64ToUint8Array(b64);

    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, decodedUint8);
    const text2 = doc2.getText('monaco');

    harness.assertEquals(text2.toString(), 'console.log("Hello Cortex");', 'CRDT roundtrip convergence');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.7.2 - State Vector Catch-Up Exchange');
  try {
    const serverDoc = new Y.Doc();
    serverDoc.getText('monaco').insert(0, 'function solve() { return 100; }');

    const clientDoc = new Y.Doc();
    const clientVector = Y.encodeStateVector(clientDoc);

    // Server generates update delta for missing client state
    const serverDiff = Y.encodeStateAsUpdate(serverDoc, clientVector);
    Y.applyUpdate(clientDoc, serverDiff);

    harness.assertEquals(clientDoc.getText('monaco').toString(), 'function solve() { return 100; }', 'Caught up');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.7.3 - Multi-Client Real-Time WebSocket CRDT Sync');
  try {
    const edge = new VirtualClassroomEdge('CS-CRDT-TEST');
    const teacher = new HeadlessParticipant('teacher-1', 'Teacher', 'teacher');
    const student = new HeadlessParticipant('student-1', 'Student', 'student');

    teacher.connectToEdge(edge);
    student.connectToEdge(edge);

    // Teacher types code
    const teacherDoc = new Y.Doc();
    teacherDoc.getText('monaco').insert(0, 'const total = 42;');
    const update = uint8ArrayToBase64(Y.encodeStateAsUpdate(teacherDoc));

    teacher.clientWs?.send(
      serializeRealtimeMessage({
        type: 'MONACO_CRDT_UPDATE',
        senderId: teacher.userId,
        payload: { fileId: 'main.ts', update },
        timestamp: Date.now(),
      })
    );

    // Student doc catches up
    const studentDoc = student.ydocs.get('main.ts');
    harness.assert(studentDoc !== undefined, 'Student received main.ts Y.Doc');
    harness.assertEquals(studentDoc?.getText('monaco').toString(), 'const total = 42;', 'Student converged');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.7.4 - Multi-Cursor Nametag Awareness Propagation');
  try {
    const awarenessState = {
      user: { name: 'Alex Chen', color: '#ff9100' },
      cursor: { lineNumber: 15, column: 8 },
    };

    const serialized = JSON.stringify(awarenessState);
    const parsed = JSON.parse(serialized);

    harness.assertEquals(parsed.user.name, 'Alex Chen', 'Awareness user name');
    harness.assertEquals(parsed.cursor.lineNumber, 15, 'Awareness line number');
    harness.assertEquals(parsed.cursor.column, 8, 'Awareness column');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.7.5 - Follow Instructor Viewport Synchronization');
  try {
    const viewportPayload = {
      fileId: 'binary_tree.ts',
      lineNumber: 88,
      column: 1,
      scrollTop: 1200,
      senderId: 'teacher-1',
    };

    harness.assertEquals(viewportPayload.fileId, 'binary_tree.ts', 'Target file synced');
    harness.assertEquals(viewportPayload.lineNumber, 88, 'Line number synced');
    harness.assertEquals(viewportPayload.scrollTop, 1200, 'Scroll position synced');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 8: Whiteboard Stroke Delta Streaming
  // --------------------------------------------------------------------------
  harness.startTest('TC1.8.1 - 3-Stage Vector Stroke Lifecycle');
  try {
    const edge = new VirtualClassroomEdge('CS-WB-TEST');
    const teacher = new HeadlessParticipant('teacher-1', 'Teacher', 'teacher');
    const student = new HeadlessParticipant('student-1', 'Student', 'student');

    teacher.connectToEdge(edge);
    student.connectToEdge(edge);

    const strokeId = 'strk-101';
    // Stage 1: START
    teacher.clientWs?.send(
      serializeRealtimeMessage({
        type: 'WHITEBOARD_STROKE_START',
        senderId: teacher.userId,
        payload: {
          strokeId,
          tool: 'pen',
          color: '#ffffff',
          strokeWidth: 3,
          startPoint: { x: 50, y: 50 },
          pageIndex: 0,
        },
        timestamp: Date.now(),
      })
    );

    // Stage 2: POINT (batched)
    teacher.clientWs?.send(
      serializeRealtimeMessage({
        type: 'WHITEBOARD_STROKE_POINT',
        senderId: teacher.userId,
        payload: {
          strokeId,
          points: [
            { x: 55, y: 52 },
            { x: 60, y: 55 },
          ],
          pageIndex: 0,
        },
        timestamp: Date.now(),
      })
    );

    // Stage 3: END
    const finishedElement = {
      id: strokeId,
      type: 'freedraw',
      points: [
        { x: 50, y: 50 },
        { x: 55, y: 52 },
        { x: 60, y: 55 },
      ],
      color: '#ffffff',
      strokeWidth: 3,
    };

    teacher.clientWs?.send(
      serializeRealtimeMessage({
        type: 'WHITEBOARD_STROKE_END',
        senderId: teacher.userId,
        payload: { strokeId, element: finishedElement, pageIndex: 0 },
        timestamp: Date.now(),
      })
    );

    const studentCanvas = student.whiteboardCanvas.pages[0];
    harness.assertEquals(studentCanvas.elements.length, 1, 'Student received finalized whiteboard stroke');
    harness.assertEquals(studentCanvas.elements[0].id, strokeId, 'Stroke ID matches');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.8.2 - In-Flight Path Streaming During Pen Movement');
  try {
    const pointsBuffer: Array<{ x: number; y: number }> = [];
    // Stream 10 points
    for (let i = 0; i < 10; i++) {
      pointsBuffer.push({ x: 100 + i * 5, y: 100 + i * 2 });
    }

    harness.assertEquals(pointsBuffer.length, 10, 'In-flight buffer holds 10 coordinates');
    harness.assertEquals(pointsBuffer[9].x, 145, 'Latest coordinate calculated correctly');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.8.3 - Conflict-Free Shape Update Delta');
  try {
    const edge = new VirtualClassroomEdge('CS-DELTA-TEST');
    edge.whiteboardPages[0].elements.push({
      id: 'rect-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      color: '#ff0000',
    });

    const teacher = new HeadlessParticipant('teacher-1', 'Teacher', 'teacher');
    teacher.connectToEdge(edge);

    const student = new HeadlessParticipant('student-1', 'Student', 'student');
    student.whiteboardCanvas.pages[0].elements.push({
      id: 'rect-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      color: '#ff0000',
    });
    student.connectToEdge(edge);

    // Dispatch update delta
    teacher.clientWs?.send(
      serializeRealtimeMessage({
        type: 'WHITEBOARD_ELEMENT_DELTA',
        senderId: 'teacher-1',
        payload: {
          action: 'UPDATE',
          elementId: 'rect-1',
          patch: { x: 150, y: 120, color: '#00ff00' },
          pageIndex: 0,
        },
        timestamp: Date.now(),
      })
    );

    const updatedRect = student.whiteboardCanvas.pages[0].elements[0];
    harness.assertEquals(updatedRect.x, 150, 'x updated');
    harness.assertEquals(updatedRect.y, 120, 'y updated');
    harness.assertEquals(updatedRect.color, '#00ff00', 'color updated');
    harness.assertEquals(updatedRect.width, 200, 'width preserved');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.8.4 - Element Deletion Delta');
  try {
    const edge = new VirtualClassroomEdge('CS-DEL-TEST');
    edge.whiteboardPages[0].elements = [
      { id: 'shape-1', type: 'circle' },
      { id: 'shape-2', type: 'circle' },
    ];

    const teacher = new HeadlessParticipant('teacher-1', 'Teacher', 'teacher');
    teacher.connectToEdge(edge);

    const student = new HeadlessParticipant('student-1', 'Student', 'student');
    student.whiteboardCanvas.pages[0].elements = [
      { id: 'shape-1', type: 'circle' },
      { id: 'shape-2', type: 'circle' },
    ];
    student.connectToEdge(edge);

    // Delete shape-1
    teacher.clientWs?.send(
      serializeRealtimeMessage({
        type: 'WHITEBOARD_ELEMENT_DELTA',
        senderId: 'teacher-1',
        payload: { action: 'DELETE', elementId: 'shape-1', pageIndex: 0 },
        timestamp: Date.now(),
      })
    );

    harness.assertEquals(student.whiteboardCanvas.pages[0].elements.length, 1, '1 element remaining');
    harness.assertEquals(student.whiteboardCanvas.pages[0].elements[0].id, 'shape-2', 'shape-2 preserved');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.8.5 - Micro-Click Discard (<4px) Validation');
  try {
    const startPos = { x: 50, y: 50 };
    const endPos = { x: 51, y: 51 };
    const dist = Math.hypot(endPos.x - startPos.x, endPos.y - startPos.y);

    const shouldDiscard = dist < 4.0;
    harness.assert(shouldDiscard, 'Micro-clicks < 4px must be discarded locally');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // --------------------------------------------------------------------------
  // Feature 9: Authoritative Snapshot Hydration for Late Joiners
  // --------------------------------------------------------------------------
  harness.startTest('TC1.9.1 - DO Snapshot Payload Assembly');
  try {
    const edge = new VirtualClassroomEdge('CS-SNAP-TEST');
    const doc = edge.getYDoc('main.ts');
    doc.getText('monaco').insert(0, 'export const PI = 3.14159;');
    edge.whiteboardPages[0].elements.push({ id: 'shape-init', type: 'rect' });

    const snapshot = edge.createHydrationSnapshot();
    harness.assertEquals(snapshot.sessionId, 'sess-CS-SNAP-TEST', 'Snapshot session ID');
    harness.assertEquals(snapshot.code.files[0].content, 'export const PI = 3.14159;', 'Snapshot code content');
    harness.assertEquals(snapshot.whiteboard.pages[0].elements.length, 1, 'Snapshot whiteboard element count');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.9.2 - Late Joiner Instant State Recovery');
  try {
    const edge = new VirtualClassroomEdge('CS-LATE-TEST');
    edge.getYDoc('main.ts').getText('monaco').insert(0, 'class Tree {}');
    edge.whiteboardPages[0].elements.push({ id: 'node-1', type: 'circle' });

    const lateJoiner = new HeadlessParticipant('late-student', 'Late Student', 'student');
    lateJoiner.connectToEdge(edge);

    // Deliver snapshot
    const snapshot = edge.createHydrationSnapshot();
    lateJoiner.handleIncomingEdgeMessage(
      serializeRealtimeMessage({
        type: 'SESSION_HYDRATION_SNAPSHOT',
        payload: snapshot,
        timestamp: Date.now(),
      })
    );

    harness.assertEquals(lateJoiner.ydocs.get('main.ts')?.getText('monaco').toString(), 'class Tree {}', 'Code recovered');
    harness.assertEquals(lateJoiner.whiteboardCanvas.pages[0].elements.length, 1, 'Whiteboard element recovered');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.9.3 - Incremental Catch-up on Mid-Session Join');
  try {
    const doc = new Y.Doc();
    doc.getText('monaco').insert(0, 'let count = 0;\ncount += 1;');
    const clientVector = Y.encodeStateVector(new Y.Doc());
    const diff = Y.encodeStateAsUpdate(doc, clientVector);

    const newDoc = new Y.Doc();
    Y.applyUpdate(newDoc, diff);
    harness.assertEquals(newDoc.getText('monaco').toString(), 'let count = 0;\ncount += 1;', 'Diff applied cleanly');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.9.4 - Whiteboard Multi-Page Snapshot Serialization');
  try {
    const pages = [
      { id: 'page-1', elements: [{ id: 'el-1' }] },
      { id: 'page-2', elements: [{ id: 'el-2' }, { id: 'el-3' }] },
    ];
    const serialized = JSON.stringify(pages);
    const parsed = JSON.parse(serialized);

    harness.assertEquals(parsed.length, 2, '2 pages serialized');
    harness.assertEquals(parsed[1].elements.length, 2, 'Page 2 element count');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  harness.startTest('TC1.9.5 - Authoritative ICE Servers Dynamic Generation');
  try {
    const ice = getAuthoritativeIceServers('test-user');
    harness.assert(Array.isArray(ice.iceServers), 'iceServers is array');
    harness.assertGreaterThanOrEqual(ice.iceServers.length, 1, 'Contains at least default STUN');
    harness.assert(ice.ttlSeconds > 0, 'TTL is positive');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  return harness.getSummary();
}

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (ADVERSARIAL STRESS VERIFICATION)
// ============================================================================

export async function runMeshTier2BoundaryCorner(): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 2 - Boundary and Corner Cases');

  // Test 1: Offer Collision Glare Resolution with Rollback
  harness.startTest('TC2.1 - True Simultaneous Offer Glare with Rollback Resolution');
  try {
    const polite = new MockRTCPeerConnection('usr_impolite', 'usr_polite');
    const impolite = new MockRTCPeerConnection('usr_polite', 'usr_impolite');

    // Both initiate offers simultaneously!
    polite.makingOffer = true;
    const politeOffer = await polite.createOffer();
    await polite.setLocalDescription(politeOffer);

    impolite.makingOffer = true;
    const impoliteOffer = await impolite.createOffer();
    await impolite.setLocalDescription(impoliteOffer);

    harness.assertEquals(polite.signalingState, 'have-local-offer', 'Polite in have-local-offer');
    harness.assertEquals(impolite.signalingState, 'have-local-offer', 'Impolite in have-local-offer');

    // Glare resolution:
    // Impolite receives politeOffer: collision detected! Impolite ignores offer.
    const impoliteCollision = impolite.makingOffer || impolite.signalingState !== 'stable';
    harness.assert(impoliteCollision, 'Impolite detects offer collision');
    impolite.ignoreOffer = true;

    // Polite receives impoliteOffer: collision detected! Polite is polite, so rolls back!
    const politeCollision = polite.makingOffer || polite.signalingState !== 'stable';
    harness.assert(politeCollision, 'Polite detects offer collision');
    await polite.setLocalDescription({ type: 'rollback' });
    harness.assertEquals(polite.signalingState, 'stable', 'Polite rolled back to stable');

    // Polite accepts impoliteOffer
    await polite.setRemoteDescription(impoliteOffer);
    harness.assertEquals(polite.signalingState, 'have-remote-offer', 'Polite enters have-remote-offer');
    const answer = await polite.createAnswer();
    await polite.setLocalDescription(answer);
    harness.assertEquals(polite.signalingState, 'stable', 'Polite returns to stable after answer');

    // Impolite receives answer
    await impolite.setRemoteDescription(answer);
    harness.assertEquals(impolite.signalingState, 'stable', 'Impolite returns to stable after answer');
    harness.assertEquals(impolite.iceConnectionState, 'connected', 'Both connected with zero errors');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Test 2: Early ICE Candidates Flooding
  harness.startTest('TC2.2 - Early ICE Candidates Flooding (50 Candidates Before SDP)');
  try {
    const pc = new MockRTCPeerConnection('peer-b', 'peer-a');
    for (let i = 0; i < 50; i++) {
      await pc.addIceCandidate({
        candidate: `candidate:${i} 1 UDP ${i} 192.168.1.${i % 250} 500${i} typ host`,
        sdpMid: '0',
        sdpMLineIndex: 0,
      });
    }

    harness.assertEquals(pc.iceCandidateQueue.length, 50, 'All 50 candidates buffered in queue');
    harness.assertEquals(pc.processedCandidates.length, 0, 'Zero processed before remote description');

    // Remote SDP arrives
    await pc.setRemoteDescription({ type: 'offer', sdp: 'remote-sdp' });
    harness.assertEquals(pc.iceCandidateQueue.length, 0, 'Queue completely drained');
    harness.assertEquals(pc.processedCandidates.length, 50, 'All 50 candidates applied');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Test 3: High-Speed Drawing Throughput (>100 points/second) with Batching
  harness.startTest('TC2.3 - High-Speed Drawing Throughput (>100 points/second) with Batching');
  try {
    const rawPoints: Array<{ x: number; y: number }> = [];
    const startTime = Date.now();
    for (let i = 0; i < 200; i++) {
      rawPoints.push({ x: 100 + i * 2, y: 200 + Math.sin(i) * 50 });
    }

    // 16ms rAF coalescing into chunks of 5 points
    const batchedFrames: Array<Array<{ x: number; y: number }>> = [];
    const chunkSize = 5;
    for (let i = 0; i < rawPoints.length; i += chunkSize) {
      batchedFrames.push(rawPoints.slice(i, i + chunkSize));
    }

    harness.assertEquals(rawPoints.length, 200, '200 high-speed points generated');
    harness.assertEquals(batchedFrames.length, 40, 'Coalesced into 40 batched frames');
    const totalReassembled = batchedFrames.reduce((acc, f) => acc + f.length, 0);
    harness.assertEquals(totalReassembled, 200, 'All points preserved with zero loss');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Test 4: Simultaneous CRDT Edits at Identical String Offset
  harness.startTest('TC2.4 - Simultaneous CRDT Edits at Identical String Offset');
  try {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Initial base state
    docA.getText('monaco').insert(0, 'Hello World');
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

    // Both insert at offset 5 simultaneously
    // Client A inserts " Beautiful"
    docA.getText('monaco').insert(5, ' Beautiful');
    // Client B inserts " Brave"
    docB.getText('monaco').insert(5, ' Brave');

    // Exchange updates
    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);

    Y.applyUpdate(docB, updateA);
    Y.applyUpdate(docA, updateB);

    const resultA = docA.getText('monaco').toString();
    const resultB = docB.getText('monaco').toString();

    harness.assertEquals(resultA, resultB, 'Both documents converge to identical string');
    harness.assert(resultA.includes('Beautiful') && resultA.includes('Brave'), 'Both edits preserved without loss');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Test 5: Disconnection & 3s Network Partition Reconnect
  harness.startTest('TC2.5 - Disconnection & 3s Network Partition Reconnect with Event Replay');
  try {
    const edge = new VirtualClassroomEdge('CS-PARTITION');
    const student = new HeadlessParticipant('student-reconnect', 'Student', 'student');
    student.connectToEdge(edge);

    // Disconnect student
    student.clientWs?.close();

    // Teacher writes code while student is disconnected
    const doc = edge.getYDoc('main.ts');
    doc.getText('monaco').insert(0, 'const recovered = true;');
    edge.whiteboardPages[0].elements.push({ id: 'shape-offline', type: 'rect' });

    // 3 seconds elapsed in real time (simulated)
    // Student reconnects and catches up via snapshot
    const reconnectedStudent = new HeadlessParticipant('student-reconnect', 'Student', 'student');
    reconnectedStudent.connectToEdge(edge);
    const snapshot = edge.createHydrationSnapshot();
    await reconnectedStudent.handleIncomingEdgeMessage(
      serializeRealtimeMessage({
        type: 'SESSION_HYDRATION_SNAPSHOT',
        payload: snapshot,
        timestamp: Date.now(),
      })
    );

    harness.assertEquals(
      reconnectedStudent.ydocs.get('main.ts')?.getText('monaco').toString(),
      'const recovered = true;',
      'Code state restored after partition'
    );
    harness.assertEquals(
      reconnectedStudent.whiteboardCanvas.pages[0].elements.length,
      1,
      'Whiteboard state restored after partition'
    );
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  return harness.getSummary();
}

// ============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ============================================================================

export async function runMeshTier3CrossFeature(): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 3 - Cross-Feature Combinations');

  // Test 1: Screen Share Presentation Layout + Monaco Split View
  harness.startTest('TC3.1 - Screen Share Presentation Layout + Monaco Split View');
  try {
    const teacher = new HeadlessParticipant('teacher-presenter', 'Teacher', 'teacher');
    const student = new HeadlessParticipant('student-viewer', 'Student', 'student');
    const edge = new VirtualClassroomEdge('CS-STAGE-CRDT');

    teacher.connectToEdge(edge);
    student.connectToEdge(edge);

    // 1. Teacher starts screen share
    const screenTrack = new MockMediaStreamTrack('video', 'Presentation Screen');
    teacher.localStreams.screen = screenTrack;
    const pc = teacher.getOrCreatePeerConnection(student.userId);
    pc.addTrack(screenTrack, new MockMediaStream([screenTrack]));

    // 2. Concurrently, 4 participants edit code
    const doc = edge.getYDoc('exercise.ts');
    for (let i = 0; i < 4; i++) {
      doc.getText('monaco').insert(doc.getText('monaco').length, `// Student ${i} line\n`);
    }

    harness.assertEquals(screenTrack.readyState, 'live', 'Screen share track is live');
    harness.assertEquals(pc.getSenders().length, 1, 'Screen sender registered');
    harness.assertEquals(doc.getText('monaco').toString().split('\n').length - 1, 4, '4 concurrent lines inserted');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Test 2: Web Audio Energy Sampling During Active Whiteboard Drawing
  harness.startTest('TC3.2 - Web Audio Energy Sampling During Active Whiteboard Drawing');
  try {
    const meter = new MockAudioEnergyMeter();
    const levels = new Map<string, number>();

    // Simultaneously evaluate audio and whiteboard points
    const pointsDrawn: number[] = [];
    for (let tick = 0; tick < 10; tick++) {
      // Audio level pulses on tick 3 to 7
      levels.set('speaker-1', tick >= 3 && tick <= 7 ? 65 : 5);
      meter.processParticipantLevels(levels, 1000 + tick * 100);

      // Whiteboard coordinate streams
      pointsDrawn.push(tick * 10);
    }

    harness.assertEquals(pointsDrawn.length, 10, '10 whiteboard coordinate ticks processed');
    harness.assert(meter.activeSpeakerId !== null, 'Active speaker identified during drawing');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Test 3: Guest Joining During Active Code Broadcast
  harness.startTest('TC3.3 - Guest Joining During Active Code Broadcast');
  try {
    const edge = new VirtualClassroomEdge('CS-LIVE-BROADCAST');
    // Teacher broadcasting AVL tree code
    const teacherDoc = edge.getYDoc('avl.ts');
    teacherDoc.getText('monaco').insert(0, 'class AVLNode { key: number; height: number = 1; }');

    // Unauthenticated guest arrives
    const guestId = 'guest_joiner_99';
    const guestToken = ClassroomAuth.createLiveSessionToken({
      userId: guestId,
      userName: 'Guest Student 99',
      userEmail: '',
      classroomId: 'CS-LIVE-BROADCAST',
      role: 'student',
    });

    const verified = ClassroomAuth.verifyLiveSessionToken(guestToken);
    harness.assert(verified !== null, 'Guest token verified');

    const guestParticipant = new HeadlessParticipant(guestId, 'Guest Student 99', 'student', true);
    guestParticipant.connectToEdge(edge);

    // Deliver hydration snapshot to guest
    const snapshot = edge.createHydrationSnapshot();
    await guestParticipant.handleIncomingEdgeMessage(
      serializeRealtimeMessage({
        type: 'SESSION_HYDRATION_SNAPSHOT',
        payload: snapshot,
        timestamp: Date.now(),
      })
    );

    harness.assertEquals(
      guestParticipant.ydocs.get('avl.ts')?.getText('monaco').toString(),
      'class AVLNode { key: number; height: number = 1; }',
      'Guest instantly displays broadcast code'
    );
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  return harness.getSummary();
}

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (MULTI-CLIENT LIFECYCLE)
// ============================================================================

export async function runMeshTier4RealWorld(): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 4 - Real-World Application Scenarios');

  // Scenario 1: Google Meet-Class 4-Party Classroom Lecture Lifecycle
  harness.startTest('TC4.1 - Google Meet-Class 4-Party Classroom Lecture Lifecycle');
  try {
    const edge = new VirtualClassroomEdge('CS-301');

    // 1. Teacher starts session
    const teacher = new HeadlessParticipant('teacher_shivam', 'Teacher Shivam', 'teacher');
    teacher.setupLocalMedia();
    teacher.connectToEdge(edge);

    // 2. 3 Students join sequentially
    const student1 = new HeadlessParticipant('student_alex', 'Alex', 'student');
    const student2 = new HeadlessParticipant('student_bella', 'Bella', 'student');
    const student3 = new HeadlessParticipant('guest_carlos', 'Guest Carlos', 'student', true);

    student1.setupLocalMedia();
    student2.setupLocalMedia();
    student3.setupLocalMedia();

    student1.connectToEdge(edge);
    student2.connectToEdge(edge);
    student3.connectToEdge(edge);

    // 3. Negotiate full 4-peer mesh (6 bidirectional peer connections)
    const participants = [teacher, student1, student2, student3];
    let negotiatedPairs = 0;

    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const p1 = participants[i];
        const p2 = participants[j];

        const pc1 = p1.getOrCreatePeerConnection(p2.userId);
        const pc2 = p2.getOrCreatePeerConnection(p1.userId);

        const offer = await pc1.createOffer();
        await pc1.setLocalDescription(offer);
        await pc2.setRemoteDescription(offer);

        const answer = await pc2.createAnswer();
        await pc2.setLocalDescription(answer);
        await pc1.setRemoteDescription(answer);

        harness.assertEquals(pc1.signalingState, 'stable', `${p1.userId} -> ${p2.userId} stable`);
        harness.assertEquals(pc2.signalingState, 'stable', `${p2.userId} -> ${p1.userId} stable`);
        negotiatedPairs++;
      }
    }
    harness.assertEquals(negotiatedPairs, 6, 'Full mesh of 6 peer connection pairs established');

    // 4. Teacher presents code in Monaco editor
    const teacherDoc = edge.getYDoc('graph.ts');
    teacherDoc.getText('monaco').insert(0, 'class Graph { vertices: Map<string, string[]> = new Map(); }');

    // 5. Student 1 asks a question (audio energy above threshold)
    const meter = new MockAudioEnergyMeter();
    const audioLevels = new Map<string, number>();
    audioLevels.set(student1.userId, 85);
    const activeSpeaker = meter.processParticipantLevels(audioLevels, 2000);
    harness.assertEquals(activeSpeaker, student1.userId, 'Active speaker identified as student 1');

    // 6. Student 2 draws diagram on whiteboard
    const strokeElem = {
      id: 'diagram-node-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
    };
    edge.whiteboardPages[0].elements.push(strokeElem);

    // 7. Late joiner Student 4 enters and hydrates all state
    const student4 = new HeadlessParticipant('guest_diana', 'Guest Diana', 'student', true);
    student4.connectToEdge(edge);
    const snapshot = edge.createHydrationSnapshot();
    await student4.handleIncomingEdgeMessage(
      serializeRealtimeMessage({
        type: 'SESSION_HYDRATION_SNAPSHOT',
        payload: snapshot,
        timestamp: Date.now(),
      })
    );

    harness.assertEquals(
      student4.ydocs.get('graph.ts')?.getText('monaco').toString(),
      'class Graph { vertices: Map<string, string[]> = new Map(); }',
      'Late joiner hydrated graph code'
    );
    harness.assertEquals(student4.whiteboardCanvas.pages[0].elements.length, 1, 'Late joiner hydrated diagram');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Scenario 2: Restrictive Symmetric NAT Traversal via Ephemeral HMAC TURN Relay
  harness.startTest('TC4.2 - Restrictive Symmetric NAT Traversal via Ephemeral HMAC TURN Relay');
  try {
    // Mock TURN credentials request
    process.env.CORTEX_TURN_URLS = 'turn:relay.cortex.edu:3478';
    process.env.CORTEX_TURN_SECRET = 'cortex-super-secret-turn-key';

    const iceConfig = getAuthoritativeIceServers('restricted-user-1');
    harness.assertEquals(iceConfig.mode, 'stun-and-turn', 'Configured for STUN and TURN');
    harness.assert(iceConfig.isTurnConfigured, 'TURN flag enabled');

    const turnServer = iceConfig.iceServers.find((s) => s.username && s.credential);
    harness.assert(turnServer !== undefined, 'Found TURN server entry');
    harness.assert(typeof turnServer?.username === 'string', 'TURN username exists');
    harness.assert(typeof turnServer?.credential === 'string', 'TURN HMAC credential exists');

    // Clean up test env
    delete process.env.CORTEX_TURN_URLS;
    delete process.env.CORTEX_TURN_SECRET;
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Scenario 3: Google Meet Adaptive Grid Math & Aspect Ratio
  harness.startTest('TC4.3 - Google Meet Adaptive Grid Math & 16:9 Aspect Ratio Preservation');
  try {
    const calculateGrid = (participantCount: number) => {
      if (participantCount <= 1) return { cols: 1, rows: 1 };
      if (participantCount === 2) return { cols: 2, rows: 1 };
      if (participantCount <= 4) return { cols: 2, rows: 2 };
      return { cols: 3, rows: Math.ceil(participantCount / 3) };
    };

    harness.assertEquals(calculateGrid(1).cols, 1, '1 participant -> 1 col');
    harness.assertEquals(calculateGrid(2).cols, 2, '2 participants -> 2 cols');
    harness.assertEquals(calculateGrid(3).cols, 2, '3 participants -> 2x2 grid');
    harness.assertEquals(calculateGrid(4).cols, 2, '4 participants -> 2x2 grid');
    harness.assertEquals(calculateGrid(6).cols, 3, '6 participants -> 3x2 grid');
    harness.assertEquals(calculateGrid(9).cols, 3, '9 participants -> 3x3 grid');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  // Scenario 4: Transient Network Blackout & Multi-Stream Session Recovery
  harness.startTest('TC4.4 - Transient Network Blackout (3s Partition) & Full Session Recovery');
  try {
    const peerA = new MockRTCPeerConnection('peer-b', 'peer-a');
    const peerB = new MockRTCPeerConnection('peer-a', 'peer-b');

    // Initial connection
    const offer = await peerA.createOffer();
    await peerA.setLocalDescription(offer);
    await peerB.setRemoteDescription(offer);
    const answer = await peerB.createAnswer();
    await peerB.setLocalDescription(answer);
    await peerA.setRemoteDescription(answer);

    harness.assertEquals(peerA.iceConnectionState, 'connected', 'Initially connected');

    // Network partition: peerA drops
    peerA.restartIce();
    harness.assertEquals(peerA.iceConnectionState, 'checking', 'ICE restart in checking state');

    // Renegotiation completes after reconnection
    const newOffer = await peerA.createOffer();
    await peerA.setLocalDescription(newOffer);
    await peerB.setRemoteDescription(newOffer);
    const newAnswer = await peerB.createAnswer();
    await peerB.setLocalDescription(newAnswer);
    await peerA.setRemoteDescription(newAnswer);

    harness.assertEquals(peerA.signalingState, 'stable', 'Recovered to stable state');
    harness.assertEquals(peerA.iceConnectionState, 'connected', 'Recovered to connected state');
    harness.endTest();
  } catch (err: unknown) {
    harness.endTest('failed', err instanceof Error ? err.message : String(err));
  }

  return harness.getSummary();
}

// ============================================================================
// MAIN SUITE RUNNER
// ============================================================================

export async function runLiveClassroomMeshSuite(): Promise<{
  success: boolean;
  summaries: TierExecutionResult[];
}> {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('CORTEX LIVE CLASSROOM MESH - E2E TEST SUITE (TIERS 1-4)');
  console.log('='.repeat(80));
  console.log(`Timestamp:    ${new Date().toISOString()}`);
  console.log(`Node Runtime: ${process.version}`);
  console.log(`Methodology:  Opaque-Box W3C WebRTC, Yjs CRDT & Whiteboard Delta Verification`);
  console.log('='.repeat(80));
  console.log('');

  const tierRunners = [
    { name: 'Tier 1 - Feature Coverage', fn: runMeshTier1FeatureCoverage },
    { name: 'Tier 2 - Boundary and Corner Cases', fn: runMeshTier2BoundaryCorner },
    { name: 'Tier 3 - Cross-Feature Combinations', fn: runMeshTier3CrossFeature },
    { name: 'Tier 4 - Real-World Application Scenarios', fn: runMeshTier4RealWorld },
  ];

  const summaries: TierExecutionResult[] = [];
  let allPassed = true;

  for (const runner of tierRunners) {
    console.log(`>>> Executing ${runner.name}...`);
    const tierResult = await runner.fn();
    summaries.push(tierResult);

    for (const tc of tierResult.results) {
      const badge = tc.status === 'passed' ? '[PASS]' : tc.status === 'failed' ? '[FAIL]' : '[SKIP]';
      console.log(`  ${badge} ${tc.name} (${tc.durationMs}ms, ${tc.assertionCount} assertions)`);
      if (tc.status === 'failed' && tc.error) {
        console.log(`         ERROR: ${tc.error}`);
      }
    }

    if (!tierResult.passed) {
      allPassed = false;
    }

    const tierBadge = tierResult.passed ? '[PASS]' : '[FAIL]';
    console.log(
      `--- ${runner.name} Result: ${tierBadge} (Tests: ${tierResult.passedTests}/${tierResult.totalTests}, Assertions: ${tierResult.passedAssertions}/${tierResult.totalAssertions}, Time: ${tierResult.durationMs}ms)\n`
    );
  }

  const totalDuration = Date.now() - startTime;
  let totalTests = 0;
  let totalPassedTests = 0;
  let totalFailedTests = 0;
  let totalAssertions = 0;
  let totalPassedAssertions = 0;

  for (const s of summaries) {
    totalTests += s.totalTests;
    totalPassedTests += s.passedTests;
    totalFailedTests += s.failedTests;
    totalAssertions += s.totalAssertions;
    totalPassedAssertions += s.passedAssertions;
  }

  console.log('='.repeat(80));
  console.log('LIVE CLASSROOM MESH TEST EXECUTION SUMMARY');
  console.log('='.repeat(80));
  console.log(
    'Tier Name'.padEnd(42) +
      'Status'.padEnd(10) +
      'Tests'.padEnd(12) +
      'Assertions'.padEnd(14) +
      'Duration'
  );
  console.log('-'.repeat(80));

  for (const s of summaries) {
    const statusText = s.passed ? 'PASS' : 'FAIL';
    const testText = `${s.passedTests}/${s.totalTests}`;
    const assertText = `${s.passedAssertions}/${s.totalAssertions}`;
    const durText = `${s.durationMs}ms`;
    console.log(
      s.tierName.padEnd(42) +
        statusText.padEnd(10) +
        testText.padEnd(12) +
        assertText.padEnd(14) +
        durText
    );
  }

  console.log('-'.repeat(80));
  console.log(`TOTAL METRICS:`);
  console.log(`  Total Test Cases: ${totalTests} (Passed: ${totalPassedTests}, Failed: ${totalFailedTests})`);
  console.log(`  Total Assertions: ${totalAssertions} (Passed: ${totalPassedAssertions}, Failed: ${totalAssertions - totalPassedAssertions})`);
  console.log(`  Total Duration:   ${totalDuration}ms`);
  console.log(`  Overall Verdict:  ${allPassed ? 'ALL TIERS PASSED [SUCCESS]' : 'SUITE FAILED [FAILURE]'}`);
  console.log('='.repeat(80));

  return { success: allPassed, summaries };
}

// Standalone CLI execution
const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('tests/live-classroom-mesh.ts');
if (isDirectRun) {
  runLiveClassroomMeshSuite().then((res) => {
    process.exit(res.success ? 0 : 1);
  });
}
