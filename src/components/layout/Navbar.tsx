'use client';

import React from 'react';
import { Play, Bug } from 'lucide-react';
import { LanguageConfig } from '@/config/languages';
import { LanguageSelector } from '@/components/common/LanguageSelector';

export interface NavbarProps {
  currentLanguage: LanguageConfig;
  onLanguageChange: (lang: LanguageConfig) => void;
  onRun: () => void;
  isRunning: boolean;
  onDebug: () => void;
  isDebugging: boolean;
  autoFixEnabled?: boolean;
  onToggleAutoFix?: () => void;
  onOpenSettings?: () => void;
  onOpenShare?: () => void;
  projectName?: string;
  onVisualize?: () => void;
  isVisualizing?: boolean;
  layoutMode?: 'code' | 'visualize' | 'split';
  onLayoutModeChange?: (mode: 'code' | 'visualize' | 'split') => void;
}

export const Navbar: React.FC<NavbarProps> = (props) => {
  const {
    currentLanguage,
    onLanguageChange,
    onRun,
    isRunning,
    onDebug,
    isDebugging,
  } = props;

  return (
    <header className="h-10 border-b bg-[#0b0c0e] border-[#1f2024] text-[#e6edf3] flex items-center px-3 text-xs z-30 select-none shrink-0">
      <div className="flex items-center space-x-1.5">
        <LanguageSelector
          currentLanguage={currentLanguage}
          onSelectLanguage={onLanguageChange}
        />

        {/* Run Button (Ctrl+Enter) */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`h-7 flex items-center space-x-1.5 px-3 rounded-md text-xs font-bold font-heading tracking-wide shadow-sm transition active:scale-95 ${
            isRunning
              ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
          title="Compile & Run Code (Ctrl+Enter)"
        >
          <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : 'fill-current'}`} />
          <span>{isRunning ? 'Running...' : 'Run'}</span>
        </button>

        {/* Debug Button */}
        <button
          onClick={onDebug}
          className={`h-7 flex items-center space-x-1.5 px-2.5 rounded-md text-xs font-semibold border transition ${
            isDebugging
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-sm'
              : 'bg-[#15161b] hover:bg-[#1c1e24] text-gray-300 border-[#2b2d35]'
          }`}
          title="Toggle Visual Step Debugger"
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Debug</span>
        </button>
      </div>
    </header>
  );
};
