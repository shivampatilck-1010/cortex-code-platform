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

/* ================= 1. HEADER NAVBAR COMPONENT ================= */
function LandingHeaderNav({
  isDark,
  theme,
  setTheme,
}: {
  isDark: boolean;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
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

        <nav className="hidden items-center gap-6 text-xs font-medium md:flex">
          <a href="#ide" className="hover:text-[#FF9100] transition-colors">
            01 // IDE
          </a>
          <a href="#classroom" className="hover:text-[#FF9100] transition-colors">
            02 // Classroom
          </a>
          <a href="#browser" className="hover:text-[#FF9100] transition-colors">
            03 // Browser
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {/* Light / Dark Mode Switch (Default Light) */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[11px] transition-all ${
              isDark
                ? 'border-white/15 bg-white/[0.04] text-zinc-200 hover:border-[#FF9100]/50'
                : 'border-zinc-300 bg-zinc-100 text-zinc-800 hover:border-[#FF9100]'
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
                : 'border-zinc-300 bg-white/80 text-zinc-800'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF9100] shadow-[0_0_10px_#FF9100]" />
            <span className="font-mono text-[11px] font-medium tracking-[0.16em]">
              CORTEX PLATFORM v1.0 // THREE PRODUCTION SUITES
            </span>
          </div>

          <h1
            className={`text-5xl font-semibold tracking-tight sm:text-7xl lg:text-[5.25rem] lg:leading-[1.02] ${
              isDark
                ? 'bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent'
                : 'text-zinc-950'
            }`}
          >
            CODE BEYOND LIMITS
          </h1>

          <p
            className={`mt-6 max-w-2xl text-base leading-relaxed sm:text-lg ${
              isDark ? 'text-zinc-300' : 'text-zinc-600'
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
                  : 'border-zinc-200 bg-white/90 shadow-lg hover:border-[#FF9100]'
              }`}
            >
              <TubesBackground enableClickInteraction={true} className="min-h-[270px]">
                <div
                  className={`flex h-full min-h-[270px] flex-col justify-between p-6 backdrop-blur-[2px] ${
                    isDark ? 'bg-black/55' : 'bg-white/75'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold tracking-widest text-[#FF9100]">
                        {card.index} //
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-wider ${
                          card.badge === 'PRODUCTION'
                            ? isDark
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-emerald-600/30 bg-emerald-500/10 text-emerald-700'
                            : 'border-[#FF9100]/40 bg-[#FF9100]/15 text-[#FF9100]'
                        }`}
                      >
                        {card.badge}
                      </span>
                    </div>

                    <h2 className="mt-4 text-lg font-semibold tracking-tight">
                      {card.title}
                    </h2>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                      {card.subtitle}
                    </p>
                    <p
                      className={`mt-3 text-sm leading-relaxed ${
                        isDark ? 'text-zinc-300' : 'text-zinc-600'
                      }`}
                    >
                      {card.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-400/20 pt-4">
                    <span className="font-mono text-[10px] text-zinc-400">
                      CLICK CARD TO RANDOMIZE 3D TUBES
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

/* ================= 3. STICKY PROGRESS NAV COMPONENT ================= */
function LandingStickyNav({ activeSection }: { activeSection: string }) {
  return (
    <div className="sticky top-20 z-40 mx-auto my-8 flex w-full max-w-fit justify-center px-4">
      <nav
        className="flex flex-wrap items-center justify-center gap-1 rounded-full border p-1.5 shadow-2xl backdrop-blur-xl border-zinc-200 bg-white/90 dark:border-white/[0.1] dark:bg-[#0D0F12]/85"
      >
        {[
          { id: 'ide', label: '01 // CORTEX IDE' },
          { id: 'classroom', label: '02 // CORTEX CLASSROOM' },
          { id: 'browser', label: '03 // CORTEX BROWSER (IN DEVELOPMENT)' },
        ].map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            className={`rounded-full px-4 py-1.5 font-mono text-[11px] tracking-wider transition-all ${
              activeSection === tab.id
                ? 'bg-[#FF9100] font-semibold text-[#08090A] shadow-[0_0_20px_-2px_rgba(255,145,0,0.6)]'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

/* ================= 4. FOOTER COMPONENT ================= */
function LandingFooter() {
  return (
    <footer className="border-t border-zinc-200/60 dark:border-white/[0.07] py-12 text-center font-mono text-xs text-zinc-500">
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

  useEffect(() => {
    const ids = ['ide', 'classroom', 'browser'];
    const observers = ids.map((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActiveSection(id);
          });
        },
        { rootMargin: '-35% 0px -50% 0px' }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  return (
    <div className={isDark ? 'dark' : ''}>
      <div
        className={`min-h-screen transition-colors duration-300 ${
          isDark ? 'bg-[#08090A] text-zinc-100' : 'bg-[#F8FAFC] text-zinc-900'
        }`}
      >
        {/* ================= HEADER NAVBAR ================= */}
        <LandingHeaderNav isDark={isDark} theme={theme} setTheme={setTheme} />

        {/* ================= HERO SECTION ================= */}
        <LandingHero isDark={isDark} />

        {/* ================= STICKY PILL PROGRESS NAV ================= */}
        <LandingStickyNav activeSection={activeSection} />

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
                <div className="inline-flex items-center rounded-full border border-[#FF9100]/40 bg-[#FF9100]/10 px-3 py-1 font-mono text-[11px] tracking-widest text-[#FF9100]">
                  PRODUCT 01 // DEVELOPER WORKSPACE
                </div>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Cortex IDE
                </h2>
                <p
                  className={`mt-4 text-sm leading-relaxed sm:text-base ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
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
                      : 'border-amber-500/40 bg-amber-50/70'
                  }`}
                >
                  <InteractiveWavesBackground
                    lineColor={
                      isDark ? 'rgba(255, 145, 0, 0.24)' : 'rgba(234, 88, 12, 0.2)'
                    }
                    xGap={12}
                    yGap={26}
                  />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-[#FF9100]">
                      <span>CUT-OUT TELEMETRY // 16 RUNTIMES</span>
                      <span>EDGE SANDBOX</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed">
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
                    <span className="font-mono text-[11px] text-zinc-400">
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
                              ? 'bg-[#FF9100] font-semibold text-[#08090A]'
                              : 'text-zinc-500 hover:text-[#FF9100]'
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
                          : 'border-zinc-300 bg-zinc-50'
                      }`}
                    >
                      <InteractiveWavesBackground
                        lineColor={
                          isDark ? 'rgba(255, 145, 0, 0.25)' : 'rgba(234, 88, 12, 0.22)'
                        }
                        xGap={10}
                        yGap={24}
                      />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-semibold tracking-widest text-[#FF9100]">
                            GEMINI 2.5 FLASH
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </div>
                        <p className="mt-3 text-[11px] leading-relaxed">
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
                <div className="inline-flex items-center rounded-full border border-[#FF9100]/40 bg-[#FF9100]/10 px-3 py-1 font-mono text-[11px] tracking-widest text-[#FF9100]">
                  PRODUCT 02 // ACADEMIC VIRTUAL LABS
                </div>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Cortex Classroom
                </h2>
                <p
                  className={`mt-4 text-sm leading-relaxed sm:text-base ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
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
                      : 'border-zinc-300 bg-white/85 shadow-xl'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-zinc-500/20 pb-3 font-mono text-xs">
                    <span>LAB_ROOM // CS-301-DISTRIBUTED-SYSTEMS</span>
                    <span className="text-emerald-500">28 SYNCED</span>
                  </div>
                  <div className="mt-4 space-y-2 font-mono text-xs">
                    <div className="rounded bg-[#FF9100]/15 px-3 py-2 text-[#FF9100]">
                      [Instructor Cursor] Line 14: raftConsensus.commit()
                    </div>
                    <div className="rounded bg-sky-500/15 px-3 py-2 text-sky-400">
                      [Student_07 Cursor] Line 19: quorum.verifyAppendEntries()
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PRODUCT 03: CORTEX BROWSER (with Aurora + Cut-Out Waves Box) ================= */}
        <section
          id="browser"
          className="relative scroll-mt-28 overflow-hidden border-t border-zinc-200/60 dark:border-white/[0.07] py-24"
        >
          {/* 7. Aurora Borealis OGL Shader Background */}
          <div className="pointer-events-none absolute inset-0 z-0 opacity-45">
            <Aurora
              colorStops={
                isDark
                  ? ['#FF9100', '#FF3232', '#3A29FF']
                  : ['#FDBA74', '#FB7185', '#818CF8']
              }
              amplitude={1.0}
              blend={0.55}
              speed={0.5}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <div className="inline-flex items-center rounded-full border border-[#FF9100]/40 bg-[#FF9100]/10 px-3 py-1 font-mono text-[11px] tracking-widest text-[#FF9100]">
                  PRODUCT 03 // IN DEVELOPMENT
                </div>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Cortex Browser
                </h2>
                <p className="mt-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
                  Native Windows 10/11 x64 Lockdown Kiosk Engine
                </p>

                {/* 3. Small Rectangular Cut-Out Side Box with InteractiveWavesBackground */}
                <div
                  className={`relative mt-6 overflow-hidden border p-5 [clip-path:polygon(0_0,calc(100%-22px)_0,100%_22px,100%_100%,0_100%)] ${
                    isDark
                      ? 'border-white/15 bg-black/65'
                      : 'border-zinc-300 bg-white/85'
                  }`}
                >
                  <InteractiveWavesBackground
                    lineColor={
                      isDark ? 'rgba(255, 145, 0, 0.22)' : 'rgba(234, 88, 12, 0.18)'
                    }
                  />
                  <div className="relative z-10">
                    <div className="font-mono text-[10px] tracking-widest text-[#FF9100]">
                      CLOUDFLARE D1 // 10s AUTO-SAVE ENGINE
                    </div>
                    <p className="mt-2 font-mono text-[11px]">
                      Tables: exams &bull; exam_sections &bull; exam_questions &bull;
                      exam_sessions &bull; exam_integrity_events
                    </p>
                  </div>
                </div>

                <div className="mt-8">
                  <GlowCtaButton href="/lockdown" variant="primary">
                    Open Lockdown Portal &amp; Simulator
                  </GlowCtaButton>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div
                  className={`divide-y rounded-2xl border backdrop-blur-xl ${
                    isDark
                      ? 'divide-white/[0.07] border-white/15 bg-[#0C0E12]/90'
                      : 'divide-zinc-200 border-zinc-300 bg-white/90 shadow-xl'
                  }`}
                >
                  {[
                    {
                      file: 'DisplayAffinity.cs',
                      api: 'SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)',
                      desc: 'Forces black capture frames across OBS, Discord, Teams, Zoom, and Snipping Tool.',
                    },
                    {
                      file: 'KeyboardHook.cs',
                      api: 'Win32 WH_KEYBOARD_LL',
                      desc: 'Suppresses WinKey, Alt+Tab, Ctrl+Shift+Esc, PrintScreen. Supervisor exit: Ctrl+Alt+F10.',
                    },
                    {
                      file: 'ProcessWatchdog.cs',
                      api: '1,500ms Kernel Poll',
                      desc: 'Continuously scans active background processes against a 40+ prohibited app blacklist.',
                    },
                  ].map((item) => (
                    <div key={item.file} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                        <span className="font-semibold">{item.file}</span>
                        <span className="rounded border border-[#FF9100]/40 bg-[#FF9100]/10 px-2.5 py-0.5 text-[10px] text-[#FF9100]">
                          {item.api}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">{item.desc}</p>
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
