import { NextRequest, NextResponse } from 'next/server';
import { ClassroomRoomManager } from '@/lib/classroom/room-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const room = ClassroomRoomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const requesterId = searchParams.get('requesterId');
    const requester = requesterId ? room.participants[requesterId] : null;
    const isAdmin = requester?.role === 'admin';

    // Sanitize participants' private code according to privacy rules
    const sanitizedParticipants: Record<string, any> = {};
    for (const [id, p] of Object.entries(room.participants)) {
      const isSelf = id === requesterId;
      const isPublic = p.privacy.workspaceVisibility === 'public';
      const isCollaborating = Object.values(room.collaborationSessions).some(
        (s) => s.participantIds.includes(id) && requesterId && s.participantIds.includes(requesterId)
      );

      const canViewCode = isSelf || isAdmin || isPublic || isCollaborating;

      sanitizedParticipants[id] = {
        ...p,
        activeCode: canViewCode ? p.activeCode : '',
        files: canViewCode ? p.files : p.files.map((f) => ({ ...f, content: '' })),
        isCodeHidden: !canViewCode,
      };
    }

    return NextResponse.json({
      success: true,
      room: {
        ...room,
        participants: sanitizedParticipants,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get room' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await req.json();
    const { action, participantId } = body;

    const room = ClassroomRoomManager.getRoom(roomId);
    if (!room) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    switch (action) {
      case 'update_code': {
        const { code, language, fileName, status } = body;
        ClassroomRoomManager.updateParticipantCode(roomId, participantId, { code, language, fileName, status });
        return NextResponse.json({ success: true });
      }

      case 'select_workspaces': {
        const { slotAUserId, slotBUserId } = body;
        ClassroomRoomManager.selectWorkspaces(roomId, slotAUserId, slotBUserId);
        return NextResponse.json({ success: true, activeWorkspaces: room.activeWorkspaces });
      }

      case 'request_collaboration': {
        const { targetUserId } = body;
        const request = ClassroomRoomManager.requestCollaboration(roomId, participantId, targetUserId);
        return NextResponse.json({ success: true, request });
      }

      case 'respond_collaboration': {
        const { requestId, decision } = body;
        const session = ClassroomRoomManager.respondCollaboration(roomId, requestId, participantId, decision);
        return NextResponse.json({ success: true, session });
      }

      case 'end_collaboration': {
        const { sessionId } = body;
        ClassroomRoomManager.endCollaboration(roomId, sessionId, participantId);
        return NextResponse.json({ success: true });
      }

      case 'request_download': {
        const { ownerId, fileId } = body;
        const request = ClassroomRoomManager.requestFileDownload(roomId, participantId, ownerId, fileId);
        return NextResponse.json({ success: true, request });
      }

      case 'respond_download': {
        const { requestId, decision } = body;
        const result = ClassroomRoomManager.respondFileDownload(roomId, requestId, participantId, decision);
        return NextResponse.json({ success: true, ...result });
      }

      case 'admin_action': {
        const { adminAction } = body;
        ClassroomRoomManager.adminAction(roomId, participantId, adminAction);
        return NextResponse.json({ success: true });
      }

      case 'send_chat': {
        const { text, isAnnouncement } = body;
        const msg = ClassroomRoomManager.sendChat(roomId, participantId, text, Boolean(isAnnouncement));
        return NextResponse.json({ success: true, message: msg });
      }

      case 'update_privacy': {
        const { privacy } = body;
        const p = room.participants[participantId];
        if (p && privacy) {
          p.privacy = { ...p.privacy, ...privacy };
        }
        return NextResponse.json({ success: true, privacy: p?.privacy });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Action failed' }, { status: 400 });
  }
}
