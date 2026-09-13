import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await classroomDb.getUserByEmail(normalizedEmail);

    // We intentionally return a success message even if the user doesn't exist to prevent email enumeration.
    if (!user || user.status !== 'active') {
      return NextResponse.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const resetToken = ClassroomAuth.generateSecureToken(64);
    const tokenBuffer = new TextEncoder().encode(resetToken);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBuffer);
    const fastHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    const expiresAt = Date.now() + 1000 * 60 * 60; // 1 hour

    await classroomDb.createResetToken(fastHash, user.id, expiresAt);

    if (process.env.NODE_ENV === 'development' || !process.env.EMAIL_PROVIDER) {
      console.log('\n==================================================');
      console.log('DEVELOPMENT ONLY: PASSWORD RESET TOKEN');
      console.log(`User: ${user.email}`);
      console.log(`Token: ${resetToken}`);
      console.log('Use this token to reset the password manually.');
      console.log('==================================================\n');
    } else {
      // In production, send via email provider
      // throw new Error("Production email provider missing");
    }

    return NextResponse.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
