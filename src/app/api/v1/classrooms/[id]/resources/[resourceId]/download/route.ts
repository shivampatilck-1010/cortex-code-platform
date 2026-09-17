import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string, resourceId: string }> }
) {
  try {
    const { id, resourceId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);

    if (!auth.authorized) {
      const status = auth.error?.includes('Authentication required') ? 401 : 403;
      return NextResponse.json({ error: auth.error || 'Access denied' }, { status });
    }

    const searchParams = req.nextUrl.searchParams;
    const key = searchParams.get('key');
    if (!key || key.includes('..')) {
      return NextResponse.json({ error: 'Invalid object key' }, { status: 400 });
    }

    // Verify the key belongs to this classroom to prevent path traversal across buckets
    if (!key.startsWith(`classrooms/${id}/resources/${resourceId}/`)) {
       return NextResponse.json({ error: 'Access denied to this resource key' }, { status: 403 });
    }

    const bucket = (typeof process !== 'undefined' && process.env && process.env.ASSETS_BUCKET) || 
                   (typeof globalThis !== 'undefined' && (globalThis as any).env && (globalThis as any).env.ASSETS_BUCKET);
    
    if (!bucket) {
      return NextResponse.json({ error: 'R2 Bucket is not bound' }, { status: 500 });
    }

    const object = await bucket.get(key);
    if (!object) {
      return NextResponse.json({ error: 'Resource not found in storage' }, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    
    return new NextResponse(object.body, {
      headers,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to download resource' }, { status: 500 });
  }
}
