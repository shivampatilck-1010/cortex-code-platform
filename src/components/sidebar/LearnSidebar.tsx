'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Circle,
  Code2,
  Play,
  RotateCcw,
  Square,
  X,
  XCircle,
} from 'lucide-react';
import type { Course, LabLesson, NotesLesson } from '@/types/learn';
import { findLessonInCourse, getCourseByIdOrSlug } from '@/data/courses';
import { useLearnProgress } from '@/hooks/useLearnProgress';
import { resolveLabTestCases } from '@/lib/execution/lab-runner';
import type { TestCase } from '@/lib/execution/types';

export interface ActiveLearnSnippetContext {
  code: string;
  language: string;
  filename: string;
  courseId?: string;
  lessonId?: string;
}

export interface LearnSidebarProps {
  width?: number;
  currentLanguage?: string;
  isDarkMode?: boolean;
  onLoadLesson?: (code: string, language: string, title: string, filename?: string) => void;
  onClose?: () => void;
  activeCourseId?: string | null;
  activeLessonId?: string | null;
  activeLabFileName?: string | null;
  activeSnippet?: ActiveLearnSnippetContext | null;
  labTestCases?: TestCase[];
  isRunningTests?: boolean;
  onRunLabTests?: () => void;
  onLoadStarterCode?: (lab: LabLesson, course: Course) => void;
  onClearLearnContext?: () => void;
}

function findMatchingNotesSnippet(
  notes: NotesLesson,
  filename?: string | null
): { code: string; language: string; filename: string } | null {
  if (!filename) return null;
  const target = filename.trim().toLowerCase();
  for (const sec of notes.sections) {
    if (sec.codeBlock && sec.codeBlock.filename.trim().toLowerCase() === target) {
      return {
        code: sec.codeBlock.code,
        language: sec.codeBlock.language,
        filename: sec.codeBlock.filename,
      };
    }
  }
  return null;
}

export const LearnSidebar: React.FC<LearnSidebarProps> = ({
  width = 250,
  currentLanguage = 'python',
  isDarkMode = true,
  onLoadLesson,
  onClose,
  activeCourseId = null,
  activeLessonId = null,
  activeLabFileName = null,
  activeSnippet = null,
  labTestCases,
  isRunningTests = false,
  onRunLabTests,
  onLoadStarterCode,
  onClearLearnContext,
}) => {
  const {
    hydrated,
    isItemCompleted,
    markItemCompleted,
    toggleLabStep,
    getLabCheckedSteps,
  } = useLearnProgress();

  const [starterFeedback, setStarterFeedback] = useState<string | null>(null);

  const effectiveCourseId = activeCourseId || activeSnippet?.courseId || null;
  const effectiveLessonId = activeLessonId || activeSnippet?.lessonId || null;

  const resolvedCourse = useMemo(
    () => (effectiveCourseId ? getCourseByIdOrSlug(effectiveCourseId) : undefined),
    [effectiveCourseId]
  );

  const resolvedLesson = useMemo(
    () =>
      resolvedCourse && effectiveLessonId
        ? findLessonInCourse(resolvedCourse, effectiveLessonId)
        : undefined,
    [resolvedCourse, effectiveLessonId]
  );

  const activeLab: LabLesson | null =
    !activeSnippet && resolvedLesson?.item.type === 'lab'
      ? resolvedLesson.item
      : null;

  const activeNotes: NotesLesson | null =
    resolvedLesson?.item.type === 'notes' ? resolvedLesson.item : null;

  const isSnippetMode = Boolean(activeSnippet) || (!activeLab && Boolean(activeNotes));

  const resolvedTestCases = useMemo<TestCase[]>(() => {
    if (!activeLab) return [];
    if (Array.isArray(labTestCases) && labTestCases.length > 0) {
      return labTestCases;
    }
    return resolveLabTestCases(activeLab);
  }, [activeLab, labTestCases]);

  const rootStyle = width
    ? { width: `${width}px`, minWidth: `${width}px` }
    : undefined;

  const rootThemeClass = isDarkMode
    ? 'dark bg-[#0F0F12] text-zinc-200'
    : 'bg-[#F8F8FA] text-zinc-800';

  const triggerFeedback = (msg: string) => {
    setStarterFeedback(msg);
    window.setTimeout(() => {
      setStarterFeedback((cur) => (cur === msg ? null : cur));
    }, 1800);
  };

  // Mode 1: Active Lab Companion
  if (activeLab && resolvedCourse) {
    const isCompleted = hydrated && isItemCompleted(activeLab.id);
    const checkedSteps = hydrated ? getLabCheckedSteps(activeLab.id) : [];
    const passedCount = resolvedTestCases.filter((tc) => tc.passed === true).length;
    const allTestsPassed =
      resolvedTestCases.length > 0 && passedCount === resolvedTestCases.length;
    const returnCourseHref = `/learn/${resolvedCourse.slug}?lesson=${encodeURIComponent(activeLab.id)}`;

    return (
      <div
        data-testid="learn-sidebar"
        style={rootStyle}
        className={`${rootThemeClass} h-full w-full flex flex-col select-none text-xs overflow-hidden`}
      >
        <div
          data-testid="learn-companion-lab"
          className="h-full flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="h-[34px] px-3 border-b border-black/[0.08] dark:border-white/[0.07] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Code2 className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                Lab Companion
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onClearLearnContext && (
                <button
                  type="button"
                  onClick={onClearLearnContext}
                  title="Exit Lab Companion"
                  className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {onClose && !onClearLearnContext && (
                <button
                  type="button"
                  onClick={onClose}
                  title="Close Sidebar"
                  className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Course & Lesson Meta */}
            <div className="space-y-1.5">
              <div className="text-[10.5px] font-mono text-zinc-500 truncate">
                {resolvedCourse.title}
              </div>
              <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                {activeLab.title}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {activeLabFileName && (
                  <span
                    data-testid="learn-lab-file-badge"
                    className="px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] font-mono text-[10px] text-zinc-700 dark:text-zinc-300 truncate max-w-full"
                  >
                    {activeLabFileName}
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.04] font-mono text-[10px] uppercase text-zinc-500">
                  {activeLab.language} · ~{activeLab.estimatedMins}m
                </span>
                {isCompleted && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>Completed</span>
                  </span>
                )}
              </div>
            </div>

            {/* Objective Summary */}
            <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.07] bg-white dark:bg-[#16161A] p-2.5 space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Objective
              </div>
              <p className="text-[11.5px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                {activeLab.objective}
              </p>
            </div>

            {/* Primary Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="learn-load-starter-btn"
                onClick={() => {
                  if (onLoadStarterCode) {
                    onLoadStarterCode(activeLab, resolvedCourse);
                  } else if (onLoadLesson) {
                    onLoadLesson(
                      activeLab.starterCode,
                      activeLab.language,
                      activeLab.title,
                      activeLabFileName || undefined
                    );
                  }
                  triggerFeedback('Starter code loaded');
                }}
                className="flex-1 min-w-[110px] h-8 px-2.5 rounded-md border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-[#1C1C21] hover:border-black/20 dark:hover:border-white/20 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                {starterFeedback ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">Loaded</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">Load Starter Code</span>
                  </>
                )}
              </button>

              {resolvedTestCases.length > 0 && onRunLabTests && (
                <button
                  type="button"
                  data-testid="learn-run-tests-btn"
                  disabled={isRunningTests}
                  onClick={onRunLabTests}
                  className="h-8 px-3 rounded-md border border-black/15 dark:border-white/[0.12] bg-zinc-900 dark:bg-[#222227] hover:border-amber-500/50 hover:text-amber-400 disabled:opacity-50 text-[11px] font-medium text-zinc-100 inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Play className="w-3 h-3 text-[#F59E0B] shrink-0" />
                  <span>{isRunningTests ? 'Running...' : 'Run Tests'}</span>
                </button>
              )}
            </div>

            {/* Live Test-Case Checklist */}
            {resolvedTestCases.length > 0 && (
              <div
                data-testid="learn-lab-test-cases"
                className="rounded-lg border border-black/[0.08] dark:border-white/[0.07] bg-white dark:bg-[#16161A] p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Test Cases
                  </span>
                  <span
                    className={`text-[10.5px] font-mono ${
                      allTestsPassed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {passedCount}/{resolvedTestCases.length} passed
                  </span>
                </div>

                <div className="space-y-1.5">
                  {resolvedTestCases.map((tc, idx) => {
                    const isPassed = tc.passed === true;
                    const isFailed = tc.passed === false;
                    return (
                      <div
                        key={tc.id || `tc-${idx}`}
                        className={`rounded-md border px-2 py-1.5 text-[11px] space-y-0.5 ${
                          isPassed
                            ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                            : isFailed
                              ? 'border-rose-500/30 bg-rose-500/[0.06]'
                              : 'border-black/[0.06] dark:border-white/[0.06] bg-zinc-50/70 dark:bg-[#121216]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {isPassed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : isFailed ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600 shrink-0" />
                          )}
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                            {tc.name || `Case ${idx + 1}`}
                          </span>
                        </div>
                        <div className="pl-5 text-[10px] font-mono text-zinc-500 truncate">
                          {tc.isHidden
                            ? 'Hidden verification case'
                            : `Expected: ${tc.expectedStdout.replace(/\n/g, ' | ')}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step-by-Step Checklist */}
            {activeLab.steps.length > 0 && (
              <div
                data-testid="learn-lab-steps"
                className="rounded-lg border border-black/[0.08] dark:border-white/[0.07] bg-white dark:bg-[#16161A] p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Lab Checklist
                  </span>
                  <span className="text-[10.5px] font-mono text-zinc-500">
                    {checkedSteps.length}/{activeLab.steps.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {activeLab.steps.map((step, idx) => {
                    const checked = checkedSteps.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          toggleLabStep(resolvedCourse.id, activeLab.id, idx)
                        }
                        className="w-full flex items-start gap-2 text-left rounded-md px-1.5 py-1 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                      >
                        {checked ? (
                          <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                        )}
                        <span
                          className={`text-[11px] leading-snug ${
                            checked
                              ? 'line-through text-zinc-400 dark:text-zinc-500'
                              : 'text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {step}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual Completion Toggle */}
            <button
              type="button"
              data-testid="learn-mark-complete-btn"
              onClick={() =>
                markItemCompleted(resolvedCourse.id, activeLab.id, !isCompleted)
              }
              className={`w-full h-8 px-3 rounded-md border text-[11px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                isCompleted
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-black/[0.09] dark:border-white/[0.09] bg-transparent text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isCompleted ? 'Completed' : 'Mark Lab Complete'}</span>
            </button>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-black/[0.08] dark:border-white/[0.07] shrink-0 space-y-1.5">
            <Link
              href={returnCourseHref}
              data-testid="learn-return-to-course"
              className="w-full h-8 px-3 rounded-md border border-black/[0.1] dark:border-white/[0.1] bg-zinc-900 dark:bg-[#222227] text-zinc-100 hover:border-amber-500/40 hover:text-amber-400 text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>← Return to Course</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Mode 2: Active Notes Snippet Mode
  if (isSnippetMode) {
    const snippetFilename =
      activeSnippet?.filename || activeLabFileName || 'snippet';
    const snippetLanguage =
      activeSnippet?.language || currentLanguage || 'python';
    const fallbackNotesBlock =
      !activeSnippet?.code && activeNotes
        ? findMatchingNotesSnippet(activeNotes, snippetFilename)
        : null;
    const reloadableCode = activeSnippet?.code || fallbackNotesBlock?.code || '';
    const reloadableLang =
      activeSnippet?.language || fallbackNotesBlock?.language || snippetLanguage;
    const reloadableFilename =
      activeSnippet?.filename || fallbackNotesBlock?.filename || snippetFilename;

    const returnHref =
      resolvedCourse && resolvedLesson
        ? `/learn/${resolvedCourse.slug}?lesson=${encodeURIComponent(resolvedLesson.item.id)}`
        : resolvedCourse
          ? `/learn/${resolvedCourse.slug}`
          : '/learn';

    return (
      <div
        data-testid="learn-sidebar"
        style={rootStyle}
        className={`${rootThemeClass} h-full w-full flex flex-col select-none text-xs overflow-hidden`}
      >
        <div
          data-testid="learn-companion-snippet"
          className="h-full flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="h-[34px] px-3 border-b border-black/[0.08] dark:border-white/[0.07] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              <span className="font-semibold uppercase tracking-wider text-[11px] text-zinc-700 dark:text-zinc-300 truncate">
                Notes Snippet
              </span>
            </div>
            {onClearLearnContext && (
              <button
                type="button"
                onClick={onClearLearnContext}
                title="Exit Snippet View"
                className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            <div className="space-y-1">
              <div className="text-[10.5px] font-mono text-zinc-500 truncate">
                {resolvedCourse ? resolvedCourse.title : 'Cortex Learn'}
              </div>
              <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                {resolvedLesson ? resolvedLesson.item.title : 'Reading Example'}
              </h3>
            </div>

            <div className="rounded-lg border border-black/[0.08] dark:border-white/[0.07] bg-white dark:bg-[#16161A] p-2.5 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Active Snippet
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] font-mono text-[10.5px] text-zinc-800 dark:text-zinc-200 truncate max-w-full">
                  {snippetFilename}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.04] font-mono text-[10px] uppercase text-zinc-500">
                  {snippetLanguage}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Loaded from reading notes. Edit and execute this file directly in the workspace.
              </p>
            </div>

            {reloadableCode && onLoadLesson && (
              <button
                type="button"
                data-testid="learn-reload-snippet-btn"
                onClick={() => {
                  onLoadLesson(
                    reloadableCode,
                    reloadableLang,
                    reloadableFilename,
                    reloadableFilename
                  );
                  triggerFeedback('Snippet reloaded');
                }}
                className="w-full h-8 px-3 rounded-md border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-[#1C1C21] hover:border-black/20 dark:hover:border-white/20 text-[11px] font-medium text-zinc-800 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                {starterFeedback ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Reloaded</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span>Reload Snippet</span>
                  </>
                )}
              </button>
            )}

            {onClearLearnContext ? (
              <button
                type="button"
                data-testid="learn-clear-context-btn"
                onClick={onClearLearnContext}
                className="w-full h-8 px-3 rounded-md border border-black/[0.08] dark:border-white/[0.07] text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] inline-flex items-center justify-center transition-colors"
              >
                Exit Snippet View
              </button>
            ) : (
              <Link
                href="/learn"
                className="w-full h-8 px-3 rounded-md border border-black/[0.08] dark:border-white/[0.07] text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] inline-flex items-center justify-center transition-colors"
              >
                Browse All Courses
              </Link>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-black/[0.08] dark:border-white/[0.07] shrink-0">
            <Link
              href={returnHref}
              data-testid="learn-return-to-course"
              className="w-full h-8 px-3 rounded-md border border-black/[0.1] dark:border-white/[0.1] bg-zinc-900 dark:bg-[#222227] text-zinc-100 hover:border-amber-500/40 hover:text-amber-400 text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>← Return to Course</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No active lab or snippet: never show the legacy Reference card list
  return null;
};
