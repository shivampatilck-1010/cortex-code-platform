import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb, Project, ProjectFile } from '@/lib/project/db';
import { CHALLENGES } from '@/lib/challenges/challenges-data';


export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { challengeId, language } = await req.json();
    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 });
    }

    const challenge = CHALLENGES.find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    let workspace = await arenaDb.getArenaWorkspace(user.id, challenge.id);
    let projectId = workspace?.projectId;
    let created = false;

    if (!workspace || !(await projectDb.getProject(workspace.projectId))) {
      // Create backing project
      projectId = `proj_arena_${user.id}_${challenge.id}_${Date.now()}`;
      
      const proj: Project = {
        id: projectId,
        ownerId: user.id,
        name: `Arena: ${challenge.title}`,
        description: `Arena Workspace for ${challenge.title}`,
        language: language || 'python',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await projectDb.createProject(proj);
      
      // Starter code
      const targetLang = language || 'python';
      const starterCode = challenge.starterTemplates[targetLang] || challenge.starterTemplates['python'] || '# Write your solution here\n';
      
      const ext = targetLang === 'python' ? 'py' : targetLang === 'javascript' ? 'js' : targetLang === 'typescript' ? 'ts' : targetLang === 'cpp' ? 'cpp' : targetLang === 'c' ? 'c' : targetLang === 'java' ? 'java' : 'txt';
      const file: ProjectFile = {
        id: crypto.randomUUID(),
        projectId,
        name: `solution.${ext}`,
        path: `/solution.${ext}`,
        content: starterCode,
        isFolder: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await projectDb.createFile(file);

      workspace = {
        id: `arena_ws_${user.id}_${challenge.id}`,
        userId: user.id,
        challengeId: challenge.id,
        projectId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await arenaDb.createArenaWorkspace(workspace);
      created = true;
    }

    const safeChallenge = {
      ...challenge,
      testCases: challenge.testCases.filter(tc => !tc.isHidden).map(tc => ({ ...tc, isHidden: false }))
    };

    const files = await projectDb.listFilesForProject(projectId!);

    return NextResponse.json({ workspace, files, created, challenge: safeChallenge });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
