'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Terminal, 
  BookOpen, 
  ShieldAlert, 
  Github, 
  ExternalLink,
  Cpu,
  Layers,
  Radio
} from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { useTheme } from './ThemeContext';

export const LandingFooter: React.FC = () => {
  const { isDark } = useTheme();

  return (
    <footer 
      className={`border-t py-16 font-sans transition-colors duration-300 ${
        isDark ? 'border-[#1F2024] bg-[#08090A] text-zinc-400' : 'border-slate-200 bg-white text-zinc-600'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Status Beacon Banner */}
        <div className={`p-4 rounded-xl border mb-12 flex flex-wrap items-center justify-between gap-4 transition-colors ${
          isDark ? 'bg-[#0B0C0E] border-[#1F2024]' : 'bg-slate-50 border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className={`font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
              SYSTEM STATUS // ALL SYSTEMS OPERATIONAL
            </span>
            <span className="text-zinc-500">//</span>
            <span className="text-emerald-500 font-medium">
              CLOUDFLARE EDGE ACTIVE
            </span>
          </div>

          <div className="font-mono text-[11px] text-zinc-500 flex items-center gap-4">
            <span>EDGE POPS: 300+</span>
            <span>UPTIME: 99.99%</span>
          </div>
        </div>

        {/* Directory Columns */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-4">
            <CortexLogo variant="header" size="md" />
            <p className={`text-xs max-w-sm leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Decoupled cloud developer ecosystem spanning standalone multi-language IDE, 
              academic virtual computer science labs, and secure assessment kiosks.
            </p>
            <div className={`text-[11px] font-mono ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>
              Zero-Install Architecture &bull; Global Edge Network
            </div>
          </div>

          {/* Column 1: Products */}
          <div className="space-y-3 font-mono text-xs">
            <div className={`font-bold tracking-wider uppercase text-[11px] ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Products
            </div>
            <ul className="space-y-2">
              <li>
                <Link href="/ide" className={`transition-colors flex items-center gap-1.5 ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
                  <Terminal className="w-3 h-3 text-[#FF9100]" />
                  <span>Cortex IDE</span>
                </Link>
              </li>
              <li>
                <Link href="/classroom" className={`transition-colors flex items-center gap-1.5 ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
                  <BookOpen className="w-3 h-3 text-cyan-500" />
                  <span>Cortex Classroom</span>
                </Link>
              </li>
              <li>
                <Link href="/lockdown" className={`transition-colors flex items-center gap-1.5 ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
                  <ShieldAlert className="w-3 h-3 text-purple-500" />
                  <span>Cortex Browser</span>
                </Link>
              </li>
              <li>
                <Link href="/cpp" className={`transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800'}`}>
                  C++ Cloud Compiler
                </Link>
              </li>
              <li>
                <Link href="/python" className={`transition-colors ${isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800'}`}>
                  Python Cloud Compiler
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Architecture */}
          <div className="space-y-3 font-mono text-xs">
            <div className={`font-bold tracking-wider uppercase text-[11px] ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Architecture
            </div>
            <ul className="space-y-2">
              <li className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Cloudflare Workers Edge</li>
              <li className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Micro-VM Sandboxes</li>
              <li className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>Win32 Hook Agent</li>
              <li className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>WebRTC Audio/Video Mesh</li>
              <li className={isDark ? 'text-zinc-400' : 'text-zinc-600'}>D1 Distributed SQL</li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-3 font-mono text-xs">
            <div className={`font-bold tracking-wider uppercase text-[11px] ${isDark ? 'text-white' : 'text-zinc-900'}`}>
              Resources
            </div>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/shivampatilck-1010/cortex-code-platform"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`transition-colors flex items-center gap-1.5 ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}
                >
                  <Github className="w-3.5 h-3.5" />
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-2.5 h-2.5 text-zinc-500" />
                </a>
              </li>
              <li>
                <Link href="/ide" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
                  Web IDE Studio
                </Link>
              </li>
              <li>
                <Link href="/classroom" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
                  Classroom Collaboration
                </Link>
              </li>
              <li>
                <Link href="/lockdown" className={`transition-colors ${isDark ? 'hover:text-white' : 'hover:text-zinc-900'}`}>
                  Security Verification
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className={`pt-8 border-t flex flex-wrap items-center justify-between text-xs font-mono gap-4 ${
          isDark ? 'border-[#1F2024] text-zinc-600' : 'border-slate-200 text-zinc-500'
        }`}>
          <div>
            &copy; 2026 Cortex Code Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Security Compliant</span>
            <span>Edge Accelerated</span>
            <span>Zero-Telemetry Leak</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
