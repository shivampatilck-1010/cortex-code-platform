import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { arenaDb } from '@/lib/arena/db';
import { projectDb, Project } from '@/lib/project/db';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';


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
    let projA: Project | null = null;
    let projB: Project | null = null;

    if (!workspace) {
      const workspaceAProjectId = `proj_bench_a_${user.id}_${benchmarkId}_${Date.now()}`;
      const workspaceBProjectId = `proj_bench_b_${user.id}_${benchmarkId}_${Date.now()}`;
      
      projA = {
        id: workspaceAProjectId,
        ownerId: user.id,
        name: `Benchmark Workspace A`,
        description: `Benchmark A`,
        language: langA,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      projB = {
        id: workspaceBProjectId,
        ownerId: user.id,
        name: `Benchmark Workspace B`,
        description: `Benchmark B`,
        language: langB,
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

    if (runType === 'A' || runType === 'BOTH') {
        const file = filesA[0];
        file.id = crypto.randomUUID();
        file.projectId = workspace.workspaceAProjectId;
        file.isFolder = file.isFolder || false;
        file.createdAt = file.createdAt || Date.now();
        file.updatedAt = Date.now();
        await projectDb.createFile(file); // Upsert file A
    }

    if (runType === 'B' || runType === 'BOTH') {
        const file = filesB[0];
        file.id = crypto.randomUUID();
        file.projectId = workspace.workspaceBProjectId;
        file.isFolder = file.isFolder || false;
        file.createdAt = file.createdAt || Date.now();
        file.updatedAt = Date.now();
        await projectDb.createFile(file); // Upsert file B
    }

    let resultA: any = null;
    let resultB: any = null;

    if (runType === 'A' || runType === 'BOTH') {
        resultA = await executeInCloudRunner({
            language: langA,
            files: filesA,
            runTimeoutMs: 5000,
            memoryLimitMb: 256
        });
    }

    if (runType === 'B' || runType === 'BOTH') {
        resultB = await executeInCloudRunner({
            language: langB,
            files: filesB,
            runTimeoutMs: 5000,
            memoryLimitMb: 256
        });
    }

    if (runType === 'BOTH') {
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
