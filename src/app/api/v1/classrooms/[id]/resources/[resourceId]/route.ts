import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string, resourceId: string }> }
) {
  try {
    const { id, resourceId } = await params;
    const auth = await ClassroomAuth.verifyAccess(req, id);
    if (!auth.authorized || auth.context?.membership?.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can delete resources' }, { status: 403 });
    }

    // Attempt to delete from R2 as well if possible (but the DB record deletion is primary)
    // For now we just call deleteResource on the DB.
    await classroomDb.deleteResource(resourceId);
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete resource' }, { status: 500 });
  }
}
