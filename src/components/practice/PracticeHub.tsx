'use client';

import React, { useState, useMemo } from 'react';
import { Swords, ArrowLeft, Sun, Moon, CheckCircle2, Clock } from 'lucide-react';
import { CHALLENGES, Challenge } from '@/lib/challenges/challenges-data';
import { PracticeProgressMap } from './usePracticeProgress';
import { PracticeTrackCards, TrackFilter, TrackCardStats } from './PracticeTrackCards';
import {
  PracticeFilters,
  CategoryFilter,
  DifficultyFilter,
  StatusFilter,
  TopicCountItem,
} from './PracticeFilters';
import { PracticeProblemTable } from './PracticeProblemTable';

export interface PracticeHubProps {
  isDarkMode: boolean;
  onToggleDarkMode: (coords?: { x: number; y: number }) => void;
  onLaunchProblem: (challenge: Challenge, preferredLang?: string) => void;
  onReturnToEditor: () => void;
  progressMap: PracticeProgressMap;
  activeProblemId?: string | null;
}

export const PracticeHub: React.FC<PracticeHubProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onLaunchProblem,
  onReturnToEditor,
  progressMap,
  activeProblemId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<TrackFilter>('All');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [selectedTopic, setSelectedTopic] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>('All');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All');
  const [selectedCompany, setSelectedCompany] = useState<string>('All');

  const solvedCount = useMemo(
    () => CHALLENGES.filter((c) => progressMap[c.id] === 'solved').length,
    [progressMap]
  );

  const attemptedCount = useMemo(
    () => CHALLENGES.filter((c) => progressMap[c.id] === 'attempted').length,
    [progressMap]
  );

  const trackStats: TrackCardStats[] = useMemo(() => {
    const countFor = (filterFn: (c: Challenge) => boolean) => {
      const items = CHALLENGES.filter(filterFn);
      return {
        total: items.length,
        solved: items.filter((c) => progressMap[c.id] === 'solved').length,
      };
    };
    const allStats = countFor(() => true);
    const progStats = countFor((c) => c.track === 'Programming');
    const dsaStats = countFor((c) => c.track === 'DSA');
    const sqlStats = countFor((c) => c.track === 'SQL');

    return [
      {
        id: 'All',
        label: 'All Problems',
        subtitle: 'Full multi-track catalog',
        total: allStats.total,
        solved: allStats.solved,
      },
      {
        id: 'Programming',
        label: 'Programming',
        subtitle: 'Core logic, math & syntax',
        total: progStats.total,
        solved: progStats.solved,
      },
      {
        id: 'DSA',
        label: 'DSA',
        subtitle: 'Algorithms & data structures',
        total: dsaStats.total,
        solved: dsaStats.solved,
      },
      {
        id: 'SQL',
        label: 'SQL',
        subtitle: 'Relational queries & analytics',
        total: sqlStats.total,
        solved: sqlStats.solved,
      },
    ];
  }, [progressMap]);

  const trackScopedProblems = useMemo(() => {
    return CHALLENGES.filter(
      (c) => selectedTrack === 'All' || c.track === selectedTrack
    );
  }, [selectedTrack]);

  const categoryCounts = useMemo<Record<CategoryFilter, number>>(() => {
    return {
      All: trackScopedProblems.length,
      Algorithms: trackScopedProblems.filter((c) => c.topicCategory === 'Algorithms').length,
      Database: trackScopedProblems.filter((c) => c.topicCategory === 'Database').length,
      Programming: trackScopedProblems.filter((c) => c.topicCategory === 'Programming').length,
    };
  }, [trackScopedProblems]);

  const categoryScopedProblems = useMemo(() => {
    return trackScopedProblems.filter(
      (c) => selectedCategory === 'All' || c.topicCategory === selectedCategory
    );
  }, [trackScopedProblems, selectedCategory]);

  const topicCounts: TopicCountItem[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categoryScopedProblems) {
      for (const tag of c.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
  }, [categoryScopedProblems]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of CHALLENGES) {
      for (const comp of c.companyTags) {
        set.add(comp);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, []);

  const handleSelectTrack = (track: TrackFilter) => {
    setSelectedTrack(track);
    if (track !== 'All') {
      const nextScoped = CHALLENGES.filter((c) => c.track === track);
      if (
        selectedCategory !== 'All' &&
        !nextScoped.some((c) => c.topicCategory === selectedCategory)
      ) {
        setSelectedCategory('All');
      }
      if (
        selectedTopic !== 'All' &&
        !nextScoped.some((c) => c.tags.includes(selectedTopic))
      ) {
        setSelectedTopic('All');
      }
    }
  };

  const handleSelectCategory = (cat: CategoryFilter) => {
    setSelectedCategory(cat);
    if (cat !== 'All') {
      let nextScoped = trackScopedProblems.filter((c) => c.topicCategory === cat);
      if (nextScoped.length === 0 && selectedTrack !== 'All') {
        setSelectedTrack('All');
        nextScoped = CHALLENGES.filter((c) => c.topicCategory === cat);
      }
      if (
        selectedTopic !== 'All' &&
        !nextScoped.some((c) => c.tags.includes(selectedTopic))
      ) {
        setSelectedTopic('All');
      }
    }
  };

  const filteredProblems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return categoryScopedProblems.filter((c) => {
      if (selectedTopic !== 'All' && !c.tags.includes(selectedTopic)) {
        return false;
      }
      if (selectedDifficulty !== 'All' && c.difficulty !== selectedDifficulty) {
        return false;
      }
      const status: 'solved' | 'attempted' | 'unsolved' = progressMap[c.id] || 'unsolved';
      if (selectedStatus === 'Solved' && status !== 'solved') return false;
      if (selectedStatus === 'Attempted' && status !== 'attempted') return false;
      if (selectedStatus === 'Unsolved' && status !== 'unsolved') return false;

      if (selectedCompany !== 'All' && !c.companyTags.includes(selectedCompany)) {
        return false;
      }

      if (q) {
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesTrack = c.track.toLowerCase().includes(q);
        const matchesDifficulty = c.difficulty.toLowerCase().includes(q);
        const matchesCat = c.category.toLowerCase().includes(q);
        const matchesTags = c.tags.some((t) => t.toLowerCase().includes(q));
        const matchesCompany = c.companyTags.some((comp) => comp.toLowerCase().includes(q));
        if (
          !matchesTitle &&
          !matchesDesc &&
          !matchesTrack &&
          !matchesDifficulty &&
          !matchesCat &&
          !matchesTags &&
          !matchesCompany
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    categoryScopedProblems,
    selectedTopic,
    selectedDifficulty,
    selectedStatus,
    selectedCompany,
    searchQuery,
    progressMap,
  ]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedTrack !== 'All' ||
    selectedCategory !== 'All' ||
    selectedTopic !== 'All' ||
    selectedDifficulty !== 'All' ||
    selectedStatus !== 'All' ||
    selectedCompany !== 'All';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedTrack('All');
    setSelectedCategory('All');
    setSelectedTopic('All');
    setSelectedDifficulty('All');
    setSelectedStatus('All');
    setSelectedCompany('All');
  };

  return (
    <div
      data-testid="practice-hub-workspace"
      className={`flex-1 h-full flex flex-col overflow-y-auto transition-colors duration-200 ${
        isDarkMode ? 'bg-[#0b0c0e] text-[#e6edf3]' : 'bg-[#f8fafc] text-slate-900'
      }`}
    >
      {/* Top Cortex Practice Hub Header */}
      <header
        className={`sticky top-0 z-20 border-b backdrop-blur-md transition-colors ${
          isDarkMode
            ? 'bg-[#0d0e12]/95 border-[#1f2024]'
            : 'bg-white/95 border-slate-200 shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff9100]/15 border border-[#ff9100]/35 flex items-center justify-center shrink-0">
              <Swords className="w-5 h-5 text-[#ff9100]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className={`font-heading font-bold text-lg tracking-tight ${
                    isDarkMode ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Cortex Practice Hub
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#ff9100]/15 text-[#ff9100] border border-[#ff9100]/30">
                  {CHALLENGES.length} Problems
                </span>
              </div>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                Train across Programming, Data Structures & Algorithms, and SQL inside Cortex IDE
              </p>
            </div>
          </div>

          {/* Right Controls: Progress Summary, Theme Toggle, Return to Editor */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Progress Pill */}
            <div
              className={`hidden md:flex items-center gap-3 px-3 py-1.5 rounded-lg border text-xs ${
                isDarkMode
                  ? 'bg-[#13151b] border-[#222530] text-gray-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-mono font-semibold">
                  {solvedCount}/{CHALLENGES.length}
                </span>
                <span className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>Solved</span>
              </div>
              <span className={isDarkMode ? 'text-gray-600' : 'text-slate-300'}>|</span>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#ff9100]" />
                <span className="font-mono font-semibold">{attemptedCount}</span>
                <span className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>In Progress</span>
              </div>
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={(e) => onToggleDarkMode({ x: e.clientX, y: e.clientY })}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              data-testid="practice-theme-toggle"
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
                isDarkMode
                  ? 'bg-[#14151b] border-[#262936] text-gray-200 hover:border-[#ff9100]/60'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
              }`}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#ff9100]" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-700" />
                  <span>Dark</span>
                </>
              )}
            </button>

            {/* Return to Editor */}
            <button
              type="button"
              onClick={onReturnToEditor}
              data-testid="practice-return-to-editor"
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-xs font-heading font-semibold border transition-colors ${
                isDarkMode
                  ? 'bg-[#181a22] border-[#2c3040] text-gray-200 hover:text-white hover:border-[#ff9100]'
                  : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Editor</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="max-w-7xl w-full mx-auto px-5 sm:px-8 py-6 space-y-6">
        <PracticeTrackCards
          stats={trackStats}
          selectedTrack={selectedTrack}
          onSelectTrack={handleSelectTrack}
          isDarkMode={isDarkMode}
        />

        <PracticeFilters
          isDarkMode={isDarkMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedTrack={selectedTrack}
          onSelectTrack={handleSelectTrack}
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          categoryCounts={categoryCounts}
          selectedTopic={selectedTopic}
          onSelectTopic={setSelectedTopic}
          topicCounts={topicCounts}
          selectedDifficulty={selectedDifficulty}
          onSelectDifficulty={setSelectedDifficulty}
          selectedStatus={selectedStatus}
          onSelectStatus={setSelectedStatus}
          selectedCompany={selectedCompany}
          onSelectCompany={setSelectedCompany}
          companies={companies}
          hasActiveFilters={hasActiveFilters}
          onResetFilters={handleResetFilters}
          matchingCount={filteredProblems.length}
          totalCount={CHALLENGES.length}
        />

        <PracticeProblemTable
          problems={filteredProblems}
          progressMap={progressMap}
          activeProblemId={activeProblemId}
          isDarkMode={isDarkMode}
          onLaunchProblem={(challenge) => onLaunchProblem(challenge)}
          onResetFilters={handleResetFilters}
        />
      </div>
    </div>
  );
};
