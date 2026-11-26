'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { CHALLENGES, Challenge, ChallengeTrack } from '../../lib/challenges/challenges-data';
import { PracticeFilters, DifficultyFilter, StatusFilter } from './PracticeFilters';
import { PracticeProblemTable, SortDirection, SortField } from './PracticeProblemTable';
import { PracticeProgressMap } from './usePracticeProgress';

export interface PracticeHubProps {
  isDarkMode: boolean;
  onToggleDarkMode: (coords?: { x: number; y: number }) => void;
  onLaunchProblem: (challenge: Challenge, preferredLang?: string) => void;
  onReturnToEditor: () => void;
  progressMap: PracticeProgressMap;
  activeProblemId?: string | null;
}

type TrackTabKey = 'All' | ChallengeTrack;

const DIFFICULTY_RANK: Record<Challenge['difficulty'], number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

/**
 * High-density Linear/Raycast-inspired Cortex Practice Hub view inside `/ide`.
 * Preserves full CHALLENGES dataset filtering, sorting, progress state, theme toggle,
 * and editor launch/return handlers while eliminating visual clutter.
 */
export const PracticeHub: React.FC<PracticeHubProps> = ({
  isDarkMode,
  onToggleDarkMode,
  onLaunchProblem,
  onReturnToEditor,
  progressMap,
  activeProblemId,
}) => {
  const [selectedTrack, setSelectedTrack] = useState<TrackTabKey>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyFilter>('All');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All');
  const [selectedCompany, setSelectedCompany] = useState('All');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const solvedCount = useMemo(
    () => CHALLENGES.filter((c) => progressMap[c.id] === 'solved').length,
    [progressMap]
  );

  const inProgressCount = useMemo(
    () => CHALLENGES.filter((c) => progressMap[c.id] === 'attempted').length,
    [progressMap]
  );

  const totalCount = CHALLENGES.length;
  const progressPct = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

  const trackTabs = useMemo<{ key: TrackTabKey; label: string; count: number }[]>(
    () => [
      { key: 'All', label: 'All', count: totalCount },
      {
        key: 'Programming',
        label: 'Programming',
        count: CHALLENGES.filter((c) => c.track === 'Programming').length,
      },
      {
        key: 'DSA',
        label: 'DSA',
        count: CHALLENGES.filter((c) => c.track === 'DSA').length,
      },
      {
        key: 'SQL',
        label: 'SQL',
        count: CHALLENGES.filter((c) => c.track === 'SQL').length,
      },
    ],
    [totalCount]
  );

  const allTopics = useMemo(() => {
    const unique = new Set<string>();
    for (const c of CHALLENGES) {
      for (const tag of c.tags) {
        unique.add(tag);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, []);

  const allCompanies = useMemo(() => {
    const unique = new Set<string>();
    for (const c of CHALLENGES) {
      for (const company of c.companyTags) {
        unique.add(company);
      }
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, []);

  const hasActiveFilters = Boolean(
    selectedTrack !== 'All' ||
      searchQuery.trim() ||
      selectedTopic !== 'All' ||
      selectedDifficulty !== 'All' ||
      selectedStatus !== 'All' ||
      selectedCompany !== 'All'
  );

  const handleResetFilters = () => {
    setSelectedTrack('All');
    setSearchQuery('');
    setSelectedTopic('All');
    setSelectedDifficulty('All');
    setSelectedStatus('All');
    setSelectedCompany('All');
  };

  const handleTopicChipClick = (topic: string) => {
    setSelectedTopic((prev) => (prev === topic ? 'All' : topic));
  };

  const handleSortChange = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortField(null);
      setSortDirection('asc');
    }
  };

  const filteredProblems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matched = CHALLENGES.filter((c) => {
      if (selectedTrack !== 'All' && c.track !== selectedTrack) {
        return false;
      }
      if (selectedTopic !== 'All' && !c.tags.includes(selectedTopic)) {
        return false;
      }
      if (selectedDifficulty !== 'All' && c.difficulty !== selectedDifficulty) {
        return false;
      }
      if (selectedCompany !== 'All' && !c.companyTags.includes(selectedCompany)) {
        return false;
      }
      if (selectedStatus !== 'All') {
        const status = progressMap[c.id];
        if (selectedStatus === 'Solved' && status !== 'solved') return false;
        if (selectedStatus === 'In Progress' && status !== 'attempted') return false;
        if (selectedStatus === 'Todo' && Boolean(status)) return false;
      }
      if (q) {
        const matchesQuery =
          c.title.toLowerCase().includes(q) ||
          c.track.toLowerCase().includes(q) ||
          c.difficulty.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)) ||
          c.companyTags.some((comp) => comp.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }
      return true;
    });

    if (!sortField) {
      return matched;
    }

    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...matched].sort((a, b) => {
      if (sortField === 'title') {
        return a.title.localeCompare(b.title) * dir;
      }
      if (sortField === 'acceptance') {
        const aVal = parseFloat(a.acceptanceRate) || 0;
        const bVal = parseFloat(b.acceptanceRate) || 0;
        return (aVal - bVal) * dir;
      }
      return (DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty]) * dir;
    });
  }, [
    selectedTrack,
    searchQuery,
    selectedTopic,
    selectedDifficulty,
    selectedStatus,
    selectedCompany,
    progressMap,
    sortField,
    sortDirection,
  ]);

  return (
    <div
      data-testid="practice-hub-workspace"
      className={`${
        isDarkMode ? 'dark bg-[#09090B] text-[#F4F4F5]' : 'bg-[#FFFFFF] text-[#09090B]'
      } flex-1 min-h-0 h-full w-full flex flex-col overflow-hidden antialiased select-none transition-colors duration-150`}
    >
      {/* 1. Compact Single-Line Header */}
      <header className="h-14 shrink-0 px-6 flex items-center justify-between border-b border-[#E4E4E7] dark:border-white/[0.07]">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-[#09090B] dark:text-[#F4F4F5] truncate">
            Cortex Practice Hub
          </h1>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Inline Compact Progress Meter */}
          <div className="hidden sm:flex items-center gap-2.5">
            <span
              data-testid="practice-progress-summary"
              className="text-xs font-mono tabular-nums text-[#52525B] dark:text-[#A1A1AA]"
            >
              {solvedCount}/{totalCount} Solved
            </span>
            <div className="w-24 h-1.5 rounded-full overflow-hidden bg-[#F4F4F5] dark:bg-white/[0.08]">
              <div
                className="h-full bg-[#F59E0B] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-[#71717A]">
              {inProgressCount} In Progress
            </span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            data-testid="practice-theme-toggle"
            onClick={(e) => onToggleDarkMode({ x: e.clientX, y: e.clientY })}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md transition-colors border border-[#E4E4E7] text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F5] dark:border-white/[0.07] dark:text-[#A1A1AA] dark:hover:text-[#F4F4F5] dark:hover:bg-[#18181B]"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Return to Editor */}
          <button
            type="button"
            data-testid="practice-return-to-editor"
            onClick={onReturnToEditor}
            className="h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors border border-[#E4E4E7] text-[#09090B] hover:bg-[#F4F4F5] dark:border-white/[0.07] dark:text-[#F4F4F5] dark:hover:bg-[#18181B]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Editor</span>
          </button>
        </div>
      </header>

      {/* 2. Underline Track Tab Bar */}
      <nav
        aria-label="Practice tracks"
        className="h-10 shrink-0 px-6 flex items-center gap-6 border-b border-[#E4E4E7] dark:border-white/[0.07]"
      >
        {trackTabs.map((tab) => {
          const isActive = selectedTrack === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              data-testid={`practice-track-tab-${tab.key.toLowerCase()}`}
              onClick={() => setSelectedTrack(tab.key)}
              className={`relative h-full inline-flex items-center gap-2 text-xs transition-colors border-b-2 ${
                isActive
                  ? 'border-[#F59E0B] text-[#09090B] dark:text-[#F4F4F5] font-medium'
                  : 'border-transparent text-[#71717A] hover:text-[#52525B] dark:hover:text-[#A1A1AA] font-normal'
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono tabular-nums text-[11px] text-[#71717A]">
                {tab.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 3. Single Borderless Filter Toolbar */}
      <PracticeFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        topics={allTopics}
        selectedTopic={selectedTopic}
        onTopicChange={setSelectedTopic}
        selectedDifficulty={selectedDifficulty}
        onDifficultyChange={setSelectedDifficulty}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        companies={allCompanies}
        selectedCompany={selectedCompany}
        onCompanyChange={setSelectedCompany}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        filteredCount={filteredProblems.length}
        totalCount={totalCount}
      />

      {/* 4. Full-Bleed High-Density Problem Table */}
      <PracticeProblemTable
        challenges={filteredProblems}
        progressMap={progressMap}
        activeProblemId={activeProblemId}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onLaunchProblem={onLaunchProblem}
        onTopicClick={handleTopicChipClick}
        selectedTopic={selectedTopic}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
};
