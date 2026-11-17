import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { classroomDb } from '@/lib/classroom/db';
import { User } from '@/lib/classroom/models';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const isSimulated = searchParams.get('simulated') === 'true';

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 });
    }

    const expectedState = req.cookies.get('google_oauth_state')?.value;
    if (!expectedState || state !== expectedState) {
      return NextResponse.json(
        { error: 'Invalid Google OAuth state (CSRF / Replay protection trigger)' },
        { status: 400 }
      );
    }

    const env = (typeof globalThis !== 'undefined' ? (globalThis as any).env : null) || process.env || {};
    const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    let googleProfile: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };

    if (!isSimulated && clientId && clientSecret && clientId !== 'mock_google_client_id') {
      const redirectUri = `${req.nextUrl.origin}/api/v1/auth/google/callback`;

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
        return NextResponse.json(
          { error: tokenData.error_description || tokenData.error || 'Google token exchange failed' },
          { status: 400 }
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
        return NextResponse.json({ error: 'Failed to retrieve Google user profile' }, { status: 400 });
      }

      googleProfile = {
        id: userData.sub,
        email: userData.email.toLowerCase(),
        name: userData.name || userData.email.split('@')[0],
        picture: userData.picture,
      };
    } else {
      // Offline / Developer sandbox simulation profile
      googleProfile = {
        id: 'google_usr_demo_1092',
        email: 'alex.student@student.cortex.edu',
        name: 'Alex Student',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&h=128&fit=crop&crop=faces',
      };
    }

    // 3. User lookup or auto-provisioning in D1
    let user: User | null = await classroomDb.getUserByEmail(googleProfile.email);
    if (!user) {
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
      cortexId: user.cortex_id,
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

    // Clear state cookie
    response.cookies.delete('google_oauth_state');

    return response;
  } catch (err: any) {
    console.error('[Google OAuth] Callback error:', err);
    return NextResponse.json({ error: 'Google authentication processing failed' }, { status: 500 });
  }
}
