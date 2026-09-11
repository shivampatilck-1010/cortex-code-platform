import { NextRequest } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { realtimeCoordinator } from '@/lib/classroom/realtime';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = ClassroomAuth.getCurrentUser(req);
  const classroom = classroomDb.getClassroom(id);

  if (!classroom) {
    return new Response(JSON.stringify({ error: 'Classroom not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const subscriberId = `sub_${user.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const sinceSeqParam = req.nextUrl.searchParams.get('sinceSequence');
  const lastClientSeq = sinceSeqParam ? parseInt(sinceSeqParam, 10) : 0;

  let unsubscribe: (() => void) | null = null;
  let keepAliveTimer: any = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Closed stream
        }
      };

      // 1. Initial Connection Handshake Event
      const handshake = {
        type: 'connection.ready',
        classroomId: id,
        userId: user.id,
        userName: user.name,
        timestamp: Date.now(),
      };
      sendEvent(JSON.stringify(handshake));

      // 2. Reconnection Replay (Catchup)
      if (lastClientSeq > 0) {
        const missedEvents = realtimeCoordinator.getMissedEvents(id, lastClientSeq);
        for (const evt of missedEvents) {
          sendEvent(JSON.stringify(evt));
        }
      }

      // 3. Register with Realtime Coordinator
      unsubscribe = realtimeCoordinator.subscribe(id, {
        id: subscriberId,
        userId: user.id,
        send: sendEvent,
      });

      // 4. Send Presence Update
      realtimeCoordinator.broadcast(
        id,
        'student.presence.updated',
        {
          userId: user.id,
          userName: user.name,
          isOnline: true,
          onlineCount: realtimeCoordinator.getOnlineCount(id),
        },
        { id: user.id, name: user.name }
      );

      // 5. Keepalive Ping every 15s to keep proxy alive
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(keepAliveTimer);
          if (unsubscribe) unsubscribe();
        }
      }, 15000);
    },

    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (unsubscribe) unsubscribe();
      realtimeCoordinator.broadcast(
        id,
        'student.presence.updated',
        {
          userId: user.id,
          userName: user.name,
          isOnline: false,
          onlineCount: realtimeCoordinator.getOnlineCount(id),
        },
        { id: user.id, name: user.name }
      );
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
