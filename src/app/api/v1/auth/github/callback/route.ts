import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
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

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
    }

    const expectedState = req.cookies.get('github_oauth_state')?.value;

    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.json({ error: 'Invalid state parameter (CSRF / Replay protection)' }, { status: 400 });
    }

    const env = (typeof globalThis !== 'undefined' ? (globalThis as any).env : null) || process.env || {};
    const clientId = env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || 'mock_client_id';
    const clientSecret = env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || 'mock_client_secret';

    let accessToken = 'mock_access_token';
    let githubUserId = 'mock_gh_uid';
    let githubUsername = 'mock_gh_user';

    // Real OAuth exchange if configured
    if (clientId !== 'mock_client_id' && clientSecret !== 'mock_client_secret') {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return NextResponse.json({ error: tokenData.error_description || tokenData.error }, { status: 400 });
      }
      accessToken = tokenData.access_token;

      // Get user profile
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Cortex-App'
        },
      });
      const userData = await userRes.json();
      githubUserId = userData.id.toString();
      githubUsername = userData.login;
    }

    // Save connection securely (server-side only)
    await projectDb.saveGitHubConnection(user.id, githubUserId, githubUsername, accessToken);

    // Redirect back to dashboard or close popup
    const response = NextResponse.redirect(`${req.nextUrl.origin}/dashboard?github_connected=true`);
    response.cookies.delete('github_oauth_state');
    return response;
  } catch (err: any) {
    console.error('GitHub callback error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
