'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  Circle,
  ArrowRight,
  SearchX,
  RotateCcw,
  Building2,
} from 'lucide-react';
import { Challenge } from '@/lib/challenges/challenges-data';
import { PracticeProgressMap } from './usePracticeProgress';

interface PracticeProblemTableProps {
  problems: Challenge[];
  progressMap: PracticeProgressMap;
  activeProblemId?: string | null;
  isDarkMode: boolean;
  onLaunchProblem: (challenge: Challenge) => void;
  onResetFilters: () => void;
}

export const PracticeProblemTable: React.FC<PracticeProblemTableProps> = ({
  problems,
  progressMap,
  activeProblemId,
  isDarkMode,
  onLaunchProblem,
  onResetFilters,
}) => {
  const getDifficultyStyle = (difficulty: Challenge['difficulty']) => {
    switch (difficulty) {
      case 'Easy':
        return isDarkMode
          ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
          : 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Medium':
        return isDarkMode
          ? 'text-amber-400 bg-amber-950/60 border-amber-800/50'
          : 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Hard':
        return isDarkMode
          ? 'text-rose-400 bg-rose-950/60 border-rose-800/50'
          : 'text-rose-700 bg-rose-50 border-rose-200';
    }
  };

  const getTrackStyle = (track: Challenge['track']) => {
    switch (track) {
      case 'DSA':
        return isDarkMode
          ? 'text-sky-300 bg-sky-950/50 border-sky-800/50'
          : 'text-sky-700 bg-sky-50 border-sky-200';
      case 'Programming':
        return isDarkMode
          ? 'text-amber-300 bg-amber-950/40 border-amber-800/40'
          : 'text-amber-800 bg-amber-50 border-amber-200';
      case 'SQL':
        return isDarkMode
          ? 'text-teal-300 bg-teal-950/50 border-teal-800/50'
          : 'text-teal-700 bg-teal-50 border-teal-200';
    }
  };

  if (problems.length === 0) {
    return (
      <div
        role="status"
        className={`rounded-xl border p-12 text-center ${
          isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        <SearchX
          className={`w-10 h-10 mx-auto mb-3 ${
            isDarkMode ? 'text-gray-500' : 'text-slate-400'
          }`}
        />
        <h3
          className={`font-heading font-semibold text-base ${
            isDarkMode ? 'text-gray-200' : 'text-slate-900'
          }`}
        >
          No matching problems found
        </h3>
        <p className={`text-xs mt-1 max-w-md mx-auto ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
          Try clearing your search query or adjusting the active track, topic, difficulty, status, or company filters.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#ff9100] hover:bg-[#ffa326] text-slate-950 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Filters</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-colors ${
        isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[760px]" data-testid="practice-problem-table">
          <thead>
            <tr
              className={`border-b text-[11px] font-heading font-semibold uppercase tracking-wider ${
                isDarkMode
                  ? 'bg-[#14161c] border-[#1f2024] text-gray-400'
                  : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}
            >
              <th className="py-3 px-4 w-20">Status</th>
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-4 w-32">Track</th>
              <th className="py-3 px-4 w-64">Topics</th>
              <th className="py-3 px-4 w-32">Difficulty</th>
              <th className="py-3 px-4 w-32 text-right">Action</th>
            </tr>
          </thead>

          <tbody className={`divide-y ${isDarkMode ? 'divide-[#1b1d24]' : 'divide-slate-200'}`}>
            {problems.map((problem) => {
              const status: 'solved' | 'attempted' | 'unsolved' = progressMap[problem.id] || 'unsolved';
              const isCurrent = activeProblemId === problem.id;
              const cleanSummary = problem.description
                .replace(/```[\s\S]*?```/g, '')
                .replace(/`/g, '')
                .replace(/\n+/g, ' ')
                .trim();

              return (
                <tr
                  key={problem.id}
                  data-testid={`problem-row-${problem.id}`}
                  className={`group transition-colors ${
                    isCurrent
                      ? isDarkMode
                        ? 'bg-[#ff9100]/[0.06]'
                        : 'bg-amber-50/70'
                      : isDarkMode
                        ? 'hover:bg-[#15171f]'
                        : 'hover:bg-slate-50/90'
                  }`}
                >
                  {/* 1. Status */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="flex items-center gap-1.5" title={`Status: ${status}`}>
                      {status === 'solved' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" aria-label="Solved" />
                      ) : status === 'attempted' ? (
                        <Clock className="w-4 h-4 text-[#ff9100] shrink-0" aria-label="Attempted" />
                      ) : (
                        <Circle
                          className={`w-4 h-4 shrink-0 ${
                            isDarkMode ? 'text-gray-600' : 'text-slate-300'
                          }`}
                          aria-label="Unsolved"
                        />
                      )}
                      <span
                        className={`text-[10px] font-mono capitalize ${
                          status === 'solved'
                            ? isDarkMode
                              ? 'text-emerald-400'
                              : 'text-emerald-700'
                            : status === 'attempted'
                              ? isDarkMode
                                ? 'text-amber-400'
                                : 'text-amber-700'
                              : isDarkMode
                                ? 'text-gray-500'
                                : 'text-slate-400'
                        }`}
                      >
                        {status === 'unsolved' ? '' : status}
                      </span>
                    </div>
                  </td>

                  {/* 2. Title + Summary + Company + Acceptance */}
                  <td className="py-3.5 px-4 align-middle">
                    <button
                      type="button"
                      onClick={() => onLaunchProblem(problem)}
                      className={`text-left font-heading font-semibold text-sm transition-colors group-hover:text-[#ff9100] focus:outline-none focus-visible:underline ${
                        isDarkMode ? 'text-[#e6edf3]' : 'text-slate-900'
                      }`}
                    >
                      {problem.title}
                    </button>
                    <p
                      className={`text-xs mt-0.5 line-clamp-1 max-w-xl ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-500'
                      }`}
                    >
                      {cleanSummary}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] font-mono ${
                          isDarkMode ? 'text-gray-500' : 'text-slate-500'
                        }`}
                      >
                        Acceptance: {problem.acceptanceRate}
                      </span>
                      {problem.companyTags.slice(0, 2).map((company) => (
                        <span
                          key={company}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${
                            isDarkMode
                              ? 'bg-[#171922] border-[#262936] text-gray-400'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          <Building2 className="w-2.5 h-2.5" />
                          <span>{company}</span>
                        </span>
                      ))}
                      {problem.companyTags.length > 2 && (
                        <span
                          className={`text-[10px] font-mono ${
                            isDarkMode ? 'text-gray-500' : 'text-slate-500'
                          }`}
                        >
                          +{problem.companyTags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 3. Track */}
                  <td className="py-3.5 px-4 align-middle">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${getTrackStyle(
                        problem.track
                      )}`}
                    >
                      {problem.track}
                    </span>
                  </td>

                  {/* 4. Topics */}
                  <td className="py-3.5 px-4 align-middle">
                    <div className="flex flex-wrap items-center gap-1">
                      {problem.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            isDarkMode
                              ? 'bg-[#171922] border-[#242733] text-gray-300'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                      {problem.tags.length > 3 && (
                        <span
                          className={`text-[10px] font-mono px-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          }`}
                        >
                          +{problem.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 5. Difficulty */}
                  <td className="py-3.5 px-4 align-middle">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${getDifficultyStyle(
                        problem.difficulty
                      )}`}
                    >
                      {problem.difficulty}
                    </span>
                  </td>

                  {/* 6. Action */}
                  <td className="py-3.5 px-4 align-middle text-right">
                    <button
                      type="button"
                      onClick={() => onLaunchProblem(problem)}
                      aria-label={`Practice ${problem.title}`}
                      data-testid={`launch-problem-${problem.id}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heading font-semibold border transition-colors ${
                        isDarkMode
                          ? 'bg-[#ff9100]/15 border-[#ff9100]/40 text-[#ffb347] hover:bg-[#ff9100] hover:text-slate-950 hover:border-[#ff9100]'
                          : 'bg-amber-50 border-amber-300 text-[#b45309] hover:bg-[#ff9100] hover:text-slate-950 hover:border-[#ff9100]'
                      }`}
                    >
                      <span>{status === 'solved' ? 'Solve Again' : 'Practice'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
