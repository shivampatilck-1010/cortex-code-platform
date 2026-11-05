import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { TeamMemberRole } from '@/lib/classroom/models';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { id, teamId } = await params;
    const cid = id.toUpperCase().trim();

    const membership = await ClassroomAuth.verifyClassroomMembership(user, cid);
    if (!membership.authorized) {
      return NextResponse.json({ error: 'Access denied: not an active member of this classroom' }, { status: 403 });
    }

    const team = await classroomDb.getTeam(teamId);
    if (!team || team.classroomId !== cid) {
      return NextResponse.json({ error: 'Team not found in this classroom' }, { status: 404 });
    }

    const settings = await classroomDb.getTeamSettings(cid);
    const isTeacherOrAdmin = user.role === 'admin' || membership.role === 'teacher';
    const isLeader = team.members?.some((m) => m.userId === user.id && m.teamRole === 'leader');

    // Locked check
    if (team.isLocked && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Forbidden: Team membership is locked by the instructor.' }, { status: 403 });
    }
    if (settings.membershipLocked && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Forbidden: Classroom team membership is locked.' }, { status: 403 });
    }

    const body = await req.json();
    const userIdsToAdd: string[] = Array.isArray(body.userIds)
      ? body.userIds
      : body.userId
      ? [body.userId]
      : [];

    if (userIdsToAdd.length === 0) {
      return NextResponse.json({ error: 'At least one userId must be provided' }, { status: 400 });
    }

    // Role check and mode enforcement
    if (!isTeacherOrAdmin) {
      if (settings.formationMode === 'teacher_controlled') {
        return NextResponse.json({ error: 'Forbidden: In teacher-controlled mode, only instructors can assign team members.' }, { status: 403 });
      }

      if (settings.formationMode === 'teacher_created_student_selected') {
        // In student selection mode, student can only add themselves
        if (userIdsToAdd.length !== 1 || userIdsToAdd[0] !== user.id) {
          return NextResponse.json({ error: 'In student selection mode, you can only select a team for yourself.' }, { status: 403 });
        }
      }

      if (settings.formationMode === 'student_created') {
        // Team leader can invite/add classmates, or a student can request/join if permitted
        if (!isLeader && (userIdsToAdd.length !== 1 || userIdsToAdd[0] !== user.id)) {
          return NextResponse.json({ error: 'Only the team leader or instructors can add other members.' }, { status: 403 });
        }
      }
    }

    // Capacity check
    const currentMemberCount = team.members?.length || 0;
    if (currentMemberCount + userIdsToAdd.length > settings.maxTeamSize) {
      return NextResponse.json({
        error: `Team capacity exceeded. Maximum allowed team size is ${settings.maxTeamSize} members (currently has ${currentMemberCount}).`,
      }, { status: 400 });
    }

    const addedMembers: any[] = [];

    for (const targetUserId of userIdsToAdd) {
      // 1. Verify target user is an active member of this classroom
      const targetUser = await classroomDb.getUser(targetUserId);
      if (!targetUser) continue;

      const targetMembership = await ClassroomAuth.verifyClassroomMembership(targetUser, cid);
      if (!targetMembership.authorized) {
        return NextResponse.json({ error: `User ${targetUser.name} is not an enrolled member of this classroom.` }, { status: 400 });
      }

      // 2. If multiple teams not allowed, remove target user from any other team in this classroom first!
      if (!settings.allowMultipleTeams) {
        const existingTeams = await classroomDb.listTeamsForUser(cid, targetUserId);
        for (const prevTeam of existingTeams) {
          if (prevTeam.id !== teamId) {
            await classroomDb.removeTeamMember(prevTeam.id, targetUserId);
            await classroomDb.recordProjectActivity({
              classroomId: cid,
              teamId: prevTeam.id,
              actorUserId: user.id,
              actorName: user.name,
              eventType: 'member.moved',
              details: {
                studentId: targetUserId,
                studentName: targetUser.name,
                fromTeam: prevTeam.name,
                toTeam: team.name,
              },
            });
          }
        }
      }

      // 3. Add member
      const requestedRole: TeamMemberRole = (body.teamRole as TeamMemberRole) || 'member';
      const added = await classroomDb.addTeamMember({
        teamId,
        userId: targetUserId,
        teamRole: requestedRole,
        membershipStatus: 'active',
        assignedBy: user.id,
      });

      addedMembers.push(added);

      // Record activity
      await classroomDb.recordProjectActivity({
        classroomId: cid,
        teamId,
        actorUserId: user.id,
        actorName: user.name,
        eventType: 'member.assigned',
        details: {
          studentId: targetUserId,
          studentName: targetUser.name,
          teamName: team.name,
          role: requestedRole,
        },
      });
    }

    const updatedTeam = await classroomDb.getTeam(teamId);
    return NextResponse.json({ success: true, team: updatedTeam, added: addedMembers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to add team member' }, { status: 500 });
  }
}
