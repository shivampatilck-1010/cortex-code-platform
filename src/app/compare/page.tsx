'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Play, 
  RotateCcw, 
  Check, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Zap,
  Terminal,
  ArrowLeft
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '@/config/languages';
import { executeInCloudSandbox } from '@/lib/execution/engine';
import { ExecutionResult } from '@/lib/execution/types';
import { CortexLogo } from '@/components/brand/CortexLogo';

interface BenchmarkPreset {
  id: string;
  name: string;
  langA: string;
  codeA: string;
  langB: string;
  codeB: string;
}

const PRESETS: BenchmarkPreset[] = [
  {
    id: 'search',
    name: 'Linear Search vs Binary Search',
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
print(f"Found at index: {idx}")
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
print(f"Found at index: {idx}")
`
  },
  {
    id: 'sorting',
    name: 'Bubble Sort vs Built-in Sort',
    langA: 'python',
    codeA: `# Algorithm A: Bubble Sort O(n²)
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

items = list(range(2000, 0, -1))
res = bubble_sort(items)
print(f"Sorted {len(res)} items")
print(f"First 5: {res[:5]}")
`,
    langB: 'python',
    codeB: `# Algorithm B: Built-in Timsort O(n log n)
items = list(range(2000, 0, -1))
res = sorted(items)
print(f"Sorted {len(res)} items")
print(f"First 5: {res[:5]}")
`
  },
  {
    id: 'fibonacci',
    name: 'Recursive vs Dynamic Programming Fibonacci',
    langA: 'javascript',
    codeA: `// Algorithm A: Recursive Fibonacci O(2^n)
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
`
  },
  {
    id: 'string',
    name: 'String Concatenation vs Array Join',
    langA: 'javascript',
    codeA: `// Algorithm A: String Concatenation (+)
let s = '';
for (let i = 0; i < 50000; i++) {
  s += 'x';
}
console.log(\`Length: \${s.length}\`);
`,
    langB: 'javascript',
    codeB: `// Algorithm B: Array Push + Join
const arr = [];
for (let i = 0; i < 50000; i++) {
  arr.push('x');
}
const s = arr.join('');
console.log(\`Length: \${s.length}\`);
`
  }
];

export default function ComparePage() {
  const [selectedPreset, setSelectedPreset] = useState('search');
  const [langA, setLangA] = useState(PRESETS[0].langA);
  const [codeA, setCodeA] = useState(PRESETS[0].codeA);
  const [resultA, setResultA] = useState<ExecutionResult | null>(null);

  const [langB, setLangB] = useState(PRESETS[0].langB);
  const [codeB, setCodeB] = useState(PRESETS[0].codeB);
  const [resultB, setResultB] = useState<ExecutionResult | null>(null);

  const [isComparing, setIsComparing] = useState(false);
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const p = PRESETS.find(item => item.id === presetId);
    if (p) {
      setLangA(p.langA);
      setCodeA(p.codeA);
      setResultA(null);
      setLangB(p.langB);
      setCodeB(p.codeB);
      setResultB(null);
    }
  };

  const handleRun = async () => {
    if (isComparing) return;
    setIsComparing(true);
    try {
      const [resA, resB] = await Promise.all([
        executeInCloudSandbox({
          language: langA,
          files: [{ id: 'a', name: getLanguageConfig(langA).defaultFileName, path: '/a', content: codeA }],
        }).catch((err) => ({
          status: 'runtime_error' as const,
          stdout: '',
          stderr: err?.message || 'Execution error in Code A',
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
          stderr: err?.message || 'Execution error in Code B',
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

  // Keyboard shortcut: Ctrl + Enter / Cmd + Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [langA, codeA, langB, codeB, isComparing]);

  const handleReset = () => {
    setResultA(null);
    setResultB(null);
  };

  // Metrics analysis
  const hasResults = resultA !== null && resultB !== null;
  const timeA = resultA?.executionTimeMs ?? 0;
  const timeB = resultB?.executionTimeMs ?? 0;

  let speedupLabel = '';
  if (hasResults && timeA > 0 && timeB > 0) {
    if (timeB < timeA) {
      const ratio = (timeA / timeB).toFixed(1);
      speedupLabel = `Code B is ${ratio}x faster`;
    } else if (timeA < timeB) {
      const ratio = (timeB / timeA).toFixed(1);
      speedupLabel = `Code A is ${ratio}x faster`;
    } else {
      speedupLabel = `Both executed in identical time`;
    }
  }

  const outA = (resultA?.stdout || '').trim();
  const outB = (resultB?.stdout || '').trim();
  const outputsMatch = hasResults && outA.length > 0 && outA === outB;
  const hasErrors = (resultA?.exitCode !== undefined && resultA.exitCode !== 0) ||
                    (resultB?.exitCode !== undefined && resultB.exitCode !== 0);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d0e11] text-gray-200 font-sans select-none overflow-hidden">
      {/* 1. Sleek, Minimalist Top Header */}
      <header className="h-12 bg-[#111216] border-b border-[#1f2026] px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center group transition" title="Return to IDE">
            <CortexLogo variant="header" size="sm" />
          </Link>

          <span className="text-gray-600">/</span>

          <span className="text-xs font-heading font-bold text-[#ff9100] tracking-wide">
            Benchmark
          </span>
        </div>

        {/* Center: Clean Preset Picker */}
        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">Preset:</span>
          <select
            value={selectedPreset}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="bg-[#18191f] text-xs text-gray-200 border border-[#2b2d38] rounded-md px-2.5 py-1 focus:outline-none focus:border-[#ff9100] transition"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {hasResults && (
            <button
              onClick={handleReset}
              className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1a1c22] transition flex items-center space-x-1"
              title="Reset results"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          <button
            onClick={handleRun}
            disabled={isComparing}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-xs font-heading font-bold transition shadow active:scale-95 ${
              isComparing
                ? 'bg-emerald-900 text-emerald-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title="Run Benchmark (Ctrl+Enter)"
          >
            <Play className={`w-3.5 h-3.5 ${isComparing ? 'animate-spin' : 'fill-current'}`} />
            <span>{isComparing ? 'Benchmarking...' : 'Run Benchmark'}</span>
          </button>
        </div>
      </header>

      {/* 2. Top Half: Dual Monaco Code Editors */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#1f2026] min-h-0">
        {/* Code A */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e11]">
          <div className="h-8 bg-[#131418] border-b border-[#1f2026] px-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">Code A</span>
            <select
              value={langA}
              onChange={(e) => {
                setLangA(e.target.value);
                setResultA(null);
              }}
              className="bg-[#1a1c22] text-gray-300 text-[11px] border border-[#2b2d38] rounded px-2 py-0.5 focus:outline-none focus:border-[#ff9100]"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
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
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Code B */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e11]">
          <div className="h-8 bg-[#131418] border-b border-[#1f2026] px-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">Code B</span>
            <select
              value={langB}
              onChange={(e) => {
                setLangB(e.target.value);
                setResultB(null);
              }}
              className="bg-[#1a1c22] text-gray-300 text-[11px] border border-[#2b2d38] rounded px-2 py-0.5 focus:outline-none focus:border-[#ff9100]"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
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
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. Bottom Half: Unified Results & Outputs Dock */}
      <div className="h-56 sm:h-64 border-t border-[#1f2026] bg-[#090a0d] flex flex-col">
        {/* Results Bar */}
        {hasResults ? (
          <div className="h-9 bg-[#131418] border-b border-[#1f2026] px-4 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-4">
              {speedupLabel && (
                <span className="flex items-center space-x-1.5 font-bold text-[#ff9100]">
                  <Zap className="w-3.5 h-3.5" />
                  <span>{speedupLabel}</span>
                </span>
              )}
              <span className="text-gray-400 font-mono text-[11px]">
                A: <strong className="text-gray-200">{resultA.executionTimeMs} ms</strong> ({resultA.memoryUsageMb} MB) vs B: <strong className="text-gray-200">{resultB.executionTimeMs} ms</strong> ({resultB.memoryUsageMb} MB)
              </span>
            </div>

            <div>
              {hasErrors ? (
                <span className="flex items-center space-x-1 text-rose-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Error encountered</span>
                </span>
              ) : outputsMatch ? (
                <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Outputs Match</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-amber-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Outputs Differ</span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="h-8 bg-[#111216] border-b border-[#1f2026] px-4 flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-gray-400" />
              <span>Console Output</span>
            </span>
            <span className="text-[11px] text-gray-500">
              {isComparing ? 'Running benchmark in cloud...' : 'Press "Run Benchmark" (Ctrl+Enter) to execute both'}
            </span>
          </div>
        )}

        {/* Side-by-side Output Panels */}
        <div className="flex-1 flex divide-x divide-[#1f2026] overflow-hidden min-h-0">
          {/* Output A */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#090a0d]">
            <div className="h-6 px-3 bg-[#0d0e12] border-b border-[#1a1b20] flex items-center justify-between text-[10.5px] text-gray-400">
              <span>Code A Output {resultA ? `(exit ${resultA.exitCode})` : ''}</span>
              {resultA?.stdout && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resultA.stdout);
                    setCopiedA(true);
                    setTimeout(() => setCopiedA(false), 1200);
                  }}
                  className="hover:text-white transition flex items-center space-x-1"
                >
                  {copiedA ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedA ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto select-text text-gray-300">
              {resultA ? (
                <>
                  {resultA.stdout && <pre className="whitespace-pre-wrap leading-relaxed">{resultA.stdout}</pre>}
                  {resultA.stderr && <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed">{resultA.stderr}</pre>}
                  {!resultA.stdout && !resultA.stderr && (
                    <span className="text-gray-500 italic">No output written.</span>
                  )}
                </>
              ) : isComparing ? (
                <span className="text-gray-500 italic animate-pulse">Running Code A...</span>
              ) : (
                <span className="text-gray-600 italic">Output will appear here.</span>
              )}
            </div>
          </div>

          {/* Output B */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#090a0d]">
            <div className="h-6 px-3 bg-[#0d0e12] border-b border-[#1a1b20] flex items-center justify-between text-[10.5px] text-gray-400">
              <span>Code B Output {resultB ? `(exit ${resultB.exitCode})` : ''}</span>
              {resultB?.stdout && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resultB.stdout);
                    setCopiedB(true);
                    setTimeout(() => setCopiedB(false), 1200);
                  }}
                  className="hover:text-white transition flex items-center space-x-1"
                >
                  {copiedB ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedB ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
            <div className="flex-1 p-3 font-mono text-xs overflow-y-auto select-text text-gray-300">
              {resultB ? (
                <>
                  {resultB.stdout && <pre className="whitespace-pre-wrap leading-relaxed">{resultB.stdout}</pre>}
                  {resultB.stderr && <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed">{resultB.stderr}</pre>}
                  {!resultB.stdout && !resultB.stderr && (
                    <span className="text-gray-500 italic">No output written.</span>
                  )}
                </>
              ) : isComparing ? (
                <span className="text-gray-500 italic animate-pulse">Running Code B...</span>
              ) : (
                <span className="text-gray-600 italic">Output will appear here.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
