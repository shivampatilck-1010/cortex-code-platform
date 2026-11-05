import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ThemePresetId } from '@/lib/classroom/models';

const VALID_THEME_PRESETS: Set<ThemePresetId> = new Set([
  'cortex_signature',
  'aurora',
  'neural',
  'circuit',
  'midnight',
  'ocean',
  'emerald',
  'paper',
]);

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

    const body = await req.json();
    const themePreset: ThemePresetId = body.themePreset || body.theme_preset_id;
    const action: 'apply' | 'approve' | 'propose' = body.action || 'apply';

    if (!themePreset || !VALID_THEME_PRESETS.has(themePreset)) {
      return NextResponse.json({
        error: `Invalid theme preset: '${themePreset}'. Supported presets: ${Array.from(VALID_THEME_PRESETS).join(', ')}.`,
      }, { status: 400 });
    }

    const settings = await classroomDb.getTeamSettings(cid);
    const isTeacherOrAdmin = user.role === 'admin' || membership.role === 'teacher';
    const isLeader = team.members?.some((m) => m.userId === user.id && m.teamRole === 'leader');

    // Theme Permissions Evaluation
    if (settings.themePolicy === 'teacher_controlled') {
      if (!isTeacherOrAdmin) {
        return NextResponse.json({ error: 'Forbidden: Theme customization is teacher-controlled in this classroom.' }, { status: 403 });
      }
    } else if (settings.themePolicy === 'approval_required') {
      if (!isTeacherOrAdmin && !isLeader) {
        return NextResponse.json({ error: 'Forbidden: Only the team leader or instructor can propose/change themes.' }, { status: 403 });
      }

      // If leader proposes and not teacher, set proposedThemePreset instead of applying directly
      if (!isTeacherOrAdmin && action !== 'approve') {
        const updated = await classroomDb.updateTeam(teamId, { proposedThemePreset: themePreset });
        await classroomDb.recordProjectActivity({
          classroomId: cid,
          teamId,
          actorUserId: user.id,
          actorName: user.name,
          eventType: 'theme.proposed',
          details: { proposedTheme: themePreset },
        });
        return NextResponse.json({
          success: true,
          status: 'proposed',
          message: `Theme '${themePreset}' proposed for instructor approval.`,
          team: updated,
        });
      }
    } else if (settings.themePolicy === 'team_leader') {
      if (!isTeacherOrAdmin && !isLeader) {
        return NextResponse.json({ error: 'Forbidden: Only the team leader or instructor can customize the theme.' }, { status: 403 });
      }
    }

    // Apply theme
    const updated = await classroomDb.updateTeam(teamId, {
      themePreset,
      proposedThemePreset: null, // Clear proposed
    });

    await classroomDb.recordProjectActivity({
      classroomId: cid,
      teamId,
      actorUserId: user.id,
      actorName: user.name,
      eventType: 'theme.changed',
      details: { previousTheme: team.themePreset, newTheme: themePreset },
    });

    return NextResponse.json({
      success: true,
      status: 'applied',
      message: `Theme preset '${themePreset}' applied successfully.`,
      team: updated,
      themePreset,
      theme_preset_id: themePreset,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update theme' }, { status: 500 });
  }
}
