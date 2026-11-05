const fs = require('fs');
const path = require('path');
const dir = path.join('src', 'app', 'api', 'v1', 'classrooms', '[id]', 'resources', 'upload');
fs.mkdirSync(dir, { recursive: true });
const code = \import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { ClassroomResource } from '@/lib/classroom/models';

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

    const bucket = (typeof process !== 'undefined' && process.env && process.env.ASSETS_BUCKET) || 
                   (typeof globalThis !== 'undefined' && (globalThis as any).env && (globalThis as any).env.ASSETS_BUCKET);
    
    if (!bucket) {
      return NextResponse.json({ error: 'R2 Bucket is not bound to the Worker environment' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const description = formData.get('description') as string || '';
    const unit = formData.get('unit') as string || 'General Resources';

    if (!file) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
    }
    
    if (file.size > 25 * 1024 * 1024) { // 25MB limit
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

    const resourceId = \\\es_\\_\\\\\;
    const objectKey = \\\classrooms/\\/resources/\\/\\\\\;

    await bucket.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type }
    });

    const url = \\\/api/v1/classrooms/\\/resources/\\/download?key=\\\\\;

    const resource: ClassroomResource = {
      id: resourceId,
      classroomId: id,
      uploadedBy: user.id,
      uploadedByName: user.name,
      name: sanitizedName,
      type: file.type.includes('pdf') ? 'pdf' : (file.type.includes('image') ? 'image' : 'link'),
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
\;
fs.writeFileSync(path.join(dir, 'route.ts'), code);

