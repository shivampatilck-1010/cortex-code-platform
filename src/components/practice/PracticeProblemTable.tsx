'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Circle,
  Clock,
} from 'lucide-react';
import { Challenge } from '../../lib/challenges/challenges-data';
import { PracticeProgressMap } from './usePracticeProgress';

export type SortField = 'title' | 'acceptance' | 'difficulty';
export type SortDirection = 'asc' | 'desc';

export interface PracticeProblemTableProps {
  challenges: Challenge[];
  progressMap: PracticeProgressMap;
  activeProblemId?: string | null;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  onLaunchProblem: (challenge: Challenge, preferredLang?: string) => void;
  onTopicClick: (topic: string) => void;
  selectedTopic: string;
  onResetFilters: () => void;
}

const DIFFICULTY_TEXT: Record<Challenge['difficulty'], string> = {
  Easy: 'text-emerald-600 dark:text-emerald-400',
  Medium: 'text-amber-600 dark:text-amber-400',
  Hard: 'text-rose-600 dark:text-rose-400',
};

function renderSortIcon(field: SortField, activeField: SortField | null, direction: SortDirection) {
  if (activeField !== field) {
    return <ArrowUpDown className="w-3 h-3 opacity-40 group-hover/sort:opacity-80 transition-opacity" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="w-3 h-3 text-[#09090B] dark:text-[#F4F4F5]" />
  ) : (
    <ArrowDown className="w-3 h-3 text-[#09090B] dark:text-[#F4F4F5]" />
  );
}

/**
 * Full-bleed high-density problem table with sticky sortable headers (`Title`, `Acceptance`, `Difficulty`),
 * compact `h-12` single-line rows, monochrome topic chips, and hover-accented Practice launch triggers.
 */
export const PracticeProblemTable: React.FC<PracticeProblemTableProps> = ({
  challenges,
  progressMap,
  activeProblemId,
  sortField,
  sortDirection,
  onSortChange,
  onLaunchProblem,
  onTopicClick,
  selectedTopic,
  onResetFilters,
}) => {
  if (challenges.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#09090B] dark:text-[#F4F4F5]">
          No problems match your filters
        </p>
        <p className="mt-1 text-xs text-[#71717A]">
          Adjust your search query, track tab, or filter dropdowns.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 h-8 px-3 rounded-md text-xs font-medium transition-colors bg-[#F4F4F5] text-[#09090B] border border-[#E4E4E7] hover:border-zinc-300 dark:bg-[#121215] dark:text-[#F4F4F5] dark:border-white/[0.07] dark:hover:border-white/[0.14]"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table data-testid="practice-problem-table" className="w-full border-collapse text-left table-fixed">
        <thead className="sticky top-0 z-10 h-9 bg-white/95 dark:bg-[#09090B]/95 backdrop-blur-sm border-b border-[#E4E4E7] dark:border-white/[0.07]">
          <tr className="text-[11px] font-medium uppercase tracking-wider text-[#71717A]">
            <th className="w-12 pl-6 pr-3 font-medium" aria-label="Status" />
            <th className="pr-3 font-medium">
              <button
                type="button"
                onClick={() => onSortChange('title')}
                data-testid="practice-sort-title"
                className="group/sort inline-flex items-center gap-1.5 hover:text-[#09090B] dark:hover:text-[#F4F4F5] transition-colors uppercase tracking-wider"
              >
                <span>Title</span>
                {renderSortIcon('title', sortField, sortDirection)}
              </button>
            </th>
            <th className="w-28 px-3 font-medium hidden sm:table-cell">Track</th>
            <th className="w-60 px-3 font-medium hidden md:table-cell">Topics</th>
            <th className="w-28 pl-3 pr-5 font-medium text-right">
              <button
                type="button"
                onClick={() => onSortChange('acceptance')}
                data-testid="practice-sort-acceptance"
                className="group/sort inline-flex items-center justify-end gap-1.5 ml-auto hover:text-[#09090B] dark:hover:text-[#F4F4F5] transition-colors uppercase tracking-wider"
              >
                <span>Acceptance</span>
                {renderSortIcon('acceptance', sortField, sortDirection)}
              </button>
            </th>
            <th className="w-28 pl-4 pr-3 font-medium">
              <button
                type="button"
                onClick={() => onSortChange('difficulty')}
                data-testid="practice-sort-difficulty"
                className="group/sort inline-flex items-center gap-1.5 hover:text-[#09090B] dark:hover:text-[#F4F4F5] transition-colors uppercase tracking-wider"
              >
                <span>Difficulty</span>
                {renderSortIcon('difficulty', sortField, sortDirection)}
              </button>
            </th>
            <th className="w-28 pl-3 pr-6 text-right font-medium" aria-label="Action" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E4E4E7] dark:divide-white/[0.07]">
          {challenges.map((challenge) => {
            const status = progressMap[challenge.id];
            const isActive = activeProblemId === challenge.id;
            const visibleTags = challenge.tags.slice(0, 2);
            const extraTagCount = Math.max(0, challenge.tags.length - visibleTags.length);
            const companyLine = challenge.companyTags.slice(0, 2).join(' \u00b7 ');

            return (
              <tr
                key={challenge.id}
                data-testid={`problem-row-${challenge.id}`}
                onClick={() => onLaunchProblem(challenge)}
                className={`group h-12 cursor-pointer transition-colors hover:bg-zinc-100/70 dark:hover:bg-white/[0.025] ${
                  isActive ? 'bg-zinc-100/60 dark:bg-white/[0.03]' : ''
                }`}
              >
                {/* Status Indicator */}
                <td className="w-12 pl-6 pr-3 align-middle">
                  {status === 'solved' ? (
                    <span title="Solved" aria-label="Solved" className="inline-flex items-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </span>
                  ) : status === 'attempted' ? (
                    <span title="In Progress" aria-label="In Progress" className="inline-flex items-center">
                      <Clock className="w-4 h-4 text-amber-500" />
                    </span>
                  ) : (
                    <span title="Todo" aria-label="Todo" className="inline-flex items-center">
                      <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-700" />
                    </span>
                  )}
                </td>

                {/* Title + Inline Desktop Company Tags (strict single-line) */}
                <td className="pr-3 align-middle">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[13px] font-medium text-[#09090B] dark:text-[#F4F4F5] truncate">
                      {challenge.title}
                    </span>
                    {isActive && (
                      <span className="shrink-0 text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/[0.06] text-[#52525B] dark:text-[#A1A1AA]">
                        Open
                      </span>
                    )}
                    {companyLine && (
                      <span className="hidden lg:inline shrink-0 text-[11px] text-[#71717A] truncate max-w-[180px]">
                        {companyLine}
                      </span>
                    )}
                  </div>
                </td>

                {/* Track */}
                <td className="w-28 px-3 align-middle hidden sm:table-cell">
                  <span className="text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
                    {challenge.track}
                  </span>
                </td>

                {/* Topics (max 2 borderless monochrome chips + overflow) */}
                <td className="w-60 px-3 align-middle hidden md:table-cell">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {visibleTags.map((tag) => {
                      const isTagActive = selectedTopic === tag;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTopicClick(tag);
                          }}
                          title={tag}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium max-w-[118px] transition-colors ${
                            isTagActive
                              ? 'bg-zinc-200 text-[#09090B] dark:bg-white/[0.12] dark:text-[#F4F4F5]'
                              : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/70 dark:bg-white/[0.05] dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/[0.09]'
                          }`}
                        >
                          <span className="truncate">{tag}</span>
                        </button>
                      );
                    })}
                    {extraTagCount > 0 && (
                      <span
                        title={challenge.tags.slice(2).join(', ')}
                        className="text-[11px] font-mono text-[#71717A] shrink-0"
                      >
                        +{extraTagCount}
                      </span>
                    )}
                  </div>
                </td>

                {/* Acceptance */}
                <td className="w-28 pl-3 pr-5 align-middle text-right font-mono tabular-nums text-xs text-[#71717A] dark:text-[#A1A1AA]">
                  {challenge.acceptanceRate}
                </td>

                {/* Difficulty */}
                <td className="w-28 pl-4 pr-3 align-middle">
                  <span className={`text-xs font-medium ${DIFFICULTY_TEXT[challenge.difficulty]}`}>
                    {challenge.difficulty}
                  </span>
                </td>

                {/* Action */}
                <td className="w-28 pl-3 pr-6 align-middle text-right">
                  <button
                    type="button"
                    data-testid={`launch-problem-${challenge.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchProblem(challenge);
                    }}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium transition-colors border border-[#E4E4E7] text-[#52525B] bg-transparent dark:border-white/[0.07] dark:text-[#A1A1AA] group-hover:border-amber-500/40 group-hover:bg-amber-500/10 group-hover:text-amber-600 dark:group-hover:text-[#F59E0B] hover:border-amber-500/40 hover:bg-amber-500/10"
                  >
                    <span>Practice</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
