import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ClassroomResource } from '@/lib/classroom/models';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const resources = classroomDb.listResources(id);
    return NextResponse.json({ resources });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to list resources' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = ClassroomAuth.getCurrentUser(req);
    const auth = ClassroomAuth.verifyAccess(req, id, 'teacher');

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error || 'Teacher privileges required to upload resources.' }, { status: 403 });
    }

    const body = await req.json();
    const { name, type, url, description, unit } = body;

    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required for resources.' }, { status: 400 });
    }

    const resource: ClassroomResource = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classroomId: id,
      uploadedBy: user.id,
      uploadedByName: user.name,
      name: name.trim(),
      type: type || 'pdf',
      url: url.trim(),
      description: (description || '').trim(),
      unit: (unit || 'General Resources').trim(),
      createdAt: Date.now(),
    };

    classroomDb.createResource(resource);

    return NextResponse.json({ success: true, resource }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create resource' }, { status: 500 });
  }
}
