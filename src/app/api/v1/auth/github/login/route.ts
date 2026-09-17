import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { githubRateLimiter } from '@/lib/execution/rate-limiter';

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = githubRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const env = (typeof globalThis !== 'undefined' ? (globalThis as any).env : null) || process.env || {};
    const clientId = env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || 'mock_client_id';
    
    // Generate a cryptographically secure, unpredictable state token
    const state = ClassroomAuth.generateSecureToken(32);

    const redirectUri = `${req.nextUrl.origin}/api/v1/auth/github/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo&state=${state}`;

    const response = NextResponse.redirect(githubUrl);
    // Bind state to this specific user session via HttpOnly cookie (prevents CSRF and replay attacks)
    response.cookies.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10 // 10 minutes
    });

    return response;
  } catch (err: any) {
    console.error('GitHub login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
