import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId, fileId } = await params;

    const project = await projectDb.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const file = await projectDb.getFile(fileId);
    if (!file || file.projectId !== projectId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const versions = await projectDb.listFileVersions(fileId);
    return NextResponse.json({ versions });
  } catch (err: any) {
    console.error('List file versions error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId, fileId } = await params;

    const project = await projectDb.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const file = await projectDb.getFile(fileId);
    if (!file || file.projectId !== projectId) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    let body: any = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ error: 'Malformed JSON' }, { status: 400 });
    }

    const { action, versionId } = body || {};

    if (action === 'create' || (!versionId && action !== 'restore')) {
      const content = body.content !== undefined ? String(body.content) : file.content;
      const version = await projectDb.createFileVersion(fileId, projectId, content);
      if (!version) {
        return NextResponse.json({ error: 'Failed to create file version' }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: 'Version created successfully',
        version,
      });
    }

    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }

    const restoredFile = await projectDb.restoreFileVersion(fileId, versionId);
    if (!restoredFile) {
      return NextResponse.json({ error: 'Failed to restore version or version not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Version restored successfully',
      file: restoredFile,
    });
  } catch (err: any) {
    console.error('File version operation error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
