'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudUpload,
  Code2,
  List,
  Maximize2,
  Minimize2,
  Moon,
  PanelLeftOpen,
  Play,
  Plus,
  RotateCcw,
  Settings,
  Shuffle,
  Sparkles,
  Sun,
  Terminal,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import { getLanguageConfig } from '@/config/languages';
import { Challenge } from '@/lib/challenges/challenges-data';
import { TestCase } from '@/lib/execution/types';

export type PracticeBottomTab = 'testcase' | 'result' | 'console' | 'assistant';

export interface PracticeWorkspaceResultSummary {
  mode: 'run' | 'submit';
  passed: boolean;
  status: 'Accepted' | 'Wrong Answer' | 'Runtime Error';
  passedCount: number;
  totalCount: number;
  runtimeMs: number;
}

export interface PracticeWorkspaceProps {
  problem: Challenge;
  language: string;
  languages: string[];
  onLanguageChange: (langId: string) => void;
  onFormatCode?: () => void;
  onResetCode: () => void;
  onRun: () => Promise<void> | void;
  onSubmit: () => Promise<void> | void;
  isRunning: boolean;
  runningMode?: 'run' | 'submit' | null;
  aiAssistEnabled: boolean;
  onToggleAiAssist: () => void;
  onBackToHub: () => void;
  onExitToIde?: () => void;
  onPrevProblem: () => void;
  onNextProblem: () => void;
  onShuffleProblem: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: (coords?: { x: number; y: number }) => void;
  isLeftCollapsed: boolean;
  onExpandLeftPanel: () => void;
  leftMaximized: boolean;
  onRequestRestoreLeft?: () => void;
  leftPanel: React.ReactNode;
  editorSlot: React.ReactNode;
  assistantSlot: React.ReactNode;
  testCases: TestCase[];
  activeCaseIdx: number;
  onSelectCaseIdx: (idx: number) => void;
  onAddTestCase: () => void;
  onDeleteTestCase: (id: string) => void;
  onUpdateTestCase: (idx: number, field: 'stdin' | 'expectedStdout', value: string) => void;
  lastResult: PracticeWorkspaceResultSummary | null;
  consoleOutput: string;
  cursorPos: { line: number; col: number };
  saveStatus: 'saved' | 'saving' | 'error' | 'conflict';
  onForceSave?: () => void;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  tabSize: number;
  onChangeTabSize: (size: number) => void;
  bottomTab: PracticeBottomTab;
  onBottomTabChange: (tab: PracticeBottomTab) => void;
}

function formatTimerClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Edge-to-edge 3-panel floating-card Cortex Practice Workspace.
 * Locks root to `h-screen w-screen overflow-hidden`, enforces the 3-tier neutral zinc palette,
 * provides pointer-drag horizontal/vertical splitters, single centered Run/Submit pill,
 * compact Code sub-bar & micro-footer, and single-row Testcase/Result/Console/Assistant drawer.
 */
export const PracticeWorkspace: React.FC<PracticeWorkspaceProps> = ({
  problem,
  language,
  languages,
  onLanguageChange,
  onFormatCode,
  onResetCode,
  onRun,
  onSubmit,
  isRunning,
  runningMode = null,
  aiAssistEnabled,
  onToggleAiAssist,
  onBackToHub,
  onExitToIde,
  onPrevProblem,
  onNextProblem,
  onShuffleProblem,
  isDarkMode,
  onToggleDarkMode,
  isLeftCollapsed,
  onExpandLeftPanel,
  leftMaximized,
  onRequestRestoreLeft,
  leftPanel,
  editorSlot,
  assistantSlot,
  testCases,
  activeCaseIdx,
  onSelectCaseIdx,
  onAddTestCase,
  onDeleteTestCase,
  onUpdateTestCase,
  lastResult,
  consoleOutput,
  cursorPos,
  saveStatus,
  onForceSave,
  fontSize,
  onChangeFontSize,
  tabSize,
  onChangeTabSize,
  bottomTab,
  onBottomTabChange,
}) => {
  const [leftWidth, setLeftWidth] = useState(46);
  const [editorHeight, setEditorHeight] = useState(62);
  const [rightMaximized, setRightMaximized] = useState<'editor' | 'bottom' | null>(null);
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState<'h' | 'v' | null>(null);

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const workspaceRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomScrollRef.current) {
      bottomScrollRef.current.scrollTop = 0;
    }
  }, [bottomTab, problem.id]);

  const maximized: 'left' | 'editor' | 'bottom' | null = leftMaximized
    ? 'left'
    : rightMaximized;

  // Reset stopwatch cleanly when problem changes
  useEffect(() => {
    setElapsedSeconds(0);
    setIsTimerRunning(false);
    setRightMaximized(null);
  }, [problem.id]);

  // Stopwatch tick
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning]);

  // Close Editor Settings popover on outside click / Esc
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSettingsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isSettingsOpen]);

  // Smooth horizontal & vertical drag resizing
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging === 'h' && workspaceRef.current) {
        const rect = workspaceRef.current.getBoundingClientRect();
        if (rect.width > 0) {
          const pct = ((e.clientX - rect.left) / rect.width) * 100;
          setLeftWidth(Math.min(72, Math.max(24, pct)));
        }
      } else if (isDragging === 'v' && rightColRef.current) {
        const rect = rightColRef.current.getBoundingClientRect();
        if (rect.height > 0) {
          const pct = ((e.clientY - rect.top) / rect.height) * 100;
          setEditorHeight(Math.min(82, Math.max(22, pct)));
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      if (typeof window !== 'undefined') {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 16);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Keyboard shortcuts: Ctrl/Cmd+Enter -> Run, Ctrl/Cmd+Shift+Enter -> Submit
  const onRunRef = useRef(onRun);
  const onSubmitRef = useRef(onSubmit);
  const isRunningRef = useRef(isRunning);
  onRunRef.current = onRun;
  onSubmitRef.current = onSubmit;
  isRunningRef.current = isRunning;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (isRunningRef.current) return;
        setIsBottomCollapsed(false);
        onBottomTabChange('result');
        if (e.shiftKey) {
          void onSubmitRef.current();
        } else {
          void onRunRef.current();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onBottomTabChange]);

  const toggleRightMaximize = useCallback(
    (panel: 'editor' | 'bottom') => {
      if (leftMaximized && onRequestRestoreLeft) {
        onRequestRestoreLeft();
      }
      setIsBottomCollapsed(false);
      setRightMaximized((prev) => (prev === panel ? null : panel));
      if (typeof window !== 'undefined') {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
      }
    },
    [leftMaximized, onRequestRestoreLeft]
  );

  const safeIdx = activeCaseIdx >= 0 && activeCaseIdx < testCases.length ? activeCaseIdx : 0;
  const currentCase = testCases[safeIdx];

  const saveStatusLabel = useMemo(() => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'error':
        return 'Save failed';
      case 'conflict':
        return 'Conflict';
      default:
        return 'Saved';
    }
  }, [saveStatus]);

  return (
    <div
      data-testid="practice-workspace"
      className={`${
        isDarkMode ? 'dark' : ''
      } h-screen w-screen overflow-hidden flex flex-col bg-[#F0F0F2] dark:bg-[#0F0F10] text-zinc-900 dark:text-zinc-100 antialiased ${
        isDragging ? 'select-none' : ''
      }`}
    >
      {/* 1. Compact 44px Top Navigation & Unified Execution Bar */}
      <header className="h-11 shrink-0 px-3 flex items-center justify-between gap-2">
        {/* Left: Cortex mark + Practice Hub + Prev/Next/Shuffle */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={onBackToHub}
            data-testid="practice-back-to-hub"
            className="h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <path
                d="M7 7L3.5 12L7 17"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M17 7L20.5 12L17 17"
                stroke="#F59E0B"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M13.5 5.5L10.5 18.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <List className="w-3.5 h-3.5 text-amber-500" />
            <span>Practice Hub</span>
          </button>

          <div className="h-3.5 w-px bg-black/10 dark:bg-white/10 mx-1 shrink-0" />

          <button
            type="button"
            onClick={onPrevProblem}
            title="Previous Problem"
            aria-label="Previous Problem"
            data-testid="practice-prev-problem"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNextProblem}
            title="Next Problem"
            aria-label="Next Problem"
            data-testid="practice-next-problem"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onShuffleProblem}
            title="Random Problem"
            aria-label="Random Problem"
            data-testid="practice-shuffle-problem"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center: Single Segmented Execution Cluster */}
        <div
          data-testid="practice-execution-cluster"
          className="flex items-center rounded-lg bg-[#E4E4E7] dark:bg-[#262629] border border-black/[0.06] dark:border-white/[0.07] p-0.5 gap-0.5 shrink-0"
        >
          <button
            type="button"
            onClick={() => {
              setIsBottomCollapsed(false);
              onBottomTabChange('result');
              void onRun();
            }}
            disabled={isRunning}
            title="Run Tests (Ctrl + Enter)"
            data-testid="practice-run-btn"
            className="h-7 px-3 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-zinc-800 dark:text-zinc-200 hover:bg-white dark:hover:bg-[#323236] disabled:opacity-50 transition-colors"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isRunning && runningMode === 'run' ? 'Running...' : 'Run'}</span>
          </button>

          <div className="h-4 w-px bg-black/10 dark:bg-white/[0.08]" />

          <button
            type="button"
            onClick={() => {
              setIsBottomCollapsed(false);
              onBottomTabChange('result');
              void onSubmit();
            }}
            disabled={isRunning}
            title="Submit Solution (Ctrl + Shift + Enter)"
            data-testid="practice-submit-btn"
            className="h-7 px-3 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{isRunning && runningMode === 'submit' ? 'Submitting...' : 'Submit'}</span>
          </button>

          <div className="h-4 w-px bg-black/10 dark:bg-white/[0.08]" />

          <button
            type="button"
            onClick={onToggleAiAssist}
            title="Toggle AI Assist Hints & Suggestions"
            data-testid="practice-ai-toggle"
            className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium transition-colors ${
              aiAssistEnabled
                ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-[#323236]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>

        {/* Right: Timer, Settings Popover, Theme Toggle, Optional IDE Link */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Stopwatch Toggle */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setIsTimerRunning((prev) => !prev)}
              title={isTimerRunning ? 'Pause Timer' : 'Start Timer'}
              aria-label="Toggle Stopwatch"
              data-testid="practice-timer-btn"
              className={`h-7 px-2 inline-flex items-center gap-1.5 rounded-md text-[11.5px] font-mono transition-colors ${
                isTimerRunning || elapsedSeconds > 0
                  ? 'text-zinc-900 dark:text-zinc-100 bg-black/[0.05] dark:bg-white/[0.07]'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
              }`}
            >
              <Timer className={`w-3.5 h-3.5 ${isTimerRunning ? 'text-amber-500' : ''}`} />
              {(isTimerRunning || elapsedSeconds > 0) && (
                <span className="tabular-nums">{formatTimerClock(elapsedSeconds)}</span>
              )}
            </button>
            {elapsedSeconds > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(false);
                  setElapsedSeconds(0);
                }}
                title="Reset Timer"
                aria-label="Reset Stopwatch"
                className="h-7 w-5 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
              >
                <RotateCcw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {/* Editor Settings Popover */}
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              title="Editor Settings"
              aria-label="Editor Settings"
              data-testid="practice-settings-btn"
              className={`h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors ${
                isSettingsOpen
                  ? 'text-zinc-900 dark:text-zinc-100 bg-black/[0.06] dark:bg-white/[0.08]'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {isSettingsOpen && (
              <div
                data-testid="practice-settings-popover"
                className="absolute right-0 top-full mt-1.5 w-52 rounded-lg bg-white dark:bg-[#262629] border border-black/[0.08] dark:border-white/[0.08] shadow-lg p-3 space-y-3 z-50 text-[12px]"
              >
                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Font Size
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {[12, 13, 14].map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => onChangeFontSize(sz)}
                        className={`h-7 rounded-md font-mono text-[11.5px] transition-colors ${
                          fontSize === sz
                            ? 'bg-zinc-200 dark:bg-[#323236] text-zinc-950 dark:text-zinc-100 font-medium'
                            : 'text-zinc-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        {sz}px
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    Tab Size
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {[2, 4].map((ts) => (
                      <button
                        key={ts}
                        type="button"
                        onClick={() => onChangeTabSize(ts)}
                        className={`h-7 rounded-md font-mono text-[11.5px] transition-colors ${
                          tabSize === ts
                            ? 'bg-zinc-200 dark:bg-[#323236] text-zinc-950 dark:text-zinc-100 font-medium'
                            : 'text-zinc-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                        }`}
                      >
                        {ts} spaces
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Minimal Theme Toggle */}
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onToggleDarkMode({
                x: e.clientX || rect.left + rect.width / 2,
                y: e.clientY || rect.top + rect.height / 2,
              });
            }}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            data-testid="practice-workspace-theme-toggle"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {onExitToIde && (
            <button
              type="button"
              onClick={onExitToIde}
              title="Open Full IDE Workspace"
              data-testid="practice-exit-to-ide"
              className="hidden sm:inline-flex h-7 px-2 items-center rounded-md text-[11.5px] font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
            >
              IDE
            </button>
          )}
        </div>
      </header>

      {/* 2. Edge-to-Edge 3-Panel Floating Card Workspace */}
      <main ref={workspaceRef} className="flex-1 min-h-0 px-2 pb-2 flex overflow-hidden">
        {/* LEFT PANEL: Description / Hints / Solutions / Submissions */}
        {maximized !== 'editor' && maximized !== 'bottom' && (
          isLeftCollapsed && !leftMaximized ? (
            <div className="w-9 h-full shrink-0 rounded-[10px] bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.08] flex flex-col items-center py-2.5 mr-2">
              <button
                type="button"
                onClick={onExpandLeftPanel}
                title="Expand Problem Panel"
                aria-label="Expand Problem Panel"
                data-testid="problem-reopen-panel"
                className="h-7 w-7 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4 text-amber-500" />
              </button>
            </div>
          ) : (
            <div
              style={{ width: maximized === 'left' ? '100%' : `${leftWidth}%` }}
              className="h-full min-w-0 shrink-0"
            >
              {leftPanel}
            </div>
          )
        )}

        {/* HORIZONTAL SPLITTER (8px gap) */}
        {!maximized && !isLeftCollapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize left and right panels"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging('h');
            }}
            onDoubleClick={() => setLeftWidth(46)}
            title="Drag to resize (double-click to reset)"
            data-testid="practice-h-splitter"
            className="w-2 shrink-0 cursor-col-resize group flex items-center justify-center"
          >
            <div
              className={`w-[3px] h-8 rounded-full transition-colors ${
                isDragging === 'h'
                  ? 'bg-amber-500'
                  : 'bg-transparent group-hover:bg-zinc-400 dark:group-hover:bg-zinc-600'
              }`}
            />
          </div>
        )}

        {/* RIGHT COLUMN: Code Editor + Bottom Drawer */}
        {maximized !== 'left' && (
          <div ref={rightColRef} className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
            {/* TOP-RIGHT PANEL: </> Code Editor */}
            {maximized !== 'bottom' && (
              <section
                style={{
                  height:
                    maximized === 'editor'
                      ? '100%'
                      : isBottomCollapsed
                        ? 'calc(100% - 44px)'
                        : `${editorHeight}%`,
                }}
                className="w-full min-h-0 flex flex-col rounded-[10px] bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.08] overflow-hidden"
              >
                {/* 36px Header */}
                <div className="h-9 shrink-0 px-3 bg-[#F7F7F8] dark:bg-[#262629] border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                    <Code2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Code</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleRightMaximize('editor')}
                    title={maximized === 'editor' ? 'Restore editor' : 'Maximize editor'}
                    aria-label={maximized === 'editor' ? 'Restore editor' : 'Maximize editor'}
                    data-testid="code-maximize-panel"
                    className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                  >
                    {maximized === 'editor' ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* 32px Language & Editor Sub-bar */}
                <div className="h-8 shrink-0 px-3 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <select
                    value={languages.includes(language) ? language : languages[0] || ''}
                    onChange={(e) => onLanguageChange(e.target.value)}
                    aria-label="Select programming language"
                    data-testid="problem-language-select"
                    className="h-6 px-1.5 rounded text-[12px] font-medium bg-transparent text-zinc-700 dark:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] focus:outline-none cursor-pointer"
                  >
                    {languages.map((langId) => {
                      const cfg = getLanguageConfig(langId);
                      return (
                        <option
                          key={langId}
                          value={langId}
                          className="bg-white text-zinc-900 dark:bg-[#1C1C1E] dark:text-zinc-100"
                        >
                          {cfg?.name || langId}
                        </option>
                      );
                    })}
                  </select>

                  <div className="flex items-center gap-1">
                    {onFormatCode && (
                      <button
                        type="button"
                        onClick={onFormatCode}
                        title="Format Document"
                        data-testid="practice-format-code"
                        className="h-6 px-2 inline-flex items-center gap-1 rounded text-[11.5px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <AlignLeft className="w-3 h-3" />
                        <span>Format</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onResetCode}
                      disabled={isRunning}
                      title="Reset to default starter code"
                      data-testid="problem-reset-code"
                      className="h-6 px-2 inline-flex items-center gap-1 rounded text-[11.5px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] disabled:opacity-50 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleRightMaximize('editor')}
                      title={maximized === 'editor' ? 'Exit fullscreen' : 'Fullscreen editor'}
                      aria-label={maximized === 'editor' ? 'Exit fullscreen' : 'Fullscreen editor'}
                      data-testid="practice-editor-fullscreen"
                      className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                    >
                      {maximized === 'editor' ? (
                        <Minimize2 className="w-3 h-3" />
                      ) : (
                        <Maximize2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Editor Slot */}
                <div className={`flex-1 min-h-0 relative ${isDragging ? 'pointer-events-none' : ''}`}>
                  {editorSlot}
                </div>

                {/* 24px Quiet Micro-Footer */}
                <div className="h-6 shrink-0 px-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-zinc-500">
                  <button
                    type="button"
                    onClick={onForceSave}
                    disabled={!onForceSave}
                    className="hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors text-left"
                  >
                    {saveStatusLabel}
                  </button>
                  <span className="tabular-nums">
                    Ln {cursorPos.line}, Col {cursorPos.col}
                  </span>
                </div>
              </section>
            )}

            {/* VERTICAL SPLITTER (8px gap) */}
            {!maximized && !isBottomCollapsed && (
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize code and testcase panels"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDragging('v');
                }}
                onDoubleClick={() => setEditorHeight(62)}
                title="Drag to resize (double-click to reset)"
                data-testid="practice-v-splitter"
                className="h-2 shrink-0 cursor-row-resize group flex items-center justify-center"
              >
                <div
                  className={`h-[3px] w-8 rounded-full transition-colors ${
                    isDragging === 'v'
                      ? 'bg-amber-500'
                      : 'bg-transparent group-hover:bg-zinc-400 dark:group-hover:bg-zinc-600'
                  }`}
                />
              </div>
            )}

            {/* BOTTOM-RIGHT PANEL: Single-Row Testcase & Test Result Drawer */}
            {maximized !== 'editor' && (
              <section
                className={`${
                  isBottomCollapsed && maximized !== 'bottom'
                    ? 'h-9 shrink-0 mt-2'
                    : 'flex-1 min-h-0'
                } w-full flex flex-col rounded-[10px] bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.08] overflow-hidden`}
              >
                {/* Single 36px Header Strip */}
                <div className="h-9 shrink-0 px-2 bg-[#F7F7F8] dark:bg-[#262629] border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'testcase', label: 'Testcase', icon: CheckSquare },
                      { id: 'result', label: 'Test Result', icon: Terminal },
                      { id: 'console', label: 'Console', icon: Code2 },
                      { id: 'assistant', label: 'Assistant', icon: Sparkles },
                    ].map(({ id, label, icon: Icon }) => {
                      const active = bottomTab === id && !isBottomCollapsed;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setIsBottomCollapsed(false);
                            onBottomTabChange(id as PracticeBottomTab);
                          }}
                          data-testid={`practice-bottom-tab-${id}`}
                          className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
                            active
                              ? 'text-zinc-950 dark:text-zinc-100 bg-black/[0.05] dark:bg-white/[0.07]'
                              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                          }`}
                        >
                          <Icon
                            className={`w-3.5 h-3.5 ${
                              active
                                ? id === 'assistant'
                                  ? 'text-amber-500'
                                  : 'text-emerald-500'
                                : 'opacity-70'
                            }`}
                          />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {maximized !== 'bottom' && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsBottomCollapsed((prev) => !prev);
                          if (typeof window !== 'undefined') {
                            setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
                          }
                        }}
                        title={isBottomCollapsed ? 'Expand drawer' : 'Collapse drawer'}
                        aria-label={isBottomCollapsed ? 'Expand bottom drawer' : 'Collapse bottom drawer'}
                        data-testid="bottom-collapse-panel"
                        className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                      >
                        {isBottomCollapsed ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleRightMaximize('bottom')}
                      title={maximized === 'bottom' ? 'Restore drawer' : 'Maximize drawer'}
                      aria-label={maximized === 'bottom' ? 'Restore drawer' : 'Maximize drawer'}
                      data-testid="bottom-maximize-panel"
                      className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                    >
                      {maximized === 'bottom' ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom Drawer Content */}
                {(!isBottomCollapsed || maximized === 'bottom') && (
                  <div
                    ref={bottomScrollRef}
                    className={`flex-1 min-h-0 ${
                      bottomTab === 'assistant' ? 'overflow-hidden' : 'overflow-y-auto p-3.5 space-y-3'
                    }`}
                  >
                    {bottomTab === 'testcase' && (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {testCases.map((tc, idx) => {
                            const selected = safeIdx === idx;
                            return (
                              <div key={tc.id} className="inline-flex items-center group/case">
                                <button
                                  type="button"
                                  onClick={() => onSelectCaseIdx(idx)}
                                  data-testid={`practice-testcase-pill-${idx}`}
                                  className={`h-6 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                                    selected
                                      ? 'bg-zinc-200/80 dark:bg-[#2C2C30] text-zinc-950 dark:text-zinc-100'
                                      : 'text-zinc-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                                  }`}
                                >
                                  Case {idx + 1}
                                </button>
                                {testCases.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTestCase(tc.id)}
                                    title={`Remove Case ${idx + 1}`}
                                    aria-label={`Remove Case ${idx + 1}`}
                                    className="h-5 w-4 -ml-0.5 rounded inline-flex items-center justify-center text-zinc-400 hover:text-rose-500 opacity-0 group-hover/case:opacity-100 focus:opacity-100 transition-opacity"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={onAddTestCase}
                            title="Add test case"
                            aria-label="Add test case"
                            data-testid="practice-add-testcase"
                            className="h-6 w-6 inline-flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {currentCase ? (
                          <div className="space-y-2.5">
                            <label className="block space-y-1">
                              <span className="text-[11px] font-mono text-zinc-500">Input</span>
                              <textarea
                                rows={2}
                                value={currentCase.stdin}
                                onChange={(e) => onUpdateTestCase(safeIdx, 'stdin', e.target.value)}
                                placeholder={
                                  problem.track === 'SQL'
                                    ? '(Optional stdin - SQL query runs directly against table schema)'
                                    : 'Enter test input...'
                                }
                                className="w-full px-3 py-2 rounded-md font-mono text-[12px] bg-zinc-100 dark:bg-[#262629] border border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-white/25 resize-none"
                              />
                            </label>

                            <label className="block space-y-1">
                              <span className="text-[11px] font-mono text-zinc-500">Expected Output</span>
                              <textarea
                                rows={2}
                                value={currentCase.expectedStdout}
                                onChange={(e) =>
                                  onUpdateTestCase(safeIdx, 'expectedStdout', e.target.value)
                                }
                                placeholder="Expected stdout..."
                                className="w-full px-3 py-2 rounded-md font-mono text-[12px] bg-zinc-100 dark:bg-[#262629] border border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400 dark:focus:border-white/25 resize-none"
                              />
                            </label>
                          </div>
                        ) : (
                          <p className="text-[12px] text-zinc-500 py-4 text-center">
                            No test cases defined. Click + to add a custom test case.
                          </p>
                        )}
                      </>
                    )}

                    {bottomTab === 'result' && (
                      <>
                        {isRunning ? (
                          <div className="h-full min-h-[120px] flex items-center justify-center gap-2 text-[12.5px] text-zinc-500">
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                            <span>
                              {runningMode === 'submit'
                                ? 'Evaluating submission...'
                                : 'Running test cases...'}
                            </span>
                          </div>
                        ) : !lastResult ? (
                          <div className="h-full min-h-[120px] flex items-center justify-center text-[12.5px] text-zinc-500">
                            You must run your code first
                          </div>
                        ) : (
                          <div className="space-y-3" data-testid="practice-test-result-view">
                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={`text-[15px] font-semibold inline-flex items-center gap-1.5 ${
                                  lastResult.passed
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {lastResult.passed ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                                <span>{lastResult.status}</span>
                              </span>
                              <span className="text-[12px] font-mono text-zinc-500">
                                {lastResult.passedCount}/{lastResult.totalCount} cases passed
                              </span>
                              <span className="text-[12px] font-mono text-zinc-500">
                                Runtime: {lastResult.runtimeMs} ms
                              </span>
                            </div>

                            {testCases.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {testCases.map((tc, idx) => (
                                  <button
                                    key={tc.id}
                                    type="button"
                                    onClick={() => onSelectCaseIdx(idx)}
                                    data-testid={`practice-result-case-${idx}`}
                                    className={`h-6 px-2.5 rounded-md text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors ${
                                      safeIdx === idx
                                        ? 'bg-zinc-200/80 dark:bg-[#2C2C30] text-zinc-950 dark:text-zinc-100'
                                        : 'text-zinc-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        tc.passed === true
                                          ? 'bg-emerald-500'
                                          : tc.passed === false
                                            ? 'bg-rose-500'
                                            : 'bg-zinc-400'
                                      }`}
                                    />
                                    <span>Case {idx + 1}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {currentCase && (
                              <div className="space-y-2 font-mono text-[12px]">
                                <div className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-[#262629]">
                                  <div className="text-[11px] text-zinc-500 mb-0.5">Input</div>
                                  <pre className="whitespace-pre-wrap break-words text-zinc-900 dark:text-zinc-100">
                                    {currentCase.stdin || '(empty)'}
                                  </pre>
                                </div>

                                <div className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-[#262629]">
                                  <div className="text-[11px] text-zinc-500 mb-0.5">Output</div>
                                  <pre
                                    className={`whitespace-pre-wrap break-words ${
                                      currentCase.passed === false || currentCase.error
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-zinc-900 dark:text-zinc-100'
                                    }`}
                                  >
                                    {currentCase.error
                                      ? currentCase.error
                                      : currentCase.actualStdout ?? '(no output)'}
                                  </pre>
                                </div>

                                <div className="px-3 py-2 rounded-md bg-zinc-100 dark:bg-[#262629]">
                                  <div className="text-[11px] text-zinc-500 mb-0.5">Expected</div>
                                  <pre className="whitespace-pre-wrap break-words text-zinc-900 dark:text-zinc-100">
                                    {currentCase.expectedStdout}
                                  </pre>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {bottomTab === 'console' && (
                      <pre
                        data-testid="practice-console-output"
                        className="font-mono text-[12px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap break-words"
                      >
                        {consoleOutput || 'No stdout output.'}
                      </pre>
                    )}

                    {bottomTab === 'assistant' && assistantSlot}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
