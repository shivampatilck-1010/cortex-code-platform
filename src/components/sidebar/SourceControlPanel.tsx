import React, { useState, useEffect } from 'react';
import { GitBranch, GitCommit, Github, RefreshCw, UploadCloud, DownloadCloud, AlertCircle } from 'lucide-react';

export function SourceControlPanel({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [link, setLink] = useState<any>(null);
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [branch, setBranch] = useState('main');
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) fetchStatus();
  }, [projectId]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/projects/${projectId}/github`);
      if (res.ok) {
        const data = await res.json();
        setConnected(data.connected);
        setUsername(data.githubUsername);
        setLink(data.link);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccount = () => {
    window.location.href = '/api/v1/auth/github/login';
  };

  const handleLinkRepo = async () => {
    setError(null);
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/github`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoOwner, repoName, defaultBranch: branch })
      });
      if (res.ok) {
        if (projectId) await fetchStatus();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to link repo');
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    setSyncing(true);
    await fetch(`/api/v1/projects/${projectId}/github`, { method: 'DELETE' });
    if (projectId) await fetchStatus();
    setSyncing(false);
  };

  const handleSync = async (action: 'pull' | 'push') => {
    setError(null);
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/github/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, commitMessage })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to ${action}`);
      } else {
        setCommitMessage('');
      }
    } catch (err) {
      setError(`Failed to ${action}`);
    } finally {
      setSyncing(false);
    }
  };

  if (!projectId) return <div className="p-4 text-[#8a8886]">No project selected</div>;

  if (loading) {
    return <div className="p-4 text-[#8a8886]">Loading source control...</div>;
  }

  if (!connected) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-[#8a8886]">
        <Github className="w-12 h-12 mb-4 text-[#5e5c5a]" />
        <h3 className="text-lg font-medium text-[#e8e6e3] mb-2">GitHub Integration</h3>
        <p className="text-sm text-center mb-6">Connect your GitHub account to import repositories, pull changes, and push commits directly from Cortex.</p>
        <button 
          onClick={handleConnectAccount}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF9100] hover:bg-[#ff9100]/90 text-white rounded-md font-medium transition-colors"
        >
          <Github className="w-4 h-4" /> Connect GitHub Account
        </button>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6 text-sm text-[#8a8886]">
          <Github className="w-4 h-4" /> Connected as <span className="font-medium text-[#e8e6e3]">{username}</span>
        </div>
        
        <h3 className="text-sm font-medium text-[#e8e6e3] mb-4 uppercase tracking-wider">Link Repository</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#8a8886] mb-1">Owner / Organization</label>
            <input type="text" value={repoOwner} onChange={e => setRepoOwner(e.target.value)} className="w-full bg-[#2a2928] border border-[#3D3C3B] rounded-md px-3 py-1.5 text-sm text-[#e8e6e3]" placeholder="e.g. cortexcode" />
          </div>
          <div>
            <label className="block text-xs text-[#8a8886] mb-1">Repository Name</label>
            <input type="text" value={repoName} onChange={e => setRepoName(e.target.value)} className="w-full bg-[#2a2928] border border-[#3D3C3B] rounded-md px-3 py-1.5 text-sm text-[#e8e6e3]" placeholder="e.g. universal-code-platform" />
          </div>
          <div>
            <label className="block text-xs text-[#8a8886] mb-1">Branch</label>
            <input type="text" value={branch} onChange={e => setBranch(e.target.value)} className="w-full bg-[#2a2928] border border-[#3D3C3B] rounded-md px-3 py-1.5 text-sm text-[#e8e6e3]" placeholder="main" />
          </div>
          
          {error && <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded flex items-center gap-2"><AlertCircle className="w-3 h-3"/> {error}</div>}
          
          <button 
            onClick={handleLinkRepo}
            disabled={!repoOwner || !repoName || syncing}
            className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-[#FF9100] hover:bg-[#ff9100]/90 disabled:opacity-50 text-white rounded-md font-medium transition-colors"
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />} Link Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#3D3C3B]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-[#e8e6e3] uppercase tracking-wider flex items-center gap-2">
            <Github className="w-4 h-4" /> Source Control
          </h3>
          <button onClick={handleUnlink} className="text-xs text-[#8a8886] hover:text-white">Unlink</button>
        </div>
        <div className="flex flex-col gap-1 mt-3">
          <div className="flex items-center gap-2 text-sm text-[#e8e6e3]">
            <span className="text-[#8a8886]">Repo:</span> {link.repoOwner}/{link.repoName}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#e8e6e3]">
            <span className="text-[#8a8886]">Branch:</span> <GitBranch className="w-3 h-3 text-[#FF9100]" /> {link.defaultBranch}
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#8a8886] mb-1">Commit Message</label>
            <textarea 
              value={commitMessage}
              onChange={e => setCommitMessage(e.target.value)}
              className="w-full bg-[#2a2928] border border-[#3D3C3B] rounded-md px-3 py-2 text-sm text-[#e8e6e3] resize-none h-20"
              placeholder="Message (e.g. Update main.js)"
            />
          </div>

          {error && <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded flex items-center gap-2"><AlertCircle className="w-3 h-3"/> {error}</div>}

          <button 
            onClick={() => handleSync('push')}
            disabled={!commitMessage || syncing}
            className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-[#FF9100] hover:bg-[#ff9100]/90 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} Commit & Push
          </button>
          
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#3D3C3B]"></div></div>
            <div className="relative flex justify-center"><span className="bg-[#1C1B1A] px-2 text-xs text-[#8a8886]">OR</span></div>
          </div>

          <button 
            onClick={() => handleSync('pull')}
            disabled={syncing}
            className="w-full flex justify-center items-center gap-2 px-4 py-2 bg-[#2a2928] hover:bg-[#3D3C3B] border border-[#3D3C3B] disabled:opacity-50 text-[#e8e6e3] rounded-md text-sm font-medium transition-colors"
          >
            {syncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />} Pull from GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
