import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.GITHUB_CLIENT_ID || 'mock_client_id';
    
    // We pass the userId as state to avoid CSRF and know who this is
    // In production, we'd sign this or use a secure session mapping.
    // For this scope, the userId serves as the mapped state.
    const state = user.id;

    const redirectUri = `${req.nextUrl.origin}/api/v1/auth/github/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo&state=${state}`;

    return NextResponse.redirect(githubUrl);
  } catch (err: any) {
    console.error('GitHub login error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
