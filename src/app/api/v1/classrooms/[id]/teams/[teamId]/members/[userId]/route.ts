import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { TeamMemberRole } from '@/lib/classroom/models';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string; userId: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { id, teamId, userId: targetUserId } = await params;
    const cid = id.toUpperCase().trim();

    const membership = await ClassroomAuth.verifyClassroomMembership(user, cid);
    if (!membership.authorized) {
      return NextResponse.json({ error: 'Access denied: not an active member of this classroom' }, { status: 403 });
    }

    const team = await classroomDb.getTeam(teamId);
    if (!team || team.classroomId !== cid) {
      return NextResponse.json({ error: 'Team not found in this classroom' }, { status: 404 });
    }

    const isTeacherOrAdmin = user.role === 'admin' || membership.role === 'teacher';
    const isSelf = user.id === targetUserId;
    const isLeader = team.members?.some((m) => m.userId === user.id && m.teamRole === 'leader');

    if (team.isLocked && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Forbidden: Team is locked by the instructor.' }, { status: 403 });
    }

    if (!isTeacherOrAdmin && !isSelf && !isLeader) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to remove this member.' }, { status: 403 });
    }

    const targetUser = await classroomDb.getUser(targetUserId);
    const targetMember = team.members?.find((m) => m.userId === targetUserId);

    await classroomDb.removeTeamMember(teamId, targetUserId);

    // If removed member was the leader and members remain, reassign leadership to the first active member
    if (targetMember?.teamRole === 'leader') {
      const remaining = await classroomDb.listTeamMembers(teamId);
      if (remaining.length > 0) {
        await classroomDb.updateTeamMemberRole(teamId, remaining[0].userId, 'leader');
        await classroomDb.recordProjectActivity({
          classroomId: cid,
          teamId,
          actorUserId: user.id,
          actorName: user.name,
          eventType: 'leader.changed',
          details: { newLeaderId: remaining[0].userId, newLeaderName: remaining[0].userName },
        });
      }
    }

    // Record activity
    await classroomDb.recordProjectActivity({
      classroomId: cid,
      teamId,
      actorUserId: user.id,
      actorName: user.name,
      eventType: 'member.removed',
      details: {
        studentId: targetUserId,
        studentName: targetUser?.name || targetUserId,
        teamName: team.name,
      },
    });

    const updatedTeam = await classroomDb.getTeam(teamId);
    return NextResponse.json({ success: true, team: updatedTeam });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to remove team member' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string; userId: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { id, teamId, userId: targetUserId } = await params;
    const cid = id.toUpperCase().trim();

    const membership = await ClassroomAuth.verifyClassroomMembership(user, cid);
    if (!membership.authorized) {
      return NextResponse.json({ error: 'Access denied: not an active member of this classroom' }, { status: 403 });
    }

    const team = await classroomDb.getTeam(teamId);
    if (!team || team.classroomId !== cid) {
      return NextResponse.json({ error: 'Team not found in this classroom' }, { status: 404 });
    }

    const isTeacherOrAdmin = user.role === 'admin' || membership.role === 'teacher';
    const isLeader = team.members?.some((m) => m.userId === user.id && m.teamRole === 'leader');

    if (!isTeacherOrAdmin && !isLeader) {
      return NextResponse.json({ error: 'Forbidden: Only instructors or team leaders can change member roles.' }, { status: 403 });
    }

    const body = await req.json();
    const newRole: TeamMemberRole = body.role || body.teamRole;
    if (newRole !== 'leader' && newRole !== 'member') {
      return NextResponse.json({ error: 'Invalid role. Must be "leader" or "member".' }, { status: 400 });
    }

    // If designating a new leader, demote previous leader to member
    if (newRole === 'leader') {
      const currentLeaders = team.members?.filter((m) => m.teamRole === 'leader') || [];
      for (const cl of currentLeaders) {
        if (cl.userId !== targetUserId) {
          await classroomDb.updateTeamMemberRole(teamId, cl.userId, 'member');
        }
      }
    }

    await classroomDb.updateTeamMemberRole(teamId, targetUserId, newRole);

    const targetUser = await classroomDb.getUser(targetUserId);

    await classroomDb.recordProjectActivity({
      classroomId: cid,
      teamId,
      actorUserId: user.id,
      actorName: user.name,
      eventType: 'leader.changed',
      details: {
        studentId: targetUserId,
        studentName: targetUser?.name || targetUserId,
        newRole,
      },
    });

    const updatedTeam = await classroomDb.getTeam(teamId);
    return NextResponse.json({ success: true, team: updatedTeam });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update member role' }, { status: 500 });
  }
}
