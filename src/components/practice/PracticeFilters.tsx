'use client';

import React, { useState } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Layers,
  GitBranch,
  Database,
  Code2,
} from 'lucide-react';
import { ChallengeTopicCategory } from '@/lib/challenges/challenges-data';
import { TrackFilter } from './PracticeTrackCards';

export type CategoryFilter = 'All' | ChallengeTopicCategory;
export type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';
export type StatusFilter = 'All' | 'Solved' | 'Attempted' | 'Unsolved';

export interface TopicCountItem {
  topic: string;
  count: number;
}

interface PracticeFiltersProps {
  isDarkMode: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedTrack: TrackFilter;
  onSelectTrack: (t: TrackFilter) => void;
  selectedCategory: CategoryFilter;
  onSelectCategory: (c: CategoryFilter) => void;
  categoryCounts: Record<CategoryFilter, number>;
  selectedTopic: string;
  onSelectTopic: (topic: string) => void;
  topicCounts: TopicCountItem[];
  selectedDifficulty: DifficultyFilter;
  onSelectDifficulty: (d: DifficultyFilter) => void;
  selectedStatus: StatusFilter;
  onSelectStatus: (s: StatusFilter) => void;
  selectedCompany: string;
  onSelectCompany: (c: string) => void;
  companies: string[];
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  matchingCount: number;
  totalCount: number;
}

const CATEGORY_OPTIONS: {
  id: CategoryFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'All', label: 'All Topics', icon: Layers },
  { id: 'Algorithms', label: 'Algorithms', icon: GitBranch },
  { id: 'Database', label: 'Database', icon: Database },
  { id: 'Programming', label: 'Programming', icon: Code2 },
];

const QUICK_DIFFICULTIES: {
  id: DifficultyFilter;
  label: string;
  levelLabel: string;
}[] = [
  { id: 'All', label: 'All', levelLabel: 'All Levels' },
  { id: 'Easy', label: 'Easy', levelLabel: 'Beginner' },
  { id: 'Medium', label: 'Medium', levelLabel: 'Intermediate' },
  { id: 'Hard', label: 'Hard', levelLabel: 'Advanced' },
];

export const PracticeFilters: React.FC<PracticeFiltersProps> = ({
  isDarkMode,
  searchQuery,
  onSearchChange,
  selectedTrack,
  onSelectTrack,
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  selectedTopic,
  onSelectTopic,
  topicCounts,
  selectedDifficulty,
  onSelectDifficulty,
  selectedStatus,
  onSelectStatus,
  selectedCompany,
  onSelectCompany,
  companies,
  hasActiveFilters,
  onResetFilters,
  matchingCount,
  totalCount,
}) => {
  const [topicsExpanded, setTopicsExpanded] = useState(false);

  const visibleTopics = React.useMemo(() => {
    if (topicsExpanded) return topicCounts;
    const topTen = topicCounts.slice(0, 10);
    if (
      selectedTopic !== 'All' &&
      !topTen.some((item) => item.topic === selectedTopic)
    ) {
      const selectedItem = topicCounts.find((item) => item.topic === selectedTopic);
      if (selectedItem) {
        return [...topTen, selectedItem];
      }
    }
    return topTen;
  }, [topicsExpanded, topicCounts, selectedTopic]);

  const hasMoreTopics = topicsExpanded
    ? topicCounts.length > 10
    : topicCounts.length > visibleTopics.length;

  const selectClass = `h-9 px-3 rounded-lg text-xs font-medium border focus:outline-none focus:border-[#ff9100] transition-colors cursor-pointer ${
    isDarkMode
      ? 'bg-[#14151b] border-[#262936] text-gray-200 hover:border-[#343848]'
      : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400 shadow-sm'
  }`;

  const optionClass = isDarkMode
    ? 'bg-[#14151b] text-gray-200'
    : 'bg-white text-slate-800';

  return (
    <div className="space-y-4">
      {/* Category Pills & Dynamic Topic Chips */}
      <div
        className={`rounded-xl p-4 border space-y-3.5 transition-colors ${
          isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Topic Categories">
            {CATEGORY_OPTIONS.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSelectCategory(cat.id)}
                  data-testid={`category-pill-${cat.id.toLowerCase()}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9100] ${
                    isActive
                      ? 'bg-[#ff9100] text-slate-950 border-[#ff9100] font-semibold shadow-sm'
                      : isDarkMode
                        ? 'bg-[#161820] border-[#252834] text-gray-300 hover:text-white hover:border-[#343848]'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      isActive
                        ? 'bg-slate-950/15 text-slate-950 font-bold'
                        : isDarkMode
                          ? 'bg-[#20232e] text-gray-400'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`text-xs font-mono ${
              isDarkMode ? 'text-gray-400' : 'text-slate-500'
            }`}
          >
            Showing <span className={isDarkMode ? 'text-gray-200 font-semibold' : 'text-slate-800 font-semibold'}>{matchingCount}</span> of {totalCount}
          </div>
        </div>

        {/* Topic Chips with per-topic counts */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-dashed border-opacity-60 border-gray-500/20">
          <button
            type="button"
            onClick={() => onSelectTopic('All')}
            data-testid="topic-chip-all"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
              selectedTopic === 'All'
                ? isDarkMode
                  ? 'bg-[#ff9100]/15 border-[#ff9100]/60 text-[#ffb347] font-semibold'
                  : 'bg-amber-50 border-[#ff9100] text-[#b45309] font-semibold'
                : isDarkMode
                  ? 'bg-[#15171e] border-[#232632] text-gray-300 hover:border-[#35394a]'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>All</span>
          </button>

          {visibleTopics.map(({ topic, count }) => {
            const isSelected = selectedTopic === topic;
            return (
              <button
                key={topic}
                type="button"
                onClick={() => onSelectTopic(isSelected ? 'All' : topic)}
                aria-pressed={isSelected}
                data-testid={`topic-chip-${topic.toLowerCase().replace(/\s+/g, '-')}`}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  isSelected
                    ? isDarkMode
                      ? 'bg-[#ff9100]/15 border-[#ff9100]/60 text-[#ffb347] font-semibold'
                      : 'bg-amber-50 border-[#ff9100] text-[#b45309] font-semibold'
                    : isDarkMode
                      ? 'bg-[#15171e] border-[#232632] text-gray-300 hover:text-white hover:border-[#35394a]'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{topic}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-[#ff9100]/20 text-[#ffcc80]'
                        : 'bg-[#ff9100]/20 text-[#92400e]'
                      : isDarkMode
                        ? 'bg-[#1e212b] text-gray-400'
                        : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}

          {hasMoreTopics && (
            <button
              type="button"
              onClick={() => setTopicsExpanded((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                isDarkMode
                  ? 'text-[#ff9100] hover:bg-[#191b22]'
                  : 'text-[#d97706] hover:bg-amber-50'
              }`}
            >
              <span>{topicsExpanded ? 'Show Less' : `Expand (${topicCounts.length - visibleTopics.length})`}</span>
              {topicsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Search Bar, Quick Level Pills & Multi-Filter Controls */}
      <div
        className={`rounded-xl p-4 border space-y-3 transition-colors ${
          isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search
              className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDarkMode ? 'text-gray-400' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search problems by title, statement, topic, or company..."
              aria-label="Search problems"
              data-testid="practice-search-input"
              className={`w-full h-9 pl-9 pr-9 rounded-lg text-xs border focus:outline-none focus:border-[#ff9100] transition-colors ${
                isDarkMode
                  ? 'bg-[#14151b] border-[#262936] text-gray-100 placeholder-gray-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                data-testid="practice-search-clear"
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick-Filter Difficulty / Level Segmented Pills */}
          <div
            className={`inline-flex items-center p-1 rounded-lg border shrink-0 flex-wrap gap-1 ${
              isDarkMode ? 'bg-[#14151b] border-[#262936]' : 'bg-slate-100 border-slate-200'
            }`}
            role="group"
            aria-label="Difficulty and Level Filter"
          >
            <span
              className={`text-[10px] font-mono uppercase tracking-wider px-2 ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}
            >
              Level:
            </span>
            {QUICK_DIFFICULTIES.map((item) => {
              const isActive = selectedDifficulty === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectDifficulty(item.id)}
                  aria-pressed={isActive}
                  data-testid={`level-pill-${item.id.toLowerCase()}`}
                  title={item.levelLabel}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#ff9100] text-slate-950 font-semibold shadow-sm'
                      : isDarkMode
                        ? 'text-gray-300 hover:text-white hover:bg-[#1e2029]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  {item.id === 'All' ? 'All' : `${item.label} (${item.levelLabel})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Track Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filter-track"
              className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}
            >
              Track
            </label>
            <select
              id="filter-track"
              value={selectedTrack}
              onChange={(e) => onSelectTrack(e.target.value as TrackFilter)}
              className={selectClass}
              data-testid="filter-select-track"
            >
              <option value="All" className={optionClass}>All Tracks</option>
              <option value="Programming" className={optionClass}>Programming</option>
              <option value="DSA" className={optionClass}>DSA</option>
              <option value="SQL" className={optionClass}>SQL</option>
            </select>
          </div>

          {/* Topic Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filter-topic"
              className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}
            >
              Topic
            </label>
            <select
              id="filter-topic"
              value={selectedTopic}
              onChange={(e) => onSelectTopic(e.target.value)}
              className={selectClass}
              data-testid="filter-select-topic"
            >
              <option value="All" className={optionClass}>All Topics</option>
              {topicCounts.map(({ topic, count }) => (
                <option key={topic} value={topic} className={optionClass}>
                  {topic} ({count})
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filter-difficulty"
              className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}
            >
              Difficulty
            </label>
            <select
              id="filter-difficulty"
              value={selectedDifficulty}
              onChange={(e) => onSelectDifficulty(e.target.value as DifficultyFilter)}
              className={selectClass}
              data-testid="filter-select-difficulty"
            >
              <option value="All" className={optionClass}>All Difficulties</option>
              <option value="Easy" className={optionClass}>Easy (Beginner)</option>
              <option value="Medium" className={optionClass}>Medium (Intermediate)</option>
              <option value="Hard" className={optionClass}>Hard (Advanced)</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filter-status"
              className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}
            >
              Status
            </label>
            <select
              id="filter-status"
              value={selectedStatus}
              onChange={(e) => onSelectStatus(e.target.value as StatusFilter)}
              className={selectClass}
              data-testid="filter-select-status"
            >
              <option value="All" className={optionClass}>All Status</option>
              <option value="Solved" className={optionClass}>Solved</option>
              <option value="Attempted" className={optionClass}>Attempted</option>
              <option value="Unsolved" className={optionClass}>Unsolved</option>
            </select>
          </div>

          {/* Company Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="filter-company"
              className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}
            >
              Company
            </label>
            <select
              id="filter-company"
              value={selectedCompany}
              onChange={(e) => onSelectCompany(e.target.value)}
              className={selectClass}
              data-testid="filter-select-company"
            >
              <option value="All" className={optionClass}>All Companies</option>
              {companies.map((company) => (
                <option key={company} value={company} className={optionClass}>
                  {company}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              data-testid="reset-filters-button"
              className={`ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-colors ${
                isDarkMode
                  ? 'bg-[#181a22] border-[#2b2e3d] text-gray-300 hover:text-white hover:border-[#ff9100]/60'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
