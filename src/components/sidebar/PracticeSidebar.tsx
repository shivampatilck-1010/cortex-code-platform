'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Swords, 
  Search, 
  ExternalLink, 
  CheckCircle2, 
  Code2 
} from 'lucide-react';
import { CHALLENGES, Challenge } from '@/lib/challenges/challenges-data';

interface PracticeSidebarProps {
  width?: number;
  currentLanguage?: string;
  onLoadChallenge?: (code: string, language: string, title: string) => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export const PracticeSidebar: React.FC<PracticeSidebarProps> = ({
  width = 240,
  currentLanguage = 'python',
  onLoadChallenge,
  onClose,
  isDarkMode = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredChallenges = useMemo(() => {
    return CHALLENGES.filter((c) => {
      const matchesDifficulty =
        selectedDifficulty === 'All' || c.difficulty === selectedDifficulty;
      const matchesQuery =
        !searchQuery ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesDifficulty && matchesQuery;
    });
  }, [searchQuery, selectedDifficulty]);

  const handleSelectChallenge = (challenge: Challenge) => {
    const langKey =
      currentLanguage && challenge.starterTemplates[currentLanguage]
        ? currentLanguage
        : challenge.starterTemplates['python']
        ? 'python'
        : Object.keys(challenge.starterTemplates)[0] || 'python';

    const code = challenge.starterTemplates[langKey] || '';
    if (onLoadChallenge) {
      onLoadChallenge(code, langKey, challenge.title);
      setStatusMessage(`Loaded "${challenge.title}"`);
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy':
        return isDarkMode
          ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
          : 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Medium':
        return isDarkMode
          ? 'text-amber-400 bg-amber-950/60 border-amber-800/40'
          : 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Hard':
        return isDarkMode
          ? 'text-rose-400 bg-rose-950/60 border-rose-800/40'
          : 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return isDarkMode
          ? 'text-gray-400 bg-gray-800 border-gray-700'
          : 'text-slate-600 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className={`h-full flex flex-col select-none text-xs transition-colors duration-200 ${
        isDarkMode ? 'bg-[#101114] text-[#e6edf3]' : 'bg-white text-slate-800'
      }`}
    >
      {/* Header */}
      <div className={`h-10 px-3.5 border-b flex items-center justify-between shrink-0 transition-colors ${
        isDarkMode ? 'border-[#1f2024] bg-[#0d0e11]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center space-x-2">
          <Swords className="w-4 h-4 text-[#ff9100]" />
          <span className={`font-semibold uppercase tracking-wider text-[11px] ${
            isDarkMode ? 'text-gray-200' : 'text-slate-800'
          }`}>
            Practice
          </span>
          <span className="px-1.5 py-0.2 bg-[#ff9100]/15 text-[#ff9100] text-[10px] rounded font-mono font-medium">
            {CHALLENGES.length}
          </span>
        </div>
        <Link
          href="/challenges"
          className="flex items-center space-x-1 text-[11px] text-[#ff9100] hover:text-[#ffaa33] transition"
          title="Open Challenges Hub"
        >
          <span>All</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Search and Filters */}
      <div className={`p-2.5 border-b space-y-2 shrink-0 transition-colors ${
        isDarkMode ? 'border-[#1f2024] bg-[#0c0d10]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="relative">
          <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${
            isDarkMode ? 'text-gray-400' : 'text-slate-400'
          }`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search problems, tags..."
            className={`w-full pl-8 pr-2.5 py-1.5 rounded-md text-xs focus:outline-none focus:border-[#ff9100] border transition-colors ${
              isDarkMode
                ? 'bg-[#14151b] border-[#232530] text-gray-200 placeholder-gray-500'
                : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 shadow-inner'
            }`}
          />
        </div>

        {/* Difficulty Filter Tabs */}
        <div className="flex items-center space-x-1">
          {(['All', 'Easy', 'Medium', 'Hard'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(diff)}
              className={`flex-1 py-1 text-[10px] font-medium rounded transition ${
                selectedDifficulty === diff
                  ? 'bg-[#ff9100] text-slate-950 font-semibold shadow-sm'
                  : isDarkMode
                    ? 'bg-[#15161d] text-gray-400 hover:text-gray-200 hover:bg-[#1a1c24]'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 shadow-xs'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Status notification */}
      {statusMessage && (
        <div className="mx-2.5 mt-2 px-2.5 py-1.5 bg-emerald-950/60 border border-emerald-700/50 rounded text-[11px] text-emerald-300 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {/* Challenges List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {filteredChallenges.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-[11px]">
            No challenges match your filter.
          </div>
        ) : (
          filteredChallenges.map((challenge) => (
            <div
              key={challenge.id}
              className={`p-2.5 rounded-lg transition group border ${
                isDarkMode
                  ? 'bg-[#121318] hover:bg-[#15161e] border-[#1e2026] hover:border-[#2a2c38]'
                  : 'bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <span className={`font-semibold text-xs group-hover:text-[#ff9100] transition line-clamp-1 ${
                  isDarkMode ? 'text-gray-200' : 'text-slate-800'
                }`}>
                  {challenge.title}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-medium border shrink-0 ${getDifficultyColor(
                    challenge.difficulty
                  )}`}
                >
                  {challenge.difficulty}
                </span>
              </div>

              <div className={`text-[10px] line-clamp-2 mb-2 leading-relaxed ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}>
                {challenge.description.replace(/```[\s\S]*?```/g, '').replace(/`/g, '')}
              </div>

              <div className={`flex items-center justify-between text-[10px] pt-1 border-t ${
                isDarkMode ? 'border-[#1a1c22]' : 'border-slate-200'
              }`}>
                <span className={`font-mono text-[9px] ${
                  isDarkMode ? 'text-gray-500' : 'text-slate-500'
                }`}>
                  Pass: {challenge.acceptanceRate}
                </span>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleSelectChallenge(challenge)}
                    className={`px-2 py-0.5 rounded font-medium text-[10px] transition border flex items-center space-x-1 ${
                      isDarkMode
                        ? 'bg-[#1a1c24] hover:bg-[#ff9100] hover:text-black text-gray-300 border-[#2b2d3a]'
                        : 'bg-white hover:bg-[#ff9100] hover:text-black text-slate-700 border-slate-200 shadow-sm'
                    }`}
                  >
                    <Code2 className="w-3 h-3" />
                    <span>Load</span>
                  </button>
                  <Link
                    href={`/challenges/${challenge.slug}`}
                    className={`p-1 transition ${
                      isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'
                    }`}
                    title="View Problem Details"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
