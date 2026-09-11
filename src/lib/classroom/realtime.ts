import { ClassroomEvent } from './models';
import { classroomDb } from './db';
import { ClassroomRealtimeEvent, serializeRealtimeMessage } from './protocol';

export interface ClassroomSubscriber {
  id: string;
  userId: string;
  send: (data: string) => void;
}

export interface WsClientSession {
  id: string;
  userId: string;
  userName: string;
  role: string;
  classroomId: string;
  send: (raw: string) => void;
  isAlive: boolean;
  lastActive: number;
}

class RealtimeCoordinator {
  private subscribers: Map<string, Set<ClassroomSubscriber>> = new Map();
  private wsClients: Map<string, Set<WsClientSession>> = new Map();
  private processedEventIds: Set<string> = new Set();

  // SSE Subscriptions
  subscribe(classroomId: string, subscriber: ClassroomSubscriber): () => void {
    const norm = classroomId.toUpperCase().trim();
    if (!this.subscribers.has(norm)) {
      this.subscribers.set(norm, new Set());
    }
    const set = this.subscribers.get(norm)!;
    set.add(subscriber);

    return () => {
      set.delete(subscriber);
      if (set.size === 0) {
        this.subscribers.delete(norm);
      }
    };
  }

  // WebSocket Client Management
  registerWsClient(classroomId: string, client: WsClientSession): () => void {
    const norm = classroomId.toUpperCase().trim();
    if (!this.wsClients.has(norm)) {
      this.wsClients.set(norm, new Set());
    }
    const set = this.wsClients.get(norm)!;
    set.add(client);

    // Update DB presence
    classroomDb.updateMemberPresence(norm, client.userId, true);

    return () => {
      set.delete(client);
      if (set.size === 0) {
        this.wsClients.delete(norm);
      }
      classroomDb.updateMemberPresence(norm, client.userId, false);
    };
  }

  getWsClients(classroomId: string): WsClientSession[] {
    const norm = classroomId.toUpperCase().trim();
    return Array.from(this.wsClients.get(norm) || []);
  }

  /**
   * Authoritative broadcast: increments DB sequence, persists event, and dispatches to all connected clients
   */
  broadcast(
    classroomId: string,
    type: string,
    payload: any,
    actor?: { id: string; name: string },
    incomingEventId?: string
  ): ClassroomEvent {
    const norm = classroomId.toUpperCase().trim();
    const sequence = classroomDb.getNextEventSequence(norm);
    const eventId = incomingEventId || `evt_${Date.now()}_${sequence}`;

    const event: ClassroomEvent = {
      id: eventId,
      classroomId: norm,
      sequence,
      type,
      actorId: actor?.id || 'system',
      actorName: actor?.name || 'Cortex System',
      timestamp: Date.now(),
      payload,
    };

    // 1. Deduplication cache tracking
    this.processedEventIds.add(eventId);

    // 2. Persistent storage in DB for ACID guarantees and replay
    classroomDb.recordEvent(event);

    // 3. Dispatch to WebSocket connections with targeted privacy filtering
    const wsPayload = serializeRealtimeMessage({
      type: 'event',
      classroomId: norm,
      sequence,
      eventId,
      payload: { event },
      timestamp: event.timestamp,
    });

    const isDirectMessage = type === 'message.created' && (payload?.message?.recipientType === 'direct' || payload?.message?.recipientType === 'teacher');
    const recipientId = payload?.message?.recipientId;
    const senderId = payload?.message?.senderId;

    const isGradeEvent = type === 'grade.updated' || type === 'submission.graded';
    const gradeStudentId = payload?.submission?.studentId || payload?.studentId;

    const activeWs = this.wsClients.get(norm);
    if (activeWs && activeWs.size > 0) {
      activeWs.forEach((ws) => {
        // Privacy filter for direct messages: only recipient, sender, and instructors receive it
        if (isDirectMessage) {
          const isRecipient = ws.userId === recipientId;
          const isSender = ws.userId === senderId;
          const isInstructor = ws.role === 'teacher' || ws.role === 'admin';
          if (!isRecipient && !isSender && !isInstructor) {
            return;
          }
        }

        // Privacy filter for grade events: only target student and instructors receive it
        if (isGradeEvent) {
          const isTargetStudent = ws.userId === gradeStudentId;
          const isInstructor = ws.role === 'teacher' || ws.role === 'admin';
          if (!isTargetStudent && !isInstructor) {
            return;
          }
        }

        try {
          ws.send(wsPayload);
        } catch {
          activeWs.delete(ws);
        }
      });
    }

    // 4. Dispatch to SSE subscribers (if any)
    const listeners = this.subscribers.get(norm);
    if (listeners && listeners.size > 0) {
      const sseSerialized = JSON.stringify(event);
      listeners.forEach((sub) => {
        if (isDirectMessage) {
          const isRecipient = sub.userId === recipientId;
          const isSender = sub.userId === senderId;
          if (!isRecipient && !isSender) return;
        }
        if (isGradeEvent) {
          const isTargetStudent = sub.userId === gradeStudentId;
          if (!isTargetStudent) return;
        }
        try {
          sub.send(sseSerialized);
        } catch {
          listeners.delete(sub);
        }
      });
    }

    return event;
  }

  /**
   * Handle incoming event from client with duplicate detection and role authorization
   */
  handleIncomingClientEvent(
    classroomId: string,
    event: Partial<ClassroomRealtimeEvent>,
    actor: { id: string; name: string; role?: string }
  ): ClassroomEvent | null {
    const norm = classroomId.toUpperCase().trim();

    if (event.id && this.processedEventIds.has(event.id)) {
      // Duplicate event detected, ignore
      return null;
    }

    // Authorization check for teacher-only events
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

    const eventType = event.type || 'message.created';
    const isInstructor = actor.role === 'teacher' || actor.role === 'admin';

    if (teacherOnlyEvents.has(eventType) && !isInstructor) {
      console.warn(`[Security Alert] Non-teacher user ${actor.id} attempted to emit teacher-only event: ${eventType}`);
      return null;
    }

    // Sanitize payload: enforce authenticated actor identity
    const payload = event.payload ? { ...event.payload } : {};
    if (eventType === 'message.created' && payload.message) {
      payload.message.senderId = actor.id;
      payload.message.senderName = actor.name;
      payload.message.senderRole = actor.role || 'student';
    } else if (eventType === 'student.presence.updated') {
      payload.userId = actor.id;
      payload.userName = actor.name;
    } else if (eventType === 'submission.created') {
      payload.studentId = actor.id;
      payload.studentName = actor.name;
    }

    if (event.id) {
      this.processedEventIds.add(event.id);
    }
    return this.broadcast(norm, eventType, payload, { id: actor.id, name: actor.name }, event.id);
  }

  getMissedEvents(classroomId: string, sinceSequence: number): ClassroomEvent[] {
    const norm = classroomId.toUpperCase().trim();
    return classroomDb.getEventsSince(norm, sinceSequence);
  }

  getOnlineCount(classroomId: string): number {
    const norm = classroomId.toUpperCase().trim();
    const wsCount = this.wsClients.get(norm)?.size || 0;
    const sseCount = this.subscribers.get(norm)?.size || 0;
    return Math.max(1, Math.max(wsCount, sseCount));
  }
}

export const realtimeCoordinator = new RealtimeCoordinator();
