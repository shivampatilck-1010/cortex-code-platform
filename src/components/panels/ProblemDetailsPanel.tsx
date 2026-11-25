'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Play,
  PanelLeftClose,
  Building2,
  RotateCcw,
  AlertTriangle,
  FileCode2,
} from 'lucide-react';
import { Challenge } from '@/lib/challenges/challenges-data';
import { getLanguageConfig } from '@/config/languages';

export interface ProblemDetailsPanelProps {
  challenge: Challenge;
  isDarkMode: boolean;
  status?: 'solved' | 'attempted' | 'unsolved';
  currentLanguageId: string;
  isRunningTests?: boolean;
  isChallengeFileActive?: boolean;
  activeFileName?: string | null;
  activeTestCasesCount?: number;
  onOpenChallengeFile?: () => void;
  onSelectLanguage: (langId: string) => void;
  onResetCode?: () => void;
  onRunTests: () => void;
  onBackToPracticeHub: () => void;
  onClosePanel: () => void;
}

export const ProblemDetailsPanel: React.FC<ProblemDetailsPanelProps> = ({
  challenge,
  isDarkMode,
  status = 'unsolved',
  currentLanguageId,
  isRunningTests = false,
  isChallengeFileActive = true,
  activeFileName,
  activeTestCasesCount,
  onOpenChallengeFile,
  onSelectLanguage,
  onResetCode,
  onRunTests,
  onBackToPracticeHub,
  onClosePanel,
}) => {
  const [openHints, setOpenHints] = useState<Record<number, boolean>>({});
  const availableLanguages = Object.keys(challenge.starterTemplates);

  useEffect(() => {
    setOpenHints({});
  }, [challenge.id]);

  const toggleHint = (idx: number) => {
    setOpenHints((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getDifficultyStyle = (diff: Challenge['difficulty']) => {
    switch (diff) {
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

  return (
    <aside
      data-testid="problem-details-panel"
      aria-label="Active Problem Details"
      className={`w-[340px] xl:w-[380px] shrink-0 h-full flex flex-col border-r overflow-hidden transition-colors ${
        isDarkMode
          ? 'bg-[#101114] border-[#1f2024] text-[#e6edf3]'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Top Action Header */}
      <div
        className={`h-10 px-3 border-b flex items-center justify-between gap-2 shrink-0 ${
          isDarkMode ? 'bg-[#0d0e11] border-[#1f2024]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <button
          type="button"
          onClick={onBackToPracticeHub}
          data-testid="problem-back-to-hub"
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors ${
            isDarkMode
              ? 'text-[#ff9100] hover:bg-[#1a1c24]'
              : 'text-[#d97706] hover:bg-amber-50'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Practice Hub</span>
        </button>

        <button
          type="button"
          onClick={onClosePanel}
          title="Collapse Problem Details"
          aria-label="Collapse Problem Details"
          data-testid="problem-close-panel"
          className={`p-1 rounded transition-colors ${
            isDarkMode
              ? 'text-gray-400 hover:text-white hover:bg-[#1a1c24]'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title & Metadata */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h2
              className={`font-heading font-bold text-base leading-snug ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {challenge.title}
            </h2>
            {status === 'solved' && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 border ${
                  isDarkMode
                    ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Solved</span>
              </span>
            )}
            {status === 'attempted' && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 border ${
                  isDarkMode
                    ? 'bg-amber-950/60 border-amber-800/50 text-amber-400'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>In Progress</span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getDifficultyStyle(
                challenge.difficulty
              )}`}
            >
              {challenge.difficulty}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                isDarkMode
                  ? 'bg-[#171922] border-[#262936] text-[#ffb347]'
                  : 'bg-amber-50 border-amber-200 text-[#b45309]'
              }`}
            >
              {challenge.track}
            </span>
            <span
              className={`text-[11px] font-mono ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}
            >
              Acceptance: {challenge.acceptanceRate}
            </span>
          </div>

          {/* Topics */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {challenge.tags.map((tag) => (
              <span
                key={tag}
                className={`px-2 py-0.5 rounded text-[10px] border ${
                  isDarkMode
                    ? 'bg-[#161820] border-[#242733] text-gray-300'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}
              >
                {tag}
              </span>
            ))}
            {challenge.companyTags.slice(0, 2).map((company) => (
              <span
                key={company}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${
                  isDarkMode
                    ? 'bg-[#14161c] border-[#232632] text-gray-400'
                    : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                <Building2 className="w-2.5 h-2.5" />
                <span>{company}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Active Tab Mismatch Notice */}
        {!isChallengeFileActive && (
          <div
            data-testid="problem-tab-mismatch-notice"
            className={`p-3 rounded-lg border space-y-2 text-xs ${
              isDarkMode
                ? 'bg-amber-950/35 border-amber-800/60 text-amber-200'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  {activeFileName
                    ? `Viewing "${activeFileName}" instead of this challenge's solution file.`
                    : 'No challenge solution tab is currently active.'}
                </p>
                <p className={`text-[11px] ${isDarkMode ? 'text-amber-300/80' : 'text-amber-800'}`}>
                  Running tests from this panel will target this challenge's solution file.
                </p>
              </div>
            </div>
            {onOpenChallengeFile && (
              <button
                type="button"
                onClick={onOpenChallengeFile}
                data-testid="problem-open-challenge-file"
                className={`w-full py-1.5 px-2.5 rounded-md inline-flex items-center justify-center gap-1.5 text-xs font-semibold border transition-colors ${
                  isDarkMode
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-200 hover:bg-amber-500/30'
                    : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Open Challenge File</span>
              </button>
            )}
          </div>
        )}

        {/* Language Switcher for Starter Templates */}
        {availableLanguages.length > 0 && (
          <div
            className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
              isDarkMode
                ? 'bg-[#14161c] border-[#222530]'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <label
              htmlFor="problem-lang-select"
              className={`text-xs font-medium ${
                isDarkMode ? 'text-gray-300' : 'text-slate-700'
              }`}
            >
              Template Language
            </label>
            <select
              id="problem-lang-select"
              value={availableLanguages.includes(currentLanguageId) ? currentLanguageId : availableLanguages[0]}
              onChange={(e) => onSelectLanguage(e.target.value)}
              data-testid="problem-language-select"
              className={`h-7 px-2 rounded text-xs font-mono border focus:outline-none focus:border-[#ff9100] ${
                isDarkMode
                  ? 'bg-[#101114] border-[#2b2e3d] text-[#ff9100]'
                  : 'bg-white border-slate-300 text-slate-800'
              }`}
            >
              {availableLanguages.map((langId) => {
                const cfg = getLanguageConfig(langId);
                return (
                  <option
                    key={langId}
                    value={langId}
                    className={isDarkMode ? 'bg-[#14151b] text-gray-200' : 'bg-white text-slate-800'}
                  >
                    {cfg?.name || langId}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Problem Description */}
        <div
          className={`text-xs leading-relaxed whitespace-pre-line ${
            isDarkMode ? 'text-gray-300' : 'text-slate-700'
          }`}
        >
          {challenge.description}
        </div>

        {/* Examples */}
        {challenge.examples.length > 0 && (
          <div className="space-y-2.5">
            <h3
              className={`font-heading font-semibold text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}
            >
              Examples
            </h3>
            {challenge.examples.map((ex, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 border text-xs font-mono space-y-1.5 ${
                  isDarkMode
                    ? 'bg-[#14161c] border-[#222530]'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className={`text-[10px] font-sans font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  Example {idx + 1}
                </div>
                <div>
                  <span className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>Input: </span>
                  <pre className="whitespace-pre-wrap break-words mt-0.5">{ex.input}</pre>
                </div>
                <div>
                  <span className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>Output: </span>
                  <pre className={`whitespace-pre-wrap break-words mt-0.5 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{ex.output}</pre>
                </div>
                {ex.explanation && (
                  <p className={`text-[11px] font-sans pt-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                    {ex.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Constraints */}
        {challenge.constraints.length > 0 && (
          <div className="space-y-1.5">
            <h3
              className={`font-heading font-semibold text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}
            >
              Constraints
            </h3>
            <ul className="space-y-1">
              {challenge.constraints.map((c, idx) => (
                <li
                  key={idx}
                  className={`text-xs font-mono flex items-start gap-2 ${
                    isDarkMode ? 'text-gray-300' : 'text-slate-700'
                  }`}
                >
                  <span className="text-[#ff9100]">-</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Collapsible Hints */}
        {challenge.hints.length > 0 && (
          <div className="space-y-2">
            <h3
              className={`font-heading font-semibold text-xs uppercase tracking-wider ${
                isDarkMode ? 'text-gray-400' : 'text-slate-500'
              }`}
            >
              Hints
            </h3>
            {challenge.hints.map((hint, idx) => {
              const isOpen = Boolean(openHints[idx]);
              return (
                <div
                  key={idx}
                  className={`rounded-lg border overflow-hidden ${
                    isDarkMode
                      ? 'bg-[#14161c] border-[#222530]'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleHint(idx)}
                    className={`w-full px-3 py-2 flex items-center justify-between text-xs font-medium transition-colors ${
                      isDarkMode ? 'text-gray-200 hover:bg-[#1a1c24]' : 'text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-[#ff9100]" />
                      <span>Hint {idx + 1}</span>
                    </span>
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {isOpen && (
                    <div
                      className={`px-3 pb-2.5 pt-1 text-xs border-t ${
                        isDarkMode
                          ? 'border-[#222530] text-gray-300'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {hint}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Run Tests Bar */}
      <div
        className={`p-3 border-t flex items-center gap-2 shrink-0 ${
          isDarkMode ? 'bg-[#0d0e11] border-[#1f2024]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        {onResetCode && (
          <button
            type="button"
            onClick={onResetCode}
            disabled={isRunningTests}
            title="Restore starter code template"
            data-testid="problem-reset-code"
            className={`h-9 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-medium border transition-colors ${
              isDarkMode
                ? 'bg-[#161820] border-[#262936] text-gray-300 hover:text-white hover:border-[#393d50]'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
        {(() => {
          const effectiveTestCount = activeTestCasesCount ?? challenge.testCases.length;
          const hasNoTests = effectiveTestCount === 0;
          const isDisabled = isRunningTests || hasNoTests;
          return (
            <button
              type="button"
              onClick={onRunTests}
              disabled={isDisabled}
              title={
                hasNoTests
                  ? 'No active test cases. Add a test case or click Reset to restore challenge tests.'
                  : 'Run all active test cases'
              }
              data-testid="problem-run-tests"
              className={`flex-1 h-9 rounded-lg flex items-center justify-center gap-1.5 text-xs font-heading font-bold transition-colors ${
                isDisabled
                  ? isDarkMode
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-[#ff9100] hover:bg-[#ffa326] text-slate-950 shadow-sm'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isRunningTests
                  ? 'Running Tests...'
                  : hasNoTests
                    ? 'No Test Cases (0)'
                    : `Run Tests (${effectiveTestCount})`}
              </span>
            </button>
          );
        })()}
      </div>
    </aside>
  );
};
