import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb, Project, ProjectFile } from '@/lib/project/db';
import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { readJsonBody, RequestBodyError } from '@/lib/http/safe-json';
import { ARENA_MAX_REQUEST_BYTES } from '@/lib/arena/request-validation';


export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);

    const { challengeId, language } = await readJsonBody<{ challengeId?: string; language?: string }>(req, ARENA_MAX_REQUEST_BYTES);
    if (!challengeId) {
      return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 });
    }

    const challenge = CHALLENGES.find(c => c.id === challengeId || c.slug === challengeId);
    if (!challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (!user) {
      const targetLang =
        language && challenge.starterTemplates[language]
          ? language
          : Object.keys(challenge.starterTemplates)[0] || language || 'python';
      const starterCode = challenge.starterTemplates[targetLang] || challenge.starterTemplates['python'] || '# Write your solution here\n';
      const ext = targetLang === 'python' ? 'py' : targetLang === 'javascript' ? 'js' : targetLang === 'typescript' ? 'ts' : targetLang === 'cpp' ? 'cpp' : targetLang === 'c' ? 'c' : targetLang === 'java' ? 'java' : targetLang === 'sql' ? 'sql' : 'txt';

      const guestWorkspace = {
        id: `arena_ws_guest_${challenge.id}`,
        userId: 'guest',
        challengeId: challenge.id,
        projectId: 'guest_project',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const guestFile: ProjectFile = {
        id: 'guest_sol',
        projectId: 'guest_project',
        name: `solution.${ext}`,
        path: `/solution.${ext}`,
        content: starterCode,
        isFolder: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const safeChallenge = {
        ...challenge,
        testCases: challenge.testCases.filter(tc => !tc.isHidden).map(tc => ({ ...tc, isHidden: false }))
      };

      return NextResponse.json({
        workspace: guestWorkspace,
        files: [guestFile],
        created: false,
        challenge: safeChallenge,
        isGuest: true
      });
    }

    let workspace = await arenaDb.getArenaWorkspace(user.id, challenge.id);
    let projectId = workspace?.projectId;
    let created = false;

    if (!workspace || !(await projectDb.getProject(workspace.projectId))) {
      // Create backing project
      projectId = `proj_arena_${user.id}_${challenge.id}_${Date.now()}`;
      
      const targetLang =
        language && challenge.starterTemplates[language]
          ? language
          : Object.keys(challenge.starterTemplates)[0] || language || 'python';
      const proj: Project = {
        id: projectId,
        ownerId: user.id,
        name: `Arena: ${challenge.title}`,
        description: `Arena Workspace for ${challenge.title}`,
        language: targetLang,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await projectDb.createProject(proj);
      
      // Starter code
      const starterCode = challenge.starterTemplates[targetLang] || challenge.starterTemplates['python'] || '# Write your solution here\n';
      
      const ext = targetLang === 'python' ? 'py' : targetLang === 'javascript' ? 'js' : targetLang === 'typescript' ? 'ts' : targetLang === 'cpp' ? 'cpp' : targetLang === 'c' ? 'c' : targetLang === 'java' ? 'java' : targetLang === 'sql' ? 'sql' : 'txt';
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
    if (err instanceof RequestBodyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
