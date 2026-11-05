import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { TeamFormationMode, TeamJoiningPolicy, TeamThemePolicy } from '@/lib/classroom/models';

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
    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get team settings' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { id } = await params;
    const cid = id.toUpperCase().trim();

    const membership = await ClassroomAuth.verifyClassroomMembership(user, cid);
    if (!membership.authorized || (user.role !== 'admin' && membership.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden: Only instructors can configure team settings.' }, { status: 403 });
    }

    const body = await req.json();
    const updates: any = {};

    // Validate formationMode
    if (body.formationMode) {
      const validModes: TeamFormationMode[] = ['teacher_controlled', 'teacher_created_student_selected', 'student_created'];
      if (!validModes.includes(body.formationMode)) {
        return NextResponse.json({ error: `Invalid formation mode: ${body.formationMode}` }, { status: 400 });
      }
      updates.formationMode = body.formationMode;
    }

    // Validate joiningPolicy
    if (body.joiningPolicy) {
      const validPolicies: TeamJoiningPolicy[] = ['direct', 'approval_required'];
      if (!validPolicies.includes(body.joiningPolicy)) {
        return NextResponse.json({ error: `Invalid joining policy: ${body.joiningPolicy}` }, { status: 400 });
      }
      updates.joiningPolicy = body.joiningPolicy;
    }

    // Validate minTeamSize & maxTeamSize
    const minSize = typeof body.minTeamSize === 'number' ? body.minTeamSize : undefined;
    const maxSize = typeof body.maxTeamSize === 'number' ? body.maxTeamSize : undefined;

    if (minSize !== undefined) {
      if (minSize < 1) return NextResponse.json({ error: 'Minimum team size must be at least 1' }, { status: 400 });
      updates.minTeamSize = minSize;
    }
    if (maxSize !== undefined) {
      if (maxSize < (minSize || 1)) return NextResponse.json({ error: 'Maximum team size cannot be smaller than minimum team size' }, { status: 400 });
      updates.maxTeamSize = maxSize;
    }

    // Validate themePolicy
    if (body.themePolicy) {
      const validThemePolicies: TeamThemePolicy[] = ['teacher_controlled', 'team_leader', 'approval_required'];
      if (!validThemePolicies.includes(body.themePolicy)) {
        return NextResponse.json({ error: `Invalid theme policy: ${body.themePolicy}` }, { status: 400 });
      }
      updates.themePolicy = body.themePolicy;
    }

    if (body.allowMultipleTeams !== undefined) updates.allowMultipleTeams = Boolean(body.allowMultipleTeams);
    if (body.membershipLocked !== undefined) updates.membershipLocked = Boolean(body.membershipLocked);
    if (body.creationDeadline !== undefined) updates.creationDeadline = body.creationDeadline;
    if (body.joiningDeadline !== undefined) updates.joiningDeadline = body.joiningDeadline;

    const saved = await classroomDb.updateTeamSettings(cid, updates);

    return NextResponse.json({ success: true, settings: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update team settings' }, { status: 500 });
  }
}
