'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Terminal, 
  BookOpen, 
  ShieldAlert, 
  ChevronRight, 
  ArrowDown, 
  Cpu, 
  Play,
  ArrowRight,
  Sparkles,
  MousePointer2,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { InteractiveWavesBackground } from '@/components/ui/InteractiveWavesBackground';
import { useTheme } from './ThemeContext';
import { LiquidEther, TubesBackground, GlowCtaButton } from './EffectsSuite';

export const LandingHero: React.FC = () => {
  const { isDark } = useTheme();
  const [pureWaveMode, setPureWaveMode] = useState<boolean>(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section 
      className={`relative min-h-[92vh] pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden transition-colors duration-300 flex flex-col justify-center ${
        isDark ? 'bg-[#08090A] text-[#E6EDF3]' : 'bg-[#FFFFFF] text-zinc-950'
      }`}
    >
      {/* 1. LiquidEther Navier-Stokes FBO Fluid Solver Hero Backdrop */}
      <LiquidEther 
        colors={isDark ? ['#FF9100', '#FF3D00', '#4F46E5'] : ['#FB923C', '#F59E0B', '#38BDF8']}
        className="absolute inset-0 z-0 opacity-70 dark:opacity-60 pointer-events-none"
        autoDemo={true}
        autoSpeed={0.5}
      />

      {/* Interactive Perlin Waves Background Canvas */}
      <InteractiveWavesBackground 
        lineColor={isDark ? 'rgba(255, 145, 0, 0.45)' : '#000000'}
        lineWidth={isDark ? 1.15 : 1.25}
        waveSpeedX={0.016}
        waveSpeedY={0.008}
        waveAmpX={40}
        waveAmpY={22}
        xGap={10}
        yGap={32}
        friction={0.92}
        tension={0.008}
        maxCursorMove={130}
        className="opacity-100"
      />

      {/* Ambient Glow - Subtle so wave lines remain stark & crisp */}
      {isDark && (
        <div 
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[900px] h-[400px] md:h-[500px] bg-gradient-to-b from-[#FF9100]/15 via-transparent to-transparent rounded-full blur-3xl pointer-events-none -z-10" 
          aria-hidden="true"
        />
      )}

      {/* Pure Waves Full-Canvas Toggle */}
      <div className="absolute top-20 right-6 z-20 hidden sm:flex items-center gap-2">
        <button
          onClick={() => setPureWaveMode(!pureWaveMode)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider flex items-center gap-1.5 border transition-all ${
            pureWaveMode
              ? 'bg-[#FF9100] text-black border-[#FF9100] font-bold shadow-lg'
              : isDark
                ? 'bg-[#111216]/80 text-zinc-400 hover:text-white border-[#20222A] backdrop-blur-md'
                : 'bg-white/80 text-zinc-700 hover:text-black border-slate-300 backdrop-blur-md shadow-sm'
          }`}
          title="Toggle Full Canvas Waves"
        >
          {pureWaveMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span>{pureWaveMode ? 'EXIT CANVAS VIEW' : 'EXPAND WAVES'}</span>
        </button>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10 w-full">
        {/* Central Brand Emblem Display */}
        <div className="flex justify-center mb-6">
          <div className="relative group p-2">
            <div className="absolute -inset-2 bg-gradient-to-r from-[#FF9100]/40 to-purple-500/40 rounded-3xl blur-lg opacity-40 group-hover:opacity-80 transition duration-500" />
            <div className="relative">
              <CortexLogo variant="icon" size="xl" />
            </div>
          </div>
        </div>

        {/* Interactive Waves Indicator Pill */}
        <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-6">
          <div 
            onClick={() => scrollToSection('interactive-showcase')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono tracking-wider shadow-sm hover:scale-105 transition-all cursor-pointer border ${
              isDark 
                ? 'bg-[#111216]/90 border-[#20222A] text-zinc-300 hover:border-[#FF9100]/50' 
                : 'bg-white/90 border-slate-300 text-zinc-800 hover:border-black shadow-md'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FF9100] animate-pulse" />
            <span className="font-semibold">CORTEX PLATFORM v1.0</span>
            <span className="opacity-40">//</span>
            <span className="text-[#FF9100] font-bold">THREE PRODUCTION SUITES</span>
          </div>

          <div 
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono tracking-wider border backdrop-blur-md ${
              isDark
                ? 'bg-[#111216]/60 border-zinc-800 text-zinc-400'
                : 'bg-white/80 border-slate-300 text-zinc-700'
            }`}
          >
            <MousePointer2 className="w-3 h-3 text-[#FF9100]" />
            <span>Move your cursor to distort the lines</span>
          </div>
        </div>

        {/* Master Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 uppercase">
          CODE BEYOND <span className="bg-gradient-to-r from-[#FF9100] via-[#FB7185] to-[#8B5CF6] bg-clip-text text-transparent">LIMITS</span>
        </h1>

        {/* Subtitle */}
        <p className={`max-w-3xl mx-auto text-base sm:text-lg md:text-xl font-normal leading-relaxed mb-10 ${
          isDark ? 'text-zinc-400' : 'text-zinc-700 font-medium'
        }`}>
          A unified cloud developer ecosystem engineered for extreme performance. 
          Seamlessly spanning a standalone multi-language IDE, academic collaborative virtual labs, 
          and high-integrity locked assessment environments.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <GlowCtaButton
            href="/ide"
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-mono font-bold"
          >
            LAUNCH IDE
          </GlowCtaButton>

          <button
            onClick={() => scrollToSection('interactive-showcase')}
            className={`w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-mono tracking-wider transition-all duration-200 flex items-center justify-center gap-2 group border backdrop-blur-md ${
              isDark 
                ? 'bg-[#111216]/90 text-zinc-300 hover:text-white border-[#20222A] hover:border-zinc-700' 
                : 'bg-white/90 text-zinc-900 hover:text-black border-slate-300 hover:border-black shadow-md'
            }`}
          >
            <Play className="w-4 h-4 text-[#FF9100] fill-[#FF9100]" />
            <span>WATCH SHOWCASE</span>
          </button>

          <button
            onClick={() => scrollToSection('cortex-ide')}
            className={`w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm font-mono tracking-wider transition-all duration-200 flex items-center justify-center gap-2 group border backdrop-blur-md ${
              isDark 
                ? 'bg-transparent text-zinc-400 hover:text-white border-transparent hover:border-zinc-800' 
                : 'bg-white/60 text-zinc-700 hover:text-black border-slate-200 hover:border-slate-400'
            }`}
          >
            <Cpu className="w-4 h-4 text-[#FF9100]" />
            <span>16 RUNTIMES</span>
            <ArrowDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5 opacity-60" />
          </button>
        </div>

        {/* 3 Product Quick-Launch Cards with Integrated 3D Tubes & Frosted Overlays */}
        {!pureWaveMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            {/* Card 1: Cortex IDE */}
            <div className="group relative rounded-2xl transition-all duration-300 hover:-translate-y-1.5 overflow-hidden shadow-xl">
              <TubesBackground className="absolute inset-0 z-0 pointer-events-auto">
                <div className={`absolute inset-0 backdrop-blur-md transition-colors pointer-events-none ${
                  isDark ? 'bg-black/55' : 'bg-white/75'
                }`} />
              </TubesBackground>

              <Link
                href="/ide"
                className={`relative z-10 p-6 flex flex-col justify-between h-full border rounded-2xl transition-colors ${
                  isDark 
                    ? 'border-[#1F2024] hover:border-[#FF9100]/60 shadow-black/40 hover:shadow-[0_10px_30px_rgba(255,145,0,0.15)]' 
                    : 'border-slate-300 hover:border-black shadow-slate-900/5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.12)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100]">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-[#FF9100] uppercase font-bold">
                      01 // IDE
                    </span>
                  </div>
                  <h3 className={`text-lg font-bold mb-2 group-hover:text-[#FF9100] transition-colors ${
                    isDark ? 'text-white' : 'text-zinc-950'
                  }`}>
                    Cortex IDE
                  </h3>
                  <p className={`text-xs leading-relaxed mb-4 ${
                    isDark ? 'text-zinc-300' : 'text-zinc-600'
                  }`}>
                    Cloud developer workspace with 16 runtimes, Monaco editor, step debugger, and AI assistant.
                  </p>
                </div>
                <div className={`flex items-center text-xs font-mono transition-colors pt-3 border-t ${
                  isDark 
                    ? 'border-zinc-800 text-zinc-400 group-hover:text-zinc-200' 
                    : 'border-slate-200 text-zinc-600 group-hover:text-black font-medium'
                }`}>
                  <span>Launch Studio</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto transition-transform group-hover:translate-x-1 text-[#FF9100]" />
                </div>
              </Link>
            </div>

            {/* Card 2: Cortex Classroom */}
            <div className="group relative rounded-2xl transition-all duration-300 hover:-translate-y-1.5 overflow-hidden shadow-xl">
              <TubesBackground className="absolute inset-0 z-0 pointer-events-auto">
                <div className={`absolute inset-0 backdrop-blur-md transition-colors pointer-events-none ${
                  isDark ? 'bg-black/55' : 'bg-white/75'
                }`} />
              </TubesBackground>

              <Link
                href="/classroom"
                className={`relative z-10 p-6 flex flex-col justify-between h-full border rounded-2xl transition-colors ${
                  isDark 
                    ? 'border-[#1F2024] hover:border-cyan-500/60 shadow-black/40 hover:shadow-[0_10px_30px_rgba(6,182,212,0.15)]' 
                    : 'border-slate-300 hover:border-cyan-600 shadow-slate-900/5 hover:shadow-[0_10px_30px_rgba(6,182,212,0.15)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-500">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-cyan-500 uppercase font-bold">
                      02 // CLASSROOM
                    </span>
                  </div>
                  <h3 className={`text-lg font-bold mb-2 group-hover:text-cyan-600 transition-colors ${
                    isDark ? 'text-white' : 'text-zinc-950'
                  }`}>
                    Cortex Classroom
                  </h3>
                  <p className={`text-xs leading-relaxed mb-4 ${
                    isDark ? 'text-zinc-300' : 'text-zinc-600'
                  }`}>
                    Academic collaboration platform with multi-cursor sync, WebRTC AV lecture stage, and auto-grader.
                  </p>
                </div>
                <div className={`flex items-center text-xs font-mono transition-colors pt-3 border-t ${
                  isDark 
                    ? 'border-zinc-800 text-zinc-400 group-hover:text-zinc-200' 
                    : 'border-slate-200 text-zinc-600 group-hover:text-cyan-700 font-medium'
                }`}>
                  <span>Enter Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto transition-transform group-hover:translate-x-1 text-cyan-500" />
                </div>
              </Link>
            </div>

            {/* Card 3: Cortex Browser */}
            <div className="group relative rounded-2xl transition-all duration-300 hover:-translate-y-1.5 overflow-hidden shadow-xl">
              <TubesBackground className="absolute inset-0 z-0 pointer-events-auto">
                <div className={`absolute inset-0 backdrop-blur-md transition-colors pointer-events-none ${
                  isDark ? 'bg-black/55' : 'bg-white/75'
                }`} />
              </TubesBackground>

              <Link
                href="/lockdown"
                className={`relative z-10 p-6 flex flex-col justify-between h-full border rounded-2xl transition-colors ${
                  isDark 
                    ? 'border-[#1F2024] hover:border-purple-500/60 shadow-black/40 hover:shadow-[0_10px_30px_rgba(168,85,247,0.15)]' 
                    : 'border-slate-300 hover:border-purple-600 shadow-slate-900/5 hover:shadow-[0_10px_30px_rgba(168,85,247,0.15)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-500">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-purple-500 uppercase font-bold">
                      03 // BROWSER
                    </span>
                  </div>
                  <h3 className={`text-lg font-bold mb-2 group-hover:text-purple-600 transition-colors ${
                    isDark ? 'text-white' : 'text-zinc-950'
                  }`}>
                    Cortex Browser
                  </h3>
                  <p className={`text-xs leading-relaxed mb-4 ${
                    isDark ? 'text-zinc-300' : 'text-zinc-600'
                  }`}>
                    High-integrity assessment kiosk with Win32 hook suppression, display exclusion, and telemetry watchdog.
                  </p>
                </div>
                <div className={`flex items-center text-xs font-mono transition-colors pt-3 border-t ${
                  isDark 
                    ? 'border-zinc-800 text-zinc-400 group-hover:text-zinc-200' 
                    : 'border-slate-200 text-zinc-600 group-hover:text-purple-700 font-medium'
                }`}>
                  <span>Security Preview</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto transition-transform group-hover:translate-x-1 text-purple-500" />
                </div>
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
