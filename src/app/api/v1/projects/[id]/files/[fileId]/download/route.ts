import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';

const MIME_TYPES: Record<string, string> = {
  py: 'text/x-python',
  js: 'text/javascript',
  ts: 'text/typescript',
  cpp: 'text/x-c',
  c: 'text/x-c',
  h: 'text/x-c',
  hpp: 'text/x-c',
  java: 'text/x-java-source',
  html: 'text/html',
  css: 'text/css',
  json: 'application/json',
  md: 'text/markdown',
  sql: 'text/x-sql',
  sh: 'application/x-sh',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  xml: 'application/xml',
  txt: 'text/plain',
};

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

    if (file.isFolder) {
      return NextResponse.json({ error: 'Cannot download folder as a single file' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';
    const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';

    const encodedFilename = encodeURIComponent(file.name);

    return new NextResponse(file.content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${file.name}"; filename*=UTF-8''${encodedFilename}`,
        'Content-Length': String(Buffer.byteLength(file.content, 'utf8')),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err: any) {
    console.error('[Download File Route Error]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
