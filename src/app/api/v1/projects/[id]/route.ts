import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';

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
    
    return NextResponse.json({ project, files });
  } catch (err: any) {
    console.error('Get project error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id } = await params;
    const project = await projectDb.getProject(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const updated = await projectDb.updateProject(id, body);
    return NextResponse.json({ project: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id } = await params;
    const project = await projectDb.getProject(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await projectDb.deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
