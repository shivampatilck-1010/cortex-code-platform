'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Terminal, 
  Play, 
  RotateCcw, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  HardDrive, 
  Code2,
  Cpu,
  Layers,
  ChevronRight
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { Squares, GlowCtaButton, InteractiveWavesBackground } from './EffectsSuite';

interface CodeSnippet {
  language: string;
  filename: string;
  code: string[];
  output: string[];
  latency: string;
  memory: string;
}

const SNIPPETS: Record<string, CodeSnippet> = {
  python: {
    language: 'Python',
    filename: 'fibonacci.py',
    code: [
      'def fibonacci(n: int) -> list[int]:',
      '    sequence = [0, 1]',
      '    while len(sequence) < n:',
      '        sequence.append(sequence[-1] + sequence[-2])',
      '    return sequence',
      '',
      'if __name__ == "__main__":',
      '    result = fibonacci(8)',
      '    print(f"Fibonacci series (n=8): {result}")',
    ],
    output: [
      '[Execution Engine: Cloudflare Micro-VM v1.4]',
      'Compiling & Running Python 3.12 (CPython)...',
      'Fibonacci series (n=8): [0, 1, 1, 2, 3, 5, 8, 13]',
      '',
      'Process finished with exit code 0.',
    ],
    latency: '28ms',
    memory: '14.2 MB',
  },
  cpp: {
    language: 'C++',
    filename: 'sum.cpp',
    code: [
      '#include <iostream>',
      '#include <vector>',
      '#include <numeric>',
      '',
      'int main() {',
      '    std::vector<int> numbers = {10, 20, 30, 40, 50};',
      '    int total = std::accumulate(numbers.begin(), numbers.end(), 0);',
      '    std::cout << "Sum: " << total << std::endl;',
      '    return 0;',
      '}',
    ],
    output: [
      '[Execution Engine: LLVM Clang 18.1.0 -O3]',
      'Compilation succeeded in 18ms.',
      'Sum: 150',
      '',
      'Process finished with exit code 0.',
    ],
    latency: '12ms',
    memory: '4.8 MB',
  },
  rust: {
    language: 'Rust',
    filename: 'primes.rs',
    code: [
      'fn main() {',
      '    let mut primes = Vec::new();',
      '    for num in 2..30 {',
      '        if (2..num).all(|d| num % d != 0) {',
      '            primes.push(num);',
      '        }',
      '    }',
      '    println!("Found {} primes: {:?}", primes.len(), primes);',
      '}',
    ],
    output: [
      '[Execution Engine: rustc 1.78.0 --release]',
      'Compiling target/release/main...',
      'Found 10 primes: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]',
      '',
      'Process finished with exit code 0.',
    ],
    latency: '9ms',
    memory: '3.1 MB',
  },
  typescript: {
    language: 'TypeScript',
    filename: 'metrics.ts',
    code: [
      'interface MetricPoint {',
      '  timestamp: number;',
      '  latencyMs: number;',
      '}',
      '',
      'const evaluateSLA = (points: MetricPoint[]): boolean => {',
      '  const avg = points.reduce((acc, p) => acc + p.latencyMs, 0) / points.length;',
      '  return avg < 15.0;',
      '};',
      '',
      'console.log("Edge SLA Check: PASS (<15ms verified)");',
    ],
    output: [
      '[Execution Engine: V8 / Bun 1.4.2 Edge Runtime]',
      'Executing TypeScript AST with zero-transpile delay...',
      'Edge SLA Check: PASS (<15ms verified)',
      '',
      'Process finished with exit code 0.',
    ],
    latency: '7ms',
    memory: '8.4 MB',
  },
};

const RUNTIMES = [
  'Python', 'TypeScript', 'JavaScript', 'C', 'C++', 'Rust',
  'Go', 'Java', 'Kotlin', 'Swift', 'PHP', 'Ruby',
  'C#', 'R', 'SQL', 'Bash'
];

export const IdeProductShowcase: React.FC = () => {
  const { isDark } = useTheme();
  const [selectedLang, setSelectedLang] = useState<string>('python');
  const [isRunning, setIsRunning] = useState(false);
  const [hasExecuted, setHasExecuted] = useState(true);
  const [aiAssistantFixed, setAiAssistantFixed] = useState(false);

  const activeSnippet = SNIPPETS[selectedLang] || SNIPPETS.python;

  const handleRunCode = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasExecuted(true);
    }, 450);
  };

  const handleAiFix = () => {
    setAiAssistantFixed(true);
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setHasExecuted(true);
    }, 600);
  };

  const handleReset = () => {
    setAiAssistantFixed(false);
    setHasExecuted(false);
  };

  return (
    <section 
      id="cortex-ide" 
      className={`py-24 border-t relative scroll-mt-24 transition-colors duration-300 ${
        isDark ? 'border-[#1F2024] bg-[#08090A] text-[#E6EDF3]' : 'border-slate-200 bg-[#FFFFFF] text-zinc-950'
      }`}
    >
      {/* Architectural Engineering Grid (Squares Component) */}
      <Squares 
        borderColor={isDark ? '#1F242D' : '#E2E8F0'}
        hoverFillColor={isDark ? '#2A1C0D' : '#FFEDD5'}
        speed={0.4}
        squareSize={38}
        direction="diagonal"
        className="absolute inset-0 pointer-events-auto"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] text-xs font-mono font-semibold tracking-wider mb-4">
            <Terminal className="w-3.5 h-3.5" />
            <span>01 // STANDALONE CLOUD IDE</span>
          </div>
          <h2 className={`text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            High-Performance Polyglot Workspace
          </h2>
          <p className={`max-w-3xl text-base sm:text-lg leading-relaxed mb-6 ${
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          }`}>
            Engineered completely decoupled from academic classroom infrastructure. 
            Instant execution across 16 runtimes, Monaco-powered syntax intelligence, 
            interactive step-debugging, and sub-50ms cloud sandbox latency.
          </p>
          <div>
            <GlowCtaButton href="/ide">
              LAUNCH STANDALONE IDE
            </GlowCtaButton>
          </div>
        </div>

        {/* 16 Cloud Runtime Badges */}
        <div className={`mb-10 p-4 rounded-xl border transition-colors ${
          isDark ? 'bg-[#0B0C0E]/70 border-[#1F2024]' : 'bg-white/80 border-slate-200 shadow-sm'
        }`}>
          <div className={`text-[11px] font-mono tracking-wider uppercase mb-3 flex items-center justify-between ${
            isDark ? 'text-zinc-500' : 'text-zinc-500'
          }`}>
            <span>Supported Edge Execution Runtimes (16 Total)</span>
            <span className="text-[#FF9100] font-semibold">100% Zero-Install Cloud Sandbox</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {RUNTIMES.map((runtime) => (
              <span
                key={runtime}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
                  isDark 
                    ? 'bg-[#111216] border-[#20222A] text-zinc-300 hover:border-[#FF9100]/50 hover:text-white' 
                    : 'bg-slate-50 border-slate-200 text-zinc-700 hover:border-orange-400 hover:text-zinc-900'
                }`}
              >
                {runtime}
              </span>
            ))}
          </div>
        </div>

        {/* Interactive Editor & Terminal Mockup */}
        <div className={`rounded-2xl border overflow-hidden shadow-2xl transition-colors ${
          isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/10'
        }`}>
          {/* Editor Header Toolbar */}
          <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 transition-colors ${
            isDark ? 'bg-[#111216] border-[#1F2024]' : 'bg-slate-100/90 border-slate-200'
          }`}>
            {/* Language Switcher Tabs */}
            <div className="flex items-center gap-1">
              {(['python', 'cpp', 'rust', 'typescript'] as const).map((langKey) => (
                <button
                  key={langKey}
                  onClick={() => {
                    setSelectedLang(langKey);
                    setAiAssistantFixed(false);
                    setHasExecuted(true);
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                    selectedLang === langKey
                      ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/30 font-semibold'
                      : isDark
                        ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
                  }`}
                >
                  {SNIPPETS[langKey].language}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleRunCode}
                disabled={isRunning}
                className="px-3.5 py-1.5 rounded-md text-xs font-mono font-semibold bg-[#FF9100] text-black hover:bg-[#FFA726] transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isRunning ? 'RUNNING...' : 'RUN CODE'}</span>
              </button>

              <button
                onClick={handleAiFix}
                className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors flex items-center gap-1.5 ${
                  isDark 
                    ? 'bg-[#1a1c24] border-purple-500/30 text-purple-300 hover:bg-purple-500/20' 
                    : 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                }`}
                title="Simulate Gemini AI Code Intelligence"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>AI OPTIMIZE</span>
              </button>

              <button
                onClick={handleReset}
                className={`p-1.5 rounded-md transition-colors ${
                  isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5' : 'text-zinc-400 hover:text-zinc-800 hover:bg-slate-200'
                }`}
                title="Reset simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Code Editor Window */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
            {/* Editor Body */}
            <div className="lg:col-span-7 p-4 font-mono text-xs text-zinc-300 bg-[#08090A] border-b lg:border-b-0 lg:border-r border-[#1F2024] overflow-x-auto">
              <div className="flex items-center justify-between text-zinc-500 text-[11px] pb-3 mb-3 border-b border-zinc-900">
                <span className="flex items-center gap-2">
                  <Code2 className="w-3.5 h-3.5 text-[#FF9100]" />
                  <span>{activeSnippet.filename}</span>
                </span>
                <span>Monaco Language Service Active</span>
              </div>

              {/* Code Lines */}
              <div className="space-y-1">
                {activeSnippet.code.map((line, idx) => (
                  <div key={idx} className="flex gap-4 group">
                    <span className="w-6 text-right text-zinc-600 select-none group-hover:text-zinc-400">
                      {idx + 1}
                    </span>
                    <pre className="text-zinc-300 leading-relaxed font-mono">
                      {line}
                    </pre>
                  </div>
                ))}
              </div>

              {aiAssistantFixed && (
                <div className="mt-4 p-3 rounded-lg bg-purple-950/30 border border-purple-500/30 text-purple-300 text-[11px] flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Gemini 2.5 Flash Optimizer:</span> Code AST verified. Zero heap allocation leaks detected. Vectorized SIMD loop candidate flagged.
                  </div>
                </div>
              )}
            </div>

            {/* Terminal Output Panel */}
            <div className={`lg:col-span-5 p-4 font-mono text-xs flex flex-col justify-between transition-colors ${
              isDark ? 'bg-[#0B0C0E]' : 'bg-slate-900 text-zinc-100'
            }`}>
              <div>
                <div className="flex items-center justify-between text-zinc-500 text-[11px] pb-2 mb-3 border-b border-zinc-800">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Terminal className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>TERMINAL OUTPUT</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Clock className="w-3 h-3" />
                      <span>{activeSnippet.latency}</span>
                    </span>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <HardDrive className="w-3 h-3" />
                      <span>{activeSnippet.memory}</span>
                    </span>
                  </div>
                </div>

                {/* Output Lines */}
                {isRunning ? (
                  <div className="py-12 flex flex-col items-center justify-center text-zinc-400 space-y-2">
                    <div className="w-5 h-5 border-2 border-[#FF9100] border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px]">Executing in sandboxed micro-VM...</span>
                  </div>
                ) : hasExecuted ? (
                  <div className="space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
                    {activeSnippet.output.map((outLine, idx) => (
                      <div 
                        key={idx} 
                        className={
                          outLine.includes('PASS') || outLine.includes('exit code 0')
                            ? 'text-emerald-400' 
                            : outLine.includes('[Execution Engine')
                            ? 'text-zinc-500' 
                            : 'text-zinc-200'
                        }
                      >
                        {outLine}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-zinc-600 text-xs">
                    Terminal idle. Click &quot;RUN CODE&quot; to execute in sandbox.
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Sandbox Isolation Active</span>
                </span>
                <span>Sub-50ms Cold Start</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Small Rectangular Cut-Out Side Panels with Chamfered Corners and Perlin Waves */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Panel 1: Gemini 2.5 Flash AI Assistant */}
          <div 
            className={`relative p-5 border overflow-hidden transition-colors ${
              isDark ? 'bg-[#0B0C0E]/90 border-[#1F2024]' : 'bg-white/90 border-slate-300 shadow-md'
            }`}
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }}
          >
            <InteractiveWavesBackground 
              lineColor={isDark ? 'rgba(255, 145, 0, 0.22)' : 'rgba(234, 88, 12, 0.18)'}
              waveSpeedX={0.014}
              waveSpeedY={0.007}
              waveAmpX={18}
              waveAmpY={10}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono tracking-widest text-[#FF9100] uppercase font-bold">
                  AI ENGINE // GEMINI 2.5 FLASH
                </span>
                <span className="w-2 h-2 rounded-full bg-[#FF9100] animate-ping" />
              </div>
              <h4 className={`text-sm font-bold mb-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Autonomous AST Self-Healing
              </h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Underlying compiler diagnostics feed directly into Gemini Flash for instant syntax fix proposals and vector optimizations.
              </p>
            </div>
          </div>

          {/* Panel 2: Cloudflare D1 Database Schema */}
          <div 
            className={`relative p-5 border overflow-hidden transition-colors ${
              isDark ? 'bg-[#0B0C0E]/90 border-[#1F2024]' : 'bg-white/90 border-slate-300 shadow-md'
            }`}
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }}
          >
            <InteractiveWavesBackground 
              lineColor={isDark ? 'rgba(255, 145, 0, 0.22)' : 'rgba(234, 88, 12, 0.18)'}
              waveSpeedX={0.016}
              waveSpeedY={0.008}
              waveAmpX={18}
              waveAmpY={10}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono tracking-widest text-cyan-500 uppercase font-bold">
                  DATABASE // CLOUDFLARE D1
                </span>
                <span className="text-[10px] font-mono text-emerald-400">&lt; 15ms D1 SQL latency</span>
              </div>
              <h4 className={`text-sm font-bold mb-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Distributed SQLite Replication
              </h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Zero-cold-start edge SQL store replicating user snippets and workspace configs across 300+ global edge locations.
              </p>
            </div>
          </div>

          {/* Panel 3: Isolated Sandboxed Micro-VM Telemetry */}
          <div 
            className={`relative p-5 border overflow-hidden transition-colors ${
              isDark ? 'bg-[#0B0C0E]/90 border-[#1F2024]' : 'bg-white/90 border-slate-300 shadow-md'
            }`}
            style={{
              clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
            }}
          >
            <InteractiveWavesBackground 
              lineColor={isDark ? 'rgba(255, 145, 0, 0.22)' : 'rgba(234, 88, 12, 0.18)'}
              waveSpeedX={0.013}
              waveSpeedY={0.009}
              waveAmpX={18}
              waveAmpY={10}
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono tracking-widest text-purple-400 uppercase font-bold">
                  SECURITY // SECCOMP-BPF
                </span>
                <span className="text-[10px] font-mono text-purple-400">&lt; 50ms worker latency</span>
              </div>
              <h4 className={`text-sm font-bold mb-1.5 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                Ephemeral Tenant Isolation
              </h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Strict memory cgroups and seccomp filters isolate every compilation process with zero persistent storage access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
