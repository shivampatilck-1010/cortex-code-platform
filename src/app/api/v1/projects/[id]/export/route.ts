import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { zipSync, strToU8 } from 'fflate';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id } = await params;
    const project = await projectDb.getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const files = await projectDb.listFilesForProject(id);
    const zipData: Record<string, Uint8Array> = {};

    for (const file of files) {
      if (!file.isFolder && file.path) {
        // Remove leading slash for zip paths
        const normalizedPath = file.path.replace(/^\/+/, '');
        if (normalizedPath) {
            zipData[normalizedPath] = strToU8(file.content || '');
        }
      }
    }

    const zipped = zipSync(zipData);

    return new NextResponse(zipped, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.name || 'project'}.zip"`,
      },
    });
  } catch (error: any) {
    console.error('Project export error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
