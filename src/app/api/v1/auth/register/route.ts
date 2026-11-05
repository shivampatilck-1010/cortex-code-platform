import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORTEX_ID_REGEX = /^[a-zA-Z0-9_]{3,20}$/; // Alphanumeric and underscore, 3-20 chars

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, cortexId, password, confirmPassword, role, inviteCode } = body;

    if (!name || !email || !cortexId || !password || !confirmPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    if (password.length < 10) {
      return NextResponse.json({ error: 'Password must be at least 10 characters long' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (!CORTEX_ID_REGEX.test(cortexId)) {
      return NextResponse.json({ error: 'Invalid Cortex ID format (alphanumeric and underscores only, 3-20 characters)' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCortexId = cortexId.toUpperCase().trim();

    // Check existing
    const existingEmail = await classroomDb.getUserByEmail(normalizedEmail);
    if (existingEmail) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const existingCortexId = await classroomDb.getUserByCortexId(normalizedCortexId);
    if (existingCortexId) {
      return NextResponse.json({ error: 'Cortex ID already in use' }, { status: 409 });
    }

    // Role provisioning
    let userRole: 'student' | 'teacher' | 'admin' = 'student';
    
    if (role === 'teacher') {
      // Secure teacher provisioning check (accepts demo & official invite codes)
      const normalizedInvite = (inviteCode || '').toLowerCase().trim();
      const validCodes = ['cortex-prof-2026', 'cortex-teacher-2026', 'cortex2026', 'prof2026', 'teacher2026'];
      if (!validCodes.includes(normalizedInvite)) {
        return NextResponse.json({ error: 'Invalid or missing teacher invite code. Please enter: cortex-prof-2026' }, { status: 403 });
      }
      userRole = 'teacher';
    } else if (role === 'admin') {
      return NextResponse.json({ error: 'Admin registration is not allowed via this endpoint' }, { status: 403 });
    }

    const passwordHash = await ClassroomAuth.hashPassword(password);
    const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

    const user = {
      id: userId,
      cortex_id: normalizedCortexId,
      password_hash: passwordHash,
      name: name.trim(),
      email: normalizedEmail,
      role: userRole,
      status: 'active' as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const createdUser = await classroomDb.createUser(user);

    // Create session securely
    const sessionId = ClassroomAuth.generateSecureToken(32);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    await classroomDb.createSession(sessionId, user.id, expiresAt);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        cortexId: user.cortex_id,
        professionalEmail: (createdUser as any)?.professional_email || (createdUser as any)?.professionalEmail || (user as any).professional_email,
      }
    });
    
    response.headers.append('Set-Cookie', 'cortex_session=' + sessionId + '; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=' + new Date(expiresAt).toUTCString());

    return response;
  } catch (err: any) {
    console.error('Registration error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


