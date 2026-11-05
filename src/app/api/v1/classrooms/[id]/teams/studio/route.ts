import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { id } = await params;
    const cid = id.toUpperCase().trim();

    const membership = await ClassroomAuth.verifyClassroomMembership(user, cid);
    if (!membership.authorized) {
      return NextResponse.json({ error: 'Access denied: not an active member of this classroom' }, { status: 403 });
    }

    const settings = await classroomDb.getTeamSettings(cid);
    const teams = await classroomDb.listTeams(cid);
    const unassignedStudents = await classroomDb.getUnassignedStudents(cid);

    const allMembers = await classroomDb.listMembers(cid);
    const enrolledStudents = allMembers.filter((m) => m.role === 'student' && m.status === 'active');

    // Create a map of userId -> team
    const userTeamMap = new Map<string, { teamId: string; teamName: string; teamRole: string }>();
    let assignedCount = 0;

    for (const team of teams) {
      if (team.members) {
        for (const m of team.members) {
          userTeamMap.set(m.userId, {
            teamId: team.id,
            teamName: team.name,
            teamRole: m.teamRole,
          });
          assignedCount++;
        }
      }
    }

    const roster = enrolledStudents.map((s) => {
      const assignment = userTeamMap.get(s.userId);
      return {
        userId: s.userId,
        name: s.userName,
        email: s.userEmail,
        isOnline: s.isOnline,
        teamId: assignment?.teamId || null,
        teamName: assignment?.teamName || null,
        teamRole: assignment?.teamRole || null,
        isAssigned: Boolean(assignment),
      };
    });

    const totalStudents = enrolledStudents.length;
    const totalTeams = teams.length;
    const unassignedCount = unassignedStudents.length;
    const averageTeamSize = totalTeams > 0 ? Number((assignedCount / totalTeams).toFixed(1)) : 0;

    return NextResponse.json({
      success: true,
      settings,
      stats: {
        totalStudents,
        totalTeams,
        assignedCount,
        unassignedCount,
        averageTeamSize,
      },
      teams,
      unassignedStudents,
      roster,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load team formation studio' }, { status: 500 });
  }
}
