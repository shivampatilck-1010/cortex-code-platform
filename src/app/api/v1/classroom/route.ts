import { NextRequest, NextResponse } from 'next/server';
import { ClassroomRoomManager } from '@/lib/classroom/room-manager';
import { classroomDb } from '@/lib/classroom/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, name, roomId, settings, existingId } = body;

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    if (action === 'create') {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Admin name is required to create a classroom.' }, { status: 400 });
      }

      const { room, adminParticipant } = ClassroomRoomManager.createRoom(name.trim(), settings);
      const inviteUrl = `${baseUrl}/classroom/${room.roomId}`;

      // Persist in relational DB
      classroomDb.createUser({
        id: adminParticipant.id,
        name: adminParticipant.name,
        email: `${adminParticipant.name.toLowerCase().replace(/\s+/g, '.')}@cortex.edu`,
        role: 'teacher',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      classroomDb.createClassroom({
        id: room.roomId,
        name: body.classroomName || `${name.trim()}'s Interactive Classroom`,
        subject: body.subject || 'Computer Science & Algorithms',
        description: body.description || 'Interactive collaborative coding lab with automated testing and live dual-workspace monitor.',
        courseCode: body.courseCode || room.roomId.split('-')[1] || 'CS-LAB',
        academicYear: '2026-2027',
        section: body.section || 'Sec 01',
        teacherId: adminParticipant.id,
        teacherName: adminParticipant.name,
        joinCode: room.roomId,
        joinEnabled: true,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        settings: {
          allowStudentPosting: true,
          allowStudentMessaging: true,
          allowCodeSharing: true,
          leaderboardEnabled: true,
          defaultAIPolicy: 'hints_only',
        },
      });

      classroomDb.addMember({
        id: `mem_${adminParticipant.id}_${room.roomId}`,
        classroomId: room.roomId,
        userId: adminParticipant.id,
        userName: adminParticipant.name,
        userEmail: `${adminParticipant.name.toLowerCase().replace(/\s+/g, '.')}@cortex.edu`,
        role: 'teacher',
        status: 'active',
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        isOnline: true,
      });

      return NextResponse.json({
        success: true,
        roomId: room.roomId,
        participantId: adminParticipant.id,
        participantName: adminParticipant.name,
        role: adminParticipant.role,
        inviteUrl,
        room,
      });
    }

    if (action === 'join') {
      if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
        return NextResponse.json({ error: 'Room ID is required.' }, { status: 400 });
      }
      if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Participant name is required.' }, { status: 400 });
      }

      const normRoomId = roomId.trim().toUpperCase();
      const existingRoom = ClassroomRoomManager.getRoom(normRoomId, false);
      const hasActiveAdmin = Boolean(
        existingRoom &&
        existingRoom.admin.id &&
        existingRoom.admin.name !== 'Classroom Host' &&
        existingRoom.participants[existingRoom.admin.id] &&
        existingRoom.participants[existingRoom.admin.id].role === 'admin'
      );
      const requestedRole = body.role === 'admin' ? 'admin' : 'user';
      const effectiveRole = (requestedRole === 'admin' && !hasActiveAdmin) ? 'admin' : 'user';

      const { room, participant } = ClassroomRoomManager.joinRoom(normRoomId, name.trim(), effectiveRole, existingId);
      const inviteUrl = `${baseUrl}/classroom/${room.roomId}`;

      // Persist in relational DB
      classroomDb.createUser({
        id: participant.id,
        name: participant.name,
        email: `${participant.name.toLowerCase().replace(/\s+/g, '.')}@student.cortex.edu`,
        role: participant.role === 'admin' ? 'teacher' : 'student',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      classroomDb.addMember({
        id: `mem_${participant.id}_${room.roomId}`,
        classroomId: room.roomId,
        userId: participant.id,
        userName: participant.name,
        userEmail: `${participant.name.toLowerCase().replace(/\s+/g, '.')}@student.cortex.edu`,
        role: participant.role === 'admin' ? 'teacher' : 'student',
        status: 'active',
        joinedAt: Date.now(),
        lastActiveAt: Date.now(),
        isOnline: true,
      });

      return NextResponse.json({
        success: true,
        roomId: room.roomId,
        participantId: participant.id,
        participantName: participant.name,
        role: participant.role,
        inviteUrl,
        room,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Expected "create" or "join".' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Classroom request failed' }, { status: 400 });
  }
}
