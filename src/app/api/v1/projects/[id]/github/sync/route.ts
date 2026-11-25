import { NextRequest, NextResponse } from 'next/server';
import { projectDb } from '@/lib/project/db';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { githubRateLimiter } from '@/lib/execution/rate-limiter';

function decodeUtf8Base64(b64: string): string {
  const clean = (b64 || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const rateCheck = githubRateLimiter.checkRateLimit(ip);
    if (!rateCheck.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await projectDb.getProject(id);
    if (!project || project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });
    }

    const connection = await projectDb.getGitHubConnection(user.id);
    if (!connection) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 });

    const link = await projectDb.getProjectGitHubLink(id);
    if (!link) return NextResponse.json({ error: 'Repository not linked to project' }, { status: 400 });

    const body = await req.json();
    const action = body.action; // 'pull' | 'push'

    if (action === 'pull') {
      const refRes = await fetch(
        `https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/ref/heads/${link.default_branch}`,
        { headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' } }
      );
      if (!refRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch branch reference' }, { status: refRes.status });
      }
      const refData = await refRes.json();
      const commitSha = refData?.object?.sha;
      if (!commitSha) {
        return NextResponse.json({ error: 'Missing branch commit SHA' }, { status: 400 });
      }

      const treeRes = await fetch(
        `https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/trees/${commitSha}?recursive=1`,
        { headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' } }
      );
      if (!treeRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch repository tree' }, { status: treeRes.status });
      }
      const treeData = await treeRes.json();

      const existingFiles = await projectDb.listFilesForProject(id);
      const existingByPath = new Map(existingFiles.map((ef) => [ef.path, ef]));

      for (const item of treeData.tree || []) {
        if (!item?.path || item.path.includes('.git/') || item.path.includes('node_modules/')) continue;
        const normPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
        const existing = existingByPath.get(normPath) || existingByPath.get(item.path);

        if (item.type === 'blob') {
          const blobRes = await fetch(
            `https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/blobs/${item.sha}`,
            { headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' } }
          );
          if (!blobRes.ok) {
            return NextResponse.json({ error: `Failed to fetch blob for ${item.path}` }, { status: blobRes.status });
          }
          const blobData = await blobRes.json();
          const content =
            blobData.encoding === 'base64'
              ? decodeUtf8Base64(blobData.content || '')
              : (blobData.content || '');

          if (existing) {
            await projectDb.updateFile(existing.id, { path: normPath, content, updatedAt: Date.now() });
          } else {
            await projectDb.createFile({
              id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
              projectId: id,
              name: item.path.split('/').pop() || item.path,
              path: normPath,
              content,
              isFolder: false,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
          }
        } else if (item.type === 'tree' && !existing) {
          await projectDb.createFile({
            id: 'dir_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            projectId: id,
            name: item.path.split('/').pop() || item.path,
            path: normPath,
            content: '',
            isFolder: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }

      return NextResponse.json({ success: true, message: 'Pulled successfully' });
    } else if (action === 'push') {
      const commitMessage = body.commitMessage || 'Cortex update';

      const refRes = await fetch(
        `https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/ref/heads/${link.default_branch}`,
        { headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' } }
      );
      if (!refRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch branch reference' }, { status: refRes.status });
      }
      const refData = await refRes.json();
      const baseCommitSha = refData?.object?.sha;
      if (!baseCommitSha) {
        return NextResponse.json({ error: 'Missing base commit SHA' }, { status: 400 });
      }

      const files = await projectDb.listFilesForProject(id);
      const tree = files
        .filter((f) => !f.isFolder)
        .map((f) => ({
          path: f.path.replace(/^\/+/, ''),
          mode: '100644',
          type: 'blob',
          content: f.content,
        }));

      const treeRes = await fetch(
        `https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/trees`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Cortex-App',
          },
          body: JSON.stringify({ base_tree: baseCommitSha, tree }),
        }
      );
      if (!treeRes.ok) {
        return NextResponse.json({ error: 'Failed to create GitHub tree' }, { status: treeRes.status });
      }
      const treeData = await treeRes.json();
      const newTreeSha = treeData.sha;

      const commitRes = await fetch(
        `https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/commits`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Cortex-App',
          },
          body: JSON.stringify({ message: commitMessage, tree: newTreeSha, parents: [baseCommitSha] }),
        }
      );
      if (!commitRes.ok) {
        return NextResponse.json({ error: 'Failed to create GitHub commit' }, { status: commitRes.status });
      }
      const commitData = await commitRes.json();
      const newCommitSha = commitData.sha;

      const updateRefRes = await fetch(
        `https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/refs/heads/${link.default_branch}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${connection.access_token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Cortex-App',
          },
          body: JSON.stringify({ sha: newCommitSha }),
        }
      );
      if (!updateRefRes.ok) {
        return NextResponse.json({ error: 'Failed to update branch ref' }, { status: updateRefRes.status });
      }

      return NextResponse.json({ success: true, message: 'Pushed successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('GitHub Sync Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
