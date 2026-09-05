'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowLeft,
  Users,
  Sparkles,
  RefreshCw,
  Table2,
  Cpu,
  Lock,
  ExternalLink,
  ChevronDown
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
  complexityA: string;
  complexityB: string;
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
`,
    complexityA: 'O(n) Time | O(1) Space',
    complexityB: 'O(log n) Time | O(1) Space'
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
`,
    complexityA: 'O(n²) Time | O(1) Space',
    complexityB: 'O(n log n) Time | O(n) Space'
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
`,
    complexityA: 'O(2^n) Time | O(n) Stack Space',
    complexityB: 'O(n) Time | O(1) Space'
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
`,
    complexityA: 'O(n²) Time | O(n) Space',
    complexityB: 'O(n) Time | O(n) Space'
  }
];

// Heuristic complexity analyzer for arbitrary code
function estimateComplexity(code: string, lang: string): string {
  if (!code) return 'N/A';
  const c = code.toLowerCase();
  
  if (c.includes('fib(') && c.includes('fib(') && !c.includes('memo') && !c.includes('dp')) {
    return 'O(2^n) Time (Exponential)';
  }
  
  // Count loop indicators
  const forMatches = (c.match(/\bfor\b/g) || []).length;
  const whileMatches = (c.match(/\bwhile\b/g) || []).length;
  const totalLoops = forMatches + whileMatches;
  
  if (c.includes('bisect') || c.includes('binary_search') || c.includes('mid = (low + high)')) {
    return 'O(log n) Time (Logarithmic)';
  }
  if (c.includes('.sort(') || c.includes('sorted(')) {
    return 'O(n log n) Time (Linearithmic)';
  }
  if (totalLoops >= 2 && (c.includes('j in') || c.includes('let j') || c.includes('int j'))) {
    return 'O(n²) Time (Quadratic)';
  }
  if (totalLoops === 1) {
    return 'O(n) Time (Linear)';
  }
  return 'O(1) to O(n) Time';
}

export default function ComparePage() {
  // Mode selection: presets vs classroom
  const [mode, setMode] = useState<'presets' | 'classroom'>('presets');

  // Preset state
  const [selectedPreset, setSelectedPreset] = useState('search');
  const [langA, setLangA] = useState(PRESETS[0].langA);
  const [codeA, setCodeA] = useState(PRESETS[0].codeA);
  const [resultA, setResultA] = useState<ExecutionResult | null>(null);

  const [langB, setLangB] = useState(PRESETS[0].langB);
  const [codeB, setCodeB] = useState(PRESETS[0].codeB);
  const [resultB, setResultB] = useState<ExecutionResult | null>(null);

  // Classroom integration state
  const [roomId, setRoomId] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [classroomParticipants, setClassroomParticipants] = useState<any[]>([]);
  const [selectedUserA, setSelectedUserA] = useState<string>('');
  const [selectedUserB, setSelectedUserB] = useState<string>('');
  const [userAName, setUserAName] = useState<string>('Workspace A');
  const [userBName, setUserBName] = useState<string>('Workspace B');

  // Execution & UI state
  const [isComparing, setIsComparing] = useState(false);
  const [isRunningA, setIsRunningA] = useState(false);
  const [isRunningB, setIsRunningB] = useState(false);
  const [customStdin, setCustomStdin] = useState('');
  const [activeTab, setActiveTab] = useState<'matrix' | 'outputs' | 'ai' | 'stdin'>('matrix');
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  // AI Compare state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiComparison, setAiComparison] = useState<string | null>(null);

  // Load URL query params on mount (supports ?room=CORTEX-XXXX&userA=...&userB=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const userAParam = params.get('userA');
    const userBParam = params.get('userB');

    if (roomParam) {
      setRoomId(roomParam.toUpperCase());
      setMode('classroom');
      fetchClassroomRoom(roomParam.toUpperCase(), userAParam, userBParam);
    }
  }, []);

  const fetchClassroomRoom = async (targetRoomId: string, initialUserA?: string | null, initialUserB?: string | null) => {
    if (!targetRoomId) return;
    setRoomLoading(true);
    setRoomError(null);
    try {
      const requesterId = localStorage.getItem(`cortex_participant_${targetRoomId}`) || '';
      const res = await fetch(`/api/v1/classroom/${targetRoomId}?requesterId=${requesterId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch classroom');
      }

      const pList = Object.values(data.room.participants || {}) as any[];
      setClassroomParticipants(pList);

      // Auto select users
      const chosenA = initialUserA && pList.find(p => p.id === initialUserA) 
        ? initialUserA 
        : pList[0]?.id || '';
      const chosenB = initialUserB && pList.find(p => p.id === initialUserB)
        ? initialUserB 
        : (pList[1]?.id || pList[0]?.id || '');

      if (chosenA) handleSelectParticipantA(chosenA, pList);
      if (chosenB) handleSelectParticipantB(chosenB, pList);
    } catch (err: any) {
      setRoomError(err?.message || 'Error loading classroom data');
    } finally {
      setRoomLoading(false);
    }
  };

  const handleSelectParticipantA = (participantId: string, list = classroomParticipants) => {
    setSelectedUserA(participantId);
    const p = list.find(item => item.id === participantId);
    if (p) {
      setUserAName(p.name);
      if (p.language) setLangA(p.language);
      if (p.isCodeHidden) {
        setCodeA(`// [LOCKED] Workspace of ${p.name} is private.\n// The owner must set visibility to Public to benchmark.`);
      } else {
        setCodeA(p.activeCode || `// ${p.name}'s workspace is currently empty.`);
      }
      setResultA(null);
    }
  };

  const handleSelectParticipantB = (participantId: string, list = classroomParticipants) => {
    setSelectedUserB(participantId);
    const p = list.find(item => item.id === participantId);
    if (p) {
      setUserBName(p.name);
      if (p.language) setLangB(p.language);
      if (p.isCodeHidden) {
        setCodeB(`// [LOCKED] Workspace of ${p.name} is private.\n// The owner must set visibility to Public to benchmark.`);
      } else {
        setCodeB(p.activeCode || `// ${p.name}'s workspace is currently empty.`);
      }
      setResultB(null);
    }
  };

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
      setAiComparison(null);
    }
  };

  // Run Code A independently
  const handleRunA = async () => {
    if (isRunningA || isComparing) return;
    setIsRunningA(true);
    try {
      const res = await executeInCloudSandbox({
        language: langA,
        files: [{ id: 'a', name: getLanguageConfig(langA).defaultFileName, path: '/a', content: codeA }],
        stdin: customStdin,
      }).catch((err) => ({
        status: 'runtime_error' as const,
        stdout: '',
        stderr: err?.message || 'Execution error in Code A',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox' as const,
      }));
      setResultA(res);
    } finally {
      setIsRunningA(false);
    }
  };

  // Run Code B independently
  const handleRunB = async () => {
    if (isRunningB || isComparing) return;
    setIsRunningB(true);
    try {
      const res = await executeInCloudSandbox({
        language: langB,
        files: [{ id: 'b', name: getLanguageConfig(langB).defaultFileName, path: '/b', content: codeB }],
        stdin: customStdin,
      }).catch((err) => ({
        status: 'runtime_error' as const,
        stdout: '',
        stderr: err?.message || 'Execution error in Code B',
        exitCode: 1,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        timestamp: new Date().toISOString(),
        provider: 'cloud_sandbox' as const,
      }));
      setResultB(res);
    } finally {
      setIsRunningB(false);
    }
  };

  // Run Both in Parallel (Benchmark)
  const handleRunBenchmark = async () => {
    if (isComparing) return;
    setIsComparing(true);
    try {
      const [resA, resB] = await Promise.all([
        executeInCloudSandbox({
          language: langA,
          files: [{ id: 'a', name: getLanguageConfig(langA).defaultFileName, path: '/a', content: codeA }],
          stdin: customStdin,
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
          stdin: customStdin,
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

  // Trigger AI Comparative Analysis
  const handleAiCompare = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setActiveTab('ai');
    try {
      const prompt = `Compare these two algorithm implementations in detail:
=== IMPLEMENTATION A (${mode === 'classroom' ? userAName : 'Algorithm A'}, Language: ${langA}) ===
${codeA}

=== IMPLEMENTATION B (${mode === 'classroom' ? userBName : 'Algorithm B'}, Language: ${langB}) ===
${codeB}

Please provide a concise, structured comparative analysis with:
1. Time Complexity (Big-O) comparison with reasoning
2. Space Complexity & Memory footprint
3. Edge Cases & Robustness
4. Code Quality & Readability verdict
5. Overall Winner and why`;

      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: prompt,
          code: codeA,
          language: langA,
        }),
      });
      const data = await res.json();
      setAiComparison(data.reply || 'AI comparison completed.');
    } catch (err: any) {
      setAiComparison(`⚠️ Failed to generate AI comparison: ${err?.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Keyboard shortcut: Ctrl + Enter / Cmd + Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRunBenchmark();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [langA, codeA, langB, codeB, customStdin, isComparing]);

  const handleReset = () => {
    setResultA(null);
    setResultB(null);
    setAiComparison(null);
  };

  // Performance metrics analysis
  const hasResults = resultA !== null && resultB !== null;
  const timeA = resultA?.executionTimeMs ?? 0;
  const timeB = resultB?.executionTimeMs ?? 0;

  let speedupLabel = '';
  let winner = '';
  if (hasResults && timeA > 0 && timeB > 0) {
    if (timeB < timeA) {
      const ratio = (timeA / timeB).toFixed(1);
      speedupLabel = `${mode === 'classroom' ? userBName : 'Code B'} is ${ratio}x faster`;
      winner = 'B';
    } else if (timeA < timeB) {
      const ratio = (timeB / timeA).toFixed(1);
      speedupLabel = `${mode === 'classroom' ? userAName : 'Code A'} is ${ratio}x faster`;
      winner = 'A';
    } else {
      speedupLabel = `Both executed in identical time`;
      winner = 'TIE';
    }
  }

  const outA = (resultA?.stdout || '').trim();
  const outB = (resultB?.stdout || '').trim();
  const outputsMatch = hasResults && outA.length > 0 && outA === outB;
  const hasErrors = (resultA?.exitCode !== undefined && resultA.exitCode !== 0) ||
                    (resultB?.exitCode !== undefined && resultB.exitCode !== 0);

  const currentPreset = PRESETS.find(p => p.id === selectedPreset);
  const complexityA = mode === 'presets' && currentPreset ? currentPreset.complexityA : estimateComplexity(codeA, langA);
  const complexityB = mode === 'presets' && currentPreset ? currentPreset.complexityB : estimateComplexity(codeB, langB);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0d0e11] text-gray-200 font-sans select-none overflow-hidden">
      {/* 1. Sleek, Minimalist Top Header */}
      <header className="h-12 bg-[#111216] border-b border-[#1f2026] px-3 sm:px-4 flex items-center justify-between z-20">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Link href="/" className="flex items-center group transition" title="Return to IDE">
            <CortexLogo variant="header" size="sm" />
          </Link>

          <span className="text-gray-600">/</span>

          <Link href="/" className="text-xs font-semibold text-gray-400 hover:text-white transition hidden md:inline">
            IDE
          </Link>

          <span className="text-gray-600 hidden md:inline">/</span>

          <Link href="/classroom" className="text-xs font-semibold text-gray-400 hover:text-white transition hidden md:inline">
            Classroom
          </Link>

          <span className="text-gray-600 hidden md:inline">/</span>

          <span className="text-xs font-heading font-bold text-[#ff9100] tracking-wide flex items-center space-x-1">
            <span>Benchmark</span>
          </span>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-[#181920] border border-[#2b2d38] rounded-md p-0.5 ml-2">
            <button
              onClick={() => setMode('presets')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition ${
                mode === 'presets'
                  ? 'bg-[#282a36] text-[#ff9100] shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setMode('classroom')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition flex items-center space-x-1 ${
                mode === 'classroom'
                  ? 'bg-[#282a36] text-cyan-400 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Classroom</span>
            </button>
          </div>
        </div>

        {/* Center: Dynamic Picker according to mode */}
        <div className="flex items-center space-x-2">
          {mode === 'presets' ? (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">Algorithm:</span>
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
          ) : (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  placeholder="ROOM ID (e.g. CORTEX-7K92)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && fetchClassroomRoom(roomId)}
                  className="bg-[#18191f] text-xs font-mono text-[#ff9100] border border-[#2b2d38] rounded-l-md px-2.5 py-1 w-32 sm:w-36 uppercase focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => fetchClassroomRoom(roomId)}
                  disabled={roomLoading || !roomId}
                  className="bg-[#222430] hover:bg-[#2c2f40] text-gray-300 px-2 py-1 text-xs rounded-r-md border border-l-0 border-[#2b2d38] transition flex items-center"
                  title="Refresh classroom participants"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${roomLoading ? 'animate-spin text-cyan-400' : ''}`} />
                </button>
              </div>

              {classroomParticipants.length > 0 && (
                <div className="hidden lg:flex items-center space-x-2 text-xs">
                  <span className="text-gray-400 font-mono text-[11px]">{classroomParticipants.length} students</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2">
          {/* AI Compare Button */}
          <button
            onClick={handleAiCompare}
            disabled={aiLoading}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition flex items-center space-x-1.5 ${
              aiLoading
                ? 'bg-purple-900/40 text-purple-300 border-purple-700/50 animate-pulse'
                : 'bg-[#1e192c] hover:bg-[#28223d] text-purple-300 border-purple-800/40'
            }`}
            title="Perform AI Comparison of algorithms"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">{aiLoading ? 'Analyzing...' : 'AI Compare'}</span>
          </button>

          {/* Reset */}
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

          {/* Run Benchmark Button */}
          <button
            onClick={handleRunBenchmark}
            disabled={isComparing}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md text-xs font-heading font-bold transition shadow active:scale-95 ${
              isComparing
                ? 'bg-emerald-900 text-emerald-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
            }`}
            title="Run Both Algorithms in Parallel (Ctrl+Enter)"
          >
            <Play className={`w-3.5 h-3.5 ${isComparing ? 'animate-spin' : 'fill-current'}`} />
            <span>{isComparing ? 'Benchmarking...' : 'Run Both'}</span>
          </button>
        </div>
      </header>

      {/* 2. Dual Monaco Code Editors */}
      <div className="flex-1 flex flex-col sm:flex-row overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#1f2026] min-h-0">
        {/* Workspace / Code A */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e11]">
          <div className="h-9 bg-[#131418] border-b border-[#1f2026] px-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              {mode === 'classroom' ? (
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-cyan-400">Workspace A:</span>
                  <select
                    value={selectedUserA}
                    onChange={(e) => handleSelectParticipantA(e.target.value)}
                    className="bg-[#1c1d26] text-gray-200 text-xs font-medium border border-[#2e303f] rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500"
                  >
                    {classroomParticipants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isCodeHidden ? '🔒 (Private)' : `(${p.language})`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-xs font-semibold text-gray-300">Code A</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
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

              <button
                onClick={handleRunA}
                disabled={isRunningA || isComparing}
                className="px-2 py-0.5 rounded bg-cyan-900/40 hover:bg-cyan-800/60 text-cyan-300 text-[11px] font-semibold transition border border-cyan-700/50 flex items-center space-x-1"
                title="Run Code A only"
              >
                <Play className={`w-2.5 h-2.5 ${isRunningA ? 'animate-spin' : 'fill-current'}`} />
                <span>Run A</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
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

        {/* Workspace / Code B */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#0d0e11]">
          <div className="h-9 bg-[#131418] border-b border-[#1f2026] px-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              {mode === 'classroom' ? (
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-amber-400">Workspace B:</span>
                  <select
                    value={selectedUserB}
                    onChange={(e) => handleSelectParticipantB(e.target.value)}
                    className="bg-[#1c1d26] text-gray-200 text-xs font-medium border border-[#2e303f] rounded px-2 py-0.5 focus:outline-none focus:border-amber-500"
                  >
                    {classroomParticipants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isCodeHidden ? '🔒 (Private)' : `(${p.language})`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-xs font-semibold text-gray-300">Code B</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
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

              <button
                onClick={handleRunB}
                disabled={isRunningB || isComparing}
                className="px-2 py-0.5 rounded bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 text-[11px] font-semibold transition border border-amber-700/50 flex items-center space-x-1"
                title="Run Code B only"
              >
                <Play className={`w-2.5 h-2.5 ${isRunningB ? 'animate-spin' : 'fill-current'}`} />
                <span>Run B</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
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

      {/* 3. Bottom Dock: Multi-Tab Benchmark Analytics */}
      <div className="h-64 sm:h-72 border-t border-[#1f2026] bg-[#090a0d] flex flex-col">
        {/* Navigation & Status Bar */}
        <div className="h-9 bg-[#111216] border-b border-[#1f2026] px-4 flex items-center justify-between text-xs">
          {/* Tabs */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-[#1e2029] text-white border-b-2 border-[#ff9100]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Table2 className="w-3.5 h-3.5 text-[#ff9100]" />
              <span>Comparison Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('outputs')}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'outputs'
                  ? 'bg-[#1e2029] text-white border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Console Outputs</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'ai'
                  ? 'bg-[#1e2029] text-white border-b-2 border-purple-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Analysis</span>
            </button>

            <button
              onClick={() => setActiveTab('stdin')}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'stdin'
                  ? 'bg-[#1e2029] text-white border-b-2 border-emerald-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test Input {customStdin ? '(Active)' : ''}</span>
            </button>
          </div>

          {/* Quick Metrics Flash */}
          <div className="hidden sm:flex items-center space-x-3">
            {speedupLabel && (
              <span className="flex items-center space-x-1 font-bold text-[#ff9100]">
                <Zap className="w-3.5 h-3.5" />
                <span>{speedupLabel}</span>
              </span>
            )}

            {hasResults && (
              outputsMatch ? (
                <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Outputs Match</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-amber-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Outputs Differ</span>
                </span>
              )
            )}
          </div>
        </div>

        {/* Tab Content Views */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4 font-sans text-xs">
          {/* TAB 1: Comparison Matrix Table */}
          {activeTab === 'matrix' && (
            <div className="h-full flex flex-col justify-start">
              <div className="overflow-x-auto border border-[#1f2026] rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#14161d] text-gray-400 border-b border-[#1f2026]">
                      <th className="py-2.5 px-4 font-semibold">Metric</th>
                      <th className="py-2.5 px-4 font-semibold text-cyan-400">
                        {mode === 'classroom' ? userAName : 'Implementation A'} ({langA})
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-amber-400">
                        {mode === 'classroom' ? userBName : 'Implementation B'} ({langB})
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-[#ff9100]">Benchmark Analysis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#181920] bg-[#0c0d11]">
                    {/* Execution Latency */}
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-300">Execution Time</td>
                      <td className="py-2 px-4 font-mono">
                        {resultA ? `${resultA.executionTimeMs} ms` : isComparing || isRunningA ? 'Running...' : '—'}
                      </td>
                      <td className="py-2 px-4 font-mono">
                        {resultB ? `${resultB.executionTimeMs} ms` : isComparing || isRunningB ? 'Running...' : '—'}
                      </td>
                      <td className="py-2 px-4 font-semibold">
                        {speedupLabel ? (
                          <span className={winner === 'A' ? 'text-cyan-400' : winner === 'B' ? 'text-amber-400' : 'text-gray-300'}>
                            {speedupLabel}
                          </span>
                        ) : 'Run benchmark to compare'}
                      </td>
                    </tr>

                    {/* Memory Footprint */}
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-300">Memory Usage</td>
                      <td className="py-2 px-4 font-mono">
                        {resultA ? `${resultA.memoryUsageMb} MB` : '—'}
                      </td>
                      <td className="py-2 px-4 font-mono">
                        {resultB ? `${resultB.memoryUsageMb} MB` : '—'}
                      </td>
                      <td className="py-2 px-4 text-gray-400">
                        {hasResults ? (
                          resultA.memoryUsageMb < resultB.memoryUsageMb ? (
                            <span className="text-cyan-400">Code A uses less memory</span>
                          ) : resultB.memoryUsageMb < resultA.memoryUsageMb ? (
                            <span className="text-amber-400">Code B uses less memory</span>
                          ) : 'Equivalent memory profile'
                        ) : '—'}
                      </td>
                    </tr>

                    {/* Status & Exit Code */}
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-300">Exit Status</td>
                      <td className="py-2 px-4">
                        {resultA ? (
                          resultA.exitCode === 0 ? (
                            <span className="text-emerald-400">Exit 0 (Success)</span>
                          ) : (
                            <span className="text-rose-400">Exit {resultA.exitCode} (Error)</span>
                          )
                        ) : '—'}
                      </td>
                      <td className="py-2 px-4">
                        {resultB ? (
                          resultB.exitCode === 0 ? (
                            <span className="text-emerald-400">Exit 0 (Success)</span>
                          ) : (
                            <span className="text-rose-400">Exit {resultB.exitCode} (Error)</span>
                          )
                        ) : '—'}
                      </td>
                      <td className="py-2 px-4">
                        {hasResults && (
                          outputsMatch ? (
                            <span className="text-emerald-400">✓ Identical outputs</span>
                          ) : hasErrors ? (
                            <span className="text-rose-400">⚠️ Error during execution</span>
                          ) : (
                            <span className="text-amber-400">Outputs differ in stdout</span>
                          )
                        )}
                      </td>
                    </tr>

                    {/* Algorithmic Complexity */}
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-300">Estimated Complexity</td>
                      <td className="py-2 px-4 font-mono text-cyan-300">{complexityA}</td>
                      <td className="py-2 px-4 font-mono text-amber-300">{complexityB}</td>
                      <td className="py-2 px-4 text-gray-400">
                        {mode === 'presets' ? 'Theoretical Big-O analysis' : 'Syntactic heuristic evaluation'}
                      </td>
                    </tr>

                    {/* Code Size */}
                    <tr>
                      <td className="py-2 px-4 font-medium text-gray-300">Code Size</td>
                      <td className="py-2 px-4 font-mono">{codeA.split('\n').length} lines ({codeA.length} bytes)</td>
                      <td className="py-2 px-4 font-mono">{codeB.split('\n').length} lines ({codeB.length} bytes)</td>
                      <td className="py-2 px-4 text-gray-400">
                        {codeA.length < codeB.length ? 'Code A is more concise' : 'Code B is more concise'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {!hasResults && (
                <div className="mt-3 text-center text-gray-500 text-xs">
                  Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-[#1f2026] text-gray-300 font-mono">Ctrl+Enter</kbd> to execute both implementations simultaneously in cloud sandboxes.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Console Outputs Side-by-Side */}
          {activeTab === 'outputs' && (
            <div className="h-full flex divide-x divide-[#1f2026] overflow-hidden -m-3 sm:-m-4">
              {/* Output A */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#090a0d]">
                <div className="h-6 px-3 bg-[#0e1015] border-b border-[#1a1b20] flex items-center justify-between text-[10.5px] text-gray-400">
                  <span className="text-cyan-400 font-semibold">
                    {mode === 'classroom' ? userAName : 'Code A'} Output {resultA ? `(exit ${resultA.exitCode})` : ''}
                  </span>
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
                  ) : isComparing || isRunningA ? (
                    <span className="text-cyan-400 italic animate-pulse">Running Code A...</span>
                  ) : (
                    <span className="text-gray-600 italic">Output will appear here after execution.</span>
                  )}
                </div>
              </div>

              {/* Output B */}
              <div className="flex-1 flex flex-col min-h-0 bg-[#090a0d]">
                <div className="h-6 px-3 bg-[#0e1015] border-b border-[#1a1b20] flex items-center justify-between text-[10.5px] text-gray-400">
                  <span className="text-amber-400 font-semibold">
                    {mode === 'classroom' ? userBName : 'Code B'} Output {resultB ? `(exit ${resultB.exitCode})` : ''}
                  </span>
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
                  ) : isComparing || isRunningB ? (
                    <span className="text-amber-400 italic animate-pulse">Running Code B...</span>
                  ) : (
                    <span className="text-gray-600 italic">Output will appear here after execution.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI Comparative Analysis */}
          {activeTab === 'ai' && (
            <div className="h-full flex flex-col justify-start">
              {aiLoading ? (
                <div className="h-40 flex flex-col items-center justify-center space-y-3 text-gray-400">
                  <Sparkles className="w-6 h-6 text-purple-400 animate-spin" />
                  <p className="text-sm">Evaluating algorithm efficiency, Big-O bounds, and memory trade-offs...</p>
                </div>
              ) : aiComparison ? (
                <div className="bg-[#12131a] border border-purple-900/30 rounded-lg p-4 font-sans text-xs text-gray-200 leading-relaxed overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-purple-900/30 pb-2 mb-3">
                    <span className="flex items-center space-x-2 text-purple-300 font-semibold text-sm">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Cortex AI Comparative Evaluation</span>
                    </span>
                    <button
                      onClick={handleAiCompare}
                      className="text-[11px] text-purple-400 hover:text-purple-200 transition"
                    >
                      Re-analyze
                    </button>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-gray-300">
                    {aiComparison}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center space-y-2 text-gray-500">
                  <Sparkles className="w-8 h-8 text-purple-400/50" />
                  <p>Click &quot;AI Compare&quot; in the header to run an automated algorithmic breakdown.</p>
                  <button
                    onClick={handleAiCompare}
                    className="px-3 py-1 rounded bg-purple-900/50 hover:bg-purple-800/60 text-purple-200 text-xs font-medium transition"
                  >
                    Generate AI Evaluation Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Custom Stdin / Test Cases */}
          {activeTab === 'stdin' && (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-medium">
                  Provide custom standard input (`stdin`) to supply to both algorithms during benchmark execution:
                </span>
                {customStdin && (
                  <button
                    onClick={() => setCustomStdin('')}
                    className="text-[11px] text-rose-400 hover:underline"
                  >
                    Clear Input
                  </button>
                )}
              </div>
              <textarea
                value={customStdin}
                onChange={(e) => setCustomStdin(e.target.value)}
                placeholder="Enter custom input / test parameters here (e.g. array elements, queries, test cases)..."
                className="flex-1 w-full bg-[#111216] border border-[#232530] rounded-md p-3 font-mono text-xs text-gray-200 focus:outline-none focus:border-[#ff9100] resize-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
