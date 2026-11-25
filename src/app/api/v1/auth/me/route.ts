import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';

export async function PATCH(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json();
    const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
    const rawAvatar = typeof body?.avatar === 'string' ? body.avatar.trim() : '';

    if (rawName && (rawName.length < 2 || rawName.length > 80)) {
      return NextResponse.json({ error: 'Name must be between 2 and 80 characters' }, { status: 400 });
    }

    if (rawAvatar && !rawAvatar.startsWith('https://')) {
      return NextResponse.json({ error: 'Avatar URL must use HTTPS' }, { status: 400 });
    }

    if (!rawName && !rawAvatar) {
      return NextResponse.json({ error: 'No valid profile fields provided' }, { status: 400 });
    }

    await classroomDb.updateUserProfile(user.id, {
      ...(rawName ? { name: rawName } : {}),
      ...(rawAvatar ? { avatar: rawAvatar } : {}),
    });

    const updated = await classroomDb.getUser(user.id);
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        cortexId: updated.cortexId || updated.cortex_id,
        avatar: updated.avatar || undefined,
        professionalEmail: updated.professionalEmail || updated.professional_email,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cortexId: user.cortexId || (user as any).cortex_id,
        avatar: (user as any).avatar || undefined,
        professionalEmail: (user as any).professional_email || (user as any).professionalEmail,
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
