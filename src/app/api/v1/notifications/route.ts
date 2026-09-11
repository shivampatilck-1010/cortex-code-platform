import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function PUT(req: NextRequest) {
  try {
    const user = ClassroomAuth.getCurrentUser(req);
    const body = await req.json();

    if (body.markAllRead) {
      classroomDb.markAllNotificationsRead(user.id);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
