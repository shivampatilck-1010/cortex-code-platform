import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const project = await projectDb.getProject(params.id);
    if (!project || project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Project not found or unauthorized' }, { status: 403 });
    }

    const connection = await projectDb.getGitHubConnection(user.id);
    if (!connection) return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 });

    const link = await projectDb.getProjectGitHubLink(params.id);
    if (!link) return NextResponse.json({ error: 'Repository not linked to project' }, { status: 400 });

    const body = await req.json();
    const action = body.action; // 'pull' | 'push'

    if (action === 'pull') {
      // 1. Get default branch sha
      const refRes = await fetch(`https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/ref/heads/${link.default_branch}`, {
        headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' }
      });
      if (!refRes.ok) return NextResponse.json({ error: 'Failed to fetch branch reference' }, { status: refRes.status });
      const refData = await refRes.json();
      const commitSha = refData.object.sha;

      // 2. Get tree
      const treeRes = await fetch(`https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/trees/${commitSha}?recursive=1`, {
        headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' }
      });
      const treeData = await treeRes.json();

      // 3. For each file, fetch content and write to DB
      for (const item of treeData.tree) {
        if (item.type === 'blob') {
          // Block .git and node_modules
          if (item.path.includes('.git/') || item.path.includes('node_modules/')) continue;
          
          const blobRes = await fetch(`https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/blobs/${item.sha}`, {
            headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' }
          });
          const blobData = await blobRes.json();
          let content = '';
          if (blobData.encoding === 'base64') {
            content = atob(blobData.content);
          } else {
            content = blobData.content;
          }
          await projectDb.createFile({
            id: 'file_' + Date.now() + Math.random(),
            projectId: params.id,
            name: item.path.split('/').pop(),
            path: item.path,
            content,
            isFolder: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        } else if (item.type === 'tree') {
          if (item.path.includes('.git/') || item.path.includes('node_modules/')) continue;
          await projectDb.createFile({
            id: 'file_' + Date.now() + Math.random(),
            projectId: params.id,
            name: item.path.split('/').pop(),
            path: item.path,
            content: '',
            isFolder: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      }

      return NextResponse.json({ success: true, message: 'Pulled successfully' });

    } else if (action === 'push') {
      const commitMessage = body.commitMessage || 'Cortex update';
      
      // 1. Get base tree
      const refRes = await fetch(`https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/ref/heads/${link.default_branch}`, {
        headers: { Authorization: `Bearer ${connection.access_token}`, 'User-Agent': 'Cortex-App' }
      });
      const refData = await refRes.json();
      const baseCommitSha = refData.object.sha;

      // 2. Create Tree
      const files = await projectDb.listFilesForProject(params.id);
      const tree = files.filter(f => !f.isFolder).map(f => ({
        path: f.path,
        mode: '100644',
        type: 'blob',
        content: f.content
      }));

      const treeRes = await fetch(`https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/trees`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${connection.access_token}`, 'Content-Type': 'application/json', 'User-Agent': 'Cortex-App' },
        body: JSON.stringify({ base_tree: baseCommitSha, tree })
      });
      const treeData = await treeRes.json();
      const newTreeSha = treeData.sha;

      // 3. Create Commit
      const commitRes = await fetch(`https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/commits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${connection.access_token}`, 'Content-Type': 'application/json', 'User-Agent': 'Cortex-App' },
        body: JSON.stringify({ message: commitMessage, tree: newTreeSha, parents: [baseCommitSha] })
      });
      const commitData = await commitRes.json();
      const newCommitSha = commitData.sha;

      // 4. Update Ref
      await fetch(`https://api.github.com/repos/${link.repo_owner}/${link.repo_name}/git/refs/heads/${link.default_branch}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${connection.access_token}`, 'Content-Type': 'application/json', 'User-Agent': 'Cortex-App' },
        body: JSON.stringify({ sha: newCommitSha })
      });

      return NextResponse.json({ success: true, message: 'Pushed successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('GitHub Sync Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
