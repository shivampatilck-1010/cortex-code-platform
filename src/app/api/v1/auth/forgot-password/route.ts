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

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is missing');
      return NextResponse.json({ error: 'Email configuration is missing on the server.' }, { status: 500 });
    }

    const resetUrl = new URL(req.url).origin + '/auth/reset-password?token=' + resetToken;
    const emailReq = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'support@cortexcode.io',
        to: user.email,
        subject: 'Cortex Code Platform - Password Reset',
        html: `<p>Hello ${user.name},</p><p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link expires in 1 hour.</p>`
      })
    });

    if (!emailReq.ok) {
      console.error('Failed to dispatch email via provider:', await emailReq.text());
      // Fail safely without claiming delivery
      return NextResponse.json({ error: 'Email provider rejected the request. Please try again later.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
