import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(req: NextRequest) {
  try {
    const env = (typeof globalThis !== 'undefined' ? (globalThis as any).env : null) || process.env || {};
    const clientId = (env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();

    // Validate both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET: non-empty, length > 20, and not containing 'mock_', 'demo', or 'placeholder'
    const isLiveClientId =
      clientId.length > 20 &&
      !clientId.toLowerCase().includes('mock_') &&
      !clientId.toLowerCase().includes('demo') &&
      !clientId.toLowerCase().includes('placeholder');

    const isLiveClientSecret =
      clientSecret.length > 20 &&
      !clientSecret.toLowerCase().includes('mock_') &&
      !clientSecret.toLowerCase().includes('demo') &&
      !clientSecret.toLowerCase().includes('placeholder');

    if (!isLiveClientId || !isLiveClientSecret) {
      const redirectUrl = `${req.nextUrl.origin}/login?error=google_not_configured&message=${encodeURIComponent('Google OAuth is not configured on this instance.')}`;
      return NextResponse.redirect(redirectUrl, 307);
    }

    // Generate a cryptographically secure, unpredictable state token
    const state = ClassroomAuth.generateSecureToken(32);
    const origin = req.nextUrl.origin;
    const redirectUri = `${origin}/api/v1/auth/google/callback`;

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    const response = NextResponse.redirect(googleAuthUrl.toString(), 307);
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    });
    return response;
  } catch (err: any) {
    console.error('[Google OAuth] Login initiation error:', err);
    const redirectUrl = `${req.nextUrl.origin}/login?error=google_auth_failed&message=${encodeURIComponent(err?.message || 'Authentication failed')}`;
    return NextResponse.redirect(redirectUrl, 307);
  }
}

