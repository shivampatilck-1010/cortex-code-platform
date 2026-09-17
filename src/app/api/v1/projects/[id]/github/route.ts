import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { githubRateLimiter } from '@/lib/execution/rate-limiter';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = githubRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await projectDb.getProject(params.id);
    if (!project || project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });
    }

    const connection = await projectDb.getGitHubConnection(user.id);
    const link = await projectDb.getProjectGitHubLink(params.id);

    return NextResponse.json({
      connected: !!connection,
      githubUsername: connection ? connection.github_username : null,
      link: link ? { repoOwner: link.repo_owner, repoName: link.repo_name, defaultBranch: link.default_branch } : null
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = githubRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await projectDb.getProject(params.id);
    if (!project || project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });
    }

    const connection = await projectDb.getGitHubConnection(user.id);
    if (!connection) {
      return NextResponse.json({ error: 'GitHub account not connected' }, { status: 400 });
    }

    const body = await req.json();
    const { repoOwner, repoName, defaultBranch } = body;
    if (!repoOwner || !repoName) {
      return NextResponse.json({ error: 'repoOwner and repoName required' }, { status: 400 });
    }

    await projectDb.saveProjectGitHubLink(params.id, repoOwner, repoName, defaultBranch || 'main');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = githubRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await projectDb.getProject(params.id);
    if (!project || project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });
    }

    await projectDb.deleteProjectGitHubLink(params.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
