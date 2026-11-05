import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
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

    const activity = await classroomDb.listProjectActivity(cid, teamId, 20);
    return NextResponse.json({ success: true, team, activity });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to get team' }, { status: 500 });
  }
}

export async function PATCH(
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

    const isTeacherOrAdmin = user.role === 'admin' || membership.role === 'teacher';
    const isLeader = team.members?.some((m) => m.userId === user.id && m.teamRole === 'leader');

    if (!isTeacherOrAdmin && !isLeader) {
      return NextResponse.json({ error: 'Forbidden: Only instructors or team leaders can edit team details.' }, { status: 403 });
    }

    if (team.isLocked && !isTeacherOrAdmin) {
      return NextResponse.json({ error: 'Forbidden: Team is locked by the instructor.' }, { status: 403 });
    }

    const body = await req.json();
    const updates: any = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.projectTitle !== undefined) updates.projectTitle = body.projectTitle.trim();
    if (body.description !== undefined) updates.description = body.description.trim();

    // Teacher-only fields
    if (isTeacherOrAdmin) {
      if (body.status !== undefined) updates.status = body.status;
      if (body.isLocked !== undefined) updates.isLocked = Boolean(body.isLocked);
    }

    const updated = await classroomDb.updateTeam(teamId, updates);

    // Record activity
    if (body.name && body.name !== team.name) {
      await classroomDb.recordProjectActivity({
        classroomId: cid,
        teamId,
        actorUserId: user.id,
        actorName: user.name,
        eventType: 'team.renamed',
        details: { oldName: team.name, newName: body.name },
      });
    }

    if (body.isLocked !== undefined && body.isLocked !== team.isLocked) {
      await classroomDb.recordProjectActivity({
        classroomId: cid,
        teamId,
        actorUserId: user.id,
        actorName: user.name,
        eventType: body.isLocked ? 'membership.locked' : 'membership.unlocked',
        details: { isLocked: body.isLocked },
      });
    }

    return NextResponse.json({ success: true, team: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update team' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { id, teamId } = await params;
    const cid = id.toUpperCase().trim();

    const membership = await ClassroomAuth.verifyClassroomMembership(user, cid);
    if (!membership.authorized || (user.role !== 'admin' && membership.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden: Only instructors can delete or archive teams.' }, { status: 403 });
    }

    const team = await classroomDb.getTeam(teamId);
    if (!team || team.classroomId !== cid) {
      return NextResponse.json({ error: 'Team not found in this classroom' }, { status: 404 });
    }

    // Safe deletion / archive
    await classroomDb.archiveTeam(teamId);

    await classroomDb.recordProjectActivity({
      classroomId: cid,
      teamId,
      actorUserId: user.id,
      actorName: user.name,
      eventType: 'status.changed',
      details: { status: 'archived', teamName: team.name },
    });

    return NextResponse.json({ success: true, message: `Team '${team.name}' archived successfully.` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete team' }, { status: 500 });
  }
}
