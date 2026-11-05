import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { createHmac, timingSafeEqual } from 'crypto';

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
    if (!membership.authorized || (user.role !== 'admin' && membership.role !== 'teacher')) {
      return NextResponse.json({ error: 'Forbidden: Only instructors can publish team assignments.' }, { status: 403 });
    }

    const body = await req.json();
    const { previewToken } = body;

    if (!previewToken || typeof previewToken !== 'string' || !previewToken.includes('.')) {
      return NextResponse.json({ error: 'Missing or invalid previewToken.' }, { status: 400 });
    }

    // 1. Verify HMAC signature of previewToken
    const [encodedData, signature] = previewToken.split('.');
    const secret = ClassroomAuth.getLiveSessionSigningSecret();
    const expectedSignature = createHmac('sha256', secret).update(encodedData).digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return NextResponse.json({ error: 'Invalid or forged previewToken signature.' }, { status: 403 });
    }

    let previewData: any;
    try {
      previewData = JSON.parse(Buffer.from(encodedData, 'base64url').toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'Malformed preview token payload.' }, { status: 400 });
    }

    if (previewData.cid !== cid) {
      return NextResponse.json({ error: 'Preview token does not match this classroom.' }, { status: 400 });
    }

    // Token expiry: 1 hour
    if (Date.now() - previewData.issuedAt > 3600000) {
      return NextResponse.json({ error: 'Preview token expired. Please re-run the auto-assignment preview.' }, { status: 400 });
    }

    // 2. If strategy is 'reassign_all', archive existing active teams
    if (previewData.strategy === 'reassign_all') {
      const existingTeams = await classroomDb.listTeams(cid, 'active');
      const formingTeams = await classroomDb.listTeams(cid, 'forming');
      for (const t of [...existingTeams, ...formingTeams]) {
        await classroomDb.archiveTeam(t.id);
      }
    }

    let teamsCreated = 0;
    let membersAssigned = 0;

    // 3. Create proposed teams and assign members
    for (const pt of previewData.teams) {
      const team = await classroomDb.createTeam({
        classroomId: cid,
        name: pt.name,
        projectTitle: pt.projectTitle,
        description: 'Auto-assigned project team',
        createdBy: user.id,
        status: 'active',
      });
      teamsCreated++;

      for (let idx = 0; idx < pt.memberIds.length; idx++) {
        const uid = pt.memberIds[idx];
        const isLeader = idx === 0; // First student designated as leader

        await classroomDb.addTeamMember({
          teamId: team.id,
          userId: uid,
          teamRole: isLeader ? 'leader' : 'member',
          membershipStatus: 'active',
          assignedBy: user.id,
        });
        membersAssigned++;
      }

      await classroomDb.recordProjectActivity({
        classroomId: cid,
        teamId: team.id,
        actorUserId: user.id,
        actorName: user.name,
        eventType: 'team.created',
        details: { teamName: team.name, autoAssigned: true, memberCount: pt.memberIds.length },
      });
    }

    const updatedTeams = await classroomDb.listTeams(cid);

    return NextResponse.json({
      success: true,
      teamsCreated,
      membersAssigned,
      teams: updatedTeams,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to publish team assignment' }, { status: 500 });
  }
}
