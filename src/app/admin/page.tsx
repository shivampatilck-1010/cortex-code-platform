'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  SlidersHorizontal, 
  Activity, 
  Server, 
  ShieldCheck, 
  Users, 
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import { CortexLogo } from '@/components/brand/CortexLogo';

export default function AdminPage() {
  const [languages, setLanguages] = useState(
    SUPPORTED_LANGUAGES.map((l) => ({ ...l, enabled: true }))
  );

  const toggleLanguage = (id: string) => {
    setLanguages((prev) =>
      prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l))
    );
  };

  return (
    <div className="min-h-screen bg-[#121316] text-gray-100 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="h-14 bg-[#141518] border-b border-[#252830] px-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <div className="h-4 w-[1px] bg-[#32353e]" />
          <div className="flex items-center space-x-2 text-[#ff9100] font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4" />
            <span className="text-white">Platform System Administration & Health</span>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>All 16 Sandboxes Operational</span>
        </div>
      </header>

      {/* Admin Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6 overflow-y-auto">
        {/* Cluster Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Worker Nodes</span>
            <div className="text-2xl font-bold text-white mt-1">12 / 12 Online</div>
            <span className="text-[11px] text-emerald-400">gVisor MicroVMs Active</span>
          </div>
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Queue Throughput</span>
            <div className="text-2xl font-bold text-cyan-400 mt-1">420 req/sec</div>
            <span className="text-[11px] text-gray-500">Latency: 28ms avg</span>
          </div>
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Memory Allocation</span>
            <div className="text-2xl font-bold text-purple-400 mt-1">3.4 GB / 16 GB</div>
            <span className="text-[11px] text-gray-500">21% cgroup utilization</span>
          </div>
          <div className="p-4 bg-[#18191d] border border-[#262832] rounded-lg">
            <span className="text-xs text-gray-400 block">Security Threats Blocked</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">0 Escapes</div>
            <span className="text-[11px] text-emerald-400">100% Quarantine Rate</span>
          </div>
        </div>

        {/* Language Runtime Control Matrix */}
        <div className="p-5 bg-[#18191d] border border-[#262832] rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-gray-200">Language Runtime Enable/Disable Switches</h2>
              <p className="text-xs text-gray-400">Dynamically toggle sandbox availability across the entire global gateway.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {languages.map((l) => (
              <div
                key={l.id}
                className="p-3 bg-[#141518] border border-[#262832] rounded flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-white block">{l.name}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{l.version}</span>
                </div>
                <button
                  onClick={() => toggleLanguage(l.id)}
                  className={`p-1 transition ${l.enabled ? 'text-emerald-400' : 'text-gray-600'}`}
                >
                  {l.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Security Audit Events Log */}
        <div className="p-5 bg-[#18191d] border border-[#262832] rounded-lg space-y-3 text-xs font-mono">
          <h3 className="font-bold text-sm text-gray-200 font-sans">Recent Security Audit Logs</h3>
          <div className="bg-[#121316] border border-[#242630] rounded divide-y divide-[#20222a] p-2">
            <div className="py-2 flex items-center justify-between text-gray-300">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>[AUDIT-OK] Python process completed within 256MB cgroup memory boundary</span>
              </div>
              <span className="text-gray-500 text-[10px]">Just now</span>
            </div>
            <div className="py-2 flex items-center justify-between text-gray-300">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>[AUDIT-OK] C++20 g++ compile invocation succeeded in chroot namespace</span>
              </div>
              <span className="text-gray-500 text-[10px]">2 mins ago</span>
            </div>
            <div className="py-2 flex items-center justify-between text-gray-300">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span>[QUOTA-PASS] User reached 10s execution timeout; process killed cleanly via SIGKILL</span>
              </div>
              <span className="text-gray-500 text-[10px]">5 mins ago</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
