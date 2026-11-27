'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { triggerThemeRippleTransition } from '@/lib/theme/ripple-transition';

export type CortexThemeMode = 'dark' | 'light';
export type CortexThemeName = 'cortex-dark' | 'cortex-light';

export interface UseCortexThemeReturn {
  isDarkMode: boolean;
  theme: CortexThemeName;
  setThemeMode: (mode: CortexThemeMode) => void;
  toggleTheme: (origin?: { x: number; y: number }) => void;
}

export const CORTEX_THEME_STORAGE_KEY = 'cortex_ide_theme';
export const CORTEX_THEME_EVENT = 'cortex:theme-change';

function syncDocumentDarkClass(mode: CortexThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', mode === 'dark');
}

function readStoredThemeMode(): CortexThemeMode {
  if (typeof window === 'undefined') return 'dark';
  try {
    const raw = window.localStorage.getItem(CORTEX_THEME_STORAGE_KEY);
    return raw === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function useCortexTheme(): UseCortexThemeReturn {
  // Initialize to 'dark' so SSR and first client render match without hydration mismatch.
  const [mode, setMode] = useState<CortexThemeMode>('dark');
  const modeRef = useRef<CortexThemeMode>('dark');
  const pendingTargetRef = useRef<CortexThemeMode | null>(null);

  useEffect(() => {
    const initialMode = readStoredThemeMode();
    modeRef.current = initialMode;
    syncDocumentDarkClass(initialMode);
    setMode(initialMode);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== CORTEX_THEME_STORAGE_KEY && event.key !== null) {
        return;
      }
      const nextMode: CortexThemeMode = event.newValue === 'light' ? 'light' : 'dark';
      pendingTargetRef.current = null;
      if (nextMode !== modeRef.current) {
        modeRef.current = nextMode;
        syncDocumentDarkClass(nextMode);
        setMode(nextMode);
      } else {
        syncDocumentDarkClass(nextMode);
      }
    };

    const handleCustomThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: CortexThemeMode; isDarkMode?: boolean }>;
      const detailMode = customEvent.detail?.mode;
      const nextMode: CortexThemeMode =
        detailMode === 'light' || detailMode === 'dark'
          ? detailMode
          : typeof customEvent.detail?.isDarkMode === 'boolean'
            ? customEvent.detail.isDarkMode
              ? 'dark'
              : 'light'
            : readStoredThemeMode();

      pendingTargetRef.current = null;
      if (nextMode !== modeRef.current) {
        modeRef.current = nextMode;
        syncDocumentDarkClass(nextMode);
        setMode(nextMode);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CORTEX_THEME_EVENT, handleCustomThemeChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(CORTEX_THEME_EVENT, handleCustomThemeChange);
    };
  }, []);

  const setThemeMode = useCallback((nextMode: CortexThemeMode) => {
    pendingTargetRef.current = null;
    modeRef.current = nextMode;
    setMode(nextMode);
    syncDocumentDarkClass(nextMode);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CORTEX_THEME_STORAGE_KEY, nextMode);
      } catch {
        // Ignore storage errors in restricted environments
      }
      window.dispatchEvent(
        new CustomEvent(CORTEX_THEME_EVENT, {
          detail: { mode: nextMode, isDarkMode: nextMode === 'dark' },
        })
      );
    }
  }, []);

  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => {
      const currentEffective = pendingTargetRef.current ?? modeRef.current;
      const nextMode: CortexThemeMode = currentEffective === 'dark' ? 'light' : 'dark';

      if (
        origin &&
        typeof origin.x === 'number' &&
        typeof origin.y === 'number' &&
        Number.isFinite(origin.x) &&
        Number.isFinite(origin.y) &&
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      ) {
        pendingTargetRef.current = nextMode;
        triggerThemeRippleTransition(origin.x, origin.y, nextMode, () => {
          setThemeMode(nextMode);
        });
        return;
      }

      setThemeMode(nextMode);
    },
    [setThemeMode]
  );

  return {
    isDarkMode: mode === 'dark',
    theme: mode === 'dark' ? 'cortex-dark' : 'cortex-light',
    setThemeMode,
    toggleTheme,
  };
}
