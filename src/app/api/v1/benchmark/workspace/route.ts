import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb, Project, ProjectFile } from '@/lib/project/db';


export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { benchmarkId, preset } = await req.json();
    if (!benchmarkId || !preset) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    let workspace = await arenaDb.getBenchmarkWorkspace(user.id, benchmarkId);
    let workspaceAProjectId = workspace?.workspaceAProjectId;
    let workspaceBProjectId = workspace?.workspaceBProjectId;
    
    // Ensure both exist
    if (!workspace || !(await projectDb.getProject(workspace.workspaceAProjectId)) || !(await projectDb.getProject(workspace.workspaceBProjectId))) {
      workspaceAProjectId = `proj_bench_a_${user.id}_${benchmarkId}_${Date.now()}`;
      workspaceBProjectId = `proj_bench_b_${user.id}_${benchmarkId}_${Date.now()}`;
      
      const projA: Project = {
        id: workspaceAProjectId,
        ownerId: user.id,
        name: `Benchmark A: ${preset.name}`,
        description: `Benchmark Workspace A`,
        language: preset.langA || 'python',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const projB: Project = {
        id: workspaceBProjectId,
        ownerId: user.id,
        name: `Benchmark B: ${preset.name}`,
        description: `Benchmark Workspace B`,
        language: preset.langB || 'python',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await projectDb.createProject(projA);
      await projectDb.createProject(projB);
      
      const extA = projA.language === 'python' ? 'py' : projA.language === 'javascript' ? 'js' : projA.language === 'typescript' ? 'ts' : projA.language === 'cpp' ? 'cpp' : projA.language === 'c' ? 'c' : projA.language === 'java' ? 'java' : 'txt';
      const fileA: ProjectFile = {
        id: crypto.randomUUID(),
        projectId: projA.id,
        name: `solution.${extA}`,
        path: `/solution.${extA}`,
        content: preset.codeA || '',
        isFolder: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const extB = projB.language === 'python' ? 'py' : projB.language === 'javascript' ? 'js' : projB.language === 'typescript' ? 'ts' : projB.language === 'cpp' ? 'cpp' : projB.language === 'c' ? 'c' : projB.language === 'java' ? 'java' : 'txt';
      const fileB: ProjectFile = {
        id: crypto.randomUUID(),
        projectId: projB.id,
        name: `solution.${extB}`,
        path: `/solution.${extB}`,
        content: preset.codeB || '',
        isFolder: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await projectDb.createFile(fileA);
      await projectDb.createFile(fileB);

      workspace = {
        id: `bench_ws_${user.id}_${benchmarkId}`,
        userId: user.id,
        benchmarkId,
        workspaceAProjectId,
        workspaceBProjectId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await arenaDb.createBenchmarkWorkspace(workspace);
    }

    const filesA = await projectDb.listFilesForProject(workspaceAProjectId!);
    const filesB = await projectDb.listFilesForProject(workspaceBProjectId!);

    const projectA = await projectDb.getProject(workspaceAProjectId!);
    const projectB = await projectDb.getProject(workspaceBProjectId!);

    return NextResponse.json({ 
       workspace, 
       projectA,
       projectB,
       filesA, 
       filesB 
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
