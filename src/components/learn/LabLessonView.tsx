'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  Play,
  RotateCcw,
  Square,
  XCircle,
} from 'lucide-react';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { getLanguageConfig } from '@/config/languages';
import { evaluateLabTestCases, resolveLabTestCases } from '@/lib/execution/lab-runner';
import type { ProjectFile, TestCase } from '@/lib/execution/types';
import type { LabLesson } from '@/types/learn';

interface LabLessonViewProps {
  courseId: string;
  lesson: LabLesson;
  isCompleted: boolean;
  checkedSteps: number[];
  hasNext: boolean;
  isDarkMode: boolean;
  onToggleStep: (stepIndex: number) => void;
  onMarkCompleted: () => void;
  onNextItem: () => void;
}

export const LabLessonView: React.FC<LabLessonViewProps> = ({
  courseId,
  lesson,
  isCompleted,
  checkedSteps,
  hasNext,
  isDarkMode,
  onToggleStep,
  onMarkCompleted,
  onNextItem,
}) => {
  const langConfig = useMemo(() => getLanguageConfig(lesson.language || 'python'), [lesson.language]);
  const labFileName = useMemo(() => {
    if (lesson.language === 'sql' && lesson.id === 'sql-m1-lab') return 'query.sql';
    return `${lesson.ideProblemId || lesson.id}${langConfig.fileExtension}`;
  }, [lesson.id, lesson.ideProblemId, lesson.language, langConfig.fileExtension]);

  const storageKey = `cortex_learn_lab_code_${lesson.id}`;
  const [code, setCode] = useState<string>(lesson.starterCode);
  const [testCases, setTestCases] = useState<TestCase[]>(() => resolveLabTestCases(lesson));
  const [isRunning, setIsRunning] = useState(false);
  const [hasExecutedOnce, setHasExecutedOnce] = useState(false);

  // Restore saved edits per lab lesson
  useEffect(() => {
    setHasExecutedOnce(false);
    setTestCases(resolveLabTestCases(lesson));
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem(`cortex_learn_lab_code_${lesson.id}`);
        setCode(saved && saved.trim().length > 0 ? saved : lesson.starterCode);
        return;
      } catch {
        // Ignore storage errors
      }
    }
    setCode(lesson.starterCode);
  }, [lesson]);

  const handleCodeChange = (nextCode: string) => {
    setCode(nextCode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, nextCode);
      } catch {
        // Ignore storage quota errors
      }
    }
  };

  const handleReset = () => {
    setCode(lesson.starterCode);
    setTestCases(resolveLabTestCases(lesson));
    setHasExecutedOnce(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const handleRunTests = async () => {
    if (isRunning || testCases.length === 0) return;
    setIsRunning(true);
    try {
      const res = await evaluateLabTestCases({
        language: lesson.language,
        code,
        filename: labFileName,
        testCases,
      });
      setTestCases(res.testCases);
      setHasExecutedOnce(true);
      if (res.totalCount > 0 && res.passedCount === res.totalCount) {
        onMarkCompleted();
      }
    } finally {
      setIsRunning(false);
    }
  };

  const labFile: ProjectFile[] = useMemo(
    () => [
      {
        id: `lab-file-${lesson.id}`,
        name: labFileName,
        path: `/${labFileName}`,
        content: code,
        isFolder: false,
      },
    ],
    [lesson.id, labFileName, code]
  );

  const passedCount = testCases.filter((tc) => tc.passed === true).length;
  const allPassed = testCases.length > 0 && passedCount === testCases.length;

  return (
    <div className="space-y-4">
      {/* Lab Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-white/[0.07] pb-4">
        <div className="space-y-1">
          <div className="text-[11.5px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
            Live IDE Coding Lab · {langConfig.name} · ~{lesson.estimatedMins}m
          </div>
          <h1 className="text-[22px] font-bold tracking-tight text-[#0F172A] dark:text-white">
            {lesson.title}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {(allPassed || isCompleted) && (
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-500 text-[12px] font-mono font-semibold inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Completed</span>
            </span>
          )}
          <Link
            href={`/ide?course=${encodeURIComponent(courseId)}&lesson=${encodeURIComponent(lesson.id)}`}
            data-testid="launch-lab-cta"
            className="h-8 px-3 rounded-lg text-[12px] font-medium bg-white dark:bg-[#22252C] border border-[#E2E8F0] dark:border-white/[0.1] hover:border-[#F3912E] text-[#0F172A] dark:text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Open in Full IDE</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </Link>
        </div>
      </div>

      {/* Split-Pane Lab Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Objective & Checkable Checklist */}
        <div className="lg:col-span-5 space-y-4 flex flex-col">
          <div className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C] p-4 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
              Objective
            </div>
            <p className="text-[13.5px] leading-relaxed text-slate-700 dark:text-zinc-300">
              {lesson.objective}
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C] p-4 space-y-3 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] dark:text-zinc-400 font-semibold">
                Step Checklist
              </span>
              <span className="text-[11.5px] font-mono text-[#64748B] dark:text-zinc-400">
                {checkedSteps.length}/{lesson.steps.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {lesson.steps.map((step, idx) => {
                const checked = checkedSteps.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onToggleStep(idx)}
                    className="w-full flex items-start gap-2.5 text-left rounded-lg px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-[#1A1D24] transition-colors"
                  >
                    {checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                    )}
                    <span
                      className={`text-[13px] leading-snug ${
                        checked
                          ? 'line-through text-slate-400 dark:text-zinc-500'
                          : 'text-[#0F172A] dark:text-zinc-200'
                      }`}
                    >
                      {step}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {(allPassed || isCompleted) && hasNext && (
            <button
              type="button"
              onClick={onNextItem}
              data-testid="lab-next-lesson-btn"
              className="h-10 px-4 rounded-lg text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Next Lesson</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Right Column: Embedded Monaco Editor + Reset / Run Tests + Test Results */}
        <div className="lg:col-span-7 rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-white/[0.08] bg-white dark:bg-[#22252C] flex flex-col min-h-[540px]">
          {/* Editor Action Toolbar */}
          <div className="h-11 px-3.5 bg-slate-100 dark:bg-[#21242B] border-b border-[#E2E8F0] dark:border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[12px] font-medium text-[#0F172A] dark:text-zinc-200 truncate">
                {labFileName}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-white/[0.07] font-mono text-[10px] uppercase text-[#64748B] dark:text-zinc-400">
                {langConfig.id}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                data-testid="lab-reset-btn"
                className="h-8 px-3 rounded-md text-[12px] font-medium bg-white dark:bg-[#1A1D24] border border-[#E2E8F0] dark:border-white/[0.1] text-[#0F172A] dark:text-zinc-200 hover:border-[#F3912E] inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                disabled={isRunning || testCases.length === 0}
                onClick={() => void handleRunTests()}
                data-testid="lab-run-tests-btn"
                className="h-8 px-3.5 rounded-md text-[12px] font-semibold bg-[#F3912E] hover:bg-[#E07D19] text-white disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isRunning ? 'Running Tests...' : 'Run Tests'}</span>
              </button>
            </div>
          </div>

          {/* Embedded Monaco Editor */}
          <div className="h-[320px] min-h-[260px] relative border-b border-[#E2E8F0] dark:border-white/[0.07]">
            <MonacoCodeEditor
              files={labFile}
              activeFileId={labFile[0].id}
              onSelectFile={() => {}}
              onCloseFile={() => {}}
              onContentChange={handleCodeChange}
              language={langConfig.monacoLang}
              theme={isDarkMode ? 'cortex-dark' : 'cortex-light'}
              fontSize={13}
              breakpoints={[]}
              onToggleBreakpoint={() => {}}
              isDarkMode={isDarkMode}
              hideChrome
              showMinimap={false}
            />
          </div>

          {/* Live Per-Case Pass/Fail Results */}
          <div className="p-3.5 bg-slate-50 dark:bg-[#1A1D24] flex-1 overflow-y-auto space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] dark:text-zinc-400 font-semibold">
                Test Cases
              </span>
              <span
                className={`text-[12px] font-mono font-semibold ${
                  allPassed
                    ? 'text-emerald-500'
                    : hasExecutedOnce
                      ? 'text-rose-500'
                      : 'text-[#64748B] dark:text-zinc-400'
                }`}
              >
                {passedCount}/{testCases.length} passed
              </span>
            </div>

            <div className="space-y-2">
              {testCases.map((tc, idx) => {
                const isPassed = tc.passed === true;
                const isFailed = tc.passed === false;
                return (
                  <div
                    key={tc.id || `lab-tc-${idx}`}
                    data-testid={`lab-test-case-${idx}`}
                    className={`rounded-lg border px-3 py-2 text-[12px] space-y-1 ${
                      isPassed
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : isFailed
                          ? 'border-rose-500/40 bg-rose-500/10'
                          : 'border-[#E2E8F0] dark:border-white/[0.07] bg-white dark:bg-[#22252C]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium text-[#0F172A] dark:text-zinc-100">
                        {isPassed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        ) : isFailed ? (
                          <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
                        )}
                        <span>{tc.name || `Test Case ${idx + 1}`}</span>
                      </div>

                      {typeof tc.timeMs === 'number' && (
                        <span className="font-mono text-[10.5px] text-[#64748B] dark:text-zinc-400">
                          {tc.timeMs}ms
                        </span>
                      )}
                    </div>

                    {!tc.isHidden && (
                      <div className="pl-5 font-mono text-[11px] text-[#64748B] dark:text-zinc-400 space-y-0.5">
                        <div className="truncate">
                          Expected: <span className="text-[#0F172A] dark:text-zinc-200">{tc.expectedStdout}</span>
                        </div>
                        {tc.actualStdout !== undefined && (
                          <div className="truncate">
                            Actual:{' '}
                            <span className={isPassed ? 'text-emerald-500' : 'text-rose-500'}>
                              {tc.actualStdout || '(empty)'}
                            </span>
                          </div>
                        )}
                        {tc.error && (
                          <div className="text-rose-500 truncate">Error: {tc.error}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
