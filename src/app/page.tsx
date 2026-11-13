'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Terminal, BookOpen, ShieldAlert } from 'lucide-react';
import {
  LiquidEther,
  TubesBackground,
  InteractiveWavesBackground,
  GhostCursor,
  Squares,
  Aurora,
  GlowCtaButton,
  MagnificationDock,
  type DockItemData,
} from '@/components/landing/EffectsSuite';

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
    badge: 'IN DEVELOPMENT',
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
  return (
    <header
      className={`sticky top-0 z-50 w-full border-b backdrop-blur-xl transition-colors ${
        isDark
          ? 'border-white/[0.08] bg-[#08090A]/80'
          : 'border-zinc-200/80 bg-white/80'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              isDark ? 'border-white/10 bg-white/[0.03]' : 'border-zinc-200 bg-zinc-100'
            }`}
          >
            <img
              src="/brand/cortex-logo-transparent.png"
              alt="Cortex"
              className="h-6 w-6 object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="font-mono text-xs font-bold text-[#FF9100]">CX</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-[0.18em]">CORTEX</span>
            <span className="hidden font-mono text-[10px] tracking-widest text-zinc-500 sm:inline">
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
                : 'border-zinc-300 bg-zinc-100 text-black hover:border-zinc-950'
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

          <GlowCtaButton href="/ide" variant="primary">
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
            <GlowCtaButton href="/ide" variant="primary">
              Launch Standalone IDE
            </GlowCtaButton>
            <GlowCtaButton href="/classroom" variant="secondary">
              Explore Virtual Classroom
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
                  : 'border-zinc-300 bg-white/95 shadow-lg hover:border-black'
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
                    <GlowCtaButton href={card.href} variant="primary" className="px-4 py-1.5">
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

/* ================= 3. STICKY PROGRESS NAV COMPONENT (MagnificationDock) ================= */
function LandingStickyNav({
  activeSection,
  onSelectSection,
}: {
  activeSection: string;
  onSelectSection: (id: string) => void;
}) {
  const dockItems: DockItemData[] = [
    {
      label: '01 // CORTEX IDE (16 Cloud Runtimes)',
      active: activeSection === 'ide',
      onClick: () => {
        onSelectSection('ide');
        const el = document.getElementById('ide');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      icon: (
        <span
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-mono text-xs tracking-wider transition-all cursor-pointer ${
            activeSection === 'ide'
              ? 'bg-[#FF9100] font-bold text-black shadow-[0_0_24px_rgba(255,145,0,0.7)]'
              : 'font-bold text-zinc-950 hover:text-black dark:text-zinc-300 dark:hover:text-white'
          }`}
        >
          <Terminal className="h-3.5 w-3.5 text-current" />
          <span>01 // CORTEX IDE</span>
        </span>
      ),
    },
    {
      label: '02 // CORTEX CLASSROOM (Academic Virtual Labs)',
      active: activeSection === 'classroom',
      onClick: () => {
        onSelectSection('classroom');
        const el = document.getElementById('classroom');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      icon: (
        <span
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-mono text-xs tracking-wider transition-all cursor-pointer ${
            activeSection === 'classroom'
              ? 'bg-[#FF9100] font-bold text-black shadow-[0_0_24px_rgba(255,145,0,0.7)]'
              : 'font-bold text-zinc-950 hover:text-black dark:text-zinc-300 dark:hover:text-white'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-current" />
          <span>02 // CORTEX CLASSROOM</span>
        </span>
      ),
    },
    {
      label: '03 // CORTEX BROWSER (Win32 Kiosk Security)',
      active: activeSection === 'browser',
      onClick: () => {
        onSelectSection('browser');
        const el = document.getElementById('browser');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
      icon: (
        <span
          className={`flex items-center gap-2 rounded-full px-5 py-2 font-mono text-xs tracking-wider transition-all cursor-pointer ${
            activeSection === 'browser'
              ? 'bg-[#FF9100] font-bold text-black shadow-[0_0_24px_rgba(255,145,0,0.7)]'
              : 'font-bold text-zinc-950 hover:text-black dark:text-zinc-300 dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5 text-current" />
          <span>03 // CORTEX BROWSER</span>
        </span>
      ),
    },
  ];

  return (
    <div className="sticky top-20 z-40 mx-auto my-8 flex w-full max-w-fit justify-center px-4">
      <MagnificationDock
        items={dockItems}
        magnification={58}
        baseItemSize={48}
        distance={160}
        panelHeight={52}
      />
    </div>
  );
}

/* ================= 4. FOOTER COMPONENT ================= */
function LandingFooter() {
  return (
    <footer className="border-t border-zinc-200/60 dark:border-white/[0.07] py-12 text-center font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
      CORTEX PLATFORM v1.0 // CODE BEYOND LIMITS // LIGHT &amp; DARK ADAPTIVE SUITE
    </footer>
  );
}

/* ================= MASTER EXPORT: CORTEX LANDING PAGE ================= */
export default function CortexLandingPage() {
  // Default Light Theme (Alabaster #F8FAFC) with Dark Mode toggle (Obsidian #08090A)
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [selectedRuntime, setSelectedRuntime] = useState(0);
  const [activeSection, setActiveSection] = useState('ide');
  const isDark = theme === 'dark';
  const currentRt = RUNTIMES[selectedRuntime];

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  // Robust, accurate scroll-spy tracking for sticky pill navigation
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['ide', 'classroom', 'browser'];
      const scrollPos = window.scrollY + 280;

      // Bottom detection: if scrolled near the bottom of document, prioritize 'browser'
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 380
      ) {
        setActiveSection('browser');
        return;
      }

      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const top = el.offsetTop;
          if (scrollPos >= top) {
            setActiveSection(sections[i]);
            return;
          }
        }
      }
      setActiveSection('ide');
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
                  <GlowCtaButton href="/ide" variant="primary">
                    Launch Standalone IDE
                  </GlowCtaButton>
                  <GlowCtaButton href={currentRt.route} variant="secondary">
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
                  <GlowCtaButton href="/classroom" variant="primary">
                    Enter Classroom Suite
                  </GlowCtaButton>
                  <GlowCtaButton href="/classroom/teams" variant="secondary">
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
                      className={`sticky rounded-2xl border transition-all duration-300 overflow-hidden ${
                        isDark
                          ? 'border-white/10 bg-[#1A1A1B] shadow-[0_0_40px_rgba(0,0,0,0.4)] text-white'
                          : 'border-zinc-300 bg-white/95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] text-zinc-950'
                      }`}
                    >
                      {/* Dark Mode ONLY: Aurora WebGL + Gradient Overlay + Glowing Blurs */}
                      {isDark && (
                        <>
                          {/* Background Gradient to blend with Aurora */}
                          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40 z-10 pointer-events-none" />

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
                          <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
                          <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
                        </>
                      )}

                      {/* Foreground Content */}
                      <div className="relative z-20 p-6 sm:p-8 flex flex-col justify-between min-h-[290px]">
                        {/* Header */}
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className="font-bold tracking-widest text-[#EA580C] dark:text-[#FF94B4]">
                                {card.index} //
                              </span>
                              <span className="font-semibold text-zinc-600 dark:text-white/60">
                                {card.subsystem}
                              </span>
                            </div>
                            <h3 className="mt-1 text-2xl font-extrabold tracking-tight text-black dark:text-white">
                              {card.file}
                            </h3>
                            <p className="mt-2 text-xs sm:text-sm max-w-md leading-relaxed font-medium text-zinc-800 dark:text-white/70">
                              {card.desc}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {card.badges.map((badge) => (
                              <span
                                key={badge}
                                className={`px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                                  isDark
                                    ? 'bg-white/10 text-white/90 border border-white/10 backdrop-blur-sm'
                                    : 'bg-zinc-100 text-zinc-900 border border-zinc-300 shadow-sm'
                                }`}
                              >
                                {badge}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* API Banner */}
                        <div
                          className={`my-5 rounded-xl border p-3.5 ${
                            isDark
                              ? 'border-white/10 bg-black/40 backdrop-blur-md text-amber-300'
                              : 'border-zinc-200 bg-zinc-50 shadow-sm text-black'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                            <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>{card.api}</span>
                            </div>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                                isDark
                                  ? 'bg-white/10 text-zinc-300'
                                  : 'bg-zinc-200 text-zinc-800'
                              }`}
                            >
                              {card.spec}
                            </span>
                          </div>
                        </div>

                        {/* Card Footer / Telemetry */}
                        <div
                          className={`flex flex-wrap items-center justify-between gap-2 border-t pt-4 font-mono text-[11px] font-semibold ${
                            isDark
                              ? 'border-white/10 text-white/60'
                              : 'border-zinc-200 text-zinc-700'
                          }`}
                        >
                          <div>{card.metric}</div>
                          <div className="font-bold text-emerald-700 dark:text-emerald-400">
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
        <LandingFooter />
      </div>
    </div>
  );
}
