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

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').toLowerCase().trim();
    const status = searchParams.get('status') || undefined;
    const sort = searchParams.get('sort') || 'name'; // 'name' | 'members' | 'recent'

    let teams = await classroomDb.listTeams(cid, status);

    // Filter by search query (name, projectTitle, description, or member name)
    if (q) {
      teams = teams.filter((t) => {
        const matchesText =
          t.name.toLowerCase().includes(q) ||
          t.projectTitle.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q);
        const matchesMember = t.members?.some((m) => (m.userName || '').toLowerCase().includes(q));
        return matchesText || matchesMember;
      });
    }

    // Sort
    if (sort === 'members') {
      teams.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
    } else if (sort === 'recent') {
      teams.sort((a, b) => b.updatedAt - a.updatedAt);
    } else {
      teams.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Attach latest activity to each card
    const galleryCards: any[] = [];
    for (const t of teams) {
      const recentActivities = await classroomDb.listProjectActivity(cid, t.id, 1);
      const latestActivity = recentActivities.length > 0 ? recentActivities[0] : null;

      galleryCards.push({
        id: t.id,
        classroomId: t.classroomId,
        classroom_id: t.classroomId,
        name: t.name,
        projectTitle: t.projectTitle,
        project_title: t.projectTitle,
        description: t.description,
        status: t.status,
        themePreset: t.themePreset,
        theme_preset_id: t.themePreset,
        proposedThemePreset: t.proposedThemePreset,
        isLocked: Boolean(t.isLocked),
        is_locked: Boolean(t.isLocked),
        max_size: 6,
        memberCount: t.memberCount || 0,
        member_count: t.memberCount || 0,
        members: t.members || [],
        latestActivity: latestActivity
          ? {
              type: latestActivity.eventType,
              actorName: latestActivity.actorName,
              createdAt: latestActivity.createdAt,
            }
          : null,
        createdAt: t.createdAt,
        created_at: t.createdAt,
        updatedAt: t.updatedAt,
        updated_at: t.updatedAt,
      });
    }

    return NextResponse.json({ success: true, cards: galleryCards, totalCount: galleryCards.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load project gallery' }, { status: 500 });
  }
}
