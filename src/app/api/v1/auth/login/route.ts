import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required' }, { status: 400 });
    }

    const normalizedIdentifier = identifier.trim();
    let user = null;

    if (normalizedIdentifier.includes('@')) {
      user = await classroomDb.getUserByEmail(normalizedIdentifier.toLowerCase());
    } else {
      user = await classroomDb.getUserByCortexId(normalizedIdentifier.toUpperCase());
    }

    if (!user || user.status !== 'active') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.password_hash) {
       return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await ClassroomAuth.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const sessionId = ClassroomAuth.generateSecureToken(32);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    await classroomDb.createSession(sessionId, user.id, expiresAt);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, cortexId: user.cortex_id }
    });
    
    response.cookies.set({
      name: 'cortex_session',
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt),
    });

    return response;
  } catch (err: any) {
    console.error('Login error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
