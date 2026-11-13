'use client';

import React, { useState } from 'react';
import { 
  Cpu, 
  Globe, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Database, 
  Server, 
  Clock, 
  Lock,
  Network,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { useTheme } from './ThemeContext';

interface TierData {
  id: string;
  name: string;
  tagline: string;
  specs: { label: string; value: string }[];
  description: string;
  technologies: string[];
}

const ARCHITECTURE_TIERS: TierData[] = [
  {
    id: 'client',
    name: '01 // Client Tier',
    tagline: 'Modern Web Frontends & Native OS Kiosk Agents',
    description: 
      'Combines Next.js 14 App Router on the web with a native Windows 10/11 x64 Kiosk Agent written in C#/.NET. Enforces Win32 display exclusion and low-level keyboard hook suppression directly on candidate hardware.',
    specs: [
      { label: 'Rendering Pipeline', value: 'SSR + React 19 Client Hydration' },
      { label: 'Native Agent', value: 'C# .NET / Win32 P/Invoke Hooks' },
      { label: 'Display Affinity', value: 'WDA_EXCLUDEFROMCAPTURE' },
      { label: 'Bundle Footprint', value: '< 2.4 MB Compressed' },
    ],
    technologies: ['Next.js 14', 'React 19', 'Tailwind CSS', 'Monaco Editor', 'C# / WPF', 'WebView2'],
  },
  {
    id: 'edge',
    name: '02 // Edge Routing Tier',
    tagline: 'Global Anycast Edge Network & Zero-Cold-Start Gateways',
    description:
      'All traffic routes through 300+ global Cloudflare edge points of presence. Provides edge TLS 1.3 termination, automatic DDoS mitigation, dynamic caching, and instant request routing with < 15ms D1 SQL latency.',
    specs: [
      { label: 'Global Edge Latency', value: '< 15ms D1 SQL latency' },
      { label: 'Edge POPs', value: '300+ Global Locations' },
      { label: 'DDoS Capacity', value: '192 Tbps Mitigation Fabric' },
      { label: 'HTTP Protocol', value: 'HTTP/3 over QUIC' },
    ],
    technologies: ['Cloudflare Workers', 'V8 Isolates', 'Cloudflare D1', 'Anycast Routing', 'TLS 1.3'],
  },
  {
    id: 'compute',
    name: '03 // Compute Sandboxes',
    tagline: 'Ephemeral Micro-VM Runtimes & Isolated Execution',
    description:
      'Multi-language code compilation runs in isolated ephemeral micro-VM environments with strict memory cgroups, seccomp-bpf syscall filtering, and zero persistent disk access to guarantee absolute tenant isolation with < 50ms worker latency.',
    specs: [
      { label: 'Worker Latency', value: '< 50ms worker latency' },
      { label: 'Runtime Matrix', value: '16 Polyglot Environments' },
      { label: 'Memory Ceiling', value: '512 MB per Execution' },
      { label: 'Syscall Security', value: 'Seccomp-BPF / Linux Namespaces' },
    ],
    technologies: ['Docker / Firecracker', 'LLVM Clang', 'Rustc', 'CPython', 'OpenJDK', 'Go Toolchain'],
  },
  {
    id: 'state',
    name: '04 // State Fabric',
    tagline: 'Distributed Real-Time WebRTC Mesh & Cryptographic Ledger',
    description:
      'Facilitates peer-to-peer audio/video streaming via WebRTC mesh networks while simultaneously syncing collaborative editor state via CRDTs. All exam telemetry is sealed into an append-only SHA-256 integrity chain.',
    specs: [
      { label: 'Collaboration Sync', value: '< 20ms Peer Mesh' },
      { label: 'Integrity Chain', value: 'SHA-256 Merkle Verification' },
      { label: 'Database Engine', value: 'Cloudflare D1 SQLite Cluster (< 15ms D1 SQL latency)' },
      { label: 'Availability SLA', value: '99.99% Uptime Guarantee' },
    ],
    technologies: ['WebRTC Mesh', 'CRDT Yjs', 'Cloudflare D1', 'WebSockets', 'SHA-256 Merkle Ledger'],
  },
];

export const TechnicalArchitectureGrid: React.FC = () => {
  const { isDark } = useTheme();
  const [selectedTierId, setSelectedTierId] = useState<string>('client');
  const activeTier = ARCHITECTURE_TIERS.find((t) => t.id === selectedTierId) || ARCHITECTURE_TIERS[0];

  return (
    <section 
      className={`py-24 border-t relative transition-colors duration-300 ${
        isDark ? 'border-[#1F2024] bg-[#08090A] text-[#E6EDF3]' : 'border-slate-200 bg-[#FFFFFF] text-zinc-950'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wider mb-4 border transition-colors bg-orange-500/10 border-orange-500/30 text-[#FF9100]">
            <Layers className="w-3.5 h-3.5 text-[#FF9100]" />
            <span>DISTRIBUTED INFRASTRUCTURE</span>
          </div>
          <h2 className={`text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            Engineered for Millisecond Precision
          </h2>
          <p className={`text-base sm:text-lg leading-relaxed ${
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          }`}>
            The Cortex platform combines global edge networks, ephemeral compute containers, 
            and native OS-level integrity monitors into a cohesive, high-availability developer fabric.
          </p>
        </div>

        {/* 4 Performance Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          <div className={`p-6 rounded-2xl border shadow-xl transition-colors ${
            isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/5'
          }`}>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-[#FF9100] mb-2">
              &lt; 15ms
            </div>
            <div className={`text-xs font-mono font-bold uppercase tracking-wider mb-1 ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}>
              Global Edge Latency
            </div>
            <div className="text-[11px] text-zinc-500">
              Distributed Cloudflare Workers network routing across 300+ edge locations.
            </div>
          </div>

          <div className={`p-6 rounded-2xl border shadow-xl transition-colors ${
            isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/5'
          }`}>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-cyan-500 mb-2">
              16
            </div>
            <div className={`text-xs font-mono font-bold uppercase tracking-wider mb-1 ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}>
              Isolated Runtimes
            </div>
            <div className="text-[11px] text-zinc-500">
              Native compiler sandboxes with zero-install execution for all major languages.
            </div>
          </div>

          <div className={`p-6 rounded-2xl border shadow-xl transition-colors ${
            isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/5'
          }`}>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-purple-500 mb-2">
              SHA-256
            </div>
            <div className={`text-xs font-mono font-bold uppercase tracking-wider mb-1 ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}>
              Cryptographic Audit
            </div>
            <div className="text-[11px] text-zinc-500">
              Immutable telemetry event hashing for zero-trust institutional compliance.
            </div>
          </div>

          <div className={`p-6 rounded-2xl border shadow-xl transition-colors ${
            isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/5'
          }`}>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-500 mb-2">
              99.99%
            </div>
            <div className={`text-xs font-mono font-bold uppercase tracking-wider mb-1 ${
              isDark ? 'text-white' : 'text-zinc-900'
            }`}>
              SLA Availability
            </div>
            <div className="text-[11px] text-zinc-500">
              Fault-tolerant state replication with resilient offline ring-buffering.
            </div>
          </div>
        </div>

        {/* 4-Tier Interactive Breakdown */}
        <div className={`rounded-2xl border overflow-hidden shadow-2xl transition-colors ${
          isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-white border-slate-200 shadow-slate-900/5'
        }`}>
          {/* Tier Switcher Header */}
          <div className={`grid grid-cols-2 md:grid-cols-4 border-b ${
            isDark ? 'border-[#1F2024] bg-[#111216]' : 'border-slate-200 bg-slate-50'
          }`}>
            {ARCHITECTURE_TIERS.map((tier) => {
              const isSelected = tier.id === selectedTierId;
              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTierId(tier.id)}
                  className={`p-4 text-left font-mono transition-colors border-r last:border-r-0 ${
                    isDark ? 'border-[#1F2024]' : 'border-slate-200'
                  } ${
                    isSelected
                      ? isDark
                        ? 'bg-[#0B0C0E] text-white border-b-2 border-b-[#FF9100]'
                        : 'bg-white text-zinc-900 border-b-2 border-b-orange-500 font-bold'
                      : isDark
                        ? 'text-zinc-400 hover:text-white hover:bg-white/5'
                        : 'text-zinc-600 hover:text-zinc-900 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs font-bold mb-1">{tier.name}</div>
                  <div className="text-[10px] text-zinc-500 truncate">{tier.tagline}</div>
                </button>
              );
            })}
          </div>

          {/* Tier Detail Body */}
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              <h3 className={`text-xl sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {activeTier.tagline}
              </h3>
              <p className={`text-sm leading-relaxed font-sans ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {activeTier.description}
              </p>

              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-zinc-500 mb-2">
                  Key Technologies &amp; Standards
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeTier.technologies.map((tech) => (
                    <span
                      key={tech}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono border ${
                        isDark 
                          ? 'bg-[#111216] border-[#20222A] text-zinc-300' 
                          : 'bg-slate-100 border-slate-200 text-zinc-700'
                      }`}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className={`lg:col-span-5 p-5 rounded-xl border font-mono text-xs space-y-3 ${
              isDark ? 'bg-[#08090A] border-[#1F2024]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider pb-2 border-b border-zinc-700/20">
                System Specification Parameters
              </div>
              {activeTier.specs.map((spec, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 border-b border-zinc-700/20">
                  <span className="text-zinc-500">{spec.label}</span>
                  <span className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{spec.value}</span>
                </div>
              ))}
              <div className="pt-2 flex items-center gap-1.5 text-emerald-500 text-[10px]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero-Trust Enterprise Compliance Verified</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
