import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    
    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, cortexId: user.cortexId }
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
