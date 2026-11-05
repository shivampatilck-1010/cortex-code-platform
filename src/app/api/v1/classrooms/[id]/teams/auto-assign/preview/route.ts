import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { createHmac } from 'crypto';

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
      return NextResponse.json({ error: 'Forbidden: Only instructors can run automatic team assignment.' }, { status: 403 });
    }

    const settings = await classroomDb.getTeamSettings(cid);
    if (settings.membershipLocked) {
      return NextResponse.json({ error: 'Cannot auto-assign: Classroom team membership is locked.' }, { status: 403 });
    }

    const body = await req.json();
    const strategy: 'unassigned_only' | 'reassign_all' = body.strategy || 'reassign_all';
    const targetCount: number | undefined =
      body.targetCount && body.targetCount > 0
        ? body.targetCount
        : (body.target_type === 'teams_count' && body.target_value > 0 ? body.target_value : undefined);
    const targetSize: number | undefined =
      body.targetSize && body.targetSize > 0
        ? body.targetSize
        : (body.target_type === 'team_size' && body.target_value > 0 ? body.target_value : undefined);
    const selectedUserIds: string[] | undefined = Array.isArray(body.selectedUserIds) && body.selectedUserIds.length > 0 ? body.selectedUserIds : undefined;
    const keepExisting: boolean = Boolean(body.keepExisting);
    const keepTogether: string[][] = Array.isArray(body.keepTogether) ? body.keepTogether : [];
    const keepSeparate: string[][] = Array.isArray(body.keepSeparate) ? body.keepSeparate : [];

    // 1. Gather student candidates
    const allMembers = await classroomDb.listMembers(cid);
    const activeStudents = allMembers.filter((m) => m.role === 'student' && m.status === 'active');
    const existingTeams = await classroomDb.listTeams(cid);

    let candidateStudents = activeStudents;

    // Filter to selected students if specified
    if (selectedUserIds) {
      const selectedSet = new Set(selectedUserIds);
      candidateStudents = candidateStudents.filter((s) => selectedSet.has(s.userId));
    }

    // Filter to unassigned only if strategy specifies
    if (strategy === 'unassigned_only') {
      const assignedUserIds = new Set<string>();
      for (const t of existingTeams) {
        if (t.members) {
          for (const m of t.members) assignedUserIds.add(m.userId);
        }
      }
      candidateStudents = candidateStudents.filter((s) => !assignedUserIds.has(s.userId));
    }

    const N = candidateStudents.length;
    if (N === 0) {
      return NextResponse.json({ error: 'No eligible students available for team assignment.' }, { status: 400 });
    }

    // 2. Determine number of teams K
    let K = 1;
    if (targetCount) {
      K = Math.max(1, Math.min(targetCount, N));
    } else if (targetSize) {
      K = Math.max(1, Math.round(N / targetSize));
      K = Math.min(K, N);
    } else {
      K = Math.max(1, Math.ceil(N / settings.maxTeamSize));
    }

    // 3. Balanced equal-size distribution calculation
    // N students across K teams:
    // Base size: b = Math.floor(N / K)
    // Remainder: r = N % K
    // Exactly r teams get (b + 1), and (K - r) teams get b
    const b = Math.floor(N / K);
    const r = N % K;
    const minCalculatedSize = b;
    const maxCalculatedSize = r > 0 ? b + 1 : b;

    // Validate against classroom settings
    if (minCalculatedSize < settings.minTeamSize && b > 0) {
      return NextResponse.json({
        error: `Conflict: Proposed distribution of ${N} students across ${K} teams results in team sizes of ${minCalculatedSize}-${maxCalculatedSize}, which is below the minimum team size limit (${settings.minTeamSize}).`,
      }, { status: 400 });
    }

    if (maxCalculatedSize > settings.maxTeamSize) {
      return NextResponse.json({
        error: `Conflict: Proposed distribution of ${N} students across ${K} teams results in team sizes of ${minCalculatedSize}-${maxCalculatedSize}, which exceeds the maximum team size limit (${settings.maxTeamSize}).`,
      }, { status: 400 });
    }

    // Capacities array for each of the K teams
    const capacities: number[] = [];
    for (let i = 0; i < K; i++) {
      capacities.push(i < r ? b + 1 : b);
    }

    // Validate keepTogether groups
    for (const group of keepTogether) {
      if (group.length > settings.maxTeamSize) {
        return NextResponse.json({
          error: `Conflict: keepTogether group of ${group.length} students exceeds maximum team size (${settings.maxTeamSize}).`,
        }, { status: 400 });
      }
    }

    // 4. Partition students into teams
    // Shuffle students randomly
    const shuffled = [...candidateStudents].sort(() => Math.random() - 0.5);
    const studentMap = new Map(candidateStudents.map((s) => [s.userId, s]));

    // Initialize proposed teams
    const proposedTeams: Array<{
      teamIndex: number;
      name: string;
      projectTitle: string;
      capacity: number;
      memberIds: string[];
      members: Array<{ userId: string; name: string; email: string }>;
    }> = [];

    for (let i = 0; i < K; i++) {
      const teamNumber = (existingTeams.length > 0 && strategy === 'unassigned_only' ? existingTeams.length : 0) + i + 1;
      proposedTeams.push({
        teamIndex: i,
        name: `Team ${teamNumber}`,
        projectTitle: `Project Team ${teamNumber}`,
        capacity: capacities[i],
        memberIds: [],
        members: [],
      });
    }

    const assignedInPartition = new Set<string>();

    // A. Place keepTogether groups first
    for (const group of keepTogether) {
      const validGroup = group.filter((id) => studentMap.has(id) && !assignedInPartition.has(id));
      if (validGroup.length === 0) continue;

      // Find team with enough capacity
      const team = proposedTeams.find((t) => t.capacity - t.memberIds.length >= validGroup.length);
      if (team) {
        for (const uid of validGroup) {
          team.memberIds.push(uid);
          const st = studentMap.get(uid)!;
          team.members.push({ userId: st.userId, name: st.userName, email: st.userEmail });
          assignedInPartition.add(uid);
        }
      }
    }

    // B. Place remaining students
    for (const st of shuffled) {
      if (assignedInPartition.has(st.userId)) continue;

      // Find teams that still have capacity
      const availableTeams = proposedTeams.filter((t) => t.memberIds.length < t.capacity);
      if (availableTeams.length === 0) break;

      // Filter out teams that violate keepSeparate constraint
      let eligibleTeam = availableTeams.find((team) => {
        for (const sep of keepSeparate) {
          if (sep.includes(st.userId)) {
            const conflictingId = sep.find((id) => id !== st.userId);
            if (conflictingId && team.memberIds.includes(conflictingId)) {
              return false;
            }
          }
        }
        return true;
      });

      if (!eligibleTeam) {
        eligibleTeam = availableTeams[0];
      }

      eligibleTeam.memberIds.push(st.userId);
      eligibleTeam.members.push({ userId: st.userId, name: st.userName, email: st.userEmail });
      assignedInPartition.add(st.userId);
    }

    // 5. Calculate Changes (moving, remaining, unassigned)
    const existingUserTeamMap = new Map<string, string>();
    for (const t of existingTeams) {
      if (t.members) {
        for (const m of t.members) existingUserTeamMap.set(m.userId, t.name);
      }
    }

    const moving: Array<{ userId: string; name: string; fromTeam?: string; toTeam: string }> = [];
    const remaining: Array<{ userId: string; name: string; team: string }> = [];

    for (const pt of proposedTeams) {
      for (const m of pt.members) {
        const prev = existingUserTeamMap.get(m.userId);
        if (prev) {
          if (prev === pt.name) {
            remaining.push({ userId: m.userId, name: m.name, team: pt.name });
          } else {
            moving.push({ userId: m.userId, name: m.name, fromTeam: prev, toTeam: pt.name });
          }
        } else {
          moving.push({ userId: m.userId, name: m.name, toTeam: pt.name });
        }
      }
    }

    const unassignedAfter = activeStudents
      .filter((s) => !assignedInPartition.has(s.userId))
      .map((s) => ({ userId: s.userId, name: s.userName }));

    // 6. Sign Preview Token (HMAC-SHA256)
    const previewData = {
      cid,
      strategy,
      issuedAt: Date.now(),
      teams: proposedTeams.map((t) => ({ name: t.name, projectTitle: t.projectTitle, memberIds: t.memberIds })),
    };
    const secret = ClassroomAuth.getLiveSessionSigningSecret();
    const encoded = Buffer.from(JSON.stringify(previewData)).toString('base64url');
    const sig = createHmac('sha256', secret).update(encoded).digest('base64url');
    const previewToken = `${encoded}.${sig}`;

    return NextResponse.json({
      success: true,
      previewToken,
      stats: {
        totalStudents: N,
        totalTeams: K,
        minTeamSize: minCalculatedSize,
        maxTeamSize: maxCalculatedSize,
        isBalanced: maxCalculatedSize - minCalculatedSize <= 1,
      },
      proposedTeams,
      distribution: {
        totalStudents: N,
        teamCount: K,
        teams: proposedTeams.map((t, idx) => ({
          teamIndex: idx + 1,
          name: t.name,
          studentCount: t.members.length,
          studentIds: t.memberIds,
          students: t.members.map((m: any) => ({ id: m.userId, name: m.name, email: m.email || '' })),
        })),
      },
      changes: {
        moving,
        remaining,
        unassigned: unassignedAfter,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to generate auto-assign preview' }, { status: 500 });
  }
}
