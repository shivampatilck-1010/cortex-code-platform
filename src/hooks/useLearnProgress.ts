'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  Course,
  ExamAttemptRecord,
  LearnProgressState,
  LessonItem,
  QuizScoreRecord,
} from '@/types/learn';

export const LEARN_PROGRESS_STORAGE_KEY = 'cortex_learn_progress_v1';
export const LEARN_PROGRESS_EVENT = 'cortex:learn-progress-changed';

export const DEFAULT_LEARN_PROGRESS: LearnProgressState = {
  completedItemIds: [],
  quizScores: {},
  examAttempts: {},
  labSteps: {},
  lastVisitedLesson: {},
  lastActiveCourseId: null,
};

export interface CourseProgressSummary {
  completedCount: number;
  totalCount: number;
  pct: number;
  resumeLessonId: string;
  currentModuleTitle: string;
}

export interface InProgressCourseEntry {
  course: Course;
  pct: number;
  completedCount: number;
  totalCount: number;
  currentModuleTitle: string;
  resumeLesson: LessonItem;
}

export interface UseLearnProgressReturn {
  progress: LearnProgressState;
  hydrated: boolean;
  completedSet: Set<string>;
  isItemCompleted: (itemId: string) => boolean;
  markItemCompleted: (courseId: string, lessonId: string, completed?: boolean) => void;
  recordQuizResult: (
    courseId: string,
    lessonId: string,
    result: Omit<QuizScoreRecord, 'attempts' | 'updatedAt'>
  ) => void;
  recordExamAttempt: (
    courseId: string,
    lessonId: string,
    attempt: Omit<ExamAttemptRecord, 'submittedAt'>
  ) => void;
  toggleLabStep: (courseId: string, lessonId: string, stepIndex: number) => void;
  getLabCheckedSteps: (lessonId: string) => number[];
  setLastVisitedLesson: (courseId: string, lessonId: string) => void;
  getCourseProgress: (course: Course) => CourseProgressSummary;
  getInProgressCourses: (courses: Course[]) => InProgressCourseEntry[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeLearnProgress(raw: unknown): LearnProgressState {
  if (!isPlainObject(raw)) {
    return {
      completedItemIds: [],
      quizScores: {},
      examAttempts: {},
      labSteps: {},
      lastVisitedLesson: {},
      lastActiveCourseId: null,
    };
  }

  const completedSet = new Set<string>();
  if (Array.isArray(raw.completedItemIds)) {
    for (const id of raw.completedItemIds) {
      if (typeof id === 'string' && id.trim().length > 0) {
        completedSet.add(id.trim());
      }
    }
  }

  const quizScores: Record<string, QuizScoreRecord> = {};
  if (isPlainObject(raw.quizScores)) {
    for (const [lessonId, rec] of Object.entries(raw.quizScores)) {
      if (!lessonId || !isPlainObject(rec)) continue;
      quizScores[lessonId] = {
        scorePct: Math.max(0, Math.min(100, toFiniteNumber(rec.scorePct, 0))),
        correctCount: Math.max(0, toFiniteNumber(rec.correctCount, 0)),
        totalCount: Math.max(0, toFiniteNumber(rec.totalCount, 0)),
        passed: Boolean(rec.passed),
        attempts: Math.max(1, Math.floor(toFiniteNumber(rec.attempts, 1))),
        updatedAt: toFiniteNumber(rec.updatedAt, 0),
      };
    }
  }

  const examAttempts: Record<string, ExamAttemptRecord[]> = {};
  if (isPlainObject(raw.examAttempts)) {
    for (const [lessonId, list] of Object.entries(raw.examAttempts)) {
      if (!lessonId || !Array.isArray(list)) continue;
      const validList: ExamAttemptRecord[] = [];
      for (const entry of list) {
        if (!isPlainObject(entry)) continue;
        validList.push({
          scorePct: Math.max(0, Math.min(100, toFiniteNumber(entry.scorePct, 0))),
          correctCount: Math.max(0, toFiniteNumber(entry.correctCount, 0)),
          totalCount: Math.max(0, toFiniteNumber(entry.totalCount, 0)),
          passed: Boolean(entry.passed),
          timeTakenSecs: Math.max(0, toFiniteNumber(entry.timeTakenSecs, 0)),
          submittedAt: toFiniteNumber(entry.submittedAt, 0),
        });
      }
      if (validList.length > 0) {
        examAttempts[lessonId] = validList;
      }
    }
  }

  const labSteps: Record<string, number[]> = {};
  if (isPlainObject(raw.labSteps)) {
    for (const [lessonId, steps] of Object.entries(raw.labSteps)) {
      if (!lessonId || !Array.isArray(steps)) continue;
      const uniqueSteps = new Set<number>();
      for (const idx of steps) {
        if (typeof idx === 'number' && Number.isInteger(idx) && idx >= 0) {
          uniqueSteps.add(idx);
        }
      }
      if (uniqueSteps.size > 0) {
        labSteps[lessonId] = Array.from(uniqueSteps).sort((a, b) => a - b);
      }
    }
  }

  const lastVisitedLesson: Record<
    string,
    { courseId: string; lessonId: string; updatedAt: number }
  > = {};
  if (isPlainObject(raw.lastVisitedLesson)) {
    for (const [courseId, entry] of Object.entries(raw.lastVisitedLesson)) {
      if (!courseId || !isPlainObject(entry)) continue;
      if (typeof entry.lessonId !== 'string' || !entry.lessonId.trim()) continue;
      lastVisitedLesson[courseId] = {
        courseId: typeof entry.courseId === 'string' && entry.courseId.trim() ? entry.courseId : courseId,
        lessonId: entry.lessonId,
        updatedAt: toFiniteNumber(entry.updatedAt, 0),
      };
    }
  }

  const lastActiveCourseId =
    typeof raw.lastActiveCourseId === 'string' && raw.lastActiveCourseId.trim().length > 0
      ? raw.lastActiveCourseId
      : null;

  return {
    completedItemIds: Array.from(completedSet),
    quizScores,
    examAttempts,
    labSteps,
    lastVisitedLesson,
    lastActiveCourseId,
  };
}

export function loadLearnProgress(): LearnProgressState {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return normalizeLearnProgress(DEFAULT_LEARN_PROGRESS);
  }
  try {
    const raw = window.localStorage.getItem(LEARN_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return normalizeLearnProgress(DEFAULT_LEARN_PROGRESS);
    }
    return normalizeLearnProgress(JSON.parse(raw));
  } catch {
    return normalizeLearnProgress(DEFAULT_LEARN_PROGRESS);
  }
}

export function saveLearnProgress(state: LearnProgressState): LearnProgressState {
  const normalized = normalizeLearnProgress(state);
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      window.localStorage.setItem(LEARN_PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Ignore storage quota or restricted mode errors
    }
  }
  return normalized;
}

export function reduceMarkItemCompleted(
  prev: LearnProgressState,
  courseId: string,
  lessonId: string,
  completed = true,
  now = Date.now()
): LearnProgressState {
  const nextSet = new Set(prev.completedItemIds);
  if (completed) {
    nextSet.add(lessonId);
  } else {
    nextSet.delete(lessonId);
  }

  const nextLastVisited = { ...prev.lastVisitedLesson };
  if (completed && !nextLastVisited[courseId]) {
    nextLastVisited[courseId] = {
      courseId,
      lessonId,
      updatedAt: now,
    };
  }

  return normalizeLearnProgress({
    ...prev,
    completedItemIds: Array.from(nextSet),
    lastVisitedLesson: nextLastVisited,
    lastActiveCourseId: completed ? courseId : prev.lastActiveCourseId,
  });
}

export function reduceRecordQuizResult(
  prev: LearnProgressState,
  courseId: string,
  lessonId: string,
  result: Omit<QuizScoreRecord, 'attempts' | 'updatedAt'>,
  now = Date.now()
): LearnProgressState {
  const prevAttempts = prev.quizScores[lessonId]?.attempts ?? 0;
  const nextSet = new Set(prev.completedItemIds);
  if (result.passed) {
    nextSet.add(lessonId);
  }

  return normalizeLearnProgress({
    ...prev,
    completedItemIds: Array.from(nextSet),
    quizScores: {
      ...prev.quizScores,
      [lessonId]: {
        ...result,
        attempts: prevAttempts + 1,
        updatedAt: now,
      },
    },
    lastVisitedLesson: {
      ...prev.lastVisitedLesson,
      [courseId]: {
        courseId,
        lessonId,
        updatedAt: now,
      },
    },
    lastActiveCourseId: courseId,
  });
}

export function reduceRecordExamAttempt(
  prev: LearnProgressState,
  courseId: string,
  lessonId: string,
  attempt: Omit<ExamAttemptRecord, 'submittedAt'>,
  now = Date.now()
): LearnProgressState {
  const prevHistory = prev.examAttempts[lessonId] ?? [];
  const nextSet = new Set(prev.completedItemIds);
  if (attempt.passed) {
    nextSet.add(lessonId);
  }

  return normalizeLearnProgress({
    ...prev,
    completedItemIds: Array.from(nextSet),
    examAttempts: {
      ...prev.examAttempts,
      [lessonId]: [
        ...prevHistory,
        {
          ...attempt,
          submittedAt: now,
        },
      ],
    },
    lastVisitedLesson: {
      ...prev.lastVisitedLesson,
      [courseId]: {
        courseId,
        lessonId,
        updatedAt: now,
      },
    },
    lastActiveCourseId: courseId,
  });
}

export function reduceToggleLabStep(
  prev: LearnProgressState,
  courseId: string,
  lessonId: string,
  stepIndex: number
): LearnProgressState {
  if (!Number.isInteger(stepIndex) || stepIndex < 0) {
    return prev;
  }
  const existing = prev.labSteps[lessonId] ?? [];
  const nextSteps = existing.includes(stepIndex)
    ? existing.filter((idx) => idx !== stepIndex)
    : [...existing, stepIndex].sort((a, b) => a - b);

  const nextLabSteps = { ...prev.labSteps };
  if (nextSteps.length > 0) {
    nextLabSteps[lessonId] = nextSteps;
  } else {
    delete nextLabSteps[lessonId];
  }

  return normalizeLearnProgress({
    ...prev,
    labSteps: nextLabSteps,
    lastActiveCourseId: courseId,
  });
}

export function reduceSetLastVisitedLesson(
  prev: LearnProgressState,
  courseId: string,
  lessonId: string,
  now = Date.now()
): LearnProgressState {
  return normalizeLearnProgress({
    ...prev,
    lastVisitedLesson: {
      ...prev.lastVisitedLesson,
      [courseId]: {
        courseId,
        lessonId,
        updatedAt: now,
      },
    },
    lastActiveCourseId: courseId,
  });
}

export function computeCourseProgress(
  progress: LearnProgressState,
  course: Course
): CourseProgressSummary {
  const completedSet = new Set(progress.completedItemIds);
  const flatItems: Array<{ item: LessonItem; moduleTitle: string }> = [];

  for (const mod of course.modules) {
    for (const item of mod.items) {
      flatItems.push({ item, moduleTitle: mod.title });
    }
  }

  const totalCount = flatItems.length;
  const completedCount = flatItems.filter(({ item }) => completedSet.has(item.id)).length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const visitedId = progress.lastVisitedLesson[course.id]?.lessonId;
  const visitedEntry = visitedId
    ? flatItems.find(({ item }) => item.id === visitedId)
    : undefined;
  const firstUncompleted = flatItems.find(({ item }) => !completedSet.has(item.id));
  const targetEntry = visitedEntry ?? firstUncompleted ?? flatItems[0];

  return {
    completedCount,
    totalCount,
    pct,
    resumeLessonId: targetEntry ? targetEntry.item.id : '',
    currentModuleTitle: targetEntry ? targetEntry.moduleTitle : course.modules[0]?.title ?? '',
  };
}

export function computeInProgressCourses(
  progress: LearnProgressState,
  courses: Course[]
): InProgressCourseEntry[] {
  const entries: Array<InProgressCourseEntry & { updatedAt: number; isLastActive: boolean }> = [];

  for (const course of courses) {
    const summary = computeCourseProgress(progress, course);
    if (summary.totalCount === 0 || summary.completedCount >= summary.totalCount) {
      continue;
    }

    const flatItems = course.modules.flatMap((mod) => mod.items);
    const hasAssessmentOrLabActivity = flatItems.some(
      (item) =>
        Boolean(progress.quizScores[item.id]) ||
        Boolean(progress.examAttempts[item.id]?.length) ||
        Boolean(progress.labSteps[item.id]?.length)
    );
    const hasVisited = Boolean(progress.lastVisitedLesson[course.id]);

    if (summary.completedCount === 0 && !hasVisited && !hasAssessmentOrLabActivity) {
      continue;
    }

    const resumeLesson =
      flatItems.find((item) => item.id === summary.resumeLessonId) ?? flatItems[0];
    if (!resumeLesson) {
      continue;
    }

    entries.push({
      course,
      pct: summary.pct,
      completedCount: summary.completedCount,
      totalCount: summary.totalCount,
      currentModuleTitle: summary.currentModuleTitle,
      resumeLesson,
      updatedAt: progress.lastVisitedLesson[course.id]?.updatedAt ?? 0,
      isLastActive: progress.lastActiveCourseId === course.id,
    });
  }

  entries.sort((a, b) => {
    if (a.isLastActive !== b.isLastActive) {
      return a.isLastActive ? -1 : 1;
    }
    return b.updatedAt - a.updatedAt;
  });

  return entries.map(({ updatedAt: _u, isLastActive: _a, ...entry }) => entry);
}

function syncLessonToServer(
  courseId: string,
  lessonId: string,
  status: 'completed' | 'in_progress'
): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return;
  }
  try {
    void fetch('/api/v1/learn/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ courseId, lessonId, status }),
    }).catch(() => {
      // Guest / offline / legacy FK mismatch errors are intentionally ignored
    });
  } catch {
    // Ignore synchronous fetch issues
  }
}

export function useLearnProgress(): UseLearnProgressReturn {
  const [progress, setProgress] = useState<LearnProgressState>(DEFAULT_LEARN_PROGRESS);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const progressRef = useRef<LearnProgressState>(DEFAULT_LEARN_PROGRESS);
  const instanceId = useId();

  useEffect(() => {
    const initial = loadLearnProgress();
    progressRef.current = initial;
    setProgress(initial);
    setHydrated(true);

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        progress?: LearnProgressState;
        sourceId?: string;
      }>;
      if (customEvent.detail?.sourceId === instanceId) {
        return;
      }
      const next = customEvent.detail?.progress
        ? normalizeLearnProgress(customEvent.detail.progress)
        : loadLearnProgress();
      progressRef.current = next;
      setProgress(next);
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key !== LEARN_PROGRESS_STORAGE_KEY && event.key !== null) {
        return;
      }
      let next = normalizeLearnProgress(DEFAULT_LEARN_PROGRESS);
      if (event.newValue) {
        try {
          next = normalizeLearnProgress(JSON.parse(event.newValue));
        } catch {
          next = normalizeLearnProgress(DEFAULT_LEARN_PROGRESS);
        }
      }
      progressRef.current = next;
      setProgress(next);
    };

    window.addEventListener(LEARN_PROGRESS_EVENT, handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);

    // Optional silent server merge for authenticated sessions
    let cancelled = false;
    if (typeof fetch === 'function') {
      fetch('/api/v1/learn/progress', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { progress?: Array<{ lesson_id?: string; status?: string }> } | null) => {
          if (cancelled || !data || !Array.isArray(data.progress)) {
            return;
          }
          const serverCompletedIds = data.progress
            .filter(
              (row) =>
                row?.status === 'completed' &&
                typeof row.lesson_id === 'string' &&
                row.lesson_id.trim().length > 0
            )
            .map((row) => row.lesson_id!.trim());

          if (serverCompletedIds.length === 0) {
            return;
          }

          const current = progressRef.current;
          const mergedSet = new Set(current.completedItemIds);
          let changed = false;
          for (const id of serverCompletedIds) {
            if (!mergedSet.has(id)) {
              mergedSet.add(id);
              changed = true;
            }
          }

          if (changed) {
            const merged = saveLearnProgress({
              ...current,
              completedItemIds: Array.from(mergedSet),
            });
            progressRef.current = merged;
            setProgress(merged);
          }
        })
        .catch(() => {
          // Guests receive 401 or offline error; localStorage remains authoritative
        });
    }

    return () => {
      cancelled = true;
      window.removeEventListener(LEARN_PROGRESS_EVENT, handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [instanceId]);

  const commitProgress = useCallback(
    (updater: (current: LearnProgressState) => LearnProgressState) => {
      const next = saveLearnProgress(updater(progressRef.current));
      progressRef.current = next;
      setProgress(next);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(LEARN_PROGRESS_EVENT, {
            detail: { progress: next, sourceId: instanceId },
          })
        );
      }
    },
    [instanceId]
  );

  const completedSet = useMemo(
    () => new Set(progress.completedItemIds),
    [progress.completedItemIds]
  );

  const isItemCompleted = useCallback(
    (itemId: string) => completedSet.has(itemId),
    [completedSet]
  );

  const markItemCompleted = useCallback(
    (courseId: string, lessonId: string, completed = true) => {
      commitProgress((prev) => reduceMarkItemCompleted(prev, courseId, lessonId, completed));
      syncLessonToServer(courseId, lessonId, completed ? 'completed' : 'in_progress');
    },
    [commitProgress]
  );

  const recordQuizResult = useCallback(
    (
      courseId: string,
      lessonId: string,
      result: Omit<QuizScoreRecord, 'attempts' | 'updatedAt'>
    ) => {
      commitProgress((prev) => reduceRecordQuizResult(prev, courseId, lessonId, result));
      if (result.passed) {
        syncLessonToServer(courseId, lessonId, 'completed');
      }
    },
    [commitProgress]
  );

  const recordExamAttempt = useCallback(
    (
      courseId: string,
      lessonId: string,
      attempt: Omit<ExamAttemptRecord, 'submittedAt'>
    ) => {
      commitProgress((prev) => reduceRecordExamAttempt(prev, courseId, lessonId, attempt));
      if (attempt.passed) {
        syncLessonToServer(courseId, lessonId, 'completed');
      }
    },
    [commitProgress]
  );

  const toggleLabStep = useCallback(
    (courseId: string, lessonId: string, stepIndex: number) => {
      commitProgress((prev) => reduceToggleLabStep(prev, courseId, lessonId, stepIndex));
    },
    [commitProgress]
  );

  const getLabCheckedSteps = useCallback(
    (lessonId: string) => progress.labSteps[lessonId] ?? [],
    [progress.labSteps]
  );

  const setLastVisitedLesson = useCallback(
    (courseId: string, lessonId: string) => {
      const current = progressRef.current;
      if (
        current.lastActiveCourseId === courseId &&
        current.lastVisitedLesson[courseId]?.lessonId === lessonId
      ) {
        return;
      }
      commitProgress((prev) => reduceSetLastVisitedLesson(prev, courseId, lessonId));
      syncLessonToServer(courseId, lessonId, 'in_progress');
    },
    [commitProgress]
  );

  const getCourseProgress = useCallback(
    (course: Course) => computeCourseProgress(progress, course),
    [progress]
  );

  const getInProgressCourses = useCallback(
    (courses: Course[]) => computeInProgressCourses(progress, courses),
    [progress]
  );

  return {
    progress,
    hydrated,
    completedSet,
    isItemCompleted,
    markItemCompleted,
    recordQuizResult,
    recordExamAttempt,
    toggleLabStep,
    getLabCheckedSteps,
    setLastVisitedLesson,
    getCourseProgress,
    getInProgressCourses,
  };
}
