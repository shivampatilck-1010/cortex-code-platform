'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  Bug,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Columns2,
  Command,
  Copy,
  Database,
  FileCode2,
  GitBranch,
  Globe,
  Maximize2,
  MessageSquare,
  Minimize2,
  Moon,
  PanelBottom,
  Play,
  Plus,
  Search,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { LanguageConfig } from '@/config/languages';
import { LanguageIcon } from '@/components/common/LanguageIcon';
import { detectLanguageFromFilename } from '@/lib/editor/language-detector';
import { ExecutionResult, ProjectFile } from '@/lib/execution/types';
import { BottomPanelTab, EditorLayoutMode } from '@/types/ide';
import { SidebarTab } from '@/hooks/useIdeLayout';

export interface CommandPaletteItem {
  id: string;
  label: string;
  category: 'File' | 'Command' | 'Navigation' | 'Practice';
  shortcut?: string;
  keywords?: string;
  action: () => void;
}

export interface CortexIdeShellProps {
  workspaceName?: string;
  isDarkMode: boolean;
  onToggleDarkMode: (coords?: { x: number; y: number }) => void;
  currentLanguage: LanguageConfig;
  isExecutable?: boolean;
  selectedSqlDialect?: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'oracle';
  onSqlDialectChange?: (dialect: 'sqlite' | 'postgresql' | 'mysql' | 'mssql' | 'oracle') => void;
  openTabs: ProjectFile[];
  activeTab: ProjectFile | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewFile: () => void;
  aiCompleteEnabled: boolean;
  onToggleAiComplete: () => void;
  isRunning: boolean;
  onRun: () => void;
  onRunWithStdin: () => void;
  onRunTests: () => void;
  onDebug: () => void;
  onFormatCode?: () => void;
  editorLayoutMode: EditorLayoutMode;
  onChangeEditorLayoutMode: (mode: EditorLayoutMode) => void;
  onClearOutput?: () => void;
  executionResult: ExecutionResult | null;
  saveStatus: 'saved' | 'saving' | 'error' | 'conflict';
  cursorPos: { line: number; col: number };
  tabSize?: number;
  hasActiveError?: boolean;
  onOpenFeedback: () => void;
  activeSidebarTab: SidebarTab;
  isSidebarOpen: boolean;
  sidebarWidth: number;
  onResizeSidebar: (width: number) => void;
  onToggleSidebarOpen: () => void;
  activeBottomTab: BottomPanelTab;
  onChangeBottomTab: (tab: BottomPanelTab) => void;
  isBottomOpen: boolean;
  onToggleBottomOpen: (open?: boolean) => void;
  bottomHeight: number;
  onResizeBottom: (height: number) => void;
  sidebarRef?: React.RefObject<HTMLDivElement | null>;
  commandPaletteItems: CommandPaletteItem[];
  renderRail: () => React.ReactNode;
  renderLeftPanel: (panel: Exclude<SidebarTab, 'practice'>) => React.ReactNode;
  renderEditor: () => React.ReactNode;
  renderOutput: () => React.ReactNode;
  renderTerminal: () => React.ReactNode;
  renderTests: () => React.ReactNode;
  renderAssistant: () => React.ReactNode;
  renderDebugger: () => React.ReactNode;
  renderPreview: () => React.ReactNode;
}

/**
 * Extracts the nearest enclosing function, class, or SQL statement near cursor line
 * for the lightweight editor symbol breadcrumb strip.
 */
function detectActiveSymbol(content: string | undefined, cursorLine: number): string | null {
  if (!content) return null;
  const lines = content.split('\n');
  const limit = Math.min(lines.length, Math.max(1, cursorLine));

  const patterns = [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/,
    /^\s*(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)/,
    /^\s*(?:export\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/,
    /^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)/,
    /^\s*func\s+(?:\([^)]+\)\s*)?([A-Za-z_][A-Za-z0-9_]*)/,
    /^\s*(?:int|void|double|float|bool|string|std::\w+)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
  ];

  for (let i = limit - 1; i >= 0; i--) {
    const line = lines[i];
    for (const pat of patterns) {
      const m = line.match(pat);
      if (m?.[1]) {
        return `${m[1]}()`;
      }
    }
  }
  return null;
}

/**
 * Flagship monochrome Cortex IDE Shell:
 * 40px top titlebar with Cmd+K palette & graphite split Run, 44px activity rail,
 * single mutually exclusive animated sidebar, flat file tabs + symbol breadcrumb,
 * zero-overflow resizable bottom workbench, and 24px bottom status bar.
 */
export const CortexIdeShell: React.FC<CortexIdeShellProps> = ({
  workspaceName = 'cortex-workspace',
  isDarkMode,
  onToggleDarkMode,
  currentLanguage,
  isExecutable = true,
  selectedSqlDialect = 'sqlite',
  onSqlDialectChange,
  openTabs,
  activeTab,
  onSelectTab,
  onCloseTab,
  onNewFile,
  aiCompleteEnabled,
  onToggleAiComplete,
  isRunning,
  onRun,
  onRunWithStdin,
  onRunTests,
  onDebug,
  onFormatCode,
  editorLayoutMode,
  onChangeEditorLayoutMode,
  onClearOutput,
  executionResult,
  saveStatus,
  cursorPos,
  tabSize = 4,
  hasActiveError = false,
  onOpenFeedback,
  activeSidebarTab,
  isSidebarOpen,
  sidebarWidth,
  onResizeSidebar,
  onToggleSidebarOpen,
  activeBottomTab,
  onChangeBottomTab,
  isBottomOpen,
  onToggleBottomOpen,
  bottomHeight,
  onResizeBottom,
  sidebarRef,
  commandPaletteItems,
  renderRail,
  renderLeftPanel,
  renderEditor,
  renderOutput,
  renderTerminal,
  renderTests,
  renderAssistant,
  renderDebugger,
  renderPreview,
}) => {
  const [bottomMaximized, setBottomMaximized] = useState(false);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdSelectedIdx, setCmdSelectedIdx] = useState(0);
  const [copiedFile, setCopiedFile] = useState(false);
  const [dragging, setDragging] = useState<'sidebar' | 'workbench' | null>(null);

  const cmdInputRef = useRef<HTMLInputElement>(null);
  const runMenuRef = useRef<HTMLDivElement>(null);

  const exclusivePanel: Exclude<SidebarTab, 'practice'> | null =
    isSidebarOpen && activeSidebarTab !== 'practice' ? activeSidebarTab : null;

  // Global IDE keyboard shortcuts: Cmd/Ctrl+K, Cmd/Ctrl+B, Cmd/Ctrl+J, Esc
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        onToggleSidebarOpen();
      } else if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setBottomMaximized(false);
        onToggleBottomOpen();
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setRunMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleSidebarOpen, onToggleBottomOpen]);

  // Close Run menu on outside click
  useEffect(() => {
    if (!runMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (runMenuRef.current && !runMenuRef.current.contains(e.target as Node)) {
        setRunMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [runMenuOpen]);

  // Reset Command Palette input on open
  useEffect(() => {
    if (cmdOpen) {
      setCmdQuery('');
      setCmdSelectedIdx(0);
      setTimeout(() => cmdInputRef.current?.focus(), 10);
    }
  }, [cmdOpen]);

  // Smooth drag-resize for sidebar & bottom workbench
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (dragging === 'sidebar') {
        onResizeSidebar(Math.min(440, Math.max(200, e.clientX - 44)));
      } else if (dragging === 'workbench') {
        const nextH = window.innerHeight - e.clientY - 24;
        onResizeBottom(Math.min(Math.floor(window.innerHeight * 0.72), Math.max(120, nextH)));
      }
    };
    const onUp = () => {
      setDragging(null);
      if (typeof window !== 'undefined') {
        setTimeout(() => window.dispatchEvent(new Event('resize')), 16);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onResizeSidebar, onResizeBottom]);

  const filteredCommands = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return commandPaletteItems;
    return commandPaletteItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.keywords && item.keywords.toLowerCase().includes(q))
    );
  }, [commandPaletteItems, cmdQuery]);

  useEffect(() => {
    setCmdSelectedIdx(0);
  }, [cmdQuery]);

  const activeSymbol = useMemo(
    () => detectActiveSymbol(activeTab?.content, cursorPos.line),
    [activeTab?.content, cursorPos.line]
  );

  const breadcrumbSegments = useMemo(() => {
    const segs: string[] = [workspaceName];
    if (activeTab) {
      const cleaned = activeTab.path.replace(/^\/+/, '');
      if (cleaned) {
        segs.push(...cleaned.split('/').filter(Boolean));
      } else {
        segs.push(activeTab.name);
      }
    }
    if (activeSymbol) {
      segs.push(activeSymbol);
    }
    return segs;
  }, [workspaceName, activeTab, activeSymbol]);

  const workbenchTabs: { id: BottomPanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'output', label: 'Output', icon: FileCode2 },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
    { id: 'tests', label: 'Tests', icon: CheckSquare },
    { id: 'ai', label: 'Assistant', icon: Sparkles },
    { id: 'debug', label: 'Debugger', icon: Bug },
    { id: 'preview', label: 'Preview', icon: Globe },
  ];

  const handleCopyActiveFile = () => {
    if (!activeTab || typeof navigator === 'undefined' || !navigator.clipboard) return;
    navigator.clipboard.writeText(activeTab.content || '').catch(() => {});
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 1400);
  };

  return (
    <div
      data-testid="cortex-ide-shell"
      className={`${
        isDarkMode ? 'dark bg-[#0A0A0C] text-zinc-100' : 'bg-[#F4F4F6] text-zinc-900'
      } h-screen w-screen overflow-hidden flex antialiased select-none ${
        dragging ? 'select-none' : ''
      }`}
    >
      {/* Full-Height 58px Activity Rail (Emblem + Nav + Settings/Account) */}
      {renderRail()}

      {/* Main IDE Column (40px Titlebar + Sidebar/Editor/Workbench + 24px Status Bar) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
      {/* 1. Flagship 40px Top Titlebar */}
      <header className="h-10 shrink-0 px-3 flex items-center justify-between gap-3 bg-[#F4F4F6] dark:bg-[#0A0A0C] border-b border-black/[0.08] dark:border-white/[0.07]">
        {/* Left: Workspace Breadcrumb + SQL Dialect */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] min-w-0 truncate">
            <span className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 shrink-0">
              Cortex
            </span>
            <span className="text-zinc-400 dark:text-zinc-600 shrink-0">/</span>
            <span className="text-zinc-500 dark:text-zinc-400 truncate">
              {workspaceName}
            </span>
            {activeTab && (
              <>
                <span className="text-zinc-400 dark:text-zinc-600 hidden sm:inline shrink-0">/</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono text-[11.5px] truncate hidden sm:inline">
                  {activeTab.name}
                </span>
              </>
            )}
          </div>

          {currentLanguage.id === 'sql' && onSqlDialectChange && (
            <div className="hidden md:flex items-center gap-1 rounded px-1.5 h-6 bg-black/[0.04] dark:bg-[#141418] border border-black/[0.07] dark:border-white/[0.08] ml-1 shrink-0">
              <Database className="w-3 h-3 text-amber-500" />
              <select
                value={selectedSqlDialect}
                onChange={(e) => onSqlDialectChange(e.target.value as any)}
                aria-label="SQL Dialect"
                className="bg-transparent text-[11px] font-mono text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="sqlite" className="bg-white dark:bg-[#18181C]">SQLite</option>
                <option value="postgresql" className="bg-white dark:bg-[#18181C]">PostgreSQL</option>
                <option value="mysql" className="bg-white dark:bg-[#18181C]">MySQL</option>
                <option value="mssql" className="bg-white dark:bg-[#18181C]">SQL Server</option>
                <option value="oracle" className="bg-white dark:bg-[#18181C]">Oracle</option>
              </select>
            </div>
          )}
        </div>

        {/* Center: Command Palette Pill Trigger (Cmd/Ctrl+K) */}
        <button
          type="button"
          onClick={() => setCmdOpen(true)}
          data-testid="ide-command-palette-trigger"
          className="hidden sm:flex items-center justify-between w-64 md:w-80 h-7 px-2.5 rounded-md bg-black/[0.04] dark:bg-[#141418] border border-black/[0.07] dark:border-white/[0.08] hover:border-black/[0.14] dark:hover:border-white/[0.14] text-[12px] text-zinc-500 transition-colors"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 opacity-70" />
            <span>Search files &amp; commands...</span>
          </span>
          <kbd className="inline-flex items-center gap-0.5 px-1.5 h-4 rounded text-[10px] font-mono bg-black/[0.05] dark:bg-white/[0.06] text-zinc-500 dark:text-zinc-400">
            <Command className="w-2.5 h-2.5" />K
          </kbd>
        </button>

        {/* Right: AI Complete Dot + Graphite Run Split + Minimal Theme Icon */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleAiComplete}
            data-testid="ide-ai-complete-toggle"
            title={
              aiCompleteEnabled
                ? 'AI Complete: ON (Tab to accept inline suggestions)'
                : 'AI Complete: OFF (Click to enable)'
            }
            className="h-7 px-2.5 rounded-md inline-flex items-center gap-2 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                aiCompleteEnabled
                  ? 'bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.65)]'
                  : 'bg-zinc-400 dark:bg-zinc-600'
              }`}
            />
            <span className="hidden md:inline">AI Complete</span>
          </button>

          {/* Elevated Graphite Split Run Button */}
          <div
            ref={runMenuRef}
            className="relative flex items-center rounded-md bg-zinc-900 dark:bg-[#222227] border border-black/15 dark:border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <button
              type="button"
              onClick={() => {
                onToggleBottomOpen(true);
                onChangeBottomTab('output');
                onRun();
              }}
              disabled={isRunning || !isExecutable || !activeTab}
              data-testid="ide-run-btn"
              title={
                !activeTab
                  ? 'No file open'
                  : !isExecutable
                    ? 'Syntax Highlighting Only (Non-executable format)'
                    : 'Run File (Ctrl + Enter)'
              }
              className="h-7 px-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium text-white dark:text-zinc-100 hover:bg-white/[0.06] rounded-l-md disabled:opacity-50 transition-colors"
            >
              <Play
                className={`w-3 h-3 fill-current text-emerald-400 ${isRunning ? 'animate-spin' : ''}`}
              />
              <span>
                {!activeTab ? 'Run' : !isExecutable ? 'Preview Only' : isRunning ? 'Running' : 'Run'}
              </span>
            </button>

            <div className="h-4 w-px bg-white/10" />

            <button
              type="button"
              onClick={() => setRunMenuOpen((v) => !v)}
              data-testid="ide-run-dropdown-btn"
              aria-label="Execution Options"
              aria-expanded={runMenuOpen}
              className="h-7 px-1.5 inline-flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.06] rounded-r-md transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${runMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {runMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-8 w-44 py-1 rounded-lg bg-white dark:bg-[#18181C] border border-black/[0.09] dark:border-white/[0.1] shadow-2xl z-50 text-[12px]"
              >
                {[
                  {
                    label: 'Run File',
                    shortcut: 'Ctrl+Enter',
                    action: () => {
                      onToggleBottomOpen(true);
                      onChangeBottomTab('output');
                      onRun();
                    },
                  },
                  {
                    label: 'Run with Stdin',
                    shortcut: '',
                    action: () => {
                      onToggleBottomOpen(true);
                      onChangeBottomTab('output');
                      onRunWithStdin();
                    },
                  },
                  {
                    label: 'Run Tests',
                    shortcut: '',
                    action: () => {
                      onToggleBottomOpen(true);
                      onChangeBottomTab('tests');
                      onRunTests();
                    },
                  },
                  {
                    label: 'Debug File',
                    shortcut: '',
                    action: () => {
                      onToggleBottomOpen(true);
                      onChangeBottomTab('debug');
                      onDebug();
                    },
                  },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRunMenuOpen(false);
                      opt.action();
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-zinc-700 dark:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] text-left transition-colors"
                  >
                    <span>{opt.label}</span>
                    {opt.shortcut && (
                      <span className="font-mono text-[10px] text-zinc-500">{opt.shortcut}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Minimal 28px Theme Icon Button */}
          <button
            type="button"
            data-testid="ide-theme-toggle"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onToggleDarkMode({
                x: e.clientX || rect.left + rect.width / 2,
                y: e.clientY || rect.top + rect.height / 2,
              });
            }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="h-7 w-7 rounded-md inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* 2. Main IDE Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Single Mutually Exclusive Animated Left Sidebar */}
        <div
          ref={sidebarRef}
          style={{ width: exclusivePanel ? sidebarWidth : 0 }}
          className={`h-full shrink-0 overflow-hidden bg-[#F8F8FA] dark:bg-[#0F0F12] ${
            dragging === 'sidebar'
              ? ''
              : 'transition-[width,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]'
          } ${
            exclusivePanel
              ? 'opacity-100 border-r border-black/[0.08] dark:border-white/[0.07]'
              : 'opacity-0 border-r-0 pointer-events-none'
          }`}
        >
          {exclusivePanel && (
            <div style={{ width: sidebarWidth }} className="h-full flex flex-col">
              {renderLeftPanel(exclusivePanel)}
            </div>
          )}
        </div>

        {/* 4px Sidebar Resizer */}
        {exclusivePanel && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize left sidebar"
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging('sidebar');
            }}
            onDoubleClick={() => onResizeSidebar(250)}
            title="Drag to resize sidebar (double-click to reset)"
            className="w-1 -ml-0.5 z-20 cursor-col-resize hover:bg-amber-500/40 transition-colors shrink-0"
          />
        )}

        {/* Center Editor + Bottom Workbench Column */}
        <main className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-white dark:bg-[#0C0C0E]">
          {/* Editor Column */}
          {!bottomMaximized && (
            <section className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Flat 34px File Tab Strip */}
              <div
                data-testid="ide-file-tabs"
                className="h-[34px] shrink-0 flex items-center bg-[#F4F4F6] dark:bg-[#0F0F12] border-b border-black/[0.08] dark:border-white/[0.07] overflow-x-auto no-scrollbar"
              >
                {openTabs.map((tab) => {
                  const isActive = tab.id === activeTab?.id;
                  const langId = detectLanguageFromFilename(tab.name);
                  return (
                    <div
                      key={tab.id}
                      onClick={() => onSelectTab(tab.id)}
                      data-testid={`ide-tab-${tab.id}`}
                      className={`group relative h-full px-3 inline-flex items-center gap-2 text-[12px] cursor-pointer border-r border-black/[0.06] dark:border-white/[0.05] shrink-0 transition-colors ${
                        isActive
                          ? 'bg-white dark:bg-[#0C0C0E] text-zinc-950 dark:text-zinc-100 font-medium'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <LanguageIcon languageId={langId || 'plaintext'} className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-mono text-[11.5px]">{tab.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCloseTab(tab.id);
                        }}
                        aria-label={`Close ${tab.name}`}
                        title={`Close ${tab.name}`}
                        className="opacity-50 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {isActive && (
                        <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#F59E0B]" />
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={onNewFile}
                  title="New File"
                  aria-label="New File"
                  data-testid="ide-new-file-tab-btn"
                  className="h-full px-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 26px Symbol Breadcrumb Strip */}
              <div className="h-[26px] shrink-0 px-3 flex items-center justify-between gap-2 bg-white dark:bg-[#0C0C0E] border-b border-black/[0.05] dark:border-white/[0.05] text-[11px] font-mono text-zinc-500">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  {breadcrumbSegments.map((seg, idx) => (
                    <React.Fragment key={`${seg}-${idx}`}>
                      {idx > 0 && <span className="opacity-50">&rsaquo;</span>}
                      <span
                        className={
                          idx === breadcrumbSegments.length - 1
                            ? 'text-zinc-700 dark:text-zinc-300 truncate'
                            : 'truncate'
                        }
                      >
                        {seg}
                      </span>
                    </React.Fragment>
                  ))}
                </div>

                <div className="flex items-center gap-1 shrink-0 font-sans">
                  {onFormatCode && (
                    <button
                      type="button"
                      onClick={onFormatCode}
                      title="Format Document"
                      aria-label="Format Document"
                      className="h-5 px-1.5 rounded inline-flex items-center gap-1 text-[10.5px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <AlignLeft className="w-3 h-3" />
                      <span className="hidden lg:inline">Format</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyActiveFile}
                    disabled={!activeTab}
                    title="Copy File Content"
                    aria-label="Copy File Content"
                    className="h-5 w-5 rounded inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
                  >
                    {copiedFile ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onChangeEditorLayoutMode(
                        editorLayoutMode === 'code' ? 'split' : 'code'
                      )
                    }
                    title={
                      editorLayoutMode === 'code'
                        ? 'Show Execution Visualizer Split'
                        : 'Return to Full Code Editor'
                    }
                    aria-label="Toggle Split Visualizer"
                    className={`h-5 px-1.5 rounded inline-flex items-center gap-1 text-[10.5px] transition-colors ${
                      editorLayoutMode !== 'code'
                        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <Columns2 className="w-3 h-3" />
                    <span className="hidden lg:inline">Visualize</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleBottomOpen()}
                    title="Toggle Workbench (Ctrl + J)"
                    aria-label="Toggle Workbench"
                    className="h-5 w-5 rounded inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <PanelBottom className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Editor Canvas */}
              <div className={`flex-1 min-h-0 relative ${dragging ? 'pointer-events-none' : ''}`}>
                {renderEditor()}
              </div>
            </section>
          )}

          {/* 4px Bottom Workbench Resizer */}
          {isBottomOpen && !bottomMaximized && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize bottom workbench"
              onMouseDown={(e) => {
                e.preventDefault();
                setDragging('workbench');
              }}
              onDoubleClick={() => onResizeBottom(240)}
              title="Drag to resize workbench (double-click to reset)"
              className="h-1 -mt-0.5 z-20 cursor-row-resize hover:bg-amber-500/40 transition-colors shrink-0"
            />
          )}

          {/* Zero-Overflow Resizable Bottom Workbench */}
          {isBottomOpen && (
            <section
              data-testid="ide-bottom-workbench"
              style={{ height: bottomMaximized ? '100%' : bottomHeight }}
              className="shrink-0 flex flex-col bg-[#F8F8FA] dark:bg-[#0F0F12] border-t border-black/[0.08] dark:border-white/[0.07] overflow-hidden"
            >
              {/* Single 34px Underlined Tab Strip */}
              <div className="h-[34px] shrink-0 px-2 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {workbenchTabs.map(({ id, label, icon: Icon }) => {
                    const isActive = activeBottomTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        data-testid={`workbench-tab-${id}`}
                        onClick={() => onChangeBottomTab(id)}
                        className={`relative h-[34px] px-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors shrink-0 ${
                          isActive
                            ? 'text-zinc-950 dark:text-zinc-100'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 opacity-80" />
                        <span>{label}</span>
                        {isActive && (
                          <span className="absolute bottom-0 left-1 right-1 h-[1.5px] bg-[#F59E0B]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {executionResult && (
                    <span className="hidden sm:inline-flex items-center gap-2 text-[11px] font-mono pr-2 border-r border-black/[0.07] dark:border-white/[0.07] text-zinc-500">
                      <span
                        className={
                          executionResult.status === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        Exit {executionResult.exitCode}
                      </span>
                      <span>{executionResult.executionTimeMs}ms</span>
                    </span>
                  )}

                  {activeBottomTab === 'output' && onClearOutput && (
                    <button
                      type="button"
                      onClick={onClearOutput}
                      title="Clear Output"
                      aria-label="Clear Output"
                      className="h-6 w-6 rounded inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setBottomMaximized((v) => !v)}
                    title={bottomMaximized ? 'Restore Workbench' : 'Maximize Workbench'}
                    aria-label={bottomMaximized ? 'Restore Workbench' : 'Maximize Workbench'}
                    className="h-6 w-6 rounded inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                  >
                    {bottomMaximized ? (
                      <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Maximize2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBottomMaximized(false);
                      onToggleBottomOpen(false);
                    }}
                    title="Close Workbench (Ctrl + J)"
                    aria-label="Close Workbench"
                    className="h-6 w-6 rounded inline-flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Workbench Body */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeBottomTab === 'output' && renderOutput()}
                {activeBottomTab === 'terminal' && renderTerminal()}
                {activeBottomTab === 'tests' && renderTests()}
                {activeBottomTab === 'ai' && renderAssistant()}
                {activeBottomTab === 'debug' && renderDebugger()}
                {activeBottomTab === 'preview' && renderPreview()}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* 3. Crisp 24px Bottom IDE Status Bar */}
      <footer
        data-testid="ide-status-bar"
        className="h-6 shrink-0 px-3 flex items-center justify-between text-[11px] font-mono bg-[#F4F4F6] dark:bg-[#0A0A0C] border-t border-black/[0.08] dark:border-white/[0.07] text-zinc-500"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-700 dark:text-zinc-300">
              {saveStatus === 'saving'
                ? 'Cortex Cloud · Saving'
                : 'Cortex Cloud · Ready'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <GitBranch className="w-3 h-3" />
            <span>main</span>
          </span>
          <span className="truncate">
            {currentLanguage.name}
            {currentLanguage.version ? ` ${currentLanguage.version}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!isBottomOpen && (
            <button
              type="button"
              onClick={() => onToggleBottomOpen(true)}
              className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              <ChevronUp className="w-3 h-3" />
              <span>Panel</span>
            </button>
          )}
          <span className="tabular-nums">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="hidden sm:inline">Spaces: {tabSize}</span>
          <span className="hidden sm:inline">UTF-8</span>
          <button
            type="button"
            onClick={onOpenFeedback}
            data-testid="status-bar-feedback-btn"
            className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
            title="Send feedback or report an issue"
          >
            {hasActiveError && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            )}
            <MessageSquare className="w-3 h-3" />
            <span>Feedback</span>
          </button>
        </div>
      </footer>
      </div>

      {/* 4. Frosted Command Palette Modal (Ctrl/Cmd + K) */}
      {cmdOpen && (
        <div
          data-testid="ide-command-palette-modal"
          onClick={() => setCmdOpen(false)}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-start justify-center pt-[14vh] px-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-xl bg-white dark:bg-[#141418] border border-black/[0.1] dark:border-white/[0.12] shadow-2xl overflow-hidden"
          >
            <div className="h-11 px-3.5 flex items-center gap-2.5 border-b border-black/[0.07] dark:border-white/[0.08]">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                ref={cmdInputRef}
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCmdSelectedIdx((idx) =>
                      filteredCommands.length > 0 ? (idx + 1) % filteredCommands.length : 0
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCmdSelectedIdx((idx) =>
                      filteredCommands.length > 0
                        ? (idx - 1 + filteredCommands.length) % filteredCommands.length
                        : 0
                    );
                  } else if (e.key === 'Enter' && filteredCommands[cmdSelectedIdx]) {
                    e.preventDefault();
                    const item = filteredCommands[cmdSelectedIdx];
                    setCmdOpen(false);
                    item.action();
                  }
                }}
                placeholder="Type a file name or command..."
                data-testid="ide-command-palette-input"
                className="flex-1 bg-transparent text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/[0.05] dark:bg-white/[0.07] text-zinc-500">
                ESC
              </kbd>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5">
              {filteredCommands.length > 0 ? (
                filteredCommands.map((item, idx) => {
                  const isHighlighted = idx === cmdSelectedIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setCmdSelectedIdx(idx)}
                      onClick={() => {
                        setCmdOpen(false);
                        item.action();
                      }}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-[12.5px] transition-colors ${
                        isHighlighted
                          ? 'bg-black/[0.06] dark:bg-white/[0.08] text-zinc-950 dark:text-zinc-100'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/[0.04] dark:bg-white/[0.06] text-zinc-500 shrink-0">
                          {item.category}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.shortcut && (
                        <span className="font-mono text-[10.5px] text-zinc-500 shrink-0 ml-2">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="py-8 text-center text-[12px] text-zinc-500">
                  No matching files or commands
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
