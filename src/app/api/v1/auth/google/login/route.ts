import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(req: NextRequest) {
  try {
    const env = (typeof globalThis !== 'undefined' ? (globalThis as any).env : null) || process.env || {};
    const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;

    // Generate a cryptographically secure, unpredictable state token
    const state = ClassroomAuth.generateSecureToken(32);
    const origin = req.nextUrl.origin;
    const redirectUri = `${origin}/api/v1/auth/google/callback`;

    // Real Google OAuth redirect if client ID is configured with valid Google format
    const isLiveClientId = clientId && 
      !clientId.includes('demo') && 
      !clientId.startsWith('mock_') && 
      !clientId.startsWith('your_') &&
      clientId.length > 20;

    if (isLiveClientId) {
      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', clientId);
      googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', 'openid email profile');
      googleAuthUrl.searchParams.set('state', state);
      googleAuthUrl.searchParams.set('access_type', 'offline');
      googleAuthUrl.searchParams.set('prompt', 'select_account');

      const response = NextResponse.redirect(googleAuthUrl.toString());
      response.cookies.set('google_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10, // 10 minutes
        path: '/',
      });
      return response;
    }

    // Interactive Demo / Sandbox Fallback
    // Allows immediate testing of Google authentication in environments where GOOGLE_CLIENT_ID is pending setup
    const demoGoogleUrl = new URL(`${origin}/api/v1/auth/google/callback`);
    demoGoogleUrl.searchParams.set('code', 'mock_google_auth_code');
    demoGoogleUrl.searchParams.set('state', state);
    demoGoogleUrl.searchParams.set('simulated', 'true');

    const response = NextResponse.redirect(demoGoogleUrl.toString());
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
    return response;
  } catch (err: any) {
    console.error('[Google OAuth] Login initiation error:', err);
    return NextResponse.json({ error: 'Failed to initiate Google authentication' }, { status: 500 });
  }
}
