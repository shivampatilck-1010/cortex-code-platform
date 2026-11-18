import React, { useState, useEffect } from 'react';
import { useClassroom } from '@/context/ClassroomContext';
import type { ClassroomResource } from '@/lib/classroom/models';
import { useParams } from 'next/navigation';
import {
  BookOpen,
  FileText,
  Download,
  ExternalLink,
  FolderArchive,
  Code2,
  Search,
  Loader2,
} from 'lucide-react';

interface ResourceItem {
  id: string;
  title: string;
  category: 'Notes' | 'Slides' | 'Code' | 'Cheatsheet';
  size: string;
  updatedAt: string;
  description: string;
  url: string;
}

const DEFAULT_RESOURCES: ResourceItem[] = [
  {
    id: 'res-1',
    title: 'Lecture 14: Balanced Search Trees & Red-Black Invariants',
    category: 'Slides',
    size: '4.2 MB',
    updatedAt: 'Today 14:00',
    description: 'Complete slide deck with step-by-step rotation diagrams.',
    url: '/assets/sample-slides.pdf',
  },
  {
    id: 'res-2',
    title: 'AVL Tree and BST Rotation C++ Reference Implementation',
    category: 'Code',
    size: '18 KB',
    updatedAt: 'Yesterday',
    description: 'Header-only C++ template library for balanced trees.',
    url: '/assets/sample-code.cpp',
  },
  {
    id: 'res-3',
    title: 'Big-O Asymptotic Complexity Reference Matrix',
    category: 'Cheatsheet',
    size: '850 KB',
    updatedAt: 'Oct 20, 2026',
    description: 'Time and space complexity for all primary tree and graph algorithms.',
    url: '/assets/sample-cheatsheet.pdf',
  },
  {
    id: 'res-4',
    title: 'CS 201 Course Syllabus & Grading Rubric',
    category: 'Notes',
    size: '320 KB',
    updatedAt: 'Oct 01, 2026',
    description: 'Course policies, project deadlines, and office hour schedules.',
    url: '/assets/sample-syllabus.pdf',
  },
];

function mapTypeToCategory(type: string, unit?: string): 'Notes' | 'Slides' | 'Code' | 'Cheatsheet' {
  const normUnit = (unit || '').toLowerCase();
  if (normUnit.includes('slide') || normUnit.includes('lecture')) return 'Slides';
  if (normUnit.includes('code') || normUnit.includes('lab')) return 'Code';
  if (normUnit.includes('cheat') || normUnit.includes('matrix')) return 'Cheatsheet';
  if (normUnit.includes('note') || normUnit.includes('syllabus')) return 'Notes';

  switch (type?.toLowerCase()) {
    case 'pdf':
      return 'Slides';
    case 'code':
      return 'Code';
    case 'notes':
      return 'Notes';
    case 'dataset':
    case 'link':
    default:
      return 'Cheatsheet';
  }
}

function formatResourceDate(timestamp: number): string {
  if (!timestamp) return 'Recent';
  try {
    const d = new Date(timestamp);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `Today ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export const ResourcesModule: React.FC<{ classroomId?: string }> = ({ classroomId: propClassroomId }) => {
  const { showToast, session, classroomId: contextClassroomId } = useClassroom();
  const params = useParams();
  const routeRoomId = typeof params?.roomId === 'string' ? params.roomId : undefined;
  const roomId = propClassroomId || contextClassroomId || session?.id || routeRoomId || '';

  const [resources, setResources] = useState<ResourceItem[]>(DEFAULT_RESOURCES);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const categories = ['All', 'Slides', 'Code', 'Cheatsheet', 'Notes'];

  useEffect(() => {
    if (!roomId) return;
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/v1/classrooms/${roomId}/resources`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.resources || !Array.isArray(data.resources)) return;
        if (data.resources.length > 0) {
          const mapped: ResourceItem[] = data.resources.map((r: ClassroomResource) => ({
            id: r.id,
            title: r.name,
            category: mapTypeToCategory(r.type, r.unit),
            size: (r.type || 'file').toUpperCase(),
            updatedAt: formatResourceDate(r.createdAt),
            description: r.description || 'Classroom course material.',
            url: r.url,
          }));
          setResources(mapped);
        } else {
          setResources([]);
        }
      })
      .catch((err) => {
        console.warn('[ResourcesModule] Failed to fetch server resources:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [roomId]);

  const filteredResources = resources.filter((res) => {
    const matchesCategory = categoryFilter === 'All' || res.category === categoryFilter;
    const matchesQuery =
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleDownload = async (res: ResourceItem) => {
    if (!res.url) {
      showToast(`No download link available for: ${res.title}`);
      return;
    }
    showToast(`Downloading resource: ${res.title}`);

    try {
      if (res.url.startsWith('/') || (typeof window !== 'undefined' && res.url.startsWith(window.location.origin))) {
        const response = await fetch(res.url);
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = res.title.replace(/[/\\?%*:|"<>]/g, '_');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);
      } else {
        const link = document.createElement('a');
        link.href = res.url;
        link.download = res.title.replace(/[/\\?%*:|"<>]/g, '_');
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.warn('[ResourcesModule] Direct download failed, falling back to window.open:', err);
      if (typeof window !== 'undefined' && res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0C0E] overflow-hidden select-none">
      {/* Header */}
      <div className="h-11 border-b border-[#282A36] bg-[#111216] px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-[#A1A1AA]">
          <BookOpen className="w-3.5 h-3.5 text-[#A855F7]" />
          <span className="font-semibold text-white">Classroom Resources & Documents</span>
        </div>
        <span className="text-[11px] text-[#71717A] font-mono">
          Course Library ({session?.courseCode || 'CS-201'})
        </span>
      </div>

      {/* Main List */}
      <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-4">
        {/* Search & Category Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lectures, code, and cheatsheets..."
              className="w-full bg-[#15161C] border border-[#282A36] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-[#A855F7]"
              aria-label="Search resources"
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-[#A855F7]/20 border border-[#A855F7] text-[#A855F7]'
                    : 'bg-[#15161C] border border-[#282A36] text-[#A1A1AA] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[#282A36] bg-[#111216] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Course Repository</h3>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              Supplementary papers, algorithmic proofs, and starter repositories.
            </p>
          </div>
          <button
            onClick={() => showToast('Opening remote course GitHub repository...')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#282A36] bg-[#15161C] hover:bg-[#1D1F27] text-xs text-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Course GitHub Repo</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[#71717A] text-xs font-mono flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#A855F7]" />
            <span>Loading classroom resources...</span>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="p-8 text-center bg-[#111216] border border-[#282A36] rounded-xl text-[#71717A] text-xs font-mono">
            No classroom resources found.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredResources.map((res) => (
              <div
                key={res.id}
                className="p-4 rounded-xl border border-[#282A36] bg-[#111216] hover:border-[#3E4251] transition-all flex items-center justify-between"
              >
                <div className="flex items-start space-x-3.5">
                  <div className="w-10 h-10 rounded-lg bg-[#15161C] border border-[#282A36] flex items-center justify-center text-[#FF9100]">
                    {res.category === 'Code' ? (
                      <Code2 className="w-5 h-5 text-[#06B6D4]" />
                    ) : res.category === 'Slides' ? (
                      <FolderArchive className="w-5 h-5 text-[#FF9100]" />
                    ) : (
                      <FileText className="w-5 h-5 text-[#A855F7]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-semibold text-white">{res.title}</h4>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#282A36] text-[#A1A1AA] font-mono">
                        {res.category}
                      </span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] mt-1">{res.description}</p>
                    <div className="flex items-center space-x-3 text-[10px] text-[#71717A] font-mono mt-2">
                      <span>Size: {res.size}</span>
                      <span>|</span>
                      <span>Updated: {res.updatedAt}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDownload(res)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#15161C] hover:bg-[#1D1F27] border border-[#282A36] text-xs font-medium text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
