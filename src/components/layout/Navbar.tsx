'use client';

import React from 'react';
import { 
  Play, 
  Bug, 
  Sparkles, 
  Share2, 
  Settings, 
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { SUPPORTED_LANGUAGES, LanguageConfig } from '@/config/languages';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { LanguageSelector } from '@/components/common/LanguageSelector';

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
}) => {
  return (
    <header className="h-12 border-b bg-[#0b0c0e] border-[#1f2024] text-[#e6edf3] flex items-center justify-between px-3.5 text-sm z-30 select-none">
      {/* Left: C1 Logo & Cortex Global Navigation */}
      <div className="flex items-center space-x-3">
        <Link href="/" className="flex items-center group transition" title="Cortex — Code Beyond Limits">
          <CortexLogo variant="header" size="sm" />
        </Link>

        {/* Global Hub Navigation */}
        <nav className="hidden lg:flex items-center space-x-1 pl-3 border-l border-[#1f2024]">
          <Link
            href="/"
            className="px-2.5 py-1 rounded text-xs font-heading font-semibold text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c] transition"
          >
            IDE
          </Link>
          <Link
            href="/compare"
            className="px-2.5 py-1 rounded text-xs font-heading font-semibold text-gray-300 hover:text-[#ff9100] hover:bg-[#16171c] transition"
          >
            Benchmark
          </Link>
        </nav>
      </div>

      {/* Middle: Simplified Controls (Language, Run, Debug, Auto-Fix) */}
      <div className="flex items-center space-x-2">
        {/* Language selector dropdown with official SVG symbols */}
        <LanguageSelector
          currentLanguage={currentLanguage}
          onSelectLanguage={onLanguageChange}
        />

        {/* Simplified Run Button */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-xs font-heading font-bold tracking-wide shadow-sm transition active:scale-95 ${
            isRunning
              ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
          title="Compile & Run Code (Ctrl+Enter)"
        >
          <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </button>

        {/* Simplified Debug Button */}
        <button
          onClick={onDebug}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-heading font-semibold border transition ${
            isDebugging
              ? 'bg-amber-500/20 text-amber-500 border-amber-500/50'
              : 'bg-[#15161b] hover:bg-[#1c1e24] text-gray-300 border-[#2b2d35]'
          }`}
          title="Toggle Visual Step-Debugger"
        >
          <Bug className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Debug</span>
        </button>

        {/* Simplified Auto-Fix Toggle */}
        <button
          onClick={onToggleAutoFix}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-heading font-semibold border transition ${
            autoFixEnabled
              ? 'bg-[#ff9100]/20 text-[#ff9100] border-[#ff9100]/50'
              : 'bg-[#15161b] hover:bg-[#1c1e24] text-gray-400 border-[#2b2d35]'
          }`}
          title="AI Auto-Fix: Automatically detects and resolves errors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Auto-Fix</span>
        </button>
      </div>

      {/* Right: Share, Settings (Dark mode toggle is on code editor only) */}
      <div className="flex items-center space-x-1">
        {/* Share Button */}
        <button
          onClick={onOpenShare}
          className="p-1.5 rounded-md transition text-gray-300 hover:text-white hover:bg-[#1c1e24]"
          title="Share Project URL"
          aria-label="Share Project"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md transition text-gray-300 hover:text-white hover:bg-[#1c1e24]"
          title="Editor Settings"
          aria-label="Editor Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
