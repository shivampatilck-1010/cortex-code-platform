'use client';

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Bug, 
  Sparkles, 
  Share2, 
  Settings, 
  User,
  Activity,
  Code2,
  Columns,
  Layers,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageConfig } from '@/config/languages';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { LanguageSelector } from '@/components/common/LanguageSelector';
import { requestBrowserFullscreen } from '@/lib/classroom/useClassroomFullscreen';

interface NavbarProps {
  currentLanguage: LanguageConfig;
  onLanguageChange: (lang: LanguageConfig) => void;
  onRun: () => void;
  isRunning: boolean;
  onDebug: () => void;
  isDebugging: boolean;
  autoFixEnabled: boolean;
  onToggleAutoFix: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  projectName?: string;
  onVisualize?: () => void;
  isVisualizing?: boolean;
  layoutMode?: 'code' | 'visualize' | 'split';
  onLayoutModeChange?: (mode: 'code' | 'visualize' | 'split') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLanguage,
  onLanguageChange,
  onRun,
  isRunning,
  onDebug,
  isDebugging,
  autoFixEnabled,
  onToggleAutoFix,
  onOpenSettings,
  onOpenShare,
  onVisualize,
  isVisualizing = false,
  layoutMode = 'code',
  onLayoutModeChange,
}) => {
  const pathname = usePathname() || '/';
  const [currentUser, setCurrentUser] = useState<{ name: string; professionalEmail?: string; role?: string } | null>(null);

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="h-12 border-b bg-[#0b0c0e] border-[#1f2024] text-[#e6edf3] flex items-center justify-between px-3 text-xs z-30 select-none relative">
      {/* GROUP 1: Primary Navigation (Left) */}
      <div className="flex items-center space-x-2.5 flex-shrink-0">
        <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
          <CortexLogo variant="header" size="sm" />
        </Link>

        {/* Global Hub Navigation */}
        <nav className="flex items-center space-x-1 pl-2.5 border-l border-[#1f2024]">
          <Link
            href="/"
            className={`h-8 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center transition ${
              pathname === '/' || pathname.endsWith('-online-compiler')
                ? 'bg-[#1e1f26] text-[#ff9100]'
                : 'text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c]'
            }`}
          >
            IDE
          </Link>
          <Link
            href="/classroom"
            onClick={() => {
              requestBrowserFullscreen().catch(() => {});
            }}
            className={`h-8 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center transition ${
              pathname.startsWith('/classroom') || pathname.startsWith('/room')
                ? 'bg-[#1e1f26] text-[#ff9100]'
                : 'text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c]'
            }`}
          >
            Classroom
          </Link>
          <Link
            href="/lockdown"
            className={`h-8 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
              pathname.startsWith('/lockdown')
                ? 'bg-[#1e1f26] text-[#ff9100]'
                : 'text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c]'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-[#ff9100]" />
            <span>Cortex Lockdown</span>
          </Link>
          <Link
            href="/compare"
            className={`h-8 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center transition ${
              pathname.startsWith('/compare')
                ? 'bg-[#1e1f26] text-[#ff9100]'
                : 'text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c]'
            }`}
          >
            Benchmark
          </Link>
          <Link
            href="/challenges"
            className={`hidden lg:flex h-8 px-2.5 rounded-md text-xs font-semibold items-center justify-center transition ${
              pathname.startsWith('/challenges')
                ? 'bg-[#1e1f26] text-[#ff9100]'
                : 'text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c]'
            }`}
          >
            Practice
          </Link>
          <Link
            href="/learn"
            className={`hidden xl:flex h-8 px-2.5 rounded-md text-xs font-semibold items-center justify-center transition ${
              pathname.startsWith('/learn')
                ? 'bg-[#1e1f26] text-[#ff9100]'
                : 'text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c]'
            }`}
          >
            Learn
          </Link>
        </nav>
      </div>

      {/* GROUP 2 & 3: Execution Controls & Workspace Mode (Center) */}
      <div className="flex items-center space-x-2.5 mx-2 flex-shrink-0">
        {/* Execution Controls Group */}
        <div className="flex items-center space-x-1.5">
          {/* Language selector */}
          <LanguageSelector
            currentLanguage={currentLanguage}
            onSelectLanguage={onLanguageChange}
          />

          {/* Run Button (Ctrl+Enter) */}
          <button
            onClick={onRun}
            disabled={isRunning}
            className={`h-8 flex items-center space-x-1.5 px-3.5 rounded-md text-xs font-bold font-heading tracking-wide shadow-sm transition active:scale-95 ${
              isRunning
                ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title="Compile & Run Code (Ctrl+Enter)"
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
            <span>{isRunning ? 'Running...' : 'Run'}</span>
          </button>

          {/* Visualize Action Button (Executes & Records Runtime Trace) */}
          {onVisualize && (
            <button
              onClick={onVisualize}
              disabled={isVisualizing}
              className={`h-8 flex items-center space-x-1.5 px-3.5 rounded-md text-xs font-bold font-heading tracking-wide transition border active:scale-95 ${
                isVisualizing
                  ? 'bg-[#06B6D4]/25 text-[#06B6D4] border-[#06B6D4] shadow-sm'
                  : 'bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 text-[#06B6D4] border-[#06B6D4]/40 hover:border-[#06B6D4]'
              }`}
              title="Execute Program and Record Execution Trace"
            >
              <Activity className={`w-3.5 h-3.5 ${isVisualizing ? 'animate-spin' : ''}`} />
              <span>{isVisualizing ? 'Tracing...' : 'Visualize'}</span>
            </button>
          )}

          {/* Debug Toggle Button */}
          <button
            onClick={onDebug}
            className={`h-8 flex items-center space-x-1.5 px-2.5 rounded-md text-xs font-semibold border transition ${
              isDebugging
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
                : 'bg-[#15161b] hover:bg-[#1c1e24] text-gray-300 border-[#2b2d35]'
            }`}
            title="Toggle Visual Step Debugger"
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Debug</span>
          </button>
        </div>

        {/* Divider between Execution Controls and Workspace Layout */}
        <div className="h-5 w-px bg-[#1f2024] hidden sm:block" />

        {/* GROUP 3: Workspace Layout Switcher (Code | Split View | Visualize) */}
        {onLayoutModeChange && (
          <div className="flex items-center bg-[#131418] p-0.5 rounded-lg border border-[#232530] h-8 text-xs">
            <button
              onClick={() => onLayoutModeChange('code')}
              className={`h-7 px-2.5 rounded-md transition font-medium flex items-center space-x-1.5 ${
                layoutMode === 'code'
                  ? 'bg-[#242631] text-white font-semibold shadow-sm border border-[#3b3e4f]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1b22]'
              }`}
              title="Code Only View"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Code</span>
            </button>
            <button
              onClick={() => onLayoutModeChange('split')}
              className={`h-7 px-2.5 rounded-md transition font-medium flex items-center space-x-1.5 ${
                layoutMode === 'split'
                  ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-semibold shadow-sm border border-[#06B6D4]/40'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1b22]'
              }`}
              title="Split View (Code + Visualization)"
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split View</span>
            </button>
            <button
              onClick={() => onLayoutModeChange('visualize')}
              className={`h-7 px-2.5 rounded-md transition font-medium flex items-center space-x-1.5 ${
                layoutMode === 'visualize'
                  ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-semibold shadow-sm border border-[#06B6D4]/40'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1b22]'
              }`}
              title="Full Visualization Workspace"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Visualizer</span>
            </button>
          </div>
        )}
      </div>

      {/* GROUP 4: Secondary Actions & User Profile (Right) */}
      <div className="flex items-center space-x-1.5 flex-shrink-0">
        {/* Auto-Fix Toggle */}
        <button
          onClick={onToggleAutoFix}
          className={`h-8 flex items-center space-x-1.5 px-2.5 rounded-md text-xs font-semibold border transition ${
            autoFixEnabled
              ? 'bg-[#ff9100]/20 text-[#ff9100] border-[#ff9100]/50'
              : 'bg-[#15161b] hover:bg-[#1c1e24] text-gray-400 border-[#2b2d35]'
          }`}
          title="AI Auto-Fix: Automatically detects and resolves syntax and runtime errors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">Auto-Fix</span>
        </button>

        {/* Share Button */}
        <button
          onClick={onOpenShare}
          className="h-8 w-8 rounded-md flex items-center justify-center transition border border-[#232530] bg-[#15161b] hover:bg-[#1c1e24] text-gray-300 hover:text-white"
          title="Share Project URL"
          aria-label="Share Project"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="h-8 w-8 rounded-md flex items-center justify-center transition border border-[#232530] bg-[#15161b] hover:bg-[#1c1e24] text-gray-300 hover:text-white"
          title="Editor Settings"
          aria-label="Editor Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* User Profile / Sign-in */}
        <div className="pl-1 sm:pl-2 ml-1 border-l border-[#1f2024]">
          {currentUser ? (
            <Link
              href="/classroom"
              onClick={() => {
                requestBrowserFullscreen().catch(() => {});
              }}
              className="h-8 flex items-center space-x-1.5 px-2.5 rounded-md bg-[#15161b] hover:bg-[#1e1f26] text-gray-300 hover:text-white border border-[#232530] transition text-xs font-medium"
              title={`Active Profile: ${currentUser.name} (${currentUser.professionalEmail || currentUser.role})`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="hidden md:inline max-w-[90px] truncate">{currentUser.name}</span>
              <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-[#252830] text-[#ff9100] font-semibold">
                {currentUser.role || 'user'}
              </span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="h-8 flex items-center space-x-1 px-2.5 rounded-md text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#1c1e24] border border-[#232530] bg-[#15161b] transition"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};
