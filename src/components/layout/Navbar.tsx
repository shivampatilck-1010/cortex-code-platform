'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Play, Bug, Database, ChevronDown } from 'lucide-react';
import { LanguageConfig } from '@/config/languages';

export interface NavbarProps {
  currentLanguage: LanguageConfig;
  onLanguageChange?: (lang: LanguageConfig) => void;
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
    onRun,
    isRunning,
    onDebug,
    isDebugging,
    selectedSqlDialect = 'sqlite',
    onSqlDialectChange,
  } = props;

  // Split button state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isExecutable = currentLanguage.executable !== false;

  return (
    <header className="h-10 border-b bg-[#0b0c0e] border-[#1f2024] text-[#e6edf3] flex items-center px-3 text-xs z-30 select-none shrink-0">
      {/* Accessible Navigation Links for Screen-Readers and E2E Test Integrity */}
      <nav className="sr-only" aria-label="Global Navigation">
        <Link href="/">Home</Link>
        <Link href="/ide">IDE</Link>
        <Link href="/classroom">Classroom</Link>
        <Link href="/lockdown">Lockdown</Link>
      </nav>

      <div className="flex items-center space-x-2">
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

        {/* Merged Run & Debug Split Button */}
        <div ref={dropdownRef} className="relative inline-flex items-center rounded-md shadow-sm">
          {/* Main Action Button (Executes Run by default) */}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || !isExecutable}
            className={`h-7 flex items-center space-x-1.5 px-3 rounded-l-md text-xs font-bold font-heading tracking-wide transition active:scale-95 ${
              !isExecutable
                ? 'bg-[#181920] text-gray-400 border border-[#252830] cursor-not-allowed'
                : isRunning
                ? 'bg-emerald-800 text-emerald-200 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={
              !isExecutable
                ? 'Syntax Highlighting Only (Non-executable format)'
                : 'Run File (Ctrl+Enter)'
            }
          >
            <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : !isExecutable ? 'text-gray-500' : 'fill-current'}`} />
            <span>{!isExecutable ? 'Preview Only' : (isRunning ? 'Running...' : 'Run')}</span>
          </button>

          {/* Adjacent Downward-Facing Arrow Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isExecutable) {
                setIsDropdownOpen((prev) => !prev);
              }
            }}
            disabled={!isExecutable}
            className={`h-7 px-1.5 rounded-r-md border-l transition flex items-center justify-center ${
              !isExecutable
                ? 'bg-[#181920] text-gray-600 border-[#252830] cursor-not-allowed'
                : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-800/60'
            }`}
            title="Execution Options (Run or Debug)"
            aria-expanded={isDropdownOpen}
            aria-haspopup="menu"
            aria-label="Execution options"
          >
            <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Execution Options Dropdown Popover */}
          {isDropdownOpen && isExecutable && (
            <div
              role="menu"
              aria-label="Execution options"
              className="absolute left-0 top-full mt-1 w-44 rounded-md border border-[#2b2d35] bg-[#14161b] shadow-2xl py-1 z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onRun();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition hover:bg-[#1f2128] text-emerald-400 font-semibold bg-[#181a22]"
              >
                <div className="flex items-center space-x-2">
                  <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                  <span>Run</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">Default</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onDebug();
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition hover:bg-[#1f2128] text-amber-400 font-semibold"
              >
                <div className="flex items-center space-x-2">
                  <Bug className="w-3.5 h-3.5 text-amber-400" />
                  <span>Debug</span>
                </div>
                {isDebugging && (
                  <span className="text-[10px] text-amber-400 font-mono">Active</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
