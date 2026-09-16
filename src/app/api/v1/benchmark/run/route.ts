import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb, Project } from '@/lib/project/db';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';

export const runtime = 'nodejs';

async function persistFiles(projectId: string, clientFiles: any[]) {
  if (!clientFiles || clientFiles.length === 0) return;
  const existingFiles = await projectDb.listFilesForProject(projectId);
  for (const clientFile of clientFiles) {
    const existing = existingFiles.find(f => f.name === clientFile.name);
    if (existing) {
      await projectDb.updateFile(existing.id, { content: clientFile.content || '', updatedAt: Date.now() });
    } else {
      await projectDb.createFile({
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        projectId,
        name: clientFile.name,
        path: clientFile.path || `/${clientFile.name}`,
        content: clientFile.content || '',
        isFolder: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { benchmarkId, runType, filesA, filesB, langA, langB } = await req.json();
    if (!benchmarkId || !runType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    let workspace = await arenaDb.getBenchmarkWorkspace(user.id, benchmarkId);
    
    // Create workspace if not existing — must verify ownership
    if (!workspace) {
      const workspaceAProjectId = `proj_bench_a_${user.id}_${benchmarkId}_${Date.now()}`;
      const workspaceBProjectId = `proj_bench_b_${user.id}_${benchmarkId}_${Date.now()}`;
      
      const projA: Project = {
        id: workspaceAProjectId,
        ownerId: user.id,
        name: `Benchmark Workspace A`,
        description: `Benchmark A`,
        language: langA || 'python',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const projB: Project = {
        id: workspaceBProjectId,
        ownerId: user.id,
        name: `Benchmark Workspace B`,
        description: `Benchmark B`,
        language: langB || 'python',
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await projectDb.createProject(projA);
      await projectDb.createProject(projB);

      workspace = await arenaDb.createBenchmarkWorkspace({
        id: `bench_ws_${user.id}_${benchmarkId}`,
        userId: user.id,
        benchmarkId,
        workspaceAProjectId,
        workspaceBProjectId,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    // Verify ownership — IDOR protection
    if (workspace.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify backing projects are owned by the same user
    const projA = await projectDb.getProject(workspace.workspaceAProjectId);
    const projB = await projectDb.getProject(workspace.workspaceBProjectId);
    if ((projA && projA.ownerId !== user.id) || (projB && projB.ownerId !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Autosave client files to server-side projects before executing
    if (runType === 'A' || runType === 'BOTH') {
      if (filesA && filesA.length > 0) {
        await persistFiles(workspace.workspaceAProjectId, filesA);
      }
    }
    if (runType === 'B' || runType === 'BOTH') {
      if (filesB && filesB.length > 0) {
        await persistFiles(workspace.workspaceBProjectId, filesB);
      }
    }

    // AUTHORITATIVE: Load server files for execution
    const serverFilesA = runType === 'A' || runType === 'BOTH' 
      ? await projectDb.listFilesForProject(workspace.workspaceAProjectId)
      : [];
    const serverFilesB = runType === 'B' || runType === 'BOTH'
      ? await projectDb.listFilesForProject(workspace.workspaceBProjectId)
      : [];

    let resultA: any = null;
    let resultB: any = null;

    if (runType === 'A' || runType === 'BOTH') {
      if (serverFilesA.length === 0) {
        return NextResponse.json({ error: 'Workspace A has no files' }, { status: 400 });
      }
      resultA = await executeInCloudRunner({
        language: langA,
        files: serverFilesA,
        runTimeoutMs: 5000,
        memoryLimitMb: 256
      });
    }

    if (runType === 'B' || runType === 'BOTH') {
      if (serverFilesB.length === 0) {
        return NextResponse.json({ error: 'Workspace B has no files' }, { status: 400 });
      }
      resultB = await executeInCloudRunner({
        language: langB,
        files: serverFilesB,
        runTimeoutMs: 5000,
        memoryLimitMb: 256
      });
    }

    // Persist benchmark run history for BOTH
    if (runType === 'BOTH' && resultA && resultB) {
      await arenaDb.createBenchmarkRun({
        id: `brun_${crypto.randomUUID()}`,
        userId: user.id,
        benchmarkId,
        langA,
        langB,
        timeMsA: resultA?.executionTimeMs || 0,
        timeMsB: resultB?.executionTimeMs || 0,
        memoryMbA: resultA?.memoryUsageMb || 0,
        memoryMbB: resultB?.memoryUsageMb || 0,
        statusA: resultA?.status || 'unknown',
        statusB: resultB?.status || 'unknown',
        createdAt: Date.now()
      });
    }

    return NextResponse.json({
       success: true,
       resultA,
       resultB
    });

  } catch (err: any) {
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
