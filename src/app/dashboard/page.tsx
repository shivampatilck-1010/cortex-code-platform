'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Code2, 
  Play, 
  Trophy, 
  BookOpen, 
  Sparkles, 
  FolderGit2, 
  Clock, 
  Cpu, 
  CheckCircle2, 
  TrendingUp, 
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function DashboardPage() {
  const stats = [
    { label: 'Total Executions', val: '1,428', change: '+14% this week', icon: Play, color: 'text-emerald-400' },
    { label: 'Challenges Solved', val: '46', change: 'Top 8% globally', icon: Trophy, color: 'text-yellow-400' },
    { label: 'Active Projects', val: '12', change: '3 shared public', icon: FolderGit2, color: 'text-[#ff9100]' },
    { label: 'AI Auto-Fixes Applied', val: '89', change: '98.2% verified', icon: Sparkles, color: 'text-purple-400' },
  ];

  const recentProjects = [
    { id: 'proj-1', name: 'High-Throughput C++ Router', lang: 'C++20', updated: '2 hours ago', status: 'Healthy' },
    { id: 'proj-2', name: 'Python Async Scraper & ETL', lang: 'Python 3.12', updated: 'Yesterday', status: 'Deployed' },
    { id: 'proj-3', name: 'Rust Memory-Safe Cache', lang: 'Rust 1.75', updated: '3 days ago', status: 'Passing Tests' },
  ];

  const recentExecutions = [
    { lang: 'Python', file: 'main.py', time: '38 ms', memory: '14 MB', status: 'Passed', when: '10 mins ago' },
    { lang: 'C++', file: 'main.cpp', time: '12 ms', memory: '8 MB', status: 'Passed', when: '1 hour ago' },
    { lang: 'Java', file: 'Main.java', time: '120 ms', memory: '34 MB', status: 'Compilation Error', when: '3 hours ago' },
  ];

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-gray-100 flex flex-col font-sans select-none">
      {/* Dashboard Header */}
      <header className="h-14 bg-[#141518] border-b border-[#252830] px-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <nav className="hidden sm:flex items-center space-x-1 pl-3 border-l border-[#252830]">
            <Link href="/" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              IDE
            </Link>
            <Link href="/challenges" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Challenges
            </Link>
            <Link href="/learn" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Learn
            </Link>
            <Link href="/compare" className="px-2.5 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1e2026] transition">
              Benchmark
            </Link>
            <Link href="/dashboard" className="px-2.5 py-1 rounded text-xs bg-[#1e2026] text-[#ff9100] font-bold transition">
              Dashboard
            </Link>
          </nav>
        </div>
        <Link
          href="/"
          className="px-3.5 py-1.5 bg-[#ff9100] hover:bg-[#e07f00] text-[#0b0c0e] rounded text-xs font-bold flex items-center space-x-1.5 transition active:scale-95 shadow"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch Cloud IDE</span>
        </Link>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 overflow-y-auto">
        {/* Welcome Banner */}
        <div className="p-6 bg-gradient-to-r from-[#17181c] to-[#121316] border border-[#262832] rounded-xl flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 text-[#ff9100] text-[10px] font-bold uppercase tracking-wider mb-1">
              <span>COMPILE</span>
              <span className="text-gray-600">|</span>
              <span>CREATE</span>
              <span className="text-gray-600">|</span>
              <span>COLLABORATE</span>
              <span className="text-gray-600">|</span>
              <span>DEPLOY</span>
            </div>
            <h1 className="text-xl font-black text-white mb-1">Cortex — Code Beyond Limits</h1>
            <p className="text-gray-400 text-xs">
              Universal cloud execution sandbox active across 16 runtimes. All workers healthy.
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-[#ff9100] hover:bg-[#e07f00] text-[#0b0c0e] font-bold rounded text-xs shadow flex items-center space-x-1.5 transition active:scale-95"
          >
            <span>Continue Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="p-4 bg-[#18191d] border border-[#262832] rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{stat.label}</span>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold text-white">{stat.val}</div>
                <div className="text-[11px] text-gray-500 flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span>{stat.change}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 2-Column Split: Recent Projects & Executions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects */}
          <div className="p-5 bg-[#18191d] border border-[#262832] rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-gray-200">Recent Projects & Workspaces</h2>
              <Link href="/" className="text-xs text-cyan-400 hover:underline">New Project</Link>
            </div>
            <div className="divide-y divide-[#262832]">
              {recentProjects.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-xs text-white block">{p.name}</span>
                    <span className="text-[11px] text-gray-400 font-mono">{p.lang} • Updated {p.updated}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 text-[10px]">
                      {p.status}
                    </span>
                    <Link href="/" className="p-1 text-gray-400 hover:text-white">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Executions Activity */}
          <div className="p-5 bg-[#18191d] border border-[#262832] rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-gray-200">Recent Sandbox Executions</h2>
              <span className="text-[11px] text-gray-500">Live Telemetry</span>
            </div>
            <div className="divide-y divide-[#262832]">
              {recentExecutions.map((e, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-cyan-400">{e.lang}</span>
                    <span className="text-gray-400">/{e.file}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span className="text-gray-400">{e.time}</span>
                    <span className="text-purple-400">{e.memory}</span>
                    <span className={e.status === 'Passed' ? 'text-emerald-400' : 'text-rose-400'}>
                      {e.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Links to Ecosystem */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <Link href="/challenges" className="p-4 bg-[#18191d] hover:bg-[#202227] border border-[#262832] rounded-lg transition group">
            <Trophy className="w-5 h-5 text-yellow-400 mb-2 group-hover:scale-110 transition" />
            <h3 className="font-bold text-sm text-white">Competitive Programming</h3>
            <p className="text-xs text-gray-400 mt-1">Solve challenges, test against hidden cases, and climb global leaderboards.</p>
          </Link>

          <Link href="/learn" className="p-4 bg-[#18191d] hover:bg-[#202227] border border-[#262832] rounded-lg transition group">
            <BookOpen className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition" />
            <h3 className="font-bold text-sm text-white">Interactive Learning</h3>
            <p className="text-xs text-gray-400 mt-1">Step-by-step programming courses with integrated tests and instant feedback.</p>
          </Link>

          <Link href="/compare" className="p-4 bg-[#18191d] hover:bg-[#202227] border border-[#262832] rounded-lg transition group">
            <Layers className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition" />
            <h3 className="font-bold text-sm text-white">Benchmark & Compare</h3>
            <p className="text-xs text-gray-400 mt-1">Compare execution latency, memory footprint, and asymptotic Big-O scaling.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
