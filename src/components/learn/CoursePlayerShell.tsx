'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  HelpCircle,
  Moon,
  PanelLeft,
  Sun,
} from 'lucide-react';
import { findLessonInCourse, flattenCourseLessons } from '@/data/courses';
import { useCortexTheme, useLearnProgress } from '@/hooks';
import type { Course, LessonItem, NotesCodeBlock } from '@/types/learn';
import { ExamLessonView } from './ExamLessonView';
import { LabLessonView } from './LabLessonView';
import { NotesLessonView } from './NotesLessonView';
import { QuizLessonView } from './QuizLessonView';
import { SandboxDrawer } from './SandboxDrawer';

export const LEARN_PENDING_SNIPPET_KEY = 'cortex_ide_pending_snippet';

interface CoursePlayerShellProps {
  course: Course;
  initialLessonId?: string | null;
}

function getItemIcon(type: LessonItem['type']) {
  switch (type) {
    case 'notes':
      return BookOpen;
    case 'quiz':
      return HelpCircle;
    case 'lab':
      return Code2;
    case 'exam':
      return Award;
  }
}

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60)
    .toString()
    .padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const CoursePlayerShell: React.FC<CoursePlayerShellProps> = ({
  course,
  initialLessonId,
}) => {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useCortexTheme();
  const {
    hydrated,
    completedSet,
    markItemCompleted,
    recordQuizResult,
    recordExamAttempt,
    toggleLabStep,
    getLabCheckedSteps,
    setLastVisitedLesson,
    getCourseProgress,
  } = useLearnProgress();

  const allItems = useMemo(() => flattenCourseLessons(course), [course]);

  const [activeLessonId, setActiveLessonId] = useState<string>(() => {
    if (initialLessonId && findLessonInCourse(course, initialLessonId)) {
      return initialLessonId;
    }
    return allItems[0]?.id ?? '';
  });

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(course.modules.map((m) => [m.id, true]))
  );
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const [examStarted, setExamStarted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sandboxSnippet, setSandboxSnippet] = useState<{
    code: string;
    language: string;
    filename: string;
  } | null>(null);

  useEffect(() => {
    if (initialLessonId && findLessonInCourse(course, initialLessonId)) {
      setActiveLessonId(initialLessonId);
    }
  }, [course, initialLessonId]);

  const activeInfo = useMemo(
    () =>
      findLessonInCourse(course, activeLessonId) ??
      findLessonInCourse(course, allItems[0]?.id ?? ''),
    [course, activeLessonId, allItems]
  );

  const activeItem = activeInfo?.item;
  const activeItemId = activeItem?.id;

  useEffect(() => {
    if (hydrated && activeItem) {
      setLastVisitedLesson(course.id, activeItem.id);
    }
  }, [hydrated, course.id, activeItem, setLastVisitedLesson]);

  // Reset exam timer state only when active lesson ID changes
  useEffect(() => {
    setExamStarted(false);
    setExamSubmitted(false);
    if (activeItem?.type === 'exam') {
      setSecondsLeft(activeItem.durationMins * 60);
    } else {
      setSecondsLeft(0);
    }
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItemId]);

  const isExamActive = activeItem?.type === 'exam' && examStarted && !examSubmitted;

  // Ctrl/Cmd + B toggles collapsible syllabus drawer (disabled during active exam)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !isExamActive) {
        e.preventDefault();
        setSidebarOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isExamActive]);

  // Countdown timer interval
  useEffect(() => {
    if (!examStarted || examSubmitted || secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [examStarted, examSubmitted, secondsLeft]);

  const selectItem = (item: LessonItem) => {
    setActiveLessonId(item.id);
    router.replace(`/learn/${course.slug}?lesson=${encodeURIComponent(item.id)}`, {
      scroll: false,
    });
  };

  const handleNextItem = () => {
    if (!activeInfo) return;
    const next = allItems[activeInfo.flatIndex + 1];
    if (next) selectItem(next);
  };

  const handlePrevItem = () => {
    if (!activeInfo) return;
    const prev = allItems[activeInfo.flatIndex - 1];
    if (prev) selectItem(prev);
  };

  const handleTryInIde = (codeBlock: NotesCodeBlock) => {
    setSandboxSnippet({
      code: codeBlock.code,
      language: codeBlock.language,
      filename: codeBlock.filename,
    });
  };

  if (!activeItem || !activeInfo) {
    return null;
  }

  const courseProgress = hydrated
    ? getCourseProgress(course)
    : {
        completedCount: 0,
        totalCount: allItems.length,
        pct: 0,
        resumeLessonId: allItems[0]?.id ?? '',
        currentModuleTitle: course.modules[0]?.title ?? '',
      };

  const hasPrev = activeInfo.flatIndex > 0;
  const hasNext = activeInfo.flatIndex < allItems.length - 1;
  const canvasWidthClass =
    activeItem.type === 'lab'
      ? 'max-w-[1320px]'
      : activeItem.type === 'notes'
        ? 'max-w-[780px]'
        : 'max-w-[820px]';

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col bg-[#F4F6F9] dark:bg-[#15181E] text-[#0F172A] dark:text-zinc-100 antialiased ${
        isDarkMode ? 'dark' : ''
      }`}
    >
      {/* 58px Glassy Course Player Top Bar */}
      <header className="h-[58px] shrink-0 px-4 sm:px-6 flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#21242B]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          {!isExamActive && (
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              title="Toggle Syllabus (Ctrl/Cmd+B)"
              aria-label="Toggle Syllabus"
              data-testid="toggle-syllabus-btn"
              className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-[#64748B] dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/learn')}
            className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#64748B] dark:text-zinc-300 hover:text-[#F3912E] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Courses</span>
          </button>
          <span className="text-slate-300 dark:text-zinc-600 hidden sm:inline">/</span>
          <span className="text-[13.5px] font-semibold truncate text-[#0F172A] dark:text-white hidden sm:inline">
            {course.title}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isExamActive ? (
            <div
              data-testid="player-exam-timer"
              className={`px-3 py-1 rounded-lg font-mono text-[12.5px] font-semibold inline-flex items-center gap-1.5 border ${
                secondsLeft < 120
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-500'
                  : 'border-[#E2E8F0] dark:border-white/[0.1] bg-[#F1F5F9] dark:bg-[#1A1D24] text-[#0F172A] dark:text-zinc-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTimer(secondsLeft)}</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2.5 text-[12px]">
              <div className="w-28 h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full bg-[#F3912E] rounded-full transition-all duration-300"
                  style={{ width: `${courseProgress.pct}%` }}
                />
              </div>
              <span className="font-mono font-semibold text-[#64748B] dark:text-zinc-300">
                {courseProgress.pct}%
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => toggleTheme(e)}
            aria-label="Toggle Light and Dark Mode"
            data-testid="player-theme-toggle"
            className="theme-glass-btn h-8 w-8 rounded-lg inline-flex items-center justify-center bg-[#F1F5F9]/90 dark:bg-[#1A1D24]/90 border border-slate-300 dark:border-white/[0.14] text-[#0F172A] dark:text-zinc-200"
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-[#F3912E]" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Collapsible Syllabus Drawer (290px, Auto-collapsed during active Exam) */}
        {!isExamActive && (
          <aside
            data-testid="syllabus-drawer"
            style={{ width: sidebarOpen ? 290 : 0 }}
            className={`h-full shrink-0 overflow-hidden bg-white dark:bg-[#21242B] transition-[width,opacity] duration-[210ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              sidebarOpen
                ? 'opacity-100 border-r border-[#E2E8F0] dark:border-white/[0.07]'
                : 'opacity-0 border-r-0'
            }`}
          >
            <div className="w-[290px] h-full flex flex-col">
              <div className="p-4 border-b border-[#E2E8F0] dark:border-white/[0.07] space-y-2">
                <div className="text-[13.5px] font-bold text-[#0F172A] dark:text-white leading-snug">
                  {course.title}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B] dark:text-zinc-400">
                  <span>
                    {courseProgress.completedCount}/{courseProgress.totalCount} lessons done
                  </span>
                  <span className="text-[#F3912E] font-semibold">{courseProgress.pct}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full bg-[#F3912E] rounded-full transition-all duration-300"
                    style={{ width: `${courseProgress.pct}%` }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {course.modules.map((mod, mIdx) => {
                  const isOpen = openModules[mod.id] ?? true;
                  return (
                    <div key={mod.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenModules((prev) => ({ ...prev, [mod.id]: !isOpen }))
                        }
                        className="w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-white/[0.04]"
                      >
                        <span className="text-[11px] font-mono uppercase tracking-wider text-[#F3912E] font-semibold">
                          Module {mIdx + 1}
                        </span>
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#64748B] dark:text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[#64748B] dark:text-zinc-400" />
                        )}
                      </button>

                      <div className="px-2 pb-1 text-[13px] font-semibold text-[#0F172A] dark:text-zinc-100">
                        {mod.title}
                      </div>

                      {isOpen && (
                        <div className="space-y-0.5 pl-1">
                          {mod.items.map((item) => {
                            const Icon = getItemIcon(item.type);
                            const isActive = item.id === activeItem.id;
                            const isDone = hydrated && completedSet.has(item.id);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => selectItem(item)}
                                data-testid={`syllabus-item-${item.id}`}
                                className={`relative w-full px-3 py-2 rounded-lg flex items-start gap-2.5 text-left transition-colors ${
                                  isActive
                                    ? 'bg-[#F3912E]/12 dark:bg-[#F3912E]/15 text-[#0F172A] dark:text-white'
                                    : 'text-[#64748B] dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.04] hover:text-[#0F172A] dark:hover:text-zinc-100'
                                }`}
                              >
                                {isActive && (
                                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#F3912E]" />
                                )}
                                {isDone ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                ) : (
                                  <Icon
                                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                                      isActive ? 'text-[#F3912E]' : 'opacity-75'
                                    }`}
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="text-[12.5px] font-medium leading-snug truncate">
                                    {item.title}
                                  </div>
                                  <div className="text-[11px] text-[#64748B] dark:text-zinc-500 capitalize mt-0.5">
                                    {item.type}
                                    {item.type === 'notes' ? ` · ${item.readMins}m` : ''}
                                    {item.type === 'lab' ? ` · ${item.estimatedMins}m` : ''}
                                    {item.type === 'exam' ? ` · ${item.durationMins}m` : ''}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {course.attribution && (
                <div className="p-3 border-t border-[#E2E8F0] dark:border-white/[0.07] text-[11px] text-[#64748B] dark:text-zinc-500">
                  {course.attribution.sourceName} ({course.attribution.license})
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center Lesson Canvas */}
        <main ref={mainScrollRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className={`${canvasWidthClass} mx-auto px-5 sm:px-8 py-8 pb-20`}>
            {activeItem.type === 'notes' && (
              <NotesLessonView
                lesson={activeItem}
                moduleIndex={activeInfo.moduleIndex}
                moduleTitle={activeInfo.module.title}
                isCompleted={hydrated && completedSet.has(activeItem.id)}
                hasPrev={hasPrev}
                hasNext={hasNext}
                attribution={course.attribution}
                onPrev={handlePrevItem}
                onCompleteAndContinue={() => {
                  markItemCompleted(course.id, activeItem.id, true);
                  if (hasNext) handleNextItem();
                }}
                onTryInIde={handleTryInIde}
              />
            )}

            {activeItem.type === 'quiz' && (
              <QuizLessonView
                lesson={activeItem}
                hasNext={hasNext}
                onRecordResult={(result) =>
                  recordQuizResult(course.id, activeItem.id, result)
                }
                onNextItem={handleNextItem}
              />
            )}

            {activeItem.type === 'lab' && (
              <LabLessonView
                courseId={course.id}
                lesson={activeItem}
                isCompleted={hydrated && completedSet.has(activeItem.id)}
                checkedSteps={hydrated ? getLabCheckedSteps(activeItem.id) : []}
                hasNext={hasNext}
                isDarkMode={isDarkMode}
                onToggleStep={(idx) => toggleLabStep(course.id, activeItem.id, idx)}
                onMarkCompleted={() => markItemCompleted(course.id, activeItem.id, true)}
                onNextItem={handleNextItem}
              />
            )}

            {activeItem.type === 'exam' && (
              <ExamLessonView
                lesson={activeItem}
                examStarted={examStarted}
                examSubmitted={examSubmitted}
                secondsLeft={secondsLeft}
                hasNext={hasNext}
                onStartExam={() => {
                  setSecondsLeft(activeItem.durationMins * 60);
                  setExamSubmitted(false);
                  setExamStarted(true);
                }}
                onSubmitExam={(result) => {
                  setExamSubmitted(true);
                  setExamStarted(false);
                  recordExamAttempt(course.id, activeItem.id, result);
                }}
                onRetryExam={() => {
                  setSecondsLeft(activeItem.durationMins * 60);
                  setExamSubmitted(false);
                  setExamStarted(true);
                }}
                onNextItem={handleNextItem}
              />
            )}
          </div>
        </main>
      </div>

      <SandboxDrawer
        open={Boolean(sandboxSnippet)}
        initialCode={sandboxSnippet?.code}
        initialLanguage={sandboxSnippet?.language}
        initialFilename={sandboxSnippet?.filename}
        isDarkMode={isDarkMode}
        onClose={() => setSandboxSnippet(null)}
      />
    </div>
  );
};
