'use client';

import { useState, useEffect, useCallback } from 'react';

export type PracticeStatus = 'solved' | 'attempted';
export type PracticeProgressMap = Record<string, PracticeStatus | undefined>;

const STORAGE_KEY = 'cortex_practice_progress_v1';

export function usePracticeProgress() {
  const [progressMap, setProgressMap] = useState<PracticeProgressMap>({});

  // Hydrate from localStorage + merge authenticated server solvedChallengeIds
  useEffect(() => {
    let initialMap: PracticeProgressMap = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            initialMap = parsed;
          }
        }
      } catch {}
    }
    setProgressMap(initialMap);

    let active = true;
    fetch('/api/v1/auth/me/dashboard')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.stats?.solvedChallengeIds) return;
        const solvedIds: string[] = Array.isArray(data.stats.solvedChallengeIds)
          ? data.stats.solvedChallengeIds
          : [];
        if (solvedIds.length === 0) return;

        setProgressMap((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const id of solvedIds) {
            if (next[id] !== 'solved') {
              next[id] = 'solved';
              changed = true;
            }
          }
          if (changed && typeof window !== 'undefined') {
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {}
          }
          return changed ? next : prev;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: PracticeProgressMap) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
    }
  }, []);

  const markAttempted = useCallback(
    (challengeId: string) => {
      setProgressMap((prev) => {
        if (prev[challengeId] === 'solved' || prev[challengeId] === 'attempted') {
          return prev;
        }
        const next: PracticeProgressMap = { ...prev, [challengeId]: 'attempted' };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const markSolved = useCallback(
    (challengeId: string) => {
      setProgressMap((prev) => {
        if (prev[challengeId] === 'solved') {
          return prev;
        }
        const next: PracticeProgressMap = { ...prev, [challengeId]: 'solved' };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const getStatus = useCallback(
    (challengeId: string): 'solved' | 'attempted' | 'unsolved' => {
      return progressMap[challengeId] || 'unsolved';
    },
    [progressMap]
  );

  return {
    progressMap,
    markAttempted,
    markSolved,
    getStatus,
  };
}
