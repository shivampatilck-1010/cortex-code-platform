'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  Users, 
  Video, 
  CheckCircle2, 
  ArrowRight, 
  GraduationCap, 
  Sparkles, 
  Code2, 
  PenTool, 
  Award,
  Radio,
  FileCheck,
  Maximize2
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { GhostCursor, GlowCtaButton } from './EffectsSuite';

export const ClassroomProductShowcase: React.FC = () => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'studio' | 'whiteboard' | 'gradebook'>('studio');

  return (
    <section 
      id="cortex-classroom" 
      className={`py-24 border-t relative scroll-mt-24 transition-colors duration-300 ${
        isDark ? 'border-[#1F2024] bg-[#08090A] text-[#E6EDF3]' : 'border-slate-200 bg-[#FFFFFF] text-zinc-950'
      }`}
    >
      {/* Live Multi-Cursor Presence Simulation (GhostCursor Component) */}
      <GhostCursor 
        color={isDark ? '#FF9100' : '#EA580C'}
        mixBlendMode={isDark ? 'screen' : 'multiply'}
        brightness={isDark ? 1.2 : 0.9}
        trailLength={24}
        className="pointer-events-none absolute inset-0 z-0"
      />

      {/* Ambient Glow */}
      <div 
        className="absolute top-1/3 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -z-10" 
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-semibold tracking-wider mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            <span>02 // ACADEMIC COLLABORATION SUITE</span>
          </div>
          <h2 className={`text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            Unified Virtual Computer Science Labs
          </h2>
          <p className={`max-w-3xl text-base sm:text-lg leading-relaxed mb-6 ${
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          }`}>
            Designed for universities and enterprise training cohorts. Featuring peer-to-peer 
            multi-cursor code synchronisation, integrated WebRTC audio/video lecture streaming, 
            mathematical whiteboard workspaces, and instant automated grading rubrics.
          </p>
          <div>
            <GlowCtaButton href="/classroom">
              ENTER CLASSROOM SUITE
            </GlowCtaButton>
          </div>
        </div>

        {/* Interactive Tabs Header */}
        <div className={`flex border-b mb-6 gap-2 sm:gap-4 overflow-x-auto no-scrollbar ${
          isDark ? 'border-[#1F2024]' : 'border-slate-200'
        }`}>
          <button
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-mono transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'studio'
                ? 'border-cyan-400 text-cyan-500 font-semibold'
                : isDark
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Code Studio (Multi-Cursor)</span>
          </button>

          <button
            onClick={() => setActiveTab('whiteboard')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-mono transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'whiteboard'
                ? 'border-cyan-400 text-cyan-500 font-semibold'
                : isDark
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <PenTool className="w-4 h-4" />
            <span>Live Whiteboard &amp; AV Stage</span>
          </button>

          <button
            onClick={() => setActiveTab('gradebook')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-mono transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'gradebook'
                ? 'border-cyan-400 text-cyan-500 font-semibold'
                : isDark
                  ? 'border-transparent text-zinc-400 hover:text-zinc-200'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Automated Gradebook</span>
          </button>
        </div>

        {/* Tab 1: Code Studio Content */}
        {activeTab === 'studio' && (
          <div className={`rounded-2xl border p-6 shadow-2xl transition-colors ${
            isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/10'
          }`}>
            {/* Session Status Bar */}
            <div className={`flex flex-wrap items-center justify-between pb-4 mb-4 border-b gap-2 ${
              isDark ? 'border-[#1F2024]' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className={`text-xs font-mono font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                  ROOM: CS-301-DISTRIBUTED-SYSTEMS
                </span>
                <span className="text-xs font-mono text-zinc-500">
                  // 24 Active Participants
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 font-semibold">
                  CRDT SYNC ACTIVE
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                  isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-100 text-zinc-600'
                }`}>
                  LATENCY: 14ms
                </span>
              </div>
            </div>

            {/* Collaborative Code Window Mockup */}
            <div className="p-4 rounded-xl bg-[#08090A] border border-[#1F2024] font-mono text-xs relative overflow-hidden text-zinc-100">
              <div className="space-y-2">
                <div className="flex gap-4 items-center">
                  <span className="w-6 text-right text-zinc-600 select-none">1</span>
                  <span className="text-purple-400 font-semibold">package</span>
                  <span className="text-zinc-200">main</span>
                </div>

                <div className="flex gap-4 items-center">
                  <span className="w-6 text-right text-zinc-600 select-none">2</span>
                  <span className="text-purple-400 font-semibold">import</span>
                  <span className="text-amber-300">&quot;sync&quot;</span>
                </div>

                <div className="flex gap-4 items-center">
                  <span className="w-6 text-right text-zinc-600 select-none">3</span>
                  <span className="text-purple-400 font-semibold">type</span>
                  <span className="text-cyan-300 font-semibold">RaftNode</span>
                  <span className="text-purple-400 font-semibold">struct</span>
                  <span className="text-zinc-300">&#123;</span>
                </div>

                {/* Line with Prof. Chen's cursor */}
                <div className="flex gap-4 items-center relative py-0.5">
                  <span className="w-6 text-right text-zinc-600 select-none">4</span>
                  <span className="text-zinc-400 pl-4">mu sync.RWMutex</span>
                  <div className="inline-flex items-center ml-2">
                    <span className="w-0.5 h-4 bg-emerald-400 animate-pulse" />
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-mono rounded bg-emerald-500 text-black font-bold">
                      Prof. Chen (Instructor)
                    </span>
                  </div>
                </div>

                {/* Line with Alex K.'s cursor */}
                <div className="flex gap-4 items-center relative py-0.5">
                  <span className="w-6 text-right text-zinc-600 select-none">5</span>
                  <span className="text-zinc-400 pl-4">peers []string</span>
                  <div className="inline-flex items-center ml-2">
                    <span className="w-0.5 h-4 bg-cyan-400 animate-pulse" />
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-mono rounded bg-cyan-400 text-black font-bold">
                      Alex K. (Editing)
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 items-center">
                  <span className="w-6 text-right text-zinc-600 select-none">6</span>
                  <span className="text-zinc-300">&#125;</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Whiteboard & AV Stage */}
        {activeTab === 'whiteboard' && (
          <div className={`rounded-2xl border p-6 shadow-2xl transition-colors ${
            isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/10'
          }`}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: KaTeX Whiteboard Canvas */}
              <div className={`lg:col-span-2 p-6 rounded-xl border relative min-h-[300px] flex flex-col justify-between ${
                isDark ? 'bg-[#08090A] border-[#1F2024]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-700/30">
                  <span className="text-xs font-mono font-semibold text-cyan-500 flex items-center gap-2">
                    <PenTool className="w-3.5 h-3.5" />
                    <span>KaTeX Mathematical Canvas // P2P Broadcast</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">60 FPS Hardware Layer</span>
                </div>

                {/* Simulated Formulas */}
                <div className="space-y-4 my-6 text-center">
                  <div className={`font-mono text-base sm:text-lg tracking-wider ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                    T(n) = 2T(n/2) + O(n) &rArr; O(n log n)
                  </div>
                  <div className="font-mono text-sm text-cyan-500">
                    &forall; v &isin; V, &sum; deg(v) = 2|E| (Euler Handshaking Lemma)
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pt-3 border-t border-zinc-700/30">
                  <span>Vector Strokes: 142</span>
                  <span>Eraser Mode Active</span>
                </div>
              </div>

              {/* Right Col: WebRTC AV Lecture Stage */}
              <div className="space-y-3">
                <div className="text-xs font-mono text-zinc-500 uppercase tracking-wider">
                  Live Lecture Stream (WebRTC)
                </div>

                {/* Host Video Stream Tile */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-[#111216] border-[#20222A]' : 'bg-slate-100 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                      PC
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Prof. Chen</div>
                      <div className="text-[10px] font-mono text-cyan-500">Host (Screen Sharing)</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    LIVE
                  </span>
                </div>

                {/* Participant Tile 1 */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-[#111216] border-[#20222A]' : 'bg-slate-100 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-mono text-xs font-bold">
                      AK
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Alex K.</div>
                      <div className="text-[10px] font-mono text-zinc-500">Student (Speaking)</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-cyan-500/20 text-cyan-500 font-semibold">
                    AUDIO
                  </span>
                </div>

                {/* Participant Tile 2 */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  isDark ? 'bg-[#111216] border-[#20222A]' : 'bg-slate-100 border-slate-200'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-mono text-xs font-bold">
                      SM
                    </div>
                    <div>
                      <div className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>Sarah M.</div>
                      <div className="text-[10px] font-mono text-zinc-500">Student (Muted)</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[9px] font-mono rounded bg-zinc-700/30 text-zinc-500">
                    MUTED
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Gradebook Content */}
        {activeTab === 'gradebook' && (
          <div className={`rounded-2xl border p-6 shadow-2xl transition-colors ${
            isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/10'
          }`}>
            <div className={`flex flex-wrap items-center justify-between pb-4 mb-4 border-b gap-2 ${
              isDark ? 'border-[#1F2024]' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                <span className={`text-xs font-mono font-semibold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  AUTOMATED ASSESSMENT RUNNER // LAB ASSIGNMENT 04
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-500 font-bold border border-emerald-500/30">
                  SCORE: 100 / 100 (100%)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className={`p-4 rounded-xl border ${
                isDark ? 'bg-[#111216] border-[#20222A]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-[10px] font-mono text-zinc-500 mb-1">TEST CASE ACCURACY</div>
                <div className="text-lg font-bold text-emerald-500 font-mono">12 / 12 PASSED</div>
                <div className="text-[11px] text-zinc-400 mt-1">Zero edge-case regressions</div>
              </div>
              <div className={`p-4 rounded-xl border ${
                isDark ? 'bg-[#111216] border-[#20222A]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-[10px] font-mono text-zinc-500 mb-1">TIME COMPLEXITY</div>
                <div className="text-lg font-bold text-cyan-500 font-mono">O(n log n)</div>
                <div className="text-[11px] text-zinc-400 mt-1">Optimal execution path verified</div>
              </div>
              <div className={`p-4 rounded-xl border ${
                isDark ? 'bg-[#111216] border-[#20222A]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="text-[10px] font-mono text-zinc-500 mb-1">EXECUTION BENCHMARK</div>
                <div className="text-lg font-bold text-[#FF9100] font-mono">14ms / 8.2 MB</div>
                <div className="text-[11px] text-zinc-400 mt-1">Well within 500ms safety envelope</div>
              </div>
            </div>

            {/* Rubric Breakdown */}
            <div className={`p-4 rounded-xl border font-mono text-xs space-y-2 ${
              isDark ? 'bg-[#08090A] border-[#1F2024]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">
                Detailed Test Execution Log
              </div>
              <div className={`flex items-center justify-between py-1 border-b ${
                isDark ? 'text-zinc-300 border-zinc-900' : 'text-zinc-700 border-slate-200'
              }`}>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Test 01: Standard Array Partitioning</span>
                </span>
                <span className="text-emerald-500 font-semibold">PASSED (2ms)</span>
              </div>
              <div className={`flex items-center justify-between py-1 border-b ${
                isDark ? 'text-zinc-300 border-zinc-900' : 'text-zinc-700 border-slate-200'
              }`}>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Test 02: Large Dataset Stress Test (N=100,000)</span>
                </span>
                <span className="text-emerald-500 font-semibold">PASSED (8ms)</span>
              </div>
              <div className={`flex items-center justify-between py-1 ${
                isDark ? 'text-zinc-300' : 'text-zinc-700'
              }`}>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Test 03: Negative and Duplicate Values Edge Case</span>
                </span>
                <span className="text-emerald-500 font-semibold">PASSED (1ms)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
