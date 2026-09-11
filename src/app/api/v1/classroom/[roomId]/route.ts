import { NextRequest, NextResponse } from 'next/server';
import { ClassroomRoomManager } from '@/lib/classroom/room-manager';
import { ClassroomAuth } from '@/lib/classroom/auth';

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
    const requesterName = searchParams.get('requesterName') || 'Participant';
    const requesterRole = (searchParams.get('requesterRole') as any) || 'user';
    const clientParticipantsRaw = searchParams.get('clientParticipants');
    const clientRoomState = searchParams.get('clientRoomState') || undefined;
    const clientAdminEntered = searchParams.get('clientAdminEntered') === 'true';

    let clientParticipants: any[] = [];
    if (clientParticipantsRaw) {
      try {
        clientParticipants = JSON.parse(clientParticipantsRaw);
      } catch {}
    }

    // Edge Self-Healing: if participant is known by client but missing in this worker isolate, auto-register
    if (requesterId && !room.participants[requesterId]) {
      ClassroomRoomManager.joinRoom(roomId, requesterName, requesterRole, requesterId);
    } else if (requesterId && room.participants[requesterId]) {
      room.participants[requesterId].lastActive = Date.now();
      room.participants[requesterId].online = true;
      if (requesterRole === 'admin') {
        if (!room.admin.id || room.admin.name === 'Classroom Host' || room.admin.id === requesterId) {
          room.participants[requesterId].role = 'admin';
          room.admin.id = requesterId;
          room.admin.name = requesterName;
          room.admin.enteredArena = true;
          room.state = 'active';
        } else {
          room.participants[requesterId].role = 'user';
        }
      }
    }

    // Cascading state sync
    if (clientRoomState === 'active' || clientAdminEntered) {
      room.state = 'active';
      if (room.admin) {
        room.admin.enteredArena = true;
      }
    }

    const clientChatMessagesRaw = searchParams.get('clientChatMessages');
    let clientChatMessages: any[] = [];
    if (clientChatMessagesRaw) {
      try {
        clientChatMessages = JSON.parse(clientChatMessagesRaw);
      } catch {}
    }

    const clientCollabRequestsRaw = searchParams.get('clientCollabRequests');
    let clientCollabRequests: any[] = [];
    if (clientCollabRequestsRaw) {
      try {
        clientCollabRequests = JSON.parse(clientCollabRequestsRaw);
      } catch {}
    }

    const clientCollabSessionsRaw = searchParams.get('clientCollabSessions');
    let clientCollabSessions: any[] = [];
    if (clientCollabSessionsRaw) {
      try {
        clientCollabSessions = JSON.parse(clientCollabSessionsRaw);
      } catch {}
    }

    // Multi-isolate gossip sync: keeps participant lists, room state, chat, and collab requests identical across all devices and isolates
    ClassroomRoomManager.syncParticipants(
      roomId,
      clientParticipants,
      clientRoomState,
      clientAdminEntered,
      clientChatMessages,
      clientCollabRequests,
      clientCollabSessions
    );

    const requester = requesterId ? room.participants[requesterId] : null;
    const isAdmin = requester?.role === 'admin';

    // Sanitize participants' private code according to privacy rules
    const sanitizedParticipants: Record<string, any> = {};
    for (const [id, p] of Object.entries(room.participants)) {
      if (!p) continue;
      const isSelf = id === requesterId;
      const privacy = p.privacy || {
        workspaceVisibility: p.role === 'admin' ? 'public' : 'private',
        allowCollaboration: true,
        requireDownloadPermission: p.role !== 'admin',
      };
      const isPublic = privacy.workspaceVisibility === 'public' || p.role === 'admin';
      const isCollaborating = Object.values(room.collaborationSessions || {}).some(
        (s) => s.participantIds?.includes(id) && requesterId && s.participantIds?.includes(requesterId)
      );

      const canViewCode = isSelf || isAdmin || isPublic || isCollaborating;

      sanitizedParticipants[id] = {
        ...p,
        privacy,
        activeCode: canViewCode ? (p.activeCode || '') : '',
        files: canViewCode ? (p.files || []) : (p.files || []).map((f) => ({ ...f, content: '' })),
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
      case 'code_update':
      case 'update_code': {
        const { code, language, fileName, status } = body;
        const targetId = body.targetUserId || body.participantId || participantId;
        const authUser = ClassroomAuth.authenticateRequest(req);
        if (authUser) {
          const isRoomAdmin = authUser.role === 'admin' || room.admin.id === authUser.id;
          if (!isRoomAdmin && targetId !== authUser.id) {
            return NextResponse.json({ error: 'Cannot update another participant\'s code' }, { status: 403 });
          }
        } else if (participantId && targetId !== participantId) {
          return NextResponse.json({ error: 'Cannot update another participant\'s code' }, { status: 403 });
        }
        ClassroomRoomManager.updateParticipantCode(roomId, targetId, { code, language, fileName, status });
        return NextResponse.json({ success: true });
      }

      case 'start_classroom':
      case 'admin_entered': {
        const updatedRoom = ClassroomRoomManager.startClassroom(roomId, participantId);
        return NextResponse.json({ success: true, room: updatedRoom });
      }

      case 'heartbeat': {
        const { clientParticipants, clientRoomState, clientAdminEntered, requesterRole, clientChatMessages } = body;
        if (participantId && room.participants[participantId]) {
          room.participants[participantId].lastActive = Date.now();
          room.participants[participantId].online = true;
          if (requesterRole === 'admin' || room.participants[participantId].role === 'admin') {
            if (!room.admin.id || room.admin.name === 'Classroom Host' || room.admin.id === participantId) {
              room.admin.id = participantId;
              room.admin.enteredArena = true;
              room.state = 'active';
            } else {
              room.participants[participantId].role = 'user';
            }
          }
        }
        if (clientRoomState === 'active' || clientAdminEntered) {
          room.state = 'active';
          if (room.admin) {
            room.admin.enteredArena = true;
          }
        }
        const syncedRoom = ClassroomRoomManager.syncParticipants(
          roomId,
          clientParticipants || [],
          clientRoomState,
          clientAdminEntered,
          clientChatMessages
        );
        return NextResponse.json({ success: true, room: syncedRoom || room });
      }

      case 'doc_update':
      case 'doc_sync_step1':
      case 'doc_sync_step2':
      case 'awareness_update':
      case 'cursor_update':
      case 'crdt_sync': {
        ClassroomRoomManager.broadcast(roomId, {
          type: action as any,
          roomId,
          senderId: participantId,
          senderName: body.senderName || '',
          payload: body,
          timestamp: Date.now(),
        });
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
        const { requestId, decision, fromId } = body;
        const session = ClassroomRoomManager.respondCollaboration(roomId, requestId, participantId, decision, fromId);
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
        const authUser = ClassroomAuth.authenticateRequest(req);
        const isAdmin = authUser?.role === 'admin' || (authUser && room.admin.id === authUser.id) || (process.env.NODE_ENV !== 'production' && room.admin.id === participantId);
        if (!isAdmin) {
          return NextResponse.json({ error: 'Administrator authorization required' }, { status: 403 });
        }
        const { adminAction } = body;
        ClassroomRoomManager.adminAction(roomId, participantId, adminAction);
        return NextResponse.json({ success: true });
      }

      case 'chat_message':
      case 'send_chat': {
        const text = body.text || body.payload?.text || body.message?.text || '';
        const isAnnouncement = Boolean(body.isAnnouncement || body.payload?.isAnnouncement);
        const senderName = body.senderName || body.payload?.senderName || body.message?.senderName;
        const role = body.role || body.payload?.role || body.message?.role;
        const messageId = body.id || body.payload?.id || body.message?.id;

        const msg = ClassroomRoomManager.sendChat(
          roomId,
          participantId,
          text,
          isAnnouncement,
          senderName,
          role,
          messageId
        );
        return NextResponse.json({ success: true, message: msg });
      }

      case 'update_privacy': {
        const { privacy } = body;
        const p = room.participants[participantId];
        if (p && privacy) {
          p.privacy = {
            ...(p.privacy || {
              workspaceVisibility: p.role === 'admin' ? 'public' : 'private',
              allowCollaboration: true,
              requireDownloadPermission: p.role !== 'admin',
            }),
            ...privacy,
          };
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
