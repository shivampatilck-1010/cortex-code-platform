'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  ChevronDown,
  ChevronRight,
  Code2,
  ExternalLink,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';

interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  language: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  path: string;
  content: string;
  isFolder: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ProjectGroup {
  project: Project;
  files: ProjectFile[];
}

export default function FilesPage() {
  const router = useRouter();
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExt, setSelectedExt] = useState<string>('all');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/v1/files');
      if (res.status === 401) {
        router.push('/login?redirect=/files');
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load files: ${res.statusText}`);
      }
      const data = await res.json();
      setProjectGroups(data.projects || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading files.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
    if (['py', 'js', 'ts', 'jsx', 'tsx', 'cpp', 'c', 'java', 'rs', 'go', 'cs', 'php', 'rb', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-[#ff9100]" />;
    }
    if (['md', 'txt', 'json', 'yml', 'yaml', 'xml', 'sql'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-cyan-400" />;
    }
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filtered files calculation
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return projectGroups.map((group) => {
      const matchingFiles = group.files.filter((file) => {
        // Exclude pure folder nodes if any
        if (file.isFolder) return false;

        // Search match
        const matchesSearch =
          q === '' ||
          file.name.toLowerCase().includes(q) ||
          file.path.toLowerCase().includes(q) ||
          group.project.name.toLowerCase().includes(q);

        // Extension match
        const matchesExt =
          selectedExt === 'all' ||
          file.name.toLowerCase().endsWith(selectedExt.toLowerCase());

        return matchesSearch && matchesExt;
      });

      return {
        ...group,
        filteredFiles: matchingFiles,
      };
    });
  }, [projectGroups, searchQuery, selectedExt]);

  const totalFilesCount = useMemo(() => {
    return projectGroups.reduce((acc, g) => acc + (g.files?.filter((f) => !f.isFolder).length || 0), 0);
  }, [projectGroups]);

  const totalMatchingFiles = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.filteredFiles.length, 0);
  }, [filteredGroups]);

  const availableExtensions = ['all', '.py', '.js', '.ts', '.cpp', '.java', '.rs', '.go', '.html', '.css', '.json', '.sql', '.md'];

  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full bg-[#0b0c0e] text-[#e6edf3] overflow-y-auto font-sans select-none">
        {/* Header Bar */}
        <header className="px-6 py-6 border-b border-[#1f2024] bg-[#0d0e12]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <FolderOpen className="w-6 h-6 text-[#ff9100]" />
                <h1 className="text-xl font-bold font-heading text-white tracking-wide">
                  Global File Manager
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#1e1f26] text-[#ff9100] border border-[#2e303d]">
                  {projectGroups.length} {projectGroups.length === 1 ? 'Project' : 'Projects'} • {totalFilesCount} Files
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Browse, search, and launch all your source files and projects across the Cortex Cloud IDE.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2.5">
              <button
                onClick={fetchFiles}
                disabled={isLoading}
                className="h-9 px-3 rounded-md border border-[#232530] bg-[#14151a] hover:bg-[#1c1e24] text-xs font-semibold text-gray-300 hover:text-white transition flex items-center space-x-1.5"
                title="Refresh Files"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <Link
                href="/ide"
                className="h-9 px-3.5 rounded-md bg-[#ff9100] hover:bg-[#ffa726] text-black text-xs font-bold font-heading transition flex items-center space-x-1.5 shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>New Project</span>
              </Link>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="max-w-7xl mx-auto mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search files by name, path, or project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md bg-[#131418] border border-[#232530] text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff9100] transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-300"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Extension Filter */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="w-3.5 h-3.5 text-gray-500 ml-1 shrink-0" />
              <span className="text-xs text-gray-500 mr-1 shrink-0">Filter:</span>
              <div className="flex items-center space-x-1">
                {availableExtensions.map((ext) => (
                  <button
                    key={ext}
                    onClick={() => setSelectedExt(ext)}
                    className={`h-7 px-2.5 rounded text-xs font-mono font-medium transition ${
                      selectedExt === ext
                        ? 'bg-[#1e1f26] text-[#ff9100] border border-[#ff9100]/50'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171d] border border-transparent'
                    }`}
                  >
                    {ext === 'all' ? 'All' : ext}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1">
          {isLoading && projectGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <RefreshCw className="w-8 h-8 text-[#ff9100] animate-spin mb-3" />
              <p className="text-sm font-medium">Scanning project repositories...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <p className="font-semibold mb-1">Failed to load files</p>
              <p>{error}</p>
              <button
                onClick={fetchFiles}
                className="mt-3 px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 font-semibold transition"
              >
                Try Again
              </button>
            </div>
          ) : projectGroups.length === 0 ? (
            <div className="text-center py-20 bg-[#101114] border border-[#1f2024] rounded-xl p-8 max-w-md mx-auto">
              <Folder className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h2 className="text-base font-bold text-gray-200 mb-1">No Projects Found</h2>
              <p className="text-xs text-gray-400 mb-5">
                You haven't created any coding projects yet. Open the Cloud IDE to create your first program.
              </p>
              <Link
                href="/ide"
                className="inline-flex items-center space-x-2 px-4 py-2 rounded-md bg-[#ff9100] text-black font-bold text-xs hover:bg-[#ffa726] transition shadow-md"
              >
                <Code2 className="w-4 h-4" />
                <span>Launch Cloud IDE</span>
              </Link>
            </div>
          ) : totalMatchingFiles === 0 ? (
            <div className="text-center py-16 bg-[#101114] border border-[#1f2024] rounded-xl p-8 max-w-md mx-auto">
              <Search className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <h2 className="text-base font-bold text-gray-200 mb-1">No Matching Files</h2>
              <p className="text-xs text-gray-400 mb-4">
                No files matched your search term "{searchQuery}"
                {selectedExt !== 'all' ? ` and extension ${selectedExt}` : ''}.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedExt('all');
                }}
                className="px-3.5 py-1.5 rounded-md bg-[#1e1f26] hover:bg-[#252830] text-xs font-semibold text-[#ff9100] border border-[#2e303d] transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                const isCollapsed = Boolean(collapsedProjects[group.project.id]);
                if (group.filteredFiles.length === 0 && (searchQuery || selectedExt !== 'all')) {
                  return null;
                }

                return (
                  <div
                    key={group.project.id}
                    className="border border-[#1f2024] rounded-lg bg-[#101114] overflow-hidden transition"
                  >
                    {/* Project Header Bar */}
                    <div className="px-4 py-3 bg-[#14151a] border-b border-[#1f2024] flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0">
                        <button
                          onClick={() => toggleProject(group.project.id)}
                          className="text-gray-400 hover:text-white p-0.5 rounded transition"
                          title={isCollapsed ? 'Expand Project' : 'Collapse Project'}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-gray-100 truncate">
                              {group.project.name}
                            </span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1e1f26] text-[#ff9100] font-semibold border border-[#2c2d3a]">
                              {group.project.language}
                            </span>
                          </div>
                          {group.project.description && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {group.project.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <div className="text-[11px] text-gray-500 hidden sm:flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>Updated {formatDate(group.project.updatedAt)}</span>
                        </div>

                        <Link
                          href={`/ide?projectId=${group.project.id}`}
                          className="h-7 px-2.5 rounded bg-[#1e1f26] hover:bg-[#252834] text-[#ff9100] text-xs font-semibold flex items-center space-x-1.5 border border-[#2e303d] transition"
                        >
                          <Code2 className="w-3.5 h-3.5" />
                          <span>Open in IDE</span>
                          <ExternalLink className="w-3 h-3 text-[#ff9100]/70" />
                        </Link>
                      </div>
                    </div>

                    {/* Files List */}
                    {!isCollapsed && (
                      <div className="divide-y divide-[#181920]">
                        {group.filteredFiles.length === 0 ? (
                          <div className="py-4 text-center text-xs text-gray-500 italic">
                            No files inside this project.
                          </div>
                        ) : (
                          group.filteredFiles.map((file) => (
                            <div
                              key={file.id}
                              onClick={() => router.push(`/ide?projectId=${group.project.id}`)}
                              className="px-4 py-2.5 flex items-center justify-between hover:bg-[#16171d] cursor-pointer group transition text-xs"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <div className="p-1 rounded bg-[#0a0b0d] border border-[#1f2024]">
                                  {getFileIcon(file.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-200 group-hover:text-[#ff9100] transition truncate">
                                    {file.name}
                                  </div>
                                  <div className="text-[11px] font-mono text-gray-500 truncate">
                                    {file.path}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-4 text-[11px] text-gray-500 shrink-0">
                                <span className="font-mono">
                                  {file.content ? `${file.content.length} chars` : '0 chars'}
                                </span>
                                <span className="hidden md:inline">
                                  {formatDate(file.updatedAt)}
                                </span>
                                <span className="text-[#ff9100] opacity-0 group-hover:opacity-100 transition font-semibold flex items-center space-x-1">
                                  <span>Edit</span>
                                  <ExternalLink className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}
