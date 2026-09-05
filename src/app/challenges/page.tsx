'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Trophy, 
  Code2, 
  Search, 
  Filter, 
  CheckCircle2, 
  ArrowRight, 
  Flame, 
  Award,
  Sparkles
} from 'lucide-react';
import { CHALLENGES } from '@/lib/challenges/challenges-data';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function ChallengesPage() {
  const [filterDifficulty, setFilterDifficulty] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChallenges = CHALLENGES.filter((c) => {
    const matchDiff = filterDifficulty === 'All' || c.difficulty === filterDifficulty;
    const matchSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchDiff && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#121316] text-gray-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="h-14 bg-[#18191c] border-b border-[#2a2c33] px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <nav className="hidden sm:flex items-center space-x-1 pl-3 border-l border-[#2a2c33]">
            <Link href="/" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#252830] transition">
              IDE
            </Link>
            <Link href="/challenges" className="px-2.5 py-1 rounded text-xs bg-[#252830] text-[#ff9100] font-bold transition">
              Challenges
            </Link>
            <Link href="/learn" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#252830] transition">
              Learn
            </Link>
            <Link href="/compare" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#252830] transition">
              Benchmark
            </Link>
            <Link href="/dashboard" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#252830] transition">
              Dashboard
            </Link>
          </nav>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold text-[#0b0c0e] bg-[#ff9100] hover:bg-[#e07f00] px-3 py-1.5 rounded transition shadow"
        >
          Launch Cloud IDE
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 overflow-y-auto">
        {/* Banner */}
        <div className="p-6 bg-gradient-to-r from-[#201c2b] to-[#18191e] border border-purple-900/40 rounded-xl flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-yellow-400 font-semibold text-xs mb-1">
              <Trophy className="w-4 h-4" />
              <span>Competitive Problem Solver & Arena</span>
            </div>
            <h1 className="text-xl font-bold text-white">Master Algorithms with Live Cloud Sandboxes</h1>
            <p className="text-gray-400 text-xs mt-1">
              Execute against sample and hidden test cases with real-time memory and time complexity limits.
            </p>
          </div>
          <div className="hidden sm:flex items-center space-x-3">
            <div className="p-3 bg-[#16171d] rounded border border-[#2c2f3b] text-center">
              <span className="text-lg font-bold text-yellow-400">1,280</span>
              <span className="text-[10px] text-gray-400 block">Rating Score</span>
            </div>
          </div>
        </div>

        {/* Filters & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#18191d] p-3 rounded-lg border border-[#262832]">
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search problems or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#121316] text-gray-200 pl-8 pr-3 py-1.5 rounded text-xs border border-[#2d303b] focus:outline-none focus:ring-1 focus:ring-cyan-500 w-64"
              />
            </div>
          </div>

          <div className="flex items-center space-x-1 text-xs">
            {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
              <button
                key={diff}
                onClick={() => setFilterDifficulty(diff)}
                className={`px-3 py-1 rounded transition ${
                  filterDifficulty === diff
                    ? 'bg-cyan-600 text-white font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-[#22242b]'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Challenge List Table */}
        <div className="bg-[#18191d] border border-[#262832] rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2.5 bg-[#1f2127] border-b border-[#262832] text-xs font-semibold text-gray-400">
            <div className="col-span-1">Status</div>
            <div className="col-span-5">Title</div>
            <div className="col-span-2">Difficulty</div>
            <div className="col-span-2">Acceptance</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          <div className="divide-y divide-[#262832]">
            {filteredChallenges.map((c) => (
              <div key={c.id} className="grid grid-cols-12 px-4 py-3.5 items-center text-xs hover:bg-[#1d1e24] transition">
                <div className="col-span-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
                </div>
                <div className="col-span-5">
                  <Link href={`/challenges/${c.id}`} className="font-semibold text-gray-200 hover:text-cyan-400 transition">
                    {c.title}
                  </Link>
                  <div className="flex items-center space-x-1.5 mt-1">
                    {c.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded bg-[#252830] text-gray-400 text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      c.difficulty === 'Easy'
                        ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40'
                        : c.difficulty === 'Medium'
                        ? 'text-yellow-400 bg-yellow-950/40 border border-yellow-800/40'
                        : 'text-rose-400 bg-rose-950/40 border border-rose-800/40'
                    }`}
                  >
                    {c.difficulty}
                  </span>
                </div>
                <div className="col-span-2 text-gray-400 font-mono text-[11px]">{c.acceptanceRate}</div>
                <div className="col-span-2 text-right">
                  <Link
                    href={`/challenges/${c.id}`}
                    className="inline-flex items-center space-x-1 px-3 py-1 bg-cyan-600/20 hover:bg-cyan-600 text-cyan-300 hover:text-white rounded text-xs font-semibold transition"
                  >
                    <span>Solve</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
