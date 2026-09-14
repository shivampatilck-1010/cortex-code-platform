import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb } from '@/lib/project/db';
import { classroomDb } from '@/lib/classroom/db';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    
    // 1. Get Arena challenges
    const arenaSubs = await arenaDb.listSubmissionsForUser(user.id);
    const solvedChallengeIds = new Set(
      arenaSubs.filter(s => s.status === 'PASSED' && s.score >= 70).map(s => s.challengeId)
    );
    
    // 2. Get active projects
    const projects = await projectDb.listProjectsForUser(user.id);
    const activeProjects = projects.filter(p => !p.name.startsWith('arena_'));
    
    // 3. Classrooms Enrolled
    const classMemberships = await classroomDb.listMembershipsForUser(user.id);
    
    // 4. Recent executions (from arena submissions for now)
    const recentExecutions = arenaSubs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map(s => ({
        lang: s.language || 'Code',
        file: 'main',
        time: s.executionTimeMs ? s.executionTimeMs + ' ms' : 'N/A',
        memory: s.memoryUsageMb ? s.memoryUsageMb + ' MB' : 'N/A',
        status: s.status === 'PASSED' && s.score >= 70 ? 'Passed' : 'Failed',
        when: new Date(s.createdAt).toLocaleString(),
      }));

    // 5. Recent projects
    const recentProjectsList = activeProjects
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 3)
      .map(p => ({
        id: p.id,
        name: p.name,
        lang: p.language || 'Unknown',
        updated: new Date(p.updatedAt).toLocaleString(),
        status: 'Active'
      }));
      
    // Total executions could be arenaSubs length + any classroom subs length
    const classSubs = await classroomDb.listSubmissionsForUser(user.id);
    const totalExecutions = arenaSubs.length + classSubs.length;

    return NextResponse.json({
      stats: {
        totalExecutions,
        challengesSolved: solvedChallengeIds.size,
        solvedChallengeIds: Array.from(solvedChallengeIds),
        activeProjectsCount: activeProjects.length,
        classroomsEnrolled: classMemberships.length,
      },
      recentProjects: recentProjectsList,
      recentExecutions,
    });
  } catch (err: any) {
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
