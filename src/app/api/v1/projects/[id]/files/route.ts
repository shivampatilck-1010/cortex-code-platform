import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb, ProjectFile } from '@/lib/project/db';
import crypto from 'crypto';
import { validateAndSanitizePath } from '@/lib/execution/path-sanitizer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const project = await projectDb.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, path, content, isFolder } = body;
    
    if (!name || !path) {
      return NextResponse.json({ error: 'Missing name or path' }, { status: 400 });
    }

    const pathValidation = validateAndSanitizePath(path);
    if (!pathValidation.valid) {
      return NextResponse.json({ error: pathValidation.error || 'Invalid path' }, { status: 400 });
    }
    const safePath = pathValidation.sanitizedPath || path;

    const newFile: ProjectFile = {
      id: `file_${crypto.randomUUID()}`,
      projectId,
      name,
      path: safePath,
      content: content || '',
      isFolder: Boolean(isFolder),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await projectDb.createFile(newFile);
    return NextResponse.json({ file: newFile }, { status: 201 });
  } catch (err: any) {
    console.error('Create file error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
