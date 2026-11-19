import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import { User } from '@/lib/classroom/models';

function createErrorRedirect(origin: string, error: string, message: string): NextResponse {
  const redirectUrl = `${origin}/login?error=${encodeURIComponent(error)}&message=${encodeURIComponent(message)}`;
  const response = NextResponse.redirect(redirectUrl, 307);
  response.cookies.delete('google_oauth_state');
  response.cookies.set('google_oauth_state', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  try {
    // Priority 1: Check credentials configuration
    const env = (typeof globalThis !== 'undefined' ? (globalThis as any).env : null) || process.env || {};
    const clientId = (env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '').trim();

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
      return createErrorRedirect(
        origin,
        'google_not_configured',
        'Google OAuth is not configured on this instance.'
      );
    }

    const { searchParams } = new URL(req.url);

    // Priority 2: Check query params for error (e.g. user cancelled on consent screen)
    const oauthError = searchParams.get('error');
    if (oauthError) {
      const errorDescription =
        searchParams.get('error_description') || 'Google authentication was cancelled or access denied.';
      return createErrorRedirect(
        origin,
        'google_auth_cancelled',
        errorDescription
      );
    }

    // Priority 3: Check for missing code or state
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return createErrorRedirect(
        origin,
        'google_missing_parameters',
        'Missing authorization code or state parameter.'
      );
    }

    // Priority 4: Timing-safe CSRF state validation
    const expectedState = req.cookies.get('google_oauth_state')?.value;
    if (!expectedState) {
      return createErrorRedirect(
        origin,
        'google_invalid_state',
        'Invalid or expired OAuth state.'
      );
    }

    const stateHash = crypto.createHash('sha256').update(state).digest();
    const expectedHash = crypto.createHash('sha256').update(expectedState).digest();
    const isStateValid = crypto.timingSafeEqual(stateHash, expectedHash);

    if (!isStateValid) {
      return createErrorRedirect(
        origin,
        'google_invalid_state',
        'Invalid or expired OAuth state.'
      );
    }

    const redirectUri = `${origin}/api/v1/auth/google/callback`;

    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenRes.ok || tokenData.error) {
      return createErrorRedirect(
        origin,
        'google_auth_failed',
        tokenData.error_description || tokenData.error || 'Google token exchange failed'
      );
    }

    // 2. Fetch user profile from Google UserInfo endpoint
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
      },
    });

    const userData = (await userRes.json()) as any;
    if (!userRes.ok || !userData.email) {
      return createErrorRedirect(
        origin,
        'google_auth_failed',
        'Failed to retrieve Google user profile.'
      );
    }

    // Priority 6: Safe account linking & status check
    if (userData.email_verified !== true && userData.email_verified !== 'true') {
      return createErrorRedirect(
        origin,
        'email_not_verified',
        'Google account email is not verified.'
      );
    }

    const googleProfile = {
      id: userData.sub,
      email: userData.email.toLowerCase(),
      name: userData.name || userData.email.split('@')[0],
      picture: userData.picture,
    };

    // 3. User lookup or safe account linking / auto-provisioning
    let user: User | null = await classroomDb.getUserByEmail(googleProfile.email);

    if (user) {
      if (user.status === 'suspended') {
        return createErrorRedirect(
          origin,
          'account_suspended',
          'This account has been suspended.'
        );
      }

      // Safely link existing user account: preserve password hash and role
      if (!user.avatar && googleProfile.picture) {
        user.avatar = googleProfile.picture;
      }
    } else {
      // Auto-provision new student account
      const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const randomCortexId = `CX-G${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      user = await classroomDb.createUser({
        id: newUserId,
        cortexId: randomCortexId,
        name: googleProfile.name,
        email: googleProfile.email,
        role: 'student',
        avatar: googleProfile.picture,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // 4. Create authenticated session
    const sessionId = ClassroomAuth.generateSecureToken(32);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    await classroomDb.createSession(sessionId, user.id, expiresAt);

    // 5. Build HTML response with localStorage sync and redirect to /classroom
    const safeUserJson = JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      cortexId: user.cortex_id || user.cortexId,
      avatar: user.avatar,
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Cortex Authentication Sync</title>
</head>
<body style="background-color: #08080a; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <div style="width: 40px; height: 40px; border: 3px solid #333; border-top-color: #FF9100; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
    <p style="font-size: 14px; color: #aaa;">Completing Google authentication...</p>
  </div>
  <style>
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
  <script>
    try {
      localStorage.setItem('cortex_user', ${JSON.stringify(safeUserJson)});
      localStorage.setItem('cortex_user_profile', ${JSON.stringify(safeUserJson)});
      localStorage.setItem('cortex_session_id', ${JSON.stringify(sessionId)});
    } catch (e) {
      console.error('Storage sync error:', e);
    }
    window.location.replace('/classroom');
  </script>
</body>
</html>`;

    const response = new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    response.cookies.set('cortex_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(expiresAt),
    });

    // Priority 5: Deterministic cookie cleanup on success
    response.cookies.delete('google_oauth_state');
    response.cookies.set('google_oauth_state', '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (err: any) {
    // Priority 7: Robust error handling - NEVER raw 500 or 503 JSON
    console.error('[Google OAuth] Callback error:', err);
    return createErrorRedirect(
      origin,
      'google_auth_failed',
      err?.message || 'Authentication failed'
    );
  }
}

