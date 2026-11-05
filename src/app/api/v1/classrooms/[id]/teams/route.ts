import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ThemePresetId } from '@/lib/classroom/models';

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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const teams = await classroomDb.listTeams(cid, status);
    return NextResponse.json({ success: true, teams });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list project teams' }, { status: 500 });
  }
}

export async function POST(
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

    const isTeacherOrAdmin = user.role === 'admin' || membership.role === 'teacher';
    const settings = await classroomDb.getTeamSettings(cid);

    if (settings.membershipLocked && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Team formation is currently locked by the instructor.' }, { status: 403 });
    }

    // Formation mode permissions check
    if (!isTeacherOrAdmin) {
      if (settings.formationMode === 'teacher_controlled') {
        return NextResponse.json({ error: 'Forbidden: In teacher-controlled mode, only instructors can create teams.' }, { status: 403 });
      }
      if (settings.formationMode === 'teacher_created_student_selected') {
        return NextResponse.json({ error: 'Forbidden: In student-selection mode, teams must be created by the instructor.' }, { status: 403 });
      }
      // Mode C: student_created
      if (settings.creationDeadline && Date.now() > settings.creationDeadline) {
        return NextResponse.json({ error: 'Team creation deadline has passed.' }, { status: 400 });
      }

      // Check if student is already in a team (if multiple teams not allowed)
      if (!settings.allowMultipleTeams) {
        const userTeams = await classroomDb.listTeamsForUser(cid, user.id);
        if (userTeams.length > 0) {
          return NextResponse.json({ error: 'Students are permitted to belong to only one team in this classroom.' }, { status: 400 });
        }
      }
    }

    const body = await req.json();
    const name = (body.name || '').trim();
    const projectTitle = (body.projectTitle || body.project_title || name).trim();
    const description = (body.description || '').trim();
    const themePreset = ((body.themePreset || body.theme_preset_id) as ThemePresetId) || 'cortex_signature';

    if (!name) {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Check unique team name in classroom
    const existingTeams = await classroomDb.listTeams(cid);
    if (existingTeams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: `A team named '${name}' already exists in this classroom.` }, { status: 400 });
    }

    const team = await classroomDb.createTeam({
      classroomId: cid,
      name,
      projectTitle,
      description,
      createdBy: user.id,
      themePreset,
      status: 'forming',
    });

    // If created by a student in student_created mode, automatically add them as team leader!
    if (!isTeacherOrAdmin) {
      await classroomDb.addTeamMember({
        teamId: team.id,
        userId: user.id,
        teamRole: 'leader',
        membershipStatus: 'active',
        assignedBy: user.id,
      });
      team.members = await classroomDb.listTeamMembers(team.id);
      team.memberCount = 1;
    }

    // Record activity
    await classroomDb.recordProjectActivity({
      classroomId: cid,
      teamId: team.id,
      actorUserId: user.id,
      actorName: user.name,
      eventType: 'team.created',
      details: { teamName: team.name, projectTitle: team.projectTitle },
    });

    return NextResponse.json({ success: true, team });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create team' }, { status: 500 });
  }
}
