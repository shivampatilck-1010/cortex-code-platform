'use client';

import React from 'react';

let activeGlassAnims: Animation[] = [];
let fallbackTimer: number | null = null;

interface ViewTransitionLike {
  ready: Promise<void>;
  finished: Promise<void>;
}

export function ThemeGlassOverlay() {
  return (
    <>
      <div
        id="themeGlassVeil"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[90]"
      />
      <div id="themeGlassRing" aria-hidden="true" className="z-[91]" />
    </>
  );
}

function triggerGlassWaveOverlay(
  x: number,
  y: number,
  maxRadius: number,
  toDark: boolean
) {
  if (typeof document === 'undefined') return;
  const veil = document.getElementById('themeGlassVeil');
  const ring = document.getElementById('themeGlassRing');
  if (!veil || !ring || typeof veil.animate !== 'function' || typeof ring.animate !== 'function') {
    return;
  }

  activeGlassAnims.forEach((a) => {
    try {
      a.cancel();
    } catch {}
  });
  activeGlassAnims = [];

  veil.style.background = toDark
    ? `radial-gradient(circle at ${x}px ${y}px, rgba(15, 18, 26, 0.28), rgba(21, 24, 30, 0.14))`
    : `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 0.34), rgba(244, 246, 249, 0.16))`;

  const diameter = Math.ceil(maxRadius * 2.15);
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.width = `${diameter}px`;
  ring.style.height = `${diameter}px`;
  ring.style.border = toDark
    ? '1.5px solid rgba(255, 255, 255, 0.24)'
    : '1.5px solid rgba(255, 255, 255, 0.65)';
  ring.style.background = toDark
    ? 'radial-gradient(circle, rgba(243, 145, 46, 0.04) 48%, rgba(255, 255, 255, 0.14) 86%, rgba(243, 145, 46, 0.22) 96%, transparent 100%)'
    : 'radial-gradient(circle, rgba(255, 255, 255, 0.08) 48%, rgba(255, 255, 255, 0.38) 86%, rgba(243, 145, 46, 0.22) 96%, transparent 100%)';
  ring.style.boxShadow = toDark
    ? 'inset 0 0 36px rgba(255, 255, 255, 0.16), 0 0 32px rgba(243, 145, 46, 0.16)'
    : 'inset 0 0 36px rgba(255, 255, 255, 0.55), 0 0 32px rgba(243, 145, 46, 0.18)';

  const veilAnim = veil.animate(
    [{ opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 0 }],
    { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );
  const ringAnim = ring.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.02)', opacity: 0.92 },
      { transform: 'translate(-50%, -50%) scale(0.55)', opacity: 0.72, offset: 0.45 },
      { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 0 },
    ],
    { duration: 660, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );

  activeGlassAnims.push(veilAnim, ringAnim);
}

export function toggleGlassyTheme(
  eventOrOrigin:
    | React.MouseEvent<HTMLElement>
    | { x: number; y: number }
    | null,
  onSyncThemeState?: (isDark: boolean) => void
) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const toDark = !root.classList.contains('dark');
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  let x = window.innerWidth - 36;
  let y = 31;

  if (eventOrOrigin && 'currentTarget' in eventOrOrigin && eventOrOrigin.currentTarget) {
    const btn = eventOrOrigin.currentTarget;
    if (typeof btn.getBoundingClientRect === 'function') {
      const rect = btn.getBoundingClientRect();
      x = Math.round(rect.left + rect.width / 2);
      y = Math.round(rect.top + rect.height / 2);
      btn.classList.remove('is-morphing');
      void btn.offsetWidth;
      btn.classList.add('is-morphing');
      window.setTimeout(() => btn.classList.remove('is-morphing'), 480);
    }
  } else if (
    eventOrOrigin &&
    'x' in eventOrOrigin &&
    typeof eventOrOrigin.x === 'number' &&
    typeof eventOrOrigin.y === 'number'
  ) {
    x = Math.round(eventOrOrigin.x);
    y = Math.round(eventOrOrigin.y);
  }

  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  const applyFlip = () => {
    root.classList.toggle('dark', toDark);
    const val = toDark ? 'dark' : 'light';
    try {
      window.localStorage.setItem('cortex_theme', val);
      window.localStorage.setItem('cortex_ide_theme', val);
    } catch {}
    onSyncThemeState?.(toDark);
  };

  if (prefersReduced) {
    applyFlip();
    return;
  }

  const startVT = (
    document as unknown as {
      startViewTransition?: (cb: () => void) => ViewTransitionLike;
    }
  ).startViewTransition;

  if (typeof startVT === 'function') {
    try {
      const transition = startVT.call(document, () => applyFlip());
      transition.ready
        .then(() => {
          document.documentElement.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${Math.ceil(maxRadius)}px at ${x}px ${y}px)`,
              ],
              opacity: [0.3, 0.92, 1],
              filter: [
                toDark
                  ? 'blur(14px) saturate(140%) brightness(1.12)'
                  : 'blur(14px) saturate(140%) brightness(1.08)',
                'blur(4px) saturate(115%) brightness(1.02)',
                'blur(0px) saturate(100%) brightness(1)',
              ],
            },
            {
              duration: 620,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-new(root)',
            }
          );

          document.documentElement.animate(
            {
              filter: ['blur(0px)', 'blur(7px)'],
              opacity: [1, 0.84],
            },
            {
              duration: 620,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
              pseudoElement: '::view-transition-old(root)',
            }
          );
        })
        .catch(() => {});

      transition.finished
        .then(() => triggerGlassWaveOverlay(x, y, maxRadius, toDark))
        .catch(() => {});
      return;
    } catch {}
  }

  // Fallback glassy radial wave + smooth surface crossfade
  root.classList.add('theme-glass-switching');
  if (fallbackTimer) window.clearTimeout(fallbackTimer);
  triggerGlassWaveOverlay(x, y, maxRadius, toDark);
  window.requestAnimationFrame(() => applyFlip());
  fallbackTimer = window.setTimeout(() => {
    root.classList.remove('theme-glass-switching');
  }, 650);
}
