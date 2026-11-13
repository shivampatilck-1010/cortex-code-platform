'use client';

import React, { useRef } from 'react';
import Link from 'next/link';

export interface InteractiveGlowButtonProps {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'book-call' | 'dark';
  className?: string;
  glowColor?: string;
  showArrow?: boolean;
  showUnderline?: boolean;
  id?: string;
}

/**
 * Interactive call-to-action button featuring:
 * - #070708 base background
 * - Slide-in blur entrance animation
 * - Dynamic cursor-tracked radial glow driven by CSS variables (--x, --y)
 * - Underline expansion on hover
 * - Right-arrow SVG icon with animated hover shift
 */
export function InteractiveGlowButton({
  href,
  onClick,
  children,
  variant = 'primary',
  className = '',
  glowColor = 'rgba(255, 145, 0, 0.42)',
  showArrow = true,
  showUnderline = true,
  id,
}: InteractiveGlowButtonProps) {
  const ref = useRef<HTMLElement | null>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--x', `${x}px`);
    el.style.setProperty('--y', `${y}px`);
  };

  const isDarkBase = variant === 'primary' || variant === 'dark' || variant === 'book-call';

  const baseClasses = [
    'group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-6 py-3 text-xs font-semibold tracking-wide transition-all duration-300 select-none cursor-pointer animate-slide-blur-in',
    isDarkBase
      ? 'border border-[#FF9100]/50 bg-[#070708] text-white shadow-[0_0_20px_-3px_rgba(255,145,0,0.35)] hover:border-[#FF9100] hover:shadow-[0_0_35px_rgba(255,145,0,0.55)] hover:scale-[1.02]'
      : 'border border-zinc-300 bg-white/95 text-zinc-950 dark:border-white/15 dark:bg-[#070708] dark:text-zinc-100 hover:border-black dark:hover:border-[#FF9100] hover:scale-[1.02]',
    className,
  ].filter(Boolean).join(' ');

  const innerContent = (
    <>
      {/* Outer ambient cursor-following halo glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[1px] rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-75"
        style={{
          background: 'radial-gradient(140px circle at var(--x, 50%) var(--y, 50%), rgba(255, 145, 0, 0.55), transparent 80%)',
        }}
      />
      {/* Cursor-tracked radial glow driven by --x and --y */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(120px circle at var(--x, 50%) var(--y, 50%), ${glowColor}, transparent 75%)`,
        }}
      />
      {/* Subtle inner glass rim */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full border border-white/10 opacity-60"
      />
      {/* Foreground Content with Underline Expansion and Arrow Icon Shift */}
      <span className="relative z-10 flex items-center gap-2">
        <span className="relative inline-block font-mono font-bold tracking-wider">
          {children}
          {showUnderline && (
            <span
              aria-hidden="true"
              className="absolute -bottom-1 left-0 h-[1.5px] w-0 bg-gradient-to-r from-[#FF9100] via-amber-400 to-[#FF9100] transition-all duration-300 ease-out group-hover:w-full rounded-full"
            />
          )}
        </span>
        {showArrow && (
          <svg
            className="h-3.5 w-3.5 text-[#FF9100] transition-transform duration-300 ease-out group-hover:translate-x-1.5 group-hover:scale-110"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.5 8H12.5M12.5 8L8.5 4M12.5 8L8.5 12"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        id={id}
        href={href}
        ref={ref as React.RefObject<HTMLAnchorElement>}
        onPointerMove={handlePointerMove}
        className={baseClasses}
      >
        {innerContent}
      </Link>
    );
  }

  return (
    <button
      id={id}
      type="button"
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      onPointerMove={handlePointerMove}
      className={baseClasses}
    >
      {innerContent}
    </button>
  );
}

export default InteractiveGlowButton;
