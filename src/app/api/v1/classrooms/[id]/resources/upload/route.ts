import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ClassroomResource } from '@/lib/classroom/models';
import { getAssetsBucket } from '@/lib/classroom/storage';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await ClassroomAuth.getCurrentUser(req);
    const auth = await ClassroomAuth.verifyAccess(req, id, 'teacher');

    if (!auth.authorized) {
      const status = auth.error?.includes('Authentication required') ? 401 : 403;
      return NextResponse.json({ error: auth.error || 'Teacher privileges required to upload resources.' }, { status });
    }

    const bucket = getAssetsBucket();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string || '';
    const unit = formData.get('unit') as string || 'General Resources';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25MB limit.' }, { status: 413 });
    }

    const validMimes = ['application/pdf', 'application/zip', 'image/png', 'image/jpeg', 'text/plain'];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type.' }, { status: 415 });
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    if (sanitizedName.includes('..') || sanitizedName.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
    }

    const resourceId = `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const objectKey = `classrooms/${id}/resources/${resourceId}/${sanitizedName}`;

    await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const url = `/api/v1/classrooms/${id}/resources/${resourceId}/download?key=${encodeURIComponent(objectKey)}`;

    const resource: ClassroomResource = {
      id: resourceId,
      classroomId: id,
      uploadedBy: user.id,
      uploadedByName: user.name,
      name: sanitizedName,
      type: file.type.includes('pdf') ? 'pdf' : 'link',
      url: url,
      description: description.trim(),
      unit: unit.trim(),
      createdAt: Date.now(),
    };

    await classroomDb.createResource(resource);

    return NextResponse.json({ success: true, resource }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to upload resource' }, { status: 500 });
  }
}
