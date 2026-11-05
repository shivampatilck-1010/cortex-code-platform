import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ClassroomRoomManager as RoomManager } from '@/lib/classroom/room-manager';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = await req.json();
    if (!workspaceId || (workspaceId !== 'A' && workspaceId !== 'B' && workspaceId !== 'BOTH')) {
      return NextResponse.json({ error: 'Invalid workspaceId' }, { status: 400 });
    }

    const { id } = await params;
    const roomId = id.toUpperCase().trim();
    const room = RoomManager.getRoom(roomId, true);
    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const participant = room.participants[user.id];
    const isAdmin = room.admin?.id === user.id;

    if (!participant && !isAdmin) {
      return NextResponse.json({ error: 'Not a member of this classroom' }, { status: 403 });
    }

    if (workspaceId === 'BOTH') {
      const execA = executeInCloudRunner({
        language: room.arenaWorkspaces.A.currentLanguage,
        files: room.arenaWorkspaces.A.files,
      });
      const execB = executeInCloudRunner({
        language: room.arenaWorkspaces.B.currentLanguage,
        files: room.arenaWorkspaces.B.files,
      });
      const [resA, resB] = await Promise.all([execA, execB]);
      room.arenaWorkspaces.A.output = resA;
      room.arenaWorkspaces.B.output = resB;
      RoomManager.broadcast(roomId, { type: 'room_state', roomId, senderId: user.id, payload: { room }, timestamp: Date.now() });
      return NextResponse.json({ resultA: resA, resultB: resB });
    } else {
      const ws = workspaceId === 'A' ? room.arenaWorkspaces.A : room.arenaWorkspaces.B;
      const result = await executeInCloudRunner({
        language: ws.currentLanguage,
        files: ws.files,
      });
      ws.output = result;
      RoomManager.broadcast(roomId, { type: 'room_state', roomId, senderId: user.id, payload: { room }, timestamp: Date.now() });
      return NextResponse.json({ result });
    }
  } catch (error: any) {
    console.error('Arena Execution Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

