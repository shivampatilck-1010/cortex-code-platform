import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';

function sanitizePath(filePath: string): string {
  // Prevent directory traversal
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.includes('//')) {
    throw new Error('Invalid file path');
  }
  return normalized;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string, fileId: string } }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId, fileId } = params;
    
    // Auth & ownership check
    const project = await projectDb.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // File check
    const file = await projectDb.getFile(fileId);
    if (!file || file.projectId !== projectId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const body = await req.json();
    
    // Disallow path traversal on updates too
    if (body.path) {
      try {
        body.path = sanitizePath(body.path);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
    }

    const updated = await projectDb.updateFile(fileId, body);
    return NextResponse.json({ file: updated });
  } catch (err: any) {
    console.error('Update file error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string, fileId: string } }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId, fileId } = params;
    
    const project = await projectDb.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const file = await projectDb.getFile(fileId);
    if (!file || file.projectId !== projectId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    await projectDb.deleteFile(fileId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
