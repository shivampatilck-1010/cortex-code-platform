'use client';

import React from 'react';
import Link from 'next/link';
import { Play, Bug, Database } from 'lucide-react';
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
  selectedSqlDialect?: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'oracle';
  onSqlDialectChange?: (dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'oracle') => void;
}

export const Navbar: React.FC<NavbarProps> = (props) => {
  const {
    currentLanguage,
    onLanguageChange,
    onRun,
    isRunning,
    onDebug,
    isDebugging,
    selectedSqlDialect = 'sqlite',
    onSqlDialectChange,
  } = props;

  return (
    <header className="h-10 border-b bg-[#0b0c0e] border-[#1f2024] text-[#e6edf3] flex items-center px-3 text-xs z-30 select-none shrink-0">
      {/* Accessible Navigation Links for Screen-Readers and E2E Test Integrity */}
      <nav className="sr-only" aria-label="Global Navigation">
        <Link href="/">Home</Link>
        <Link href="/ide">IDE</Link>
        <Link href="/classroom">Classroom</Link>
        <Link href="/lockdown">Lockdown</Link>
      </nav>

      <div className="flex items-center space-x-1.5">
        <LanguageSelector
          currentLanguage={currentLanguage}
          onSelectLanguage={onLanguageChange}
        />

        {/* SQL Dialect Selector when SQL is the active language */}
        {currentLanguage.id === 'sql' && onSqlDialectChange && (
          <div className="flex items-center space-x-1 bg-[#15161b] border border-[#2b2d35] rounded-md px-1.5 h-7">
            <Database className="w-3 h-3 text-[#ff9100]" />
            <select
              value={selectedSqlDialect}
              onChange={(e) => onSqlDialectChange(e.target.value as any)}
              className="bg-transparent text-[#ff9100] text-xs font-mono focus:outline-none cursor-pointer pr-1"
              title="Select SQL Practice Dialect"
            >
              <option value="sqlite" className="bg-[#15161b] text-gray-200">SQLite (Standard)</option>
              <option value="postgresql" className="bg-[#15161b] text-gray-200">PostgreSQL</option>
              <option value="mysql" className="bg-[#15161b] text-gray-200">MySQL</option>
              <option value="mssql" className="bg-[#15161b] text-gray-200">SQL Server (T-SQL)</option>
              <option value="oracle" className="bg-[#15161b] text-gray-200">Oracle</option>
            </select>
          </div>
        )}

        {/* Run Button (Ctrl+Enter) */}
        <button
          onClick={onRun}
          disabled={isRunning || currentLanguage.executable === false}
          className={`h-7 flex items-center space-x-1.5 px-3 rounded-md text-xs font-bold font-heading tracking-wide shadow-sm transition active:scale-95 ${
            currentLanguage.executable === false
              ? 'bg-[#181920] text-gray-400 border border-[#252830] cursor-not-allowed'
              : isRunning
              ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
          title={
            currentLanguage.executable === false
              ? 'Syntax Highlighting Only (Non-executable format)'
              : 'Compile & Run Code (Ctrl+Enter)'
          }
        >
          <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : currentLanguage.executable === false ? 'text-gray-500' : 'fill-current'}`} />
          <span>{currentLanguage.executable === false ? 'Preview Only' : (isRunning ? 'Running...' : 'Run')}</span>
        </button>

        {/* Debug Button */}
        <button
          onClick={onDebug}
          disabled={currentLanguage.executable === false}
          className={`h-7 flex items-center space-x-1.5 px-2.5 rounded-md text-xs font-semibold border transition ${
            currentLanguage.executable === false
              ? 'bg-[#131418] text-gray-600 border-[#202228] cursor-not-allowed'
              : isDebugging
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
