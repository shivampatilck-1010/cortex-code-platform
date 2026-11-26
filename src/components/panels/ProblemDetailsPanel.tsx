'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  FileCode2,
  FileText,
  History,
  Lightbulb,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  Sparkles,
  Tag,
} from 'lucide-react';
import { Challenge } from '@/lib/challenges/challenges-data';

export type ProblemPanelTab = 'description' | 'hints' | 'solutions' | 'submissions';

export interface PracticeSubmissionRecord {
  id: string;
  challengeId: string;
  status: 'Accepted' | 'Wrong Answer' | 'Runtime Error';
  runtime: string;
  language: string;
  passedCount: number;
  totalCount: number;
  timestamp: number;
  code?: string;
}

export interface ProblemDetailsPanelProps {
  challenge: Challenge;
  problemNumber?: number;
  isDarkMode: boolean;
  status?: 'solved' | 'attempted' | 'unsolved';
  submissions?: PracticeSubmissionRecord[];
  isChallengeFileActive?: boolean;
  activeFileName?: string | null;
  activeTestCasesCount?: number;
  onOpenChallengeFile?: () => void;
  onLoadSubmissionCode?: (code: string, language: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClosePanel?: () => void;
}

const DIFFICULTY_CLASS: Record<Challenge['difficulty'], string> = {
  Easy: 'text-emerald-600 dark:text-emerald-400',
  Medium: 'text-amber-600 dark:text-amber-400',
  Hard: 'text-rose-600 dark:text-rose-400',
};

const INLINE_CODE_PILL =
  'font-mono text-[12px] px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-white/[0.07] border border-black/[0.06] dark:border-white/[0.08] text-zinc-900 dark:text-zinc-100';

/**
 * Parses inline markdown code backticks (`var`) and bold markers (**text**)
 * into styled inline JSX nodes without leaving literal backtick characters.
 */
function renderInlineSegments(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      parts.push(
        <code key={`${keyPrefix}-code-${idx++}`} className={INLINE_CODE_PILL}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      parts.push(
        <strong key={`${keyPrefix}-b-${idx++}`} className="font-semibold text-zinc-900 dark:text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderFormattedProse(description: string): React.ReactNode {
  const paragraphs = description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs.map((paragraph, pIdx) => {
    const lines = paragraph.split('\n');
    return (
      <p key={`p-${pIdx}`}>
        {lines.map((line, lIdx) => (
          <React.Fragment key={`l-${pIdx}-${lIdx}`}>
            {lIdx > 0 && <br />}
            {renderInlineSegments(line, `p-${pIdx}-${lIdx}`)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

/**
 * Compact left workspace card providing Description, progressive Hints,
 * Solutions overview, and Submissions history with zero duplicate controls.
 */
export const ProblemDetailsPanel: React.FC<ProblemDetailsPanelProps> = ({
  challenge,
  problemNumber,
  isDarkMode,
  status = 'unsolved',
  submissions = [],
  isChallengeFileActive = true,
  activeFileName,
  onOpenChallengeFile,
  onLoadSubmissionCode,
  isMaximized = false,
  onToggleMaximize,
  onClosePanel,
}) => {
  const [leftTab, setLeftTab] = useState<ProblemPanelTab>('description');
  const [showTopics, setShowTopics] = useState(false);
  const [showCompanies, setShowCompanies] = useState(false);
  const [revealedHintsCount, setRevealedHintsCount] = useState(0);
  const [copiedExampleIdx, setCopiedExampleIdx] = useState<number | null>(null);
  const [copiedConstraints, setCopiedConstraints] = useState(false);

  useEffect(() => {
    setLeftTab('description');
    setShowTopics(false);
    setShowCompanies(false);
    setRevealedHintsCount(0);
    setCopiedExampleIdx(null);
    setCopiedConstraints(false);
  }, [challenge.id]);

  const handleCopyText = (text: string, idx: number | 'constraints') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    if (idx === 'constraints') {
      setCopiedConstraints(true);
      setTimeout(() => setCopiedConstraints(false), 1400);
    } else {
      setCopiedExampleIdx(idx);
      setTimeout(() => setCopiedExampleIdx(null), 1400);
    }
  };

  const acceptedSubmission = submissions.find((s) => s.status === 'Accepted' && s.code);

  return (
    <section
      data-testid="problem-details-panel"
      aria-label="Active Problem Details"
      className={`${
        isDarkMode ? 'dark' : ''
      } h-full w-full min-w-0 flex flex-col rounded-[10px] bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.08] overflow-hidden`}
    >
      {/* 36px Panel Header */}
      <div className="h-9 shrink-0 px-2 bg-[#F7F7F8] dark:bg-[#262629] border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'description', label: 'Description', icon: FileText },
            { id: 'hints', label: 'Hints', icon: Lightbulb },
            { id: 'solutions', label: 'Solutions', icon: Sparkles },
            { id: 'submissions', label: 'Submissions', icon: History },
          ].map(({ id, label, icon: Icon }) => {
            const active = leftTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setLeftTab(id as ProblemPanelTab)}
                data-testid={`problem-tab-${id}`}
                className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'text-zinc-950 dark:text-zinc-100 bg-black/[0.05] dark:bg-white/[0.07]'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-500' : 'opacity-70'}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {onToggleMaximize && (
            <button
              type="button"
              onClick={onToggleMaximize}
              title={isMaximized ? 'Restore panel' : 'Maximize panel'}
              aria-label={isMaximized ? 'Restore problem panel' : 'Maximize problem panel'}
              data-testid="problem-maximize-panel"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
            >
              {isMaximized ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          {onClosePanel && (
            <button
              type="button"
              onClick={onClosePanel}
              title="Collapse problem panel"
              aria-label="Collapse problem panel"
              data-testid="problem-close-panel"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {leftTab === 'description' && (
          <>
            {/* Title + Compact Metadata Row */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {problemNumber ? `${problemNumber}. ` : ''}
                  {challenge.title}
                </h1>
                {status === 'solved' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Solved</span>
                  </span>
                ) : status === 'attempted' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Attempted</span>
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                <span
                  className={`px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] font-medium ${DIFFICULTY_CLASS[challenge.difficulty]}`}
                >
                  {challenge.difficulty}
                </span>

                {challenge.tags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTopics((v) => !v)}
                    aria-expanded={showTopics}
                    data-testid="problem-toggle-topics"
                    className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 transition-colors ${
                      showTopics
                        ? 'bg-black/[0.09] dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    <Tag className="w-3 h-3 opacity-75" />
                    <span>Topics</span>
                  </button>
                )}

                {challenge.companyTags.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCompanies((v) => !v)}
                    aria-expanded={showCompanies}
                    data-testid="problem-toggle-companies"
                    className={`px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 transition-colors ${
                      showCompanies
                        ? 'bg-black/[0.09] dark:bg-white/[0.12] text-zinc-900 dark:text-zinc-100'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    <Building2 className="w-3 h-3 opacity-75" />
                    <span>Companies</span>
                  </button>
                )}

                {challenge.acceptanceRate && (
                  <span className="ml-auto text-[11px] font-mono text-zinc-500">
                    Acceptance: {challenge.acceptanceRate}
                  </span>
                )}
              </div>

              {/* Collapsible Topics */}
              {showTopics && challenge.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1" data-testid="problem-topics-list">
                  {challenge.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-white/[0.05] text-zinc-600 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Collapsible Companies */}
              {showCompanies && challenge.companyTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1" data-testid="problem-companies-list">
                  {challenge.companyTags.map((company) => (
                    <span
                      key={company}
                      className="px-2 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-white/[0.05] text-zinc-600 dark:text-zinc-400"
                    >
                      {company}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Active Tab Mismatch Notice (only shown if user switched to another project file) */}
            {!isChallengeFileActive && onOpenChallengeFile && (
              <div
                data-testid="problem-tab-mismatch-notice"
                className="px-3 py-2 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-between gap-2 text-[12px]"
              >
                <div className="flex items-center gap-2 min-w-0 text-zinc-700 dark:text-zinc-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">
                    {activeFileName ? `Editing ${activeFileName}` : 'Challenge file not active'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenChallengeFile}
                  data-testid="problem-open-challenge-file"
                  className="shrink-0 px-2 py-1 rounded text-[11.5px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 inline-flex items-center gap-1 transition-colors"
                >
                  <FileCode2 className="w-3 h-3" />
                  <span>Open Solution</span>
                </button>
              </div>
            )}

            {/* Problem Prose */}
            <div
              data-testid="problem-description-prose"
              className="text-[13.5px] leading-[1.65] text-zinc-700 dark:text-zinc-300 space-y-3"
            >
              {renderFormattedProse(challenge.description)}
            </div>

            {/* Examples */}
            {challenge.examples.length > 0 && (
              <div className="space-y-3.5 pt-1">
                {challenge.examples.map((ex, i) => {
                  const copyPayload = `Input: ${ex.input}\nOutput: ${ex.output}${
                    ex.explanation ? `\nExplanation: ${ex.explanation}` : ''
                  }`;
                  const isCopied = copiedExampleIdx === i;
                  return (
                    <div key={i} className="group/ex space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200">
                          Example {i + 1}:
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(copyPayload, i)}
                          title="Copy example"
                          aria-label={`Copy Example ${i + 1}`}
                          className="h-6 px-1.5 rounded text-[11px] inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 opacity-0 group-hover/ex:opacity-100 focus:opacity-100 transition-opacity"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="border-l-2 border-zinc-300 dark:border-white/15 pl-3 py-0.5 font-mono text-[12px] leading-[1.6] space-y-0.5">
                        <div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Input: </span>
                          <span className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words">
                            {ex.input}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Output: </span>
                          <span className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words">
                            {ex.output}
                          </span>
                        </div>
                        {ex.explanation && (
                          <div>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              Explanation:{' '}
                            </span>
                            <span className="font-sans text-[12.5px] text-zinc-600 dark:text-zinc-400">
                              {renderInlineSegments(ex.explanation, `ex-${i}`)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Constraints */}
            {challenge.constraints.length > 0 && (
              <div className="group/constraints space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-[12.5px] font-semibold text-zinc-800 dark:text-zinc-200">
                    Constraints:
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyText(challenge.constraints.join('\n'), 'constraints')}
                    title="Copy constraints"
                    aria-label="Copy constraints"
                    className="h-6 px-1.5 rounded text-[11px] inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 opacity-0 group-hover/constraints:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    {copiedConstraints ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <ul className="border-l-2 border-zinc-300 dark:border-white/15 pl-3 py-0.5 space-y-1 text-[12px] font-mono text-zinc-600 dark:text-zinc-400">
                  {challenge.constraints.map((c, idx) => (
                    <li key={idx} className="leading-[1.55]">
                      {renderInlineSegments(c, `constraint-${idx}`)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Progressive-Reveal Hints Tab */}
        {leftTab === 'hints' && (
          <div className="space-y-3 text-[13px] text-zinc-600 dark:text-zinc-300">
            {challenge.hints.length === 0 ? (
              <p className="text-zinc-500 py-8 text-center text-[12.5px]">
                No hints available for this problem.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-zinc-500">
                    {revealedHintsCount} of {challenge.hints.length} hints revealed
                  </span>
                  {revealedHintsCount < challenge.hints.length && (
                    <button
                      type="button"
                      onClick={() => setRevealedHintsCount((prev) => prev + 1)}
                      data-testid="problem-reveal-hint"
                      className="h-7 px-2.5 rounded-md font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/15 inline-flex items-center gap-1 transition-colors"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Reveal Hint {revealedHintsCount + 1}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {challenge.hints.slice(0, revealedHintsCount).map((hint, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-black/[0.07] dark:border-white/[0.07] bg-black/[0.02] dark:bg-white/[0.02] px-3.5 py-2.5 space-y-1"
                    >
                      <div className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                        <span>Hint {idx + 1}</span>
                      </div>
                      <p className="text-[13px] leading-[1.6] text-zinc-600 dark:text-zinc-400">
                        {renderInlineSegments(hint, `hint-${idx}`)}
                      </p>
                    </div>
                  ))}

                  {challenge.hints.slice(revealedHintsCount).map((_, offsetIdx) => {
                    const realIdx = revealedHintsCount + offsetIdx;
                    return (
                      <button
                        key={realIdx}
                        type="button"
                        disabled={offsetIdx > 0}
                        onClick={() => setRevealedHintsCount(realIdx + 1)}
                        className="w-full rounded-lg border border-black/[0.06] dark:border-white/[0.06] px-3.5 py-2.5 flex items-center justify-between text-[12px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <ChevronRight className="w-3.5 h-3.5" />
                          <span>Hint {realIdx + 1}</span>
                        </span>
                        <span className="text-[11px] font-mono">
                          {offsetIdx === 0 ? 'Click to reveal' : 'Locked'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Solutions / Approach Tab */}
        {leftTab === 'solutions' && (
          <div className="space-y-4 text-[13px] text-zinc-700 dark:text-zinc-300">
            <div className="space-y-1.5">
              <div className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                Approach Overview
              </div>
              <p className="text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Track: <span className="font-medium text-zinc-800 dark:text-zinc-200">{challenge.track}</span>
                {' · '}
                Category: <span className="font-medium text-zinc-800 dark:text-zinc-200">{challenge.category}</span>
              </p>
              {challenge.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {challenge.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[11px] bg-zinc-100 dark:bg-white/[0.05] text-zinc-600 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {challenge.hints.length > 0 && (
              <div className="space-y-2">
                <div className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                  Key Steps
                </div>
                <ol className="space-y-2 border-l-2 border-zinc-300 dark:border-white/15 pl-3 text-[12.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {challenge.hints.map((hint, i) => (
                    <li key={i}>{renderInlineSegments(hint, `sol-hint-${i}`)}</li>
                  ))}
                </ol>
              </div>
            )}

            {acceptedSubmission?.code ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Your Accepted Submission ({acceptedSubmission.language})
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {acceptedSubmission.runtime}
                  </span>
                </div>
                <pre className="p-3 rounded-lg bg-zinc-100 dark:bg-[#262629] border border-black/[0.06] dark:border-white/[0.07] font-mono text-[12px] leading-[1.55] overflow-x-auto text-zinc-800 dark:text-zinc-200">
                  {acceptedSubmission.code}
                </pre>
              </div>
            ) : (
              <p className="text-[12px] text-zinc-500 border-t border-black/[0.06] dark:border-white/[0.06] pt-3">
                Submit a passing solution to save and inspect your Accepted code here.
              </p>
            )}
          </div>
        )}

        {/* Submissions Tab */}
        {leftTab === 'submissions' && (
          <div className="text-[12px] space-y-1.5">
            {submissions.length > 0 ? (
              submissions.map((sub) => (
                <div
                  key={sub.id}
                  data-testid={`submission-row-${sub.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-medium shrink-0 ${
                        sub.status === 'Accepted'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {sub.status}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500 truncate">
                      {sub.passedCount}/{sub.totalCount} cases
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-zinc-500">{sub.runtime}</span>
                    <span className="text-zinc-500">{sub.language}</span>
                    {sub.code && onLoadSubmissionCode && (
                      <button
                        type="button"
                        onClick={() => onLoadSubmissionCode(sub.code!, sub.language)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 underline underline-offset-2"
                      >
                        Load
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-zinc-500 py-8 text-center">No submissions yet.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
