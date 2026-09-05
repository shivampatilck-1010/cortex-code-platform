'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  GitFork, 
  Code2, 
  Play, 
  Clock, 
  Cpu, 
  FileCode, 
  Zap, 
  ArrowLeft,
  Scale
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { SUPPORTED_LANGUAGES, getLanguageConfig } from '@/config/languages';
import { executeInCloudSandbox } from '@/lib/execution/engine';
import { ExecutionResult } from '@/lib/execution/types';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function ComparePage() {
  // Model A
  const [langA, setLangA] = useState('python');
  const [codeA, setCodeA] = useState(
`# Algorithm A: Linear Search O(n)
def search(target, nums):
    for i, x in enumerate(nums):
        if x == target:
            return i
    return -1

nums = list(range(100000))
print(f"Index: {search(99999, nums)}")
`
  );
  const [resultA, setResultA] = useState<ExecutionResult | null>(null);

  // Model B
  const [langB, setLangB] = useState('python');
  const [codeB, setCodeB] = useState(
`# Algorithm B: Binary Search O(log n)
import bisect

def binary_search(target, nums):
    idx = bisect.bisect_left(nums, target)
    return idx if idx < len(nums) and nums[idx] == target else -1

nums = list(range(100000))
print(f"Index: {binary_search(99999, nums)}")
`
  );
  const [resultB, setResultB] = useState<ExecutionResult | null>(null);

  const [isComparing, setIsComparing] = useState(false);

  const handleRunComparison = async () => {
    setIsComparing(true);
    try {
      const [resA, resB] = await Promise.all([
        executeInCloudSandbox({
          language: langA,
          files: [{ id: 'a', name: getLanguageConfig(langA).defaultFileName, path: '/a', content: codeA }],
        }),
        executeInCloudSandbox({
          language: langB,
          files: [{ id: 'b', name: getLanguageConfig(langB).defaultFileName, path: '/b', content: codeB }],
        }),
      ]);
      setResultA(resA);
      setResultB(resB);
    } finally {
      setIsComparing(false);
    }
  };

  const speedupRatio =
    resultA && resultB && resultB.executionTimeMs > 0
      ? (resultA.executionTimeMs / resultB.executionTimeMs).toFixed(1)
      : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121316] text-gray-100 font-sans select-none overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-[#141518] border-b border-[#252830] px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <nav className="hidden lg:flex items-center space-x-1 pl-3 border-l border-[#252830]">
            <Link href="/" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              IDE
            </Link>
            <Link href="/challenges" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Challenges
            </Link>
            <Link href="/learn" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Learn
            </Link>
            <Link href="/compare" className="px-2.5 py-1 rounded text-xs bg-[#1e2026] text-[#ff9100] font-bold transition">
              Benchmark
            </Link>
            <Link href="/dashboard" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Dashboard
            </Link>
          </nav>
        </div>

        <button
          onClick={handleRunComparison}
          disabled={isComparing}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded text-xs font-semibold shadow transition ${
            isComparing
              ? 'bg-purple-900 text-purple-200 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white'
          }`}
        >
          <Play className={`w-3.5 h-3.5 ${isComparing ? 'animate-spin' : 'fill-current'}`} />
          <span>{isComparing ? 'Benchmarking Both...' : 'Run Dual Benchmark'}</span>
        </button>
      </header>

      {/* Comparison Metrics Header Banner */}
      {resultA && resultB && (
        <div className="bg-[#1a1b22] border-b border-[#282a34] p-3 px-6 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-6">
            <div>
              <span className="text-gray-500 block text-[10px]">Algorithm A Time:</span>
              <span className="text-cyan-400 font-bold">{resultA.executionTimeMs} ms</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Algorithm B Time:</span>
              <span className="text-purple-400 font-bold">{resultB.executionTimeMs} ms</span>
            </div>
            {speedupRatio && (
              <div className="px-3 py-1 bg-emerald-950/40 border border-emerald-800/40 rounded text-emerald-300 font-bold">
                Speedup: {Number(speedupRatio) >= 1 ? `B is ${speedupRatio}x faster` : `A is ${(1 / Number(speedupRatio)).toFixed(1)}x faster`}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4 text-gray-400">
            <span>Memory: {resultA.memoryUsageMb} MB vs {resultB.memoryUsageMb} MB</span>
          </div>
        </div>
      )}

      {/* 2 Side-by-Side Panels */}
      <div className="flex-1 flex overflow-hidden divide-x divide-[#2a2c33]">
        {/* SIDE A */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-[#18191d]">
          <div className="p-2 px-4 bg-[#141518] border-b border-[#262832] flex items-center justify-between">
            <span className="font-bold text-xs text-cyan-400">Candidate A</span>
            <select
              value={langA}
              onChange={(e) => setLangA(e.target.value)}
              className="bg-[#22242a] text-gray-200 border border-[#373a45] rounded px-2 py-0.5 text-xs font-mono"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              language={getLanguageConfig(langA).monacoLang}
              value={codeA}
              theme="vs-dark"
              onChange={(v) => setCodeA(v || '')}
              options={{ fontSize: 13, minimap: { enabled: false } }}
            />
          </div>
          {resultA && (
            <div className="h-28 bg-[#121316] border-t border-[#262832] p-2 text-xs font-mono overflow-y-auto">
              <span className="text-[10px] text-gray-500 uppercase block">Candidate A Output:</span>
              <pre className="text-gray-300">{resultA.stdout || resultA.stderr}</pre>
            </div>
          )}
        </div>

        {/* SIDE B */}
        <div className="w-1/2 flex flex-col overflow-hidden bg-[#18191d]">
          <div className="p-2 px-4 bg-[#141518] border-b border-[#262832] flex items-center justify-between">
            <span className="font-bold text-xs text-purple-400">Candidate B</span>
            <select
              value={langB}
              onChange={(e) => setLangB(e.target.value)}
              className="bg-[#22242a] text-gray-200 border border-[#373a45] rounded px-2 py-0.5 text-xs font-mono"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              language={getLanguageConfig(langB).monacoLang}
              value={codeB}
              theme="vs-dark"
              onChange={(v) => setCodeB(v || '')}
              options={{ fontSize: 13, minimap: { enabled: false } }}
            />
          </div>
          {resultB && (
            <div className="h-28 bg-[#121316] border-t border-[#262832] p-2 text-xs font-mono overflow-y-auto">
              <span className="text-[10px] text-gray-500 uppercase block">Candidate B Output:</span>
              <pre className="text-gray-300">{resultB.stdout || resultB.stderr}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
