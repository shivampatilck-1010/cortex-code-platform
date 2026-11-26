'use client';

import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

export type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';
export type StatusFilter = 'All' | 'Todo' | 'In Progress' | 'Solved';

export interface PracticeFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  topics: string[];
  selectedTopic: string;
  onTopicChange: (topic: string) => void;
  selectedDifficulty: DifficultyFilter;
  onDifficultyChange: (difficulty: DifficultyFilter) => void;
  selectedStatus: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  companies: string[];
  selectedCompany: string;
  onCompanyChange: (company: string) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

const SELECT_CLASSES =
  'h-8 px-2.5 rounded-md text-xs font-medium outline-none cursor-pointer transition-colors ' +
  'bg-[#F4F4F5] text-[#09090B] border border-[#E4E4E7] hover:border-zinc-300 focus:border-zinc-400 ' +
  'dark:bg-[#121215] dark:text-[#F4F4F5] dark:border-white/[0.07] dark:hover:border-white/[0.14] dark:focus:border-white/[0.2]';

const OPTION_CLASSES = 'bg-white text-[#09090B] dark:bg-[#121215] dark:text-[#F4F4F5]';

/**
 * Single borderless toolbar containing search input (with `/` focus shortcut),
 * Topic/Difficulty/Status/Company dropdowns, conditional Reset button, and count summary.
 */
export const PracticeFilters: React.FC<PracticeFiltersProps> = ({
  searchQuery,
  onSearchChange,
  topics,
  selectedTopic,
  onTopicChange,
  selectedDifficulty,
  onDifficultyChange,
  selectedStatus,
  onStatusChange,
  companies,
  selectedCompany,
  onCompanyChange,
  hasActiveFilters,
  onResetFilters,
  filteredCount,
  totalCount,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        Boolean(target?.isContentEditable);

      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          onSearchChange('');
        }
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchQuery, onSearchChange]);

  return (
    <div className="shrink-0 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E4E4E7] dark:border-white/[0.07] bg-white dark:bg-[#09090B]">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        {/* Search Input with '/' keyboard shortcut */}
        <div className="relative flex items-center w-64 max-w-full">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#71717A] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search title, topic, or company..."
            data-testid="practice-search-input"
            aria-label="Search practice problems"
            className="w-full h-8 pl-8 pr-8 rounded-md text-xs outline-none transition-colors bg-[#F4F4F5] text-[#09090B] placeholder:text-[#71717A] border border-[#E4E4E7] hover:border-zinc-300 focus:border-zinc-400 dark:bg-[#121215] dark:text-[#F4F4F5] dark:border-white/[0.07] dark:hover:border-white/[0.14] dark:focus:border-white/[0.2]"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 p-0.5 rounded text-[#71717A] hover:text-[#09090B] dark:hover:text-[#F4F4F5] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 h-4 text-[10px] font-mono rounded absolute right-2 pointer-events-none text-[#71717A] bg-white dark:bg-[#18181B] border border-[#E4E4E7] dark:border-white/[0.07]">
              /
            </kbd>
          )}
        </div>

        {/* Topic Dropdown */}
        <select
          value={selectedTopic}
          onChange={(e) => onTopicChange(e.target.value)}
          aria-label="Filter by topic"
          data-testid="practice-filter-topic"
          className={`${SELECT_CLASSES} max-w-[165px]`}
        >
          <option value="All" className={OPTION_CLASSES}>
            Topic: All
          </option>
          {topics.map((topic) => (
            <option key={topic} value={topic} className={OPTION_CLASSES}>
              {topic}
            </option>
          ))}
        </select>

        {/* Difficulty Dropdown */}
        <select
          value={selectedDifficulty}
          onChange={(e) => onDifficultyChange(e.target.value as DifficultyFilter)}
          aria-label="Filter by difficulty"
          data-testid="practice-filter-difficulty"
          className={SELECT_CLASSES}
        >
          <option value="All" className={OPTION_CLASSES}>
            Difficulty: All
          </option>
          <option value="Easy" className={OPTION_CLASSES}>
            Easy
          </option>
          <option value="Medium" className={OPTION_CLASSES}>
            Medium
          </option>
          <option value="Hard" className={OPTION_CLASSES}>
            Hard
          </option>
        </select>

        {/* Status Dropdown */}
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          data-testid="practice-filter-status"
          className={SELECT_CLASSES}
        >
          <option value="All" className={OPTION_CLASSES}>
            Status: All
          </option>
          <option value="Todo" className={OPTION_CLASSES}>
            Todo
          </option>
          <option value="In Progress" className={OPTION_CLASSES}>
            In Progress
          </option>
          <option value="Solved" className={OPTION_CLASSES}>
            Solved
          </option>
        </select>

        {/* Company Dropdown */}
        <select
          value={selectedCompany}
          onChange={(e) => onCompanyChange(e.target.value)}
          aria-label="Filter by company"
          data-testid="practice-filter-company"
          className={SELECT_CLASSES}
        >
          <option value="All" className={OPTION_CLASSES}>
            Company: All
          </option>
          {companies.map((company) => (
            <option key={company} value={company} className={OPTION_CLASSES}>
              {company}
            </option>
          ))}
        </select>

        {/* Conditional Reset Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            data-testid="practice-reset-filters"
            className="h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors text-[#52525B] hover:text-[#09090B] hover:bg-[#F4F4F5] dark:text-[#A1A1AA] dark:hover:text-[#F4F4F5] dark:hover:bg-[#18181B]"
          >
            <X className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Right-aligned muted counter */}
      <div
        data-testid="practice-showing-count"
        className="text-xs font-mono tabular-nums text-[#71717A] shrink-0"
      >
        Showing {filteredCount} of {totalCount}
      </div>
    </div>
  );
};
