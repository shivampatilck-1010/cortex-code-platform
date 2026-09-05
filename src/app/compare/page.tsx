'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Play, 
  Clock, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw,
  Terminal,
  Check,
  Copy,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '@/config/languages';
import { executeInCloudSandbox } from '@/lib/execution/engine';
import { ExecutionResult } from '@/lib/execution/types';
import { CortexLogo } from '@/components/brand/CortexLogo';

interface BenchmarkPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  langA: string;
  codeA: string;
  langB: string;
  codeB: string;
}

const BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    id: 'search',
    name: 'Linear Search vs Binary Search',
    category: 'Search',
    description: 'Compares O(n) sequential scan against O(log n) divide-and-conquer on 200,000 items.',
    langA: 'python',
    codeA: `# Candidate A: Linear Search O(n)
import time

def linear_search(arr, target):
    for i, val in enumerate(arr):
        if val == target:
            return i
    return -1

# Generate dataset
size = 200000
data = list(range(size))
target = size - 1

start = time.perf_counter()
idx = linear_search(data, target)
elapsed = (time.perf_counter() - start) * 1000

print(f"Result Index: {idx}")
print(f"Target Matched: {data[idx] == target}")
print(f"Algorithm: Linear Scan O(n)")
`,
    langB: 'python',
    codeB: `# Candidate B: Binary Search O(log n)
import time
import bisect

def binary_search(arr, target):
    idx = bisect.bisect_left(arr, target)
    if idx < len(arr) and arr[idx] == target:
        return idx
    return -1

# Generate dataset
size = 200000
data = list(range(size))
target = size - 1

start = time.perf_counter()
idx = binary_search(data, target)
elapsed = (time.perf_counter() - start) * 1000

print(f"Result Index: {idx}")
print(f"Target Matched: {data[idx] == target}")
print(f"Algorithm: Binary Search O(log n)")
`
  },
  {
    id: 'sorting',
    name: 'Bubble Sort vs Optimized Timsort',
    category: 'Sorting',
    description: 'Compares O(n²) quadratic pairwise swapping against O(n log n) optimized sorting.',
    langA: 'python',
    codeA: `# Candidate A: Bubble Sort O(n²)
import random

def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

# Fixed seed for reproducibility
random.seed(42)
items = [random.randint(1, 10000) for _ in range(2500)]

sorted_items = bubble_sort(items.copy())
print(f"Sorted Count: {len(sorted_items)}")
print(f"Sample Top 5: {sorted_items[:5]}")
print(f"Sample Last 5: {sorted_items[-5:]}")
`,
    langB: 'python',
    codeB: `# Candidate B: Optimized Quick/Timsort O(n log n)
import random

def timsort(arr):
    return sorted(arr)

# Fixed seed for reproducibility
random.seed(42)
items = [random.randint(1, 10000) for _ in range(2500)]

sorted_items = timsort(items.copy())
print(f"Sorted Count: {len(sorted_items)}")
print(f"Sample Top 5: {sorted_items[:5]}")
print(f"Sample Last 5: {sorted_items[-5:]}")
`
  },
  {
    id: 'fibonacci',
    name: 'Recursive vs Dynamic Programming',
    category: 'DP',
    description: 'Compares O(2ⁿ) exponential recursion against O(n) memoized linear calculation.',
    langA: 'javascript',
    codeA: `// Candidate A: Naive Recursive Fibonacci O(2^n)
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const n = 32;
const result = fibonacci(n);
console.log(\`Fibonacci(\${n}) = \${result}\`);
console.log(\`Complexity: O(2^n) exponential calls\`);
`,
    langB: 'javascript',
    codeB: `// Candidate B: Dynamic Programming Fibonacci O(n)
function fibonacciDP(n) {
  if (n <= 1) return n;
  let prev2 = 0, prev1 = 1;
  for (let i = 2; i <= n; i++) {
    const curr = prev1 + prev2;
    prev2 = prev1;
    prev1 = curr;
  }
  return prev1;
}

const n = 32;
const result = fibonacciDP(n);
console.log(\`Fibonacci(\${n}) = \${result}\`);
console.log(\`Complexity: O(n) single iterative pass\`);
`
  },
  {
    id: 'string-building',
    name: 'String Concatenation vs Buffer Join',
    category: 'Memory',
    description: 'Compares repeated string copy reallocations against contiguous array joins.',
    langA: 'javascript',
    codeA: `// Candidate A: Repeated String Concatenation (+ operator)
let output = '';
const count = 50000;

for (let i = 0; i < count; i++) {
  output += 'x';
}

console.log(\`Total Length: \${output.length}\`);
console.log(\`Prefix: \${output.slice(0, 10)}\`);
console.log('Method: In-place string reallocation');
`,
    langB: 'javascript',
    codeB: `// Candidate B: Array Push & Join Buffer
const chunks = [];
const count = 50000;

for (let i = 0; i < count; i++) {
  chunks.push('x');
}
const output = chunks.join('');

console.log(\`Total Length: \${output.length}\`);
console.log(\`Prefix: \${output.slice(0, 10)}\`);
console.log('Method: Contiguous array push + join');
`
  }
];

export default function ComparePage() {
  const [selectedPreset, setSelectedPreset] = useState<string>('search');

  // Candidate A
  const [langA, setLangA] = useState(BENCHMARK_PRESETS[0].langA);
  const [codeA, setCodeA] = useState(BENCHMARK_PRESETS[0].codeA);
  const [resultA, setResultA] = useState<ExecutionResult | null>(null);
  const [isRunningA, setIsRunningA] = useState(false);

  // Candidate B
  const [langB, setLangB] = useState(BENCHMARK_PRESETS[0].langB);
  const [codeB, setCodeB] = useState(BENCHMARK_PRESETS[0].codeB);
  const [resultB, setResultB] = useState<ExecutionResult | null>(null);
  const [isRunningB, setIsRunningB] = useState(false);

  const [isComparing, setIsComparing] = useState(false);
  const [copiedKeyA, setCopiedKeyA] = useState(false);
  const [copiedKeyB, setCopiedKeyB] = useState(false);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = BENCHMARK_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setLangA(preset.langA);
      setCodeA(preset.codeA);
      setResultA(null);
      setLangB(preset.langB);
      setCodeB(preset.codeB);
      setResultB(null);
    }
  };

  const handleRunA = async () => {
    setIsRunningA(true);
    try {
      const resA = await executeInCloudSandbox({
        language: langA,
        files: [{ id: 'a', name: getLanguageConfig(langA).defaultFileName, path: '/a', content: codeA }],
      });
      setResultA(resA);
    } catch (err: any) {
      setResultA({
        status: 'runtime_error',
        stdout: '',
        stderr: err?.message || 'Execution failed',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
    } finally {
      setIsRunningA(false);
    }
  };

  const handleRunB = async () => {
    setIsRunningB(true);
    try {
      const resB = await executeInCloudSandbox({
        language: langB,
        files: [{ id: 'b', name: getLanguageConfig(langB).defaultFileName, path: '/b', content: codeB }],
      });
      setResultB(resB);
    } catch (err: any) {
      setResultB({
        status: 'runtime_error',
        stdout: '',
        stderr: err?.message || 'Execution failed',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox',
      });
    } finally {
      setIsRunningB(false);
    }
  };

  const handleRunComparison = async () => {
    setIsComparing(true);
    try {
      const [resA, resB] = await Promise.all([
        executeInCloudSandbox({
          language: langA,
          files: [{ id: 'a', name: getLanguageConfig(langA).defaultFileName, path: '/a', content: codeA }],
        }).catch((err) => ({
          status: 'runtime_error' as const,
          stdout: '',
          stderr: err?.message || 'Candidate A execution error',
          exitCode: 1,
          executionTimeMs: 0,
          memoryUsageMb: 0,
          timestamp: new Date().toISOString(),
          provider: 'cloud_sandbox' as const,
        })),
        executeInCloudSandbox({
          language: langB,
          files: [{ id: 'b', name: getLanguageConfig(langB).defaultFileName, path: '/b', content: codeB }],
        }).catch((err) => ({
          status: 'runtime_error' as const,
          stdout: '',
          stderr: err?.message || 'Candidate B execution error',
          exitCode: 1,
          executionTimeMs: 0,
          memoryUsageMb: 0,
          timestamp: new Date().toISOString(),
          provider: 'cloud_sandbox' as const,
        })),
      ]);
      setResultA(resA);
      setResultB(resB);
    } finally {
      setIsComparing(false);
    }
  };

  const handleReset = () => {
    setResultA(null);
    setResultB(null);
  };

  // Speedup & Correctness Analysis
  const timeA = resultA ? resultA.executionTimeMs : null;
  const timeB = resultB ? resultB.executionTimeMs : null;

  let speedupText = null;
  let winner = null;
  if (timeA !== null && timeB !== null && timeA > 0 && timeB > 0) {
    if (timeB < timeA) {
      const ratio = (timeA / timeB).toFixed(1);
      speedupText = `Candidate B is ${ratio}x faster`;
      winner = 'B';
    } else if (timeA < timeB) {
      const ratio = (timeB / timeA).toFixed(1);
      speedupText = `Candidate A is ${ratio}x faster`;
      winner = 'A';
    } else {
      speedupText = 'Identical execution time (1.0x)';
      winner = 'TIE';
    }
  }

  // Equivalence match check (compares stdout without leading/trailing whitespace)
  const normOutA = (resultA?.stdout || '').trim();
  const normOutB = (resultB?.stdout || '').trim();
  const bothExecuted = resultA !== null && resultB !== null;
  const outputsMatch = bothExecuted && normOutA.length > 0 && normOutA === normOutB;
  const hasErrors = (resultA?.exitCode !== undefined && resultA.exitCode !== 0) || 
                    (resultB?.exitCode !== undefined && resultB.exitCode !== 0);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0c0e] text-gray-100 font-sans select-none overflow-hidden">
      {/* Header Bar */}
      <header className="h-12 bg-[#0e1013] border-b border-[#1f2024] px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>

          {/* Navigation */}
          <nav className="hidden sm:flex items-center space-x-1 pl-3 border-l border-[#1f2024]">
            <Link
              href="/"
              className="px-2.5 py-1 rounded text-xs font-heading font-semibold text-gray-400 hover:text-white hover:bg-[#16171c] transition"
            >
              IDE
            </Link>
            <Link
              href="/compare"
              className="px-2.5 py-1 rounded text-xs font-heading font-bold text-[#ff9100] bg-[#1a1714] border border-[#ff9100]/30 transition"
            >
              Benchmark
            </Link>
          </nav>
        </div>

        {/* Center: Preset Selector */}
        <div className="hidden md:flex items-center space-x-2">
          <span className="text-[11px] font-heading font-semibold text-gray-400 uppercase tracking-wider">Preset:</span>
          <select
            value={selectedPreset}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="bg-[#15161b] text-xs font-medium text-gray-200 border border-[#262832] rounded px-3 py-1 focus:outline-none focus:border-[#ff9100] transition"
          >
            {BENCHMARK_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
        </div>

        {/* Right Actions: Run Dual Benchmark */}
        <div className="flex items-center space-x-2">
          {(resultA || resultB) && (
            <button
              onClick={handleReset}
              className="px-2.5 py-1 rounded text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-[#1c1e24] transition flex items-center space-x-1"
              title="Clear execution results"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}

          <button
            onClick={handleRunComparison}
            disabled={isComparing}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-md text-xs font-heading font-bold shadow-md transition active:scale-95 ${
              isComparing
                ? 'bg-purple-900 text-purple-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-[#ff9100] to-[#e08000] hover:from-[#ff9f1c] hover:to-[#eb8a00] text-black'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isComparing ? 'animate-spin' : 'fill-current'}`} />
            <span>{isComparing ? 'Running Both In Cloud...' : 'Run Dual Benchmark'}</span>
          </button>
        </div>
      </header>

      {/* Comparison Metrics Header Banner */}
      {bothExecuted && (
        <div className="bg-[#121317] border-b border-[#21232a] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-10">
          <div className="flex items-center space-x-4 sm:space-x-6">
            {/* Speedup Badge */}
            {speedupText && (
              <div className={`px-3 py-1 rounded border flex items-center space-x-1.5 font-bold ${
                winner === 'B'
                  ? 'bg-purple-950/40 border-purple-500/50 text-purple-300'
                  : winner === 'A'
                  ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300'
                  : 'bg-gray-800 border-gray-700 text-gray-300'
              }`}>
                <Zap className="w-3.5 h-3.5 text-[#ff9100]" />
                <span>{speedupText}</span>
              </div>
            )}

            {/* Latency Comparison */}
            <div className="flex items-center space-x-3 text-gray-300 font-mono text-[11px]">
              <div>
                <span className="text-cyan-400 font-bold">Candidate A:</span> {resultA.executionTimeMs} ms
              </div>
              <span className="text-gray-600">vs</span>
              <div>
                <span className="text-purple-400 font-bold">Candidate B:</span> {resultB.executionTimeMs} ms
              </div>
            </div>

            {/* Memory Usage */}
            <div className="hidden lg:flex items-center space-x-2 text-gray-400 text-[11px] font-mono">
              <Cpu className="w-3.5 h-3.5 text-gray-500" />
              <span>RAM: {resultA.memoryUsageMb} MB (A) vs {resultB.memoryUsageMb} MB (B)</span>
            </div>
          </div>

          {/* Correctness / Equivalence Indicator */}
          <div className="flex items-center space-x-2">
            {hasErrors ? (
              <div className="px-2.5 py-1 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 flex items-center space-x-1.5 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Execution error in code</span>
              </div>
            ) : outputsMatch ? (
              <div className="px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 flex items-center space-x-1.5 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Outputs Match (Functionally Equivalent)</span>
              </div>
            ) : normOutA.length > 0 && normOutB.length > 0 ? (
              <div className="px-2.5 py-1 rounded bg-amber-950/30 border border-amber-800/40 text-amber-300 flex items-center space-x-1.5 text-xs font-medium">
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Outputs Differ (Review Outputs Below)</span>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Dual Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[#1e2026]">
        {/* ================= CANDIDATE A ================= */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full overflow-hidden bg-[#101114]">
          {/* Top Bar Candidate A */}
          <div className="h-10 bg-[#14151a] border-b border-[#202228] px-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-400/20" />
              <span className="font-heading font-bold text-xs text-cyan-400">Candidate A</span>
              {resultA && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1c1e26] text-gray-300 border border-[#2b2d38]">
                  {resultA.executionTimeMs} ms • {resultA.memoryUsageMb} MB
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={langA}
                onChange={(e) => {
                  setLangA(e.target.value);
                  setResultA(null);
                }}
                className="bg-[#1c1d24] text-gray-200 border border-[#2e303c] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-cyan-400"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>

              <button
                onClick={handleRunA}
                disabled={isRunningA || isComparing}
                className="px-2.5 py-1 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 rounded text-xs font-heading font-semibold transition flex items-center space-x-1"
                title="Execute Candidate A independently"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isRunningA ? 'Running...' : 'Run A'}</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor Candidate A */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={getLanguageConfig(langA).monacoLang}
              value={codeA}
              theme="vs-dark"
              onChange={(v) => setCodeA(v || '')}
              options={{
                fontSize: 13,
                fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                automaticLayout: true,
              }}
            />
          </div>

          {/* Dedicated Terminal Output Dock: Candidate A */}
          <div className="h-44 md:h-52 bg-[#0c0d10] border-t border-[#1e2026] flex flex-col">
            <div className="h-7 bg-[#131418] border-b border-[#1f2025] px-3 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-2 text-gray-400 font-heading">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold text-gray-300">Candidate A Output</span>
                {resultA && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    resultA.exitCode === 0 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' 
                      : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                  }`}>
                    exit {resultA.exitCode}
                  </span>
                )}
              </div>

              {resultA?.stdout && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resultA.stdout);
                    setCopiedKeyA(true);
                    setTimeout(() => setCopiedKeyA(false), 1500);
                  }}
                  className="text-gray-400 hover:text-gray-200 transition flex items-center space-x-1"
                  title="Copy output"
                >
                  {copiedKeyA ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span className="text-[10px]">{copiedKeyA ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1 select-text">
              {isRunningA || isComparing ? (
                <div className="text-gray-500 italic flex items-center space-x-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Executing Candidate A in isolated container...</span>
                </div>
              ) : resultA ? (
                <>
                  {resultA.stdout ? (
                    <pre className="text-gray-200 whitespace-pre-wrap leading-relaxed">{resultA.stdout}</pre>
                  ) : null}
                  {resultA.stderr ? (
                    <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed bg-rose-950/20 p-2 rounded border border-rose-900/30">
                      {resultA.stderr}
                    </pre>
                  ) : null}
                  {!resultA.stdout && !resultA.stderr && (
                    <span className="text-gray-500 italic">Program exited with code 0 (no output written to stdout).</span>
                  )}
                </>
              ) : (
                <div className="text-gray-500 text-xs italic">
                  Press <span className="text-[#ff9100] font-semibold">Run Dual Benchmark</span> or <span className="text-cyan-400 font-semibold">Run A</span> to view terminal output.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================= CANDIDATE B ================= */}
        <div className="w-full md:w-1/2 flex flex-col h-1/2 md:h-full overflow-hidden bg-[#101114]">
          {/* Top Bar Candidate B */}
          <div className="h-10 bg-[#14151a] border-b border-[#202228] px-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 ring-2 ring-purple-400/20" />
              <span className="font-heading font-bold text-xs text-purple-400">Candidate B</span>
              {resultB && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1c1e26] text-gray-300 border border-[#2b2d38]">
                  {resultB.executionTimeMs} ms • {resultB.memoryUsageMb} MB
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={langB}
                onChange={(e) => {
                  setLangB(e.target.value);
                  setResultB(null);
                }}
                className="bg-[#1c1d24] text-gray-200 border border-[#2e303c] rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-purple-400"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>

              <button
                onClick={handleRunB}
                disabled={isRunningB || isComparing}
                className="px-2.5 py-1 bg-purple-950/50 hover:bg-purple-900/60 text-purple-300 border border-purple-700/50 rounded text-xs font-heading font-semibold transition flex items-center space-x-1"
                title="Execute Candidate B independently"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>{isRunningB ? 'Running...' : 'Run B'}</span>
              </button>
            </div>
          </div>

          {/* Monaco Editor Candidate B */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={getLanguageConfig(langB).monacoLang}
              value={codeB}
              theme="vs-dark"
              onChange={(v) => setCodeB(v || '')}
              options={{
                fontSize: 13,
                fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                automaticLayout: true,
              }}
            />
          </div>

          {/* Dedicated Terminal Output Dock: Candidate B */}
          <div className="h-44 md:h-52 bg-[#0c0d10] border-t border-[#1e2026] flex flex-col">
            <div className="h-7 bg-[#131418] border-b border-[#1f2025] px-3 flex items-center justify-between text-[11px]">
              <div className="flex items-center space-x-2 text-gray-400 font-heading">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-semibold text-gray-300">Candidate B Output</span>
                {resultB && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    resultB.exitCode === 0 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40' 
                      : 'bg-rose-950 text-rose-300 border border-rose-800/40'
                  }`}>
                    exit {resultB.exitCode}
                  </span>
                )}
              </div>

              {resultB?.stdout && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resultB.stdout);
                    setCopiedKeyB(true);
                    setTimeout(() => setCopiedKeyB(false), 1500);
                  }}
                  className="text-gray-400 hover:text-gray-200 transition flex items-center space-x-1"
                  title="Copy output"
                >
                  {copiedKeyB ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span className="text-[10px]">{copiedKeyB ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-1 select-text">
              {isRunningB || isComparing ? (
                <div className="text-gray-500 italic flex items-center space-x-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>Executing Candidate B in isolated container...</span>
                </div>
              ) : resultB ? (
                <>
                  {resultB.stdout ? (
                    <pre className="text-gray-200 whitespace-pre-wrap leading-relaxed">{resultB.stdout}</pre>
                  ) : null}
                  {resultB.stderr ? (
                    <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed bg-rose-950/20 p-2 rounded border border-rose-900/30">
                      {resultB.stderr}
                    </pre>
                  ) : null}
                  {!resultB.stdout && !resultB.stderr && (
                    <span className="text-gray-500 italic">Program exited with code 0 (no output written to stdout).</span>
                  )}
                </>
              ) : (
                <div className="text-gray-500 text-xs italic">
                  Press <span className="text-[#ff9100] font-semibold">Run Dual Benchmark</span> or <span className="text-purple-400 font-semibold">Run B</span> to view terminal output.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

