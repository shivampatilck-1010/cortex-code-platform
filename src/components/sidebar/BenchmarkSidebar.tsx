'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  ExternalLink, 
  CheckCircle2, 
  Zap, 
  Code2 
} from 'lucide-react';

export interface BenchmarkPresetItem {
  id: string;
  name: string;
  category: string;
  langA: string;
  codeA: string;
  langB: string;
  codeB: string;
  complexityA: string;
  complexityB: string;
  description: string;
}

export const BENCHMARK_PRESETS: BenchmarkPresetItem[] = [
  {
    id: 'search',
    name: 'Linear vs Binary Search',
    category: 'Algorithms',
    langA: 'python',
    codeA: `# Algorithm A: Linear Search O(n)
def search(arr, target):
    for i, val in enumerate(arr):
        if val == target:
            return i
    return -1

data = list(range(200000))
target = 199999
idx = search(data, target)
print(f"Found at: {idx}")
`,
    langB: 'python',
    codeB: `# Algorithm B: Binary Search O(log n)
import bisect

def search(arr, target):
    idx = bisect.bisect_left(arr, target)
    if idx < len(arr) and arr[idx] == target:
        return idx
    return -1

data = list(range(200000))
target = 199999
idx = search(data, target)
print(f"Found at: {idx}")
`,
    complexityA: 'O(n) Time',
    complexityB: 'O(log n) Time',
    description: 'Compare linear traversal vs divide-and-conquer on 200,000 elements.',
  },
  {
    id: 'sorting',
    name: 'Bubble Sort vs Built-in Timsort',
    category: 'Sorting',
    langA: 'python',
    codeA: `# Algorithm A: Bubble Sort O(n^2)
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

items = list(range(1500, 0, -1))
res = bubble_sort(items)
print(f"Sorted {len(res)} items")
`,
    langB: 'python',
    codeB: `# Algorithm B: Built-in Timsort O(n log n)
items = list(range(1500, 0, -1))
res = sorted(items)
print(f"Sorted {len(res)} items")
`,
    complexityA: 'O(n^2) Time',
    complexityB: 'O(n log n) Time',
    description: 'Quadratic nested loops vs hybrid adaptive merge/insertion sort.',
  },
  {
    id: 'fibonacci',
    name: 'Recursive vs DP Fibonacci',
    category: 'Dynamic Programming',
    langA: 'javascript',
    codeA: `// Algorithm A: Naive Recursive Fibonacci O(2^n)
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

const n = 32;
console.log(\`fib(\${n}) = \${fib(n)}\`);
`,
    langB: 'javascript',
    codeB: `// Algorithm B: Iterative DP Fibonacci O(n)
function fib(n) {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}

const n = 32;
console.log(\`fib(\${n}) = \${fib(n)}\`);
`,
    complexityA: 'O(2^n) Time',
    complexityB: 'O(n) Time',
    description: 'Exponential tree recursion vs linear space-optimized DP.',
  },
  {
    id: 'string-concat',
    name: 'String Concat vs Array Join',
    category: 'Memory & Allocations',
    langA: 'javascript',
    codeA: `// Algorithm A: Repeated String Concatenation (+)
let s = "";
for (let i = 0; i < 50000; i++) {
  s += "a";
}
console.log(\`Length: \${s.length}\`);
`,
    langB: 'javascript',
    codeB: `// Algorithm B: Pre-buffered Array Join
const parts = [];
for (let i = 0; i < 50000; i++) {
  parts.push("a");
}
const s = parts.join("");
console.log(\`Length: \${s.length}\`);
`,
    complexityA: 'O(n^2) Memory Copies',
    complexityB: 'O(n) Single Allocation',
    description: 'Repeated string reallocation vs contiguous vector join.',
  },
];

interface BenchmarkSidebarProps {
  width?: number;
  onLoadCode?: (code: string, language: string) => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export const BenchmarkSidebar: React.FC<BenchmarkSidebarProps> = ({
  width = 240,
  onLoadCode,
  onClose,
  isDarkMode = true,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(BENCHMARK_PRESETS[0].id);
  const [benchmarkStatus, setBenchmarkStatus] = useState<string | null>(null);

  const selectedPreset = BENCHMARK_PRESETS.find((p) => p.id === selectedPresetId) || BENCHMARK_PRESETS[0];

  const handleQuickLoad = (code: string, lang: string, label: string) => {
    if (onLoadCode) {
      onLoadCode(code, lang);
      setBenchmarkStatus(`Loaded ${label} into editor`);
      setTimeout(() => setBenchmarkStatus(null), 2500);
    }
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className={`h-full flex flex-col select-none text-xs transition-colors duration-200 ${
        isDarkMode ? 'bg-[#101114] text-[#e6edf3]' : 'bg-white text-slate-800'
      }`}
    >
      {/* Header */}
      <div className={`h-10 px-3.5 border-b flex items-center justify-between shrink-0 transition-colors ${
        isDarkMode ? 'border-[#1f2024] bg-[#0d0e11]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-[#ff9100]" />
          <span className={`font-semibold uppercase tracking-wider text-[11px] ${
            isDarkMode ? 'text-gray-200' : 'text-slate-800'
          }`}>
            Benchmark
          </span>
          <span className="px-1.5 py-0.2 bg-[#ff9100]/15 text-[#ff9100] text-[10px] rounded font-mono font-medium">
            Presets
          </span>
        </div>
        <Link
          href="/compare"
          className="flex items-center space-x-1 text-[11px] text-[#ff9100] hover:text-[#ffaa33] transition"
          title="Open Full Benchmark Suite"
        >
          <span>Suite</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Preset List & Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* Banner */}
        <div className={`p-2.5 rounded-lg border transition-colors ${
          isDarkMode ? 'bg-[#14151b] border-[#232530]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`flex items-center space-x-1.5 mb-1 font-medium ${
            isDarkMode ? 'text-gray-200' : 'text-slate-800'
          }`}>
            <Zap className="w-3.5 h-3.5 text-[#ff9100]" />
            <span>Multi-Language Profiling</span>
          </div>
          <p className={`text-[11px] leading-relaxed ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            Select an algorithmic preset below to inspect asymptotic complexity and load code directly into the IDE.
          </p>
        </div>

        {/* Status notification */}
        {benchmarkStatus && (
          <div className="px-2.5 py-1.5 bg-emerald-950/60 border border-emerald-700/50 rounded text-[11px] text-emerald-300 flex items-center space-x-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{benchmarkStatus}</span>
          </div>
        )}

        {/* Presets List */}
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase font-semibold tracking-wider text-gray-500 px-1">
            Algorithm Presets ({BENCHMARK_PRESETS.length})
          </div>
          {BENCHMARK_PRESETS.map((preset) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedPresetId(preset.id)}
                className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-[#181920] border-[#ff9100]/50 shadow-sm'
                    : 'bg-[#121318] border-[#1e2026] hover:border-[#2a2c38] hover:bg-[#15161d]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold text-xs truncate ${isSelected ? 'text-[#ff9100]' : 'text-gray-200'}`}>
                    {preset.name}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 line-clamp-1 mb-2">
                  {preset.description}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-[#1c1d24] text-rose-300 font-mono text-[9px] border border-rose-900/30">
                    {preset.complexityA}
                  </span>
                  <span className="text-gray-500 text-[10px]">vs</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#1c1d24] text-emerald-300 font-mono text-[9px] border border-emerald-900/30">
                    {preset.complexityB}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Preset Details & Action */}
        {selectedPreset && (
          <div className="p-3 bg-[#13141a] border border-[#232530] rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-200 text-xs">
                {selectedPreset.name}
              </span>
              <span className="text-[10px] font-mono text-gray-400 uppercase">
                {selectedPreset.langA}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="p-2 bg-[#0c0d10] border border-[#1f2026] rounded">
                <div className="text-rose-400 font-semibold mb-0.5">Algorithm A</div>
                <div className="font-mono text-gray-400 text-[9px]">{selectedPreset.complexityA}</div>
                <button
                  onClick={() => handleQuickLoad(selectedPreset.codeA, selectedPreset.langA, 'Algorithm A')}
                  className="mt-2 w-full py-1 px-1.5 bg-[#1a1b22] hover:bg-[#252733] text-gray-200 rounded font-medium text-[10px] flex items-center justify-center space-x-1 border border-[#2b2d3a] transition"
                >
                  <Code2 className="w-3 h-3 text-rose-400" />
                  <span>Load A</span>
                </button>
              </div>

              <div className="p-2 bg-[#0c0d10] border border-[#1f2026] rounded">
                <div className="text-emerald-400 font-semibold mb-0.5">Algorithm B</div>
                <div className="font-mono text-gray-400 text-[9px]">{selectedPreset.complexityB}</div>
                <button
                  onClick={() => handleQuickLoad(selectedPreset.codeB, selectedPreset.langB, 'Algorithm B')}
                  className="mt-2 w-full py-1 px-1.5 bg-[#1a1b22] hover:bg-[#252733] text-gray-200 rounded font-medium text-[10px] flex items-center justify-center space-x-1 border border-[#2b2d3a] transition"
                >
                  <Code2 className="w-3 h-3 text-emerald-400" />
                  <span>Load B</span>
                </button>
              </div>
            </div>

            {/* Launch Compare Route Button */}
            <Link
              href="/compare"
              className="w-full py-2 px-3 bg-[#ff9100] hover:bg-[#ffa726] text-black font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition shadow"
            >
              <Zap className="w-3.5 h-3.5 fill-black" />
              <span>Launch Comparative Benchmark</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
