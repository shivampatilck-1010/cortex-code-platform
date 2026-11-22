'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LiquidEther,
  TubesBackground,
  InteractiveWavesBackground,
  GhostCursor,
  Squares,
  Aurora,
  GlowCtaButton,
} from '@/components/landing/EffectsSuite';
import { InteractiveVideoShowcase } from '@/components/landing/InteractiveVideoShowcase';

const RUNTIMES = [
  {
    id: 'cpp',
    label: 'C++ 20',
    route: '/cpp',
    file: 'main.cpp',
    code: `#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> nodes = {10, 20, 30, 40};\n    for (int n : nodes) std::cout << n * 2 << " ";\n    return 0;\n}`,
  },
  {
    id: 'python',
    label: 'Python 3.12',
    route: '/python',
    file: 'engine.py',
    code: `def telemetry_stream(packets: list[int]) -> float:\n    active = [p for p in packets if p > 0]\n    return sum(active) / len(active)\n\nprint(f"AVG_LATENCY: {telemetry_stream([12, 18, 9, 14]):.2f}ms")`,
  },
  {
    id: 'rust',
    label: 'Rust',
    route: '/rust',
    file: 'main.rs',
    code: `fn main() {\n    let runtimes = ["cpp", "py", "rs", "ts", "go"];\n    println!("Cortex Cloud Sandbox Ready: {} targets", runtimes.len());\n}`,
  },
  {
    id: 'typescript',
    label: 'TypeScript',
    route: '/typescript',
    file: 'worker.ts',
    code: `export async function executeEdge(runtime: string): Promise<number> {\n  const started = performance.now();\n  return Math.round(performance.now() - started);\n}`,
  },
];

const HERO_CARDS = [
  {
    index: '01',
    title: 'CORTEX IDE',
    subtitle: 'Developer Workspace',
    description:
      '16 isolated cloud runtimes, Monaco editor, step debugger, cloud shell terminal, and Gemini 2.5 Flash AI.',
    href: '/ide',
    cta: 'Open Workspace',
    badge: 'PRODUCTION',
  },
  {
    index: '02',
    title: 'CORTEX CLASSROOM',
    subtitle: 'Academic Virtual Labs',
    description:
      'Multi-tenant courses, real-time multi-cursor code sync, WebRTC AV stage, whiteboard, and project teams.',
    href: '/classroom',
    cta: 'Enter Classroom',
    badge: 'PRODUCTION',
  },
  {
    index: '03',
    title: 'CORTEX BROWSER',
    subtitle: 'Lockdown Kiosk Engine',
    description:
      'Native Windows Win32 display affinity, WH_KEYBOARD_LL hooks, process watchdog, and 10s auto-save.',
    href: '/lockdown',
    cta: 'View Architecture',
    badge: 'PRODUCTION',
  },
];

const STACKING_CARDS = [
  {
    index: '01',
    file: 'DisplayAffinity.cs',
    subsystem: 'WIN32 GPU HARDWARE MASK',
    api: 'SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE)',
    desc: 'Forces hardware-accelerated black capture frames across OBS Studio, Discord Screenshare, Microsoft Teams, Zoom, and Windows Snipping Tool.',
    badges: ['Win32 API', 'GPU Mask', 'WDA_EXCLUDEFROMCAPTURE'],
    spec: 'Desktop Window Manager Hook',
    metric: 'CAPTURE LATENCY: 0ms // DWM BUFFER',
    status: 'STATUS: ACTIVE ENFORCEMENT',
  },
  {
    index: '02',
    file: 'KeyboardHook.cs',
    subsystem: 'LOW-LEVEL KERNEL INTERCEPTION',
    api: 'SetWindowsHookEx(WH_KEYBOARD_LL, HookCallback, ...)',
    desc: 'Hardware scan-code interception suppressing WinKey, Alt+Tab, Ctrl+Alt+Del, Ctrl+Shift+Esc, and PrintScreen. Supervisor override: Ctrl+Alt+F10.',
    badges: ['WH_KEYBOARD_LL', 'Ring 3 Hook', 'Low-Level'],
    spec: 'Hardware Scan Codes Suppressed',
    metric: 'SCAN CODES: INTERCEPTED // HOTKEYS: MUTED',
    status: 'SUPERVISOR EXIT: Ctrl+Alt+F10',
  },
  {
    index: '03',
    file: 'ProcessWatchdog.cs',
    subsystem: 'CONTINUOUS PROCESS SENTINEL',
    api: 'System.Diagnostics.Process Watchdog Daemon',
    desc: 'Continuously scans active host background processes against a 40+ prohibited binary blacklist (Wireshark, Cheat Engine, IDA Pro, x64dbg, VMware).',
    badges: ['1,500ms Poll', '40+ Blacklist', 'Anti-Cheat'],
    spec: '1,500ms Kernel Thread Loop',
    metric: 'POLL INTERVAL: 1,500ms // HOST AUDIT',
    status: 'SIGNATURES: 40+ VERIFIED',
  },
  {
    index: '04',
    file: 'ClipboardGuard.cs',
    subsystem: 'AIR-GAPPED BUFFER ISOLATION',
    api: 'OpenClipboard() & EmptyClipboard() Sanitation',
    desc: 'Enforces strict clipboard sandboxing, scrubbing host clipboard buffers every second and isolating candidate memory from unauthorized IPC injection.',
    badges: ['Memory Sandbox', 'Air-Gapped IPC', 'Buffer Scrub'],
    spec: 'Ephemeral Memory Wipe',
    metric: 'BUFFER LEAK: 0 BYTES // PERIODIC PURGE',
    status: 'SANDBOX: AIR-GAPPED',
  },
];

/* ================= 1. HEADER NAVBAR COMPONENT ================= */
function LandingHeaderNav({
  isDark,
  theme,
  setTheme,
  activeSection,
  onSelectSection,
}: {
  isDark: boolean;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  activeSection: string;
  onSelectSection: (id: string) => void;
}) {
  const [logoError, setLogoError] = useState(false);

  return (
    <header
      className={`sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-colors ${
        isDark
          ? 'border-white/[0.08] bg-[#08090A]/80'
          : 'border-zinc-200/80 bg-white/80'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 group focus:outline-none"
          aria-label="Cortex Platform"
        >
          <div className="relative flex items-center justify-center h-8 w-8 flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
            {logoError ? (
              <span className="font-mono text-xs font-bold text-[#FF9100]">CX</span>
            ) : (
              <img
                src="/brand/cortex-emblem.png"
                alt="Cortex Emblem"
                className="h-7 w-7 object-contain drop-shadow-[0_2px_8px_rgba(255,145,0,0.25)]"
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold tracking-[0.16em] text-zinc-950 dark:text-white">
              CORTEX
            </span>
            <span className="hidden sm:inline font-mono text-[10px] font-bold tracking-[0.2em] text-[#FF9100]">
              PLATFORM
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-xs font-semibold md:flex">
          <a
            href="#ide"
            onClick={() => onSelectSection('ide')}
            className={`transition-colors ${
              activeSection === 'ide'
                ? 'text-[#FF9100]'
                : 'text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-[#FF9100]'
            }`}
          >
            01 // IDE
          </a>
          <a
            href="#classroom"
            onClick={() => onSelectSection('classroom')}
            className={`transition-colors ${
              activeSection === 'classroom'
                ? 'text-[#FF9100]'
                : 'text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-[#FF9100]'
            }`}
          >
            02 // Classroom
          </a>
          <a
            href="#browser"
            onClick={() => onSelectSection('browser')}
            className={`transition-colors ${
              activeSection === 'browser'
                ? 'text-[#FF9100]'
                : 'text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-[#FF9100]'
            }`}
          >
            03 // Browser
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {/* Light / Dark Mode Switch (Default Light) */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] font-bold transition-all ${
              isDark
                ? 'border-white/15 bg-white/[0.04] text-zinc-200 hover:border-[#FF9100]/50'
                : 'border-zinc-300 bg-zinc-100 text-black hover:border-zinc-400'
            }`}
            aria-label="Toggle color theme"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isDark ? 'bg-[#FF9100] shadow-[0_0_8px_#FF9100]' : 'bg-amber-500'
              }`}
            />
            <span>{isDark ? 'DARK // OBSIDIAN' : 'LIGHT // ALABASTER'}</span>
          </button>

          <GlowCtaButton href="/ide" target="_blank" rel="noopener noreferrer" variant="primary">
            Launch IDE
          </GlowCtaButton>
        </div>
      </div>
    </header>
  );
}

/* ================= 2. HERO SECTION COMPONENT (LiquidEther + Tubes Cards) ================= */
function LandingHero({ isDark }: { isDark: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200/60 dark:border-white/[0.07] pb-24 pt-20">
      {/* 0. LiquidEther WebGL Fluid Simulation Background */}
      <div className="absolute inset-0 z-0 opacity-65">
        <LiquidEther
          colors={
            isDark
              ? ['#FF9100', '#FF3D00', '#4F46E5']
              : ['#FB923C', '#F59E0B', '#38BDF8']
          }
          mouseForce={24}
          cursorSize={115}
          autoDemo={true}
          autoSpeed={0.55}
          autoIntensity={2.3}
          resolution={0.5}
          BFECC={true}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div
            className={`mb-7 inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 backdrop-blur-md ${
              isDark
                ? 'border-white/15 bg-black/50 text-zinc-200'
                : 'border-zinc-300 bg-white/80 text-black font-semibold'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9100] shadow-[0_0_10px_#FF9100]" />
            <span className="font-mono text-[11px] font-bold tracking-[0.16em]">
              CORTEX PLATFORM v1.0 // THREE PRODUCTION SUITES
            </span>
          </div>

          <h1
            className={`text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-[5.25rem] lg:leading-[1.02] ${
              isDark
                ? 'bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent'
                : 'text-black'
            }`}
          >
            CODE BEYOND LIMITS
          </h1>

          <p
            className={`mt-6 max-w-2xl text-base leading-relaxed sm:text-lg font-medium ${
              isDark ? 'text-zinc-300' : 'text-zinc-800'
            }`}
          >
            One unified engineering architecture decoupled into three standalone systems:
            high-speed cloud compilation, synchronous academic virtual labs, and native
            proctored examination security.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <GlowCtaButton href="/ide" target="_blank" rel="noopener noreferrer" variant="primary">
              Launch Standalone IDE
            </GlowCtaButton>
            <GlowCtaButton href="/classroom" target="_blank" rel="noopener noreferrer" variant="book-call">
              Book a Call // Live Lab Tour
            </GlowCtaButton>
          </div>
        </div>

        {/* 1 & 2. Three Quick-Launch Cards Powered by TubesBackground */}
        <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-3">
          {HERO_CARDS.map((card) => (
            <div
              key={card.index}
              className={`group relative rounded-2xl border overflow-hidden transition-all duration-300 ${
                isDark
                  ? 'border-white/[0.12] bg-[#0B0D11]/90 hover:border-[#FF9100]/60'
                  : 'border-zinc-300 bg-white/95 shadow-lg hover:border-zinc-400'
              }`}
            >
              <TubesBackground enableClickInteraction={true} className="min-h-[270px]">
                <div
                  className={`flex h-full min-h-[270px] flex-col justify-between p-6 backdrop-blur-[2px] ${
                    isDark ? 'bg-black/55' : 'bg-white/80'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold tracking-widest text-[#FF9100]">
                        {card.index} //
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
                          card.badge === 'PRODUCTION'
                            ? isDark
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-emerald-600/30 bg-emerald-500/15 text-emerald-800'
                            : 'border-[#FF9100]/40 bg-[#FF9100]/15 text-[#FF9100]'
                        }`}
                      >
                        {card.badge}
                      </span>
                    </div>

                    <h2 className="mt-4 text-lg font-bold tracking-tight text-black dark:text-white">
                      {card.title}
                    </h2>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-500">
                      {card.subtitle}
                    </p>
                    <p
                      className={`mt-3 text-sm leading-relaxed font-medium ${
                        isDark ? 'text-zinc-300' : 'text-zinc-800'
                      }`}
                    >
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-400/20 pt-4">
                    <span className="font-mono text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                      CLICK TO RANDOMIZE 3D TUBES
                    </span>
                    <GlowCtaButton
                      href={card.href}
                      target={card.href === '/lockdown' ? undefined : '_blank'}
                      rel={card.href === '/lockdown' ? undefined : 'noopener noreferrer'}
                      variant="primary"
                      className="px-4 py-1.5"
                    >
                      {card.cta}
                    </GlowCtaButton>
                  </div>
                </div>
              </TubesBackground>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================= 3. STICKY PROGRESS NAV COMPONENT ================= */
// Removed: Redundant with sticky header bar (LandingHeaderNav)
function LandingStickyNav(_props?: {
  activeSection?: string;
  onSelectSection?: (id: string) => void;
}) {
  return null;
}

/* ================= 4. GIANT ARCHITECTURAL FOOTER COMPONENT ('EX' FLOATING ONLY) ================= */
function LandingFooter({ isDark }: { isDark?: boolean }) {
  const footerRef = React.useRef<HTMLElement>(null);
  const letterERef = React.useRef<HTMLSpanElement>(null);
  const letterXRef = React.useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let ticking = false;
    let isListening = false;

    const updateTransforms = () => {
      if (footerRef.current) {
        const rect = footerRef.current.getBoundingClientRect();
        const winH = window.innerHeight || 800;
        const totalRange = rect.height + winH;
        const currentPos = winH - rect.top;
        const progress = Math.max(0, Math.min(1, currentPos / totalRange));

        if (letterERef.current) {
          const yE = Math.round(20 + progress * 18);
          letterERef.current.style.transform = `translateY(-${yE}px) rotate(-4deg)`;
        }
        if (letterXRef.current) {
          const yX = Math.round(45 + progress * 25);
          letterXRef.current.style.transform = `translateY(-${yX}px) rotate(8deg)`;
        }
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateTransforms);
        ticking = true;
      }
    };

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined' && footerRef.current) {
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (!isListening) {
              window.addEventListener('scroll', handleScroll, { passive: true });
              isListening = true;
            }
            updateTransforms();
          } else {
            if (isListening) {
              window.removeEventListener('scroll', handleScroll);
              isListening = false;
            }
          }
        },
        { rootMargin: '400px 0px 400px 0px', threshold: 0 }
      );
      io.observe(footerRef.current);
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
      isListening = true;
      updateTransforms();
    }

    return () => {
      if (io) io.disconnect();
      if (isListening) {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <footer
      ref={footerRef}
      className="relative w-full overflow-hidden border-t border-zinc-200/80 dark:border-white/[0.08] bg-[#F8FAFC] dark:bg-[#08090A] pt-16 sm:pt-24 pb-8 transition-colors duration-300"
    >
      <style>{`
        @keyframes antigravity-bob-e {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes antigravity-bob-x {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-14px);
          }
        }
      `}</style>

      {/* Decorative ambient background glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-gradient-to-b from-[#FF9100]/15 via-[#FF3D00]/5 to-transparent blur-3xl opacity-60 dark:opacity-30" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ================= MINIMALIST SINGLE-FRAME VIDEO SHOWCASE (BEFORE EXPERIENCE LIMITLESS CODE) ================= */}
        <div className="pb-16 sm:pb-24">
          <InteractiveVideoShowcase isDark={isDark} />
        </div>

        {/* Upper Navigation & Mission Statement Grid */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 pb-14">
          {/* Left Column: Heading, Subtitle & Action CTAs */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF9100]/40 bg-[#FF9100]/10 px-3 py-1 font-mono text-[11px] font-bold tracking-widest text-[#FF9100]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF9100] animate-pulse" />
              <span>CORTEX PLATFORM v1.0 // LIFTOFF</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-zinc-950 dark:text-white leading-[1.08]">
              Experience limitless code
            </h2>

            <p className="text-sm sm:text-base leading-relaxed font-medium text-zinc-700 dark:text-zinc-400 max-w-md">
              Three decoupled high-performance developer runtimes engineered for modern engineering workflows: instant zero-install cloud compilation, live collaborative classrooms, and tamper-resistant assessment kiosks.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <GlowCtaButton href="/ide" target="_blank" rel="noopener noreferrer" variant="primary">
                Launch Standalone IDE
              </GlowCtaButton>
              <Link
                href="/classroom"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-mono font-bold tracking-wider border border-zinc-300 dark:border-white/15 bg-white/90 dark:bg-white/5 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors shadow-sm"
              >
                <span>Enter Classroom</span>
                <span className="text-[#FF9100]">&rarr;</span>
              </Link>
            </div>
          </div>

          {/* Right Columns: Multi-Column Product, Platform & Resources Directory */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 font-mono">
            {/* Column 1: Product */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-950 dark:text-white">
                Product
              </div>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <Link href="/ide" target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Cortex IDE
                  </Link>
                </li>
                <li>
                  <Link href="/classroom" target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Cortex Classroom
                  </Link>
                </li>
                <li>
                  <Link href="/lockdown" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Cortex Browser
                  </Link>
                </li>
                <li>
                  <Link href="/cpp" target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    C++ 20 Sandbox
                  </Link>
                </li>
                <li>
                  <Link href="/python" target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Python 3.12 Engine
                  </Link>
                </li>
                <li>
                  <Link href="/rust" target="_blank" rel="noopener noreferrer" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Rust Toolchain
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Platform */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-950 dark:text-white">
                Platform
              </div>
              <ul className="space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                <li>Cloudflare D1 Storage</li>
                <li>Durable Objects Rooms</li>
                <li>Kernel Hook Watchdog</li>
                <li>DisplayAffinity Mask</li>
                <li>Air-Gapped IPC Scrub</li>
                <li>WebRTC Mesh Grid</li>
              </ul>
            </div>

            {/* Column 3: Resources */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-950 dark:text-white">
                Resources
              </div>
              <ul className="space-y-2.5 text-xs">
                <li>
                  <Link href="/downloads" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/shivampatilck-1010/cortex-code-platform"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors flex items-center gap-1"
                  >
                    <span>GitHub</span>
                    <span className="text-[10px] text-[#FF9100]">&nearr;</span>
                  </a>
                </li>
                <li>
                  <Link href="/lockdown" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Security Whitepaper
                  </Link>
                </li>
                <li>
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Status: Operational</span>
                  </div>
                </li>
                <li>
                  <Link href="/login" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
                    Terminal Login
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ================= MASSIVE ARCHITECTURAL WORDMARK: 'EX' FLOATING ONLY ================= */}
        <div className="relative w-full overflow-hidden select-none border-t border-zinc-200/80 dark:border-white/[0.08] pt-12 pb-6 sm:pt-20 sm:pb-12">
          <div className="w-full flex items-baseline justify-center font-black tracking-tighter text-[19vw] leading-[0.82] text-zinc-950 dark:text-white select-none transition-colors duration-300">
            {/* Grounded letters: C - O - R - T */}
            <span className="inline-block">C</span>
            <span className="inline-block">O</span>
            <span className="inline-block">R</span>
            <span className="inline-block">T</span>

            {/* Only last two letters float: E (modeled after 't' in Antigravity) */}
            <span
              ref={letterERef}
              style={{
                transform: 'translateY(-20px) rotate(-4deg)',
                transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              className="inline-block transform-gpu hover:-translate-y-10 hover:rotate-[-6deg] hover:text-[#FF9100] transition-all duration-300 cursor-default"
            >
              <span
                className="inline-block"
                style={{
                  animation: 'antigravity-bob-e 4s ease-in-out infinite',
                }}
              >
                E
              </span>
            </span>

            {/* Only last two letters float: X (modeled after 'Y' in Antigravity) */}
            <span
              ref={letterXRef}
              style={{
                transform: 'translateY(-45px) rotate(8deg)',
                transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              className="inline-block transform-gpu hover:-translate-y-14 hover:rotate-[12deg] hover:text-[#FF9100] transition-all duration-300 cursor-default"
            >
              <span
                className="inline-block"
                style={{
                  animation: 'antigravity-bob-x 3.6s ease-in-out infinite',
                  animationDelay: '0.4s',
                }}
              >
                X
              </span>
            </span>
          </div>
        </div>

        {/* ================= BOTTOM LEGAL & SOCIAL SUBFOOTER ================= */}
        <div className="border-t border-zinc-200/80 dark:border-white/[0.08] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
            <div className="flex items-center gap-2 font-bold text-zinc-950 dark:text-white">
              <img
                src="/brand/cortex-emblem.png"
                alt="Cortex"
                className="h-4 w-4 object-contain"
              />
              <span>CORTEX PLATFORM</span>
            </div>
            <span>&bull;</span>
            <Link href="/privacy" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/security" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
              Security
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <span>EDGE POPS: 300+</span>
            <span>UPTIME: 99.99%</span>
            <span>&copy; 2026 Cortex</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

class LandingErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any) {
    console.warn('[LandingErrorBoundary] Caught unhandled landing error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070708] text-white flex flex-col items-center justify-center p-8 text-center font-mono">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-[#FF9100]">CORTEX PLATFORM</h1>
            <p className="text-sm text-zinc-400">High-performance universal code platform and examination kiosk.</p>
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <a href="/ide" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full bg-[#FF9100] text-black font-semibold text-xs hover:bg-[#ffaa33]">Launch Cloud IDE</a>
              <a href="/classroom" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 rounded-full border border-zinc-700 text-white text-xs hover:border-[#FF9100]">Classroom Hub</a>
              <a href="/arena" className="px-5 py-2.5 rounded-full border border-zinc-700 text-white text-xs hover:border-[#FF9100]">Competitive Arena</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= MASTER EXPORT: CORTEX LANDING PAGE ================= */
function CortexLandingPageInner() {
  // Default Light Theme (Alabaster #F8FAFC) with Dark Mode toggle (Obsidian #08090A)
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [selectedRuntime, setSelectedRuntime] = useState(0);
  const [activeSection, setActiveSection] = useState('ide');
  const isDark = theme === 'dark';
  const currentRt = RUNTIMES[selectedRuntime];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const projId = params.get('projectId');
      if (projId) {
        window.location.replace(`/ide?projectId=${encodeURIComponent(projId)}`);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  // High-performance rAF-throttled scroll-spy tracking for sticky pill navigation
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const sections = ['ide', 'classroom', 'browser'];
          const scrollPos = window.scrollY + 280;

          // Bottom detection: if scrolled near the bottom of document, prioritize 'browser'
          if (
            window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 380
          ) {
            setActiveSection((prev) => (prev !== 'browser' ? 'browser' : prev));
            ticking = false;
            return;
          }

          for (let i = sections.length - 1; i >= 0; i--) {
            const el = document.getElementById(sections[i]);
            if (el) {
              const top = el.offsetTop;
              if (scrollPos >= top) {
                const target = sections[i];
                setActiveSection((prev) => (prev !== target ? target : prev));
                ticking = false;
                return;
              }
            }
          }
          setActiveSection((prev) => (prev !== 'ide' ? 'ide' : prev));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div
        className={`min-h-screen transition-colors duration-300 ${
          isDark ? 'bg-[#08090A] text-zinc-100' : 'bg-[#F8FAFC] text-zinc-900'
        }`}
      >
        {/* ================= HEADER NAVBAR ================= */}
        <LandingHeaderNav
          isDark={isDark}
          theme={theme}
          setTheme={setTheme}
          activeSection={activeSection}
          onSelectSection={(id) => setActiveSection(id)}
        />

        {/* ================= HERO SECTION ================= */}
        <LandingHero isDark={isDark} />

        {/* ================= STICKY PILL PROGRESS NAV ================= */}
        <LandingStickyNav
          activeSection={activeSection}
          onSelectSection={(id) => setActiveSection(id)}
        />

        {/* ================= PRODUCT 01: CORTEX IDE (with Squares + Cut-out Waves Side Panel) ================= */}
        <section id="ide" className="relative scroll-mt-28 overflow-hidden py-24">
          {/* 6. Squares Animated Grid Background */}
          <div className="absolute inset-0 z-0 opacity-75">
            <Squares
              direction="diagonal"
              speed={0.4}
              squareSize={44}
              borderColor={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.06)'}
              hoverFillColor={isDark ? 'rgba(255,145,0,0.14)' : 'rgba(255,145,0,0.18)'}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center rounded-full border border-[#FF9100]/40 bg-[#FF9100]/10 px-3 py-1 font-mono text-[11px] font-bold tracking-widest text-[#FF9100]">
                  PRODUCT 01 // DEVELOPER WORKSPACE
                </div>
                <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl text-black dark:text-white">
                  Cortex IDE
                </h2>
                <p
                  className={`mt-4 text-sm leading-relaxed sm:text-base font-medium ${
                    isDark ? 'text-zinc-400' : 'text-zinc-800'
                  }`}
                >
                  Write, step-debug, and benchmark across 16 cloud runtimes with Monaco
                  IntelliSense, interactive Cloud Shell terminal, and Gemini 2.5 Flash AI.
                </p>

                {/* 3. Small Rectangular Cut-Out Side Card with InteractiveWavesBackground */}
                <div
                  className={`relative mt-8 overflow-hidden border p-5 [clip-path:polygon(0_0,calc(100%-20px)_0,100%_20px,100%_100%,0_100%)] ${
                    isDark
                      ? 'border-[#FF9100]/35 bg-[#0D1016]/90'
                      : 'border-zinc-300 bg-white/95 shadow-md'
                  }`}
                >
                  <InteractiveWavesBackground
                    lineColor={
                      isDark ? 'rgba(255, 145, 0, 0.24)' : 'rgba(0, 0, 0, 0.12)'
                    }
                    xGap={12}
                    yGap={26}
                  />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between font-mono text-xs font-bold tracking-widest text-black dark:text-[#FF9100]">
                      <span>CUT-OUT TELEMETRY // 16 RUNTIMES</span>
                      <span>EDGE SANDBOX</span>
                    </div>
                    <p className="mt-2 font-mono text-xs font-semibold leading-relaxed text-black dark:text-zinc-200">
                      Sub-15ms cold starts across C++20, Python 3.12, Rust, TypeScript, Go,
                      Java, C#, Kotlin, Swift, Ruby, PHP, Bash, SQL, and R.
                    </p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-4">
                  <GlowCtaButton href="/ide" target="_blank" rel="noopener noreferrer" variant="primary">
                    Launch Standalone IDE
                  </GlowCtaButton>
                  <GlowCtaButton href={currentRt.route} target="_blank" rel="noopener noreferrer" variant="secondary">
                    Open {currentRt.route} Compiler
                  </GlowCtaButton>
                </div>
              </div>

              {/* Right Monaco + Cut-Out Gemini 2.5 Flash Side Panel */}
              <div className="lg:col-span-7">
                <div
                  className={`overflow-hidden rounded-2xl border shadow-2xl ${
                    isDark
                      ? 'border-white/[0.1] bg-[#0C0E12]'
                      : 'border-zinc-300 bg-white'
                  }`}
                >
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${
                      isDark ? 'border-white/[0.07] bg-white/[0.02]' : 'border-zinc-200 bg-zinc-50'
                    }`}
                  >
                    <span className="font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                      cortex-ide // {currentRt.file}
                    </span>
                    <div className="flex items-center gap-1">
                      {RUNTIMES.map((rt, idx) => (
                        <button
                          key={rt.id}
                          type="button"
                          onClick={() => setSelectedRuntime(idx)}
                          className={`rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors ${
                            selectedRuntime === idx
                              ? 'bg-[#FF9100] font-bold text-[#08090A]'
                              : 'text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-[#FF9100]'
                          }`}
                        >
                          {rt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3">
                    <div className="p-5 font-mono text-xs leading-6 md:col-span-2">
                      <pre className="overflow-x-auto whitespace-pre">
                        <code>{currentRt.code}</code>
                      </pre>
                    </div>

                    {/* 3. Small Rectangular Cut-Out Side Panel with InteractiveWavesBackground */}
                    <div
                      className={`relative m-3 overflow-hidden border p-4 [clip-path:polygon(0_0,calc(100%-16px)_0,100%_16px,100%_100%,16px_100%,0_calc(100%-16px))] ${
                        isDark
                          ? 'border-white/15 bg-[#090B0E]'
                          : 'border-zinc-300 bg-white shadow-sm'
                      }`}
                    >
                      <InteractiveWavesBackground
                        lineColor={
                          isDark ? 'rgba(255, 145, 0, 0.25)' : 'rgba(0, 0, 0, 0.12)'
                        }
                        xGap={10}
                        yGap={24}
                      />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold tracking-widest text-black dark:text-[#FF9100]">
                            GEMINI 2.5 FLASH
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </div>
                        <p className="mt-3 font-mono text-xs font-semibold leading-relaxed text-black dark:text-zinc-200">
                          O(n) linear pass verified. Step debugger ready at Breakpoint Line 5.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PRODUCT 02: CORTEX CLASSROOM (with GhostCursor Trail) ================= */}
        <section
          id="classroom"
          className={`relative scroll-mt-28 overflow-hidden border-t py-24 ${
            isDark ? 'border-white/[0.07] bg-[#0A0C0F]' : 'border-zinc-200 bg-zinc-100/70'
          }`}
        >
          {/* 4 & 5. GhostCursor Smoky Bloom Trail */}
          <GhostCursor
            color={isDark ? '#FF9100' : '#EA580C'}
            brightness={isDark ? 1.2 : 0.9}
            trailLength={24}
            inertia={0.45}
            bloomStrength={0.4}
            mixBlendMode={isDark ? 'screen' : 'multiply'}
            zIndex={1}
          />

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="inline-flex items-center rounded-full border border-[#FF9100]/40 bg-[#FF9100]/10 px-3 py-1 font-mono text-[11px] font-bold tracking-widest text-[#FF9100]">
                  PRODUCT 02 // ACADEMIC VIRTUAL LABS
                </div>
                <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl text-black dark:text-white">
                  Cortex Classroom
                </h2>
                <p
                  className={`mt-4 text-sm leading-relaxed sm:text-base font-medium ${
                    isDark ? 'text-zinc-400' : 'text-zinc-800'
                  }`}
                >
                  Move your cursor across this section to preview the fluid multi-cursor
                  presence trail. Synchronize code, WebRTC AV lecture stages, whiteboards,
                  and team grading in real time.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <GlowCtaButton href="/classroom" target="_blank" rel="noopener noreferrer" variant="primary">
                    Enter Classroom Suite
                  </GlowCtaButton>
                  <GlowCtaButton href="/classroom/teams" target="_blank" rel="noopener noreferrer" variant="secondary">
                    Project Teams Studio
                  </GlowCtaButton>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div
                  className={`rounded-2xl border p-6 backdrop-blur-xl ${
                    isDark
                      ? 'border-white/10 bg-black/55'
                      : 'border-zinc-300 bg-white/95 shadow-xl text-black'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-zinc-500/20 pb-3 font-mono text-xs font-bold">
                    <span>LAB_ROOM // CS-301-DISTRIBUTED-SYSTEMS</span>
                    <span className="text-emerald-600 dark:text-emerald-400">28 SYNCED</span>
                  </div>
                  <div className="mt-4 space-y-2 font-mono text-xs font-semibold">
                    <div className="rounded bg-[#FF9100]/15 px-3 py-2 text-black dark:text-[#FF9100]">
                      [Instructor Cursor] Line 14: raftConsensus.commit()
                    </div>
                    <div className="rounded bg-sky-500/15 px-3 py-2 text-sky-800 dark:text-sky-300">
                      [Student_07 Cursor] Line 19: quorum.verifyAppendEntries()
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PRODUCT 03: CORTEX BROWSER (with Stacking Cards: Light Alabaster in Light Mode, Aurora in Dark Mode) ================= */}
        <section
          id="browser"
          className="relative scroll-mt-28 overflow-visible border-t border-zinc-200/60 dark:border-white/[0.07] py-24"
        >
          {/* Subtle Aurora Ambient Backdrop (Dark Mode Only) */}
          {isDark && (
            <div className="pointer-events-none absolute inset-0 z-0 opacity-25">
              <Aurora
                colorStops={['#3A29FF', '#FF94B4', '#FF3232']}
                amplitude={1.0}
                blend={0.5}
                speed={0.5}
              />
            </div>
          )}

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
              
              {/* Left Column: Sticky Summary & High-Contrast Black Cut-Out Box */}
              <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start space-y-6">
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-black dark:text-white">
                    Cortex Browser
                  </h2>
                  <p className="mt-2 font-mono text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-400">
                    Native Windows 10/11 x64 Lockdown Kiosk Engine
                  </p>
                  <p className="mt-4 text-sm sm:text-base leading-relaxed font-medium text-zinc-800 dark:text-zinc-300">
                    Hardened, tamper-resistant examination security engine enforcing hardware screen capture blocking, low-level OS hotkey interception, and 1,500ms kernel watchdog.
                  </p>
                </div>

                {/* 3. Small Rectangular Cut-Out Side Box with High-Contrast Black Typography */}
                <div
                  className={`relative overflow-hidden border p-5 [clip-path:polygon(0_0,calc(100%-22px)_0,100%_22px,100%_100%,0_100%)] ${
                    isDark
                      ? 'border-white/15 bg-black/65 text-zinc-100'
                      : 'border-zinc-300 bg-white/95 text-black shadow-md'
                  }`}
                >
                  <InteractiveWavesBackground
                    lineColor={
                      isDark ? 'rgba(255, 145, 0, 0.22)' : 'rgba(0, 0, 0, 0.12)'
                    }
                  />
                  <div className="relative z-10">
                    <div className="font-mono text-xs font-bold tracking-widest text-black dark:text-[#FF9100]">
                      CLOUDFLARE D1 // 10s AUTO-SAVE ENGINE
                    </div>
                    <p className="mt-2 font-mono text-xs font-semibold leading-relaxed text-black dark:text-zinc-200">
                      Tables: exams &bull; exam_sections &bull; exam_questions &bull;
                      exam_sessions &bull; exam_integrity_events
                    </p>
                    <div className="mt-3 flex items-center gap-2 font-mono text-[11px] font-bold text-black dark:text-zinc-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Continuous 10-second transactional integrity checkpoint</span>
                    </div>
                  </div>
                </div>

                <div>
                  <GlowCtaButton href="/lockdown" variant="primary">
                    Open Lockdown Portal &amp; Simulator
                  </GlowCtaButton>
                  <p className="mt-3 font-mono text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                    4 HARDENED KERNEL SUBSYSTEMS // SCROLL TO INSPECT STACKED DECK
                  </p>
                </div>
              </div>

              {/* Right Column: The "Stacking Cards" Deck (Light Card in Light Mode, Aurora in Dark Mode) */}
              <div className="lg:col-span-7 relative">
                <div className="space-y-8 pb-12">
                  {STACKING_CARDS.map((card, idx) => (
                    <div
                      key={card.file}
                      style={{
                        top: `${96 + idx * 28}px`,
                        zIndex: 10 + idx * 10,
                      }}
                      className="sticky rounded-2xl border border-white/15 bg-[#070708] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] text-white transition-all duration-300 overflow-hidden"
                    >
                      {/* Aurora WebGL + Gradient Overlay + Glowing Blurs inside #070708 Card */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 z-10 pointer-events-none" />

                      {/* Aurora WebGL Component */}
                      <div className="absolute inset-0 z-0">
                        <Aurora
                          colorStops={['#3A29FF', '#FF94B4', '#FF3232']}
                          blend={0.5}
                          amplitude={1.0}
                          speed={0.5}
                        />
                      </div>

                      {/* Decorative ambient blurs */}
                      <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
                      <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-purple-500/15 rounded-full blur-3xl pointer-events-none mix-blend-screen" />

                      {/* Foreground Content */}
                      <div className="relative z-20 p-6 sm:p-8 flex flex-col justify-between min-h-[290px]">
                        {/* Header */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className="font-bold tracking-widest text-[#FF94B4]">
                                {card.index} //
                              </span>
                              <span className="font-semibold text-white/60">
                                {card.subsystem}
                              </span>
                            </div>
                            <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
                              {card.file}
                            </h3>
                            <p className="mt-2 text-xs sm:text-sm max-w-md leading-relaxed font-medium text-white/80">
                              {card.desc}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {card.badges.map((badge) => (
                              <span
                                key={badge}
                                className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-white/10 text-white/90 border border-white/10 backdrop-blur-sm"
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* API Banner */}
                        <div className="my-5 rounded-xl border border-white/10 bg-black/50 backdrop-blur-md p-3.5 text-amber-300">
                          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                            <div className="flex items-center gap-2 font-bold text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span>{card.api}</span>
                            </div>
                            <span className="rounded px-2 py-0.5 text-[10px] font-semibold bg-white/10 text-zinc-200">
                              {card.spec}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer / Telemetry */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 font-mono text-[11px] font-semibold text-white/70">
                          <div>{card.metric}</div>
                          <div className="font-bold text-emerald-400">
                            {card.status}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ================= FOOTER ================= */}
        <LandingFooter isDark={isDark} />
      </div>
    </div>
  );
}

export default function CortexLandingPage() {
  return (
    <LandingErrorBoundary>
      <CortexLandingPageInner />
    </LandingErrorBoundary>
  );
}
