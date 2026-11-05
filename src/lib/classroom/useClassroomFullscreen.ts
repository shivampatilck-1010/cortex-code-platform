'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Checks whether native browser fullscreen is currently active across standard and vendor-prefixed APIs.
 */
export function isBrowserFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
}

/**
 * Safely requests native browser fullscreen on the document or target element.
 * Traps user gesture rejections, iframe restrictions, and permission denials gracefully.
 */
export async function requestBrowserFullscreen(targetElement?: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (isBrowserFullscreenActive()) return true;

  const el = targetElement || document.documentElement;
  const requestFn =
    el.requestFullscreen ||
    (el as any).webkitRequestFullscreen ||
    (el as any).mozRequestFullScreen ||
    (el as any).msRequestFullscreen;

  if (!requestFn) return false;

  try {
    await requestFn.call(el);
    try {
      sessionStorage.setItem('cortex_classroom_fs_initiated', 'true');
    } catch {}
    return true;
  } catch (err) {
    // Browser denied fullscreen (e.g. missing user gesture, or security restriction).
    // Graceful fallback: Immersive layout remains 100% active.
    console.info('Browser fullscreen request deferred or restricted:', err);
    return false;
  }
}

/**
 * Safely exits native browser fullscreen if currently active.
 */
export async function exitBrowserFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!isBrowserFullscreenActive()) return;

  const exitFn =
    document.exitFullscreen ||
    (document as any).webkitExitFullscreen ||
    (document as any).mozCancelFullScreen ||
    (document as any).msExitFullscreen;

  if (!exitFn) return;

  try {
    await exitFn.call(document);
  } catch (err) {
    console.info('Browser exitFullscreen notice:', err);
  } finally {
    try {
      sessionStorage.removeItem('cortex_classroom_fs_initiated');
    } catch {}
  }
}

/**
 * Activates Immersive Classroom Mode CSS classes on html and body.
 */
export function enableImmersiveLayout(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.add('cortex-classroom-immersive-root');
  document.body.classList.add('cortex-classroom-immersive');
}

/**
 * Removes Immersive Classroom Mode CSS classes from html and body.
 */
export function disableImmersiveLayout(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('cortex-classroom-immersive-root');
  document.body.classList.remove('cortex-classroom-immersive');
}

export interface UseClassroomFullscreenOptions {
  roomId?: string;
  autoImmersive?: boolean;
  onExitIntentional?: () => void;
}

export interface UseClassroomFullscreenReturn {
  isImmersive: boolean;
  isFullscreen: boolean;
  isExiting: boolean;
  needsRecovery: boolean;
  toggleFullscreen: () => Promise<void>;
  requestFullscreen: () => Promise<boolean>;
  exitFullscreen: () => Promise<void>;
  retryFullscreen: () => Promise<boolean>;
  dismissRecovery: () => void;
  handleExitToIDE: () => Promise<void>;
}

/**
 * Unified hook managing Immersive Classroom Layout, Native Browser Fullscreen,
 * Intentional Exit Guarding, and User-Driven Fullscreen Recovery.
 * 
 * Separates Application Immersive State from Native Fullscreen State:
 *   - Immersive Classroom Mode is persistent while inside Classroom, even if native fullscreen exits.
 *   - Native Fullscreen is tracked synchronously via Fullscreen API events.
 *   - Intentional exit ("Exit to IDE") marks isExiting to prevent false-alarm recovery loops.
 *   - Unexpected native fullscreen exits trigger one immediate recovery attempt IF user activation is active;
 *     otherwise flags needsRecovery to display the professional "Return to Fullscreen" prompt.
 */
export function useClassroomFullscreen(options: UseClassroomFullscreenOptions = {}): UseClassroomFullscreenReturn {
  const { roomId, autoImmersive = true, onExitIntentional } = options;
  const [isImmersive, setIsImmersive] = useState<boolean>(autoImmersive);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [needsRecovery, setNeedsRecovery] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const isExitingRef = useRef<boolean>(false);
  const attemptedAutoRecoveryRef = useRef<boolean>(false);

  // Synchronize initial state on mount
  useEffect(() => {
    isMountedRef.current = true;
    isExitingRef.current = false;
    const active = isBrowserFullscreenActive();
    setIsFullscreen(active);

    if (autoImmersive) {
      enableImmersiveLayout();
      setIsImmersive(true);
    }

    return () => {
      isMountedRef.current = false;
      // Only tear down immersive classes if we are intentionally exiting
      if (isExitingRef.current) {
        disableImmersiveLayout();
      }
    };
  }, [autoImmersive]);

  // First-interaction auto-escalation:
  // If the user arrived via direct URL, bookmark, or page refresh (where modern browser
  // security forbids entering native fullscreen without a prior user gesture),
  // capture their very first click/tap anywhere on the page to seamlessly trigger native fullscreen.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isBrowserFullscreenActive()) return;

    const handleFirstUserInteraction = async () => {
      if (isExitingRef.current || isBrowserFullscreenActive()) return;
      try {
        await requestBrowserFullscreen();
      } catch {}
    };

    window.addEventListener('click', handleFirstUserInteraction, { once: true, capture: true });
    window.addEventListener('keydown', handleFirstUserInteraction, { once: true, capture: true });

    return () => {
      window.removeEventListener('click', handleFirstUserInteraction, { capture: true });
      window.removeEventListener('keydown', handleFirstUserInteraction, { capture: true });
    };
  }, []);

  // Handle native Fullscreen changes and unexpected exit recovery
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = async () => {
      if (!isMountedRef.current) return;
      const active = isBrowserFullscreenActive();
      setIsFullscreen(active);

      if (active) {
        // Fullscreen successfully entered: clear recovery requirements
        setNeedsRecovery(false);
        attemptedAutoRecoveryRef.current = false;
        if (autoImmersive) {
          enableImmersiveLayout();
          setIsImmersive(true);
        }
      } else {
        // Fullscreen was exited.
        // If the user intentionally initiated Exit to IDE, do NOT attempt recovery.
        if (isExitingRef.current) {
          setNeedsRecovery(false);
          return;
        }

        // Classroom remains immersive even when native browser fullscreen is lost
        if (autoImmersive) {
          enableImmersiveLayout();
          setIsImmersive(true);
        }

        // Attempt one immediate fullscreen re-entry request ONLY if a valid user activation is active
        const hasUserActivation = typeof navigator !== 'undefined' && Boolean((navigator as any).userActivation?.isActive);
        if (hasUserActivation && !attemptedAutoRecoveryRef.current) {
          attemptedAutoRecoveryRef.current = true;
          try {
            const recovered = await requestBrowserFullscreen();
            if (recovered && isMountedRef.current) {
              setNeedsRecovery(false);
              return;
            }
          } catch {}
        }

        // If user activation is absent (standard Esc key press) or request was rejected,
        // display the prominent, professional "Return to Fullscreen" prompt.
        if (isMountedRef.current && !isExitingRef.current) {
          setNeedsRecovery(true);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!isMountedRef.current || isExitingRef.current) return;
      if (document.visibilityState === 'visible') {
        const active = isBrowserFullscreenActive();
        setIsFullscreen(active);
        if (!active && autoImmersive) {
          enableImmersiveLayout();
          setNeedsRecovery(true);
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoImmersive]);

  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    if (isExitingRef.current) return false;
    const success = await requestBrowserFullscreen();
    if (isMountedRef.current) {
      const active = isBrowserFullscreenActive();
      setIsFullscreen(active);
      if (active) {
        setNeedsRecovery(false);
      }
    }
    return success;
  }, []);

  const exitFullscreen = useCallback(async (): Promise<void> => {
    await exitBrowserFullscreen();
    if (isMountedRef.current) {
      setIsFullscreen(false);
    }
  }, []);

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    if (isBrowserFullscreenActive()) {
      await exitFullscreen();
    } else {
      await requestFullscreen();
    }
  }, [exitFullscreen, requestFullscreen]);

  const retryFullscreen = useCallback(async (): Promise<boolean> => {
    if (isExitingRef.current) return false;
    return await requestFullscreen();
  }, [requestFullscreen]);

  const dismissRecovery = useCallback((): void => {
    if (isMountedRef.current) {
      setNeedsRecovery(false);
    }
  }, []);

  const handleExitToIDE = useCallback(async (): Promise<void> => {
    isExitingRef.current = true;
    if (isMountedRef.current) {
      setIsExiting(true);
      setNeedsRecovery(false);
    }

    if (isBrowserFullscreenActive()) {
      await exitBrowserFullscreen();
    }
    disableImmersiveLayout();
    if (isMountedRef.current) {
      setIsImmersive(false);
    }

    if (onExitIntentional) {
      onExitIntentional();
    }
  }, [onExitIntentional]);

  return {
    isImmersive,
    isFullscreen,
    isExiting,
    needsRecovery,
    toggleFullscreen,
    requestFullscreen,
    exitFullscreen,
    retryFullscreen,
    dismissRecovery,
    handleExitToIDE,
  };
}
