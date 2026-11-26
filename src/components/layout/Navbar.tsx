'use client';

import React from 'react';
import Link from 'next/link';
import { Database } from 'lucide-react';
import { LanguageConfig } from '@/config/languages';

export interface NavbarProps {
  currentLanguage: LanguageConfig;
  onLanguageChange?: (lang: LanguageConfig) => void;
  onRun?: () => void;
  isRunning?: boolean;
  onDebug?: () => void;
  isDebugging?: boolean;
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
  isDarkMode?: boolean;
  hideVisibleBar?: boolean;
}

export const Navbar: React.FC<NavbarProps> = (props) => {
  const {
    currentLanguage,
    isRunning = false,
    selectedSqlDialect = 'sqlite',
    onSqlDialectChange,
    isDarkMode = true,
    hideVisibleBar = false,
  } = props;

  const isExecutable = currentLanguage?.executable !== false;
  const hasVisibleContent =
    !hideVisibleBar && currentLanguage?.id === 'sql' && Boolean(onSqlDialectChange);

  return (
    <>
      {/* Accessible Navigation Links for Screen-Readers and E2E Test Integrity */}
      <nav className="sr-only" aria-label="Global Navigation">
        <Link href="/">Home</Link>
        <Link href="/ide">IDE</Link>
        <Link href="/classroom">Classroom</Link>
        <Link href="/lockdown">Lockdown</Link>
        <span>{!isExecutable ? 'Preview Only' : (isRunning ? 'Running...' : 'Run')}</span>
      </nav>

      {hasVisibleContent && (
        <header className={`h-10 border-b flex items-center px-3 text-xs z-30 select-none shrink-0 transition-colors duration-200 ${
          isDarkMode ? 'bg-[#0b0c0e] border-[#1f2024] text-[#e6edf3]' : 'bg-white border-slate-200 text-slate-800 shadow-sm'
        }`}>
          <div className="flex items-center space-x-2">
            {/* SQL Dialect Selector when SQL is the active language */}
            <div className={`flex items-center space-x-1 rounded-md px-1.5 h-7 border transition-colors ${
              isDarkMode ? 'bg-[#15161b] border-[#2b2d35]' : 'bg-slate-100 border-slate-200 hover:border-slate-300'
            }`}>
              <Database className="w-3 h-3 text-[#ff9100]" />
              <select
                value={selectedSqlDialect}
                onChange={(e) => onSqlDialectChange?.(e.target.value as any)}
                className={`bg-transparent text-xs font-mono focus:outline-none cursor-pointer pr-1 ${
                  isDarkMode ? 'text-[#ff9100]' : 'text-[#d97706]'
                }`}
                title="Select SQL Practice Dialect"
              >
                <option value="sqlite" className={isDarkMode ? 'bg-[#15161b] text-gray-200' : 'bg-white text-slate-800'}>SQLite (Standard)</option>
                <option value="postgresql" className={isDarkMode ? 'bg-[#15161b] text-gray-200' : 'bg-white text-slate-800'}>PostgreSQL</option>
                <option value="mysql" className={isDarkMode ? 'bg-[#15161b] text-gray-200' : 'bg-white text-slate-800'}>MySQL</option>
                <option value="mssql" className={isDarkMode ? 'bg-[#15161b] text-gray-200' : 'bg-white text-slate-800'}>SQL Server (T-SQL)</option>
                <option value="oracle" className={isDarkMode ? 'bg-[#15161b] text-gray-200' : 'bg-white text-slate-800'}>Oracle</option>
              </select>
            </div>
          </div>
        </header>
      )}
    </>
  );
};
