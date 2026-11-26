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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string, fileId: string }> }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId, fileId } = await params;
    
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

    // Conflict detection
    if (body.expectedUpdatedAt && typeof body.expectedUpdatedAt === 'number' && file.updatedAt > body.expectedUpdatedAt) {
      return NextResponse.json(
        {
          error: 'CONFLICT',
          message: 'File has been modified on the server since your last fetch.',
          serverUpdatedAt: file.updatedAt,
        },
        { status: 409 }
      );
    }
    
    // Disallow path traversal on updates too
    const patchUpdates: { name?: string; path?: string; content?: string } = {};
    if (typeof body.name === 'string') {
      const trimmedName = body.name.trim();
      if (
        !trimmedName ||
        trimmedName === '.' ||
        trimmedName.includes('/') ||
        trimmedName.includes('\\') ||
        trimmedName.includes('..') ||
        trimmedName.includes('\0')
      ) {
        return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
      }
      patchUpdates.name = trimmedName;
    }
    if (typeof body.path === 'string' && body.path) {
      try {
        patchUpdates.path = sanitizePath(body.path);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
      }
    }
    if (typeof body.content === 'string') {
      patchUpdates.content = body.content;
    }

    // Automatically snapshot version if content has changed
    if (typeof patchUpdates.content === 'string' && patchUpdates.content !== file.content) {
      try {
        await projectDb.createFileVersion(fileId, projectId, file.content);
      } catch (vErr) {
        console.warn('[FileVersion] Snapshot error:', vErr);
      }
    }

    const updated = await projectDb.updateFile(fileId, patchUpdates);
    return NextResponse.json({ file: updated });
  } catch (err: any) {
    console.error('Update file error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string, fileId: string }> }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId, fileId } = await params;
    
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
