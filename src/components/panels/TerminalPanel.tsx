'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Trash2,
  Plus,
  Split,
  ChevronDown,
  X,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { ProjectFile } from '@/lib/execution/types';

export interface TerminalPanelProps {
  files: ProjectFile[];
  activeFileId?: string;
  onSyncFiles?: (files: ProjectFile[]) => void;
  onExecuteCommand?: (cmd: string) => void;
  isDarkMode?: boolean;
  customStdin?: string;
  onChangeCustomStdin?: (stdin: string) => void;
  stdin?: string;
  onStdinChange?: (stdin: string) => void;
}

interface TerminalLine {
  id: string;
  type: 'system' | 'prompt' | 'stdout' | 'stderr' | 'warning' | 'success' | 'info' | 'stdin';
  content: string;
  rawCommand?: string;
  timestamp?: string;
}

interface TerminalTab {
  id: string;
  name: string;
  shell: string;
  lines: TerminalLine[];
}

function codeRequiresStdin(content: string, filename: string): boolean {
  if (!content) return false;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'py') {
    return /input\s*\(|sys\.stdin/.test(content);
  }
  if (ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'c') {
    return /cin\s*>>|scanf\s*\(|getline\s*\(|getchar\s*\(|fgets\s*\(|cin\./.test(content);
  }
  if (ext === 'java') {
    return /System\.in|Scanner\s*\(/.test(content);
  }
  if (ext === 'js' || ext === 'ts' || ext === 'mjs') {
    return /readline|process\.stdin/.test(content);
  }
  if (ext === 'go') {
    return /fmt\.Scan|bufio\.New/.test(content);
  }
  if (ext === 'rs') {
    return /stdin\s*\(|read_line/.test(content);
  }
  if (ext === 'cs') {
    return /Console\.Read/.test(content);
  }
  if (ext === 'rb') {
    return /gets|readline/.test(content);
  }
  if (ext === 'php') {
    return /fgets\s*\(STDIN|readline/.test(content);
  }
  return false;
}

const DEFAULT_WELCOME_LINES: TerminalLine[] = [
  {
    id: 'sys-1',
    type: 'system',
    content: 'Cortex Terminal (bash)',
  },
  {
    id: 'sys-2',
    type: 'stdout',
    content: "Type 'help' for available commands. Stdin input is supported via prompt or pipes (e.g. echo 'text' | run).",
  },
];

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  files,
  activeFileId,
  onSyncFiles,
  onExecuteCommand,
  isDarkMode = true,
  customStdin = '',
  onChangeCustomStdin,
  stdin,
  onStdinChange,
}) => {
  const activeFile = files.find((f) => f.id === activeFileId && !f.isFolder);
  const effectiveStdin = stdin !== undefined ? stdin : customStdin;
  const handleStdinChange = onStdinChange || onChangeCustomStdin;
  const [tabs, setTabs] = useState<TerminalTab[]>([
    {
      id: 'tab-1',
      name: '1: bash',
      shell: 'bash',
      lines: [...DEFAULT_WELCOME_LINES],
    },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [pendingStdinCommand, setPendingStdinCommand] = useState<{
    command: string;
    targetFile: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeTab.lines]);

  const addLinesToActiveTab = (newLines: TerminalLine[]) => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === activeTab.id ? { ...tab, lines: [...tab.lines, ...newLines] } : tab
      )
    );
  };

  const clearActiveTab = () => {
    setTabs((prevTabs) =>
      prevTabs.map((tab) => (tab.id === activeTab.id ? { ...tab, lines: [] } : tab))
    );
  };

  const handleNewTerminal = () => {
    const nextNum = tabs.length + 1;
    const newId = `tab-${Date.now()}`;
    const newTab: TerminalTab = {
      id: newId,
      name: `${nextNum}: bash`,
      shell: 'bash',
      lines: [
        {
          id: `sys-${Date.now()}`,
          type: 'system',
          content: 'Cortex Terminal (bash)',
        },
      ],
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseActiveTerminal = () => {
    if (tabs.length === 1) {
      clearActiveTab();
      return;
    }
    const remaining = tabs.filter((t) => t.id !== activeTab.id);
    setTabs(remaining);
    setActiveTabId(remaining[0].id);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'c' && (e.ctrlKey || e.metaKey)) || e.key === 'Escape') {
      if (pendingStdinCommand) {
        e.preventDefault();
        setPendingStdinCommand(null);
        addLinesToActiveTab([
          { id: `info-${Date.now()}`, type: 'info', content: '^C (Input canceled)' },
        ]);
        setInputVal('');
        return;
      }
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx < history.length) {
        setHistoryIndex(nextIdx);
        setInputVal(history[history.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[history.length - 1 - nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab Autocomplete
      const trimmed = inputVal.trim();
      const commands = [
        'run',
        'python',
        'node',
        'gcc',
        'g++',
        'clear',
      ];
      const match = commands.find((c) => c.startsWith(trimmed) && c !== trimmed);
      if (match) {
        setInputVal(match);
      } else {
        // Match file names
        const fileNames = files.map((f) => f.name);
        const parts = trimmed.split(' ');
        const lastPart = parts[parts.length - 1];
        const matchedFile = fileNames.find((f) => f.startsWith(lastPart) && f !== lastPart);
        if (matchedFile) {
          parts[parts.length - 1] = matchedFile;
          setInputVal(parts.join(' '));
        }
      }
    }
  };

  const executeTerminalCommand = async (
    commandToRun: string,
    stdinToSend: string,
    echoStdin: boolean = true,
    entrypointFile?: string
  ) => {
    try {
      const response = await fetch('/api/v1/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: commandToRun,
          files,
          stdin: stdinToSend,
          entrypoint: entrypointFile,
        }),
      });

      const data = await response.json();
      const newLines: TerminalLine[] = [];

      if (echoStdin && data.stdin && data.stdin.trim()) {
        newLines.push({
          id: `stdin-${Date.now()}`,
          type: 'stdin',
          content: data.stdin.trim(),
        });
      }

      if (data.stdout && data.stdout.trim()) {
        newLines.push({
          id: `out-${Date.now()}`,
          type: 'stdout',
          content: data.stdout.trimEnd(),
        });
      }

      if (data.stderr && data.stderr.trim()) {
        newLines.push({
          id: `err-${Date.now()}`,
          type: 'stderr',
          content: data.stderr.trimEnd(),
        });
      }

      if (!data.stdout && !data.stderr && data.exitCode !== 0) {
        newLines.push({
          id: `err-${Date.now()}`,
          type: 'stderr',
          content: `Process exited with code ${data.exitCode}`,
        });
      }

      if (newLines.length > 0) {
        addLinesToActiveTab(newLines);
      }

      // Synchronize created/deleted/modified files back to IDE
      if (data.files && Array.isArray(data.files) && data.files.length > 0 && onSyncFiles) {
        onSyncFiles(data.files);
      }
    } catch (err: any) {
      addLinesToActiveTab([
        {
          id: `err-${Date.now()}`,
          type: 'stderr',
          content: `Terminal error: ${err.message || 'Command execution failed'}`,
        },
      ]);
    }
  };

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawVal = inputVal;
    setInputVal('');

    // If waiting for stdin for a pending command:
    if (pendingStdinCommand) {
      const activePending = pendingStdinCommand;
      setPendingStdinCommand(null);
      const userStdin = rawVal;

      addLinesToActiveTab([
        {
          id: `stdin-${Date.now()}`,
          type: 'stdin',
          content: userStdin || '(empty input)',
        },
      ]);

      if (handleStdinChange && userStdin) {
        handleStdinChange(userStdin);
      }

      await executeTerminalCommand(
        activePending.command,
        userStdin ? userStdin + '\n' : '',
        false,
        activePending.targetFile
      );
      return;
    }

    const cmd = rawVal.trim();
    if (!cmd) return;

    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);

    const promptLine: TerminalLine = {
      id: `prompt-${Date.now()}`,
      type: 'prompt',
      content: cmd,
      rawCommand: cmd,
    };

    if (cmd === 'clear') {
      clearActiveTab();
      return;
    }

    if (cmd === 'help') {
      addLinesToActiveTab([
        promptLine,
        {
          id: `out-${Date.now()}-1`,
          type: 'info',
          content: 'Cortex Interactive Workspace Terminal (Execution Only):',
        },
        {
          id: `out-${Date.now()}-2`,
          type: 'stdout',
          content: `  run [file]            Compile and execute active program (interactive stdin supported)
  python [file] [args]  Execute Python script (e.g. python main.py)
  node [file] [args]    Execute JavaScript script (e.g. node index.js)
  g++ [files...]        Compile C++ files with G++
  gcc [files...]        Compile C files with GCC
  echo 'data' | run     Pass piped stdin to program execution
  clear                 Clear terminal output
  
  Note: Programs reading user input (cin, input, scanf) will prompt for stdin interactively or accept piped input.`,
        },
      ]);
      return;
    }

    // Immediately display prompt line for instant feedback
    addLinesToActiveTab([promptLine]);

    if (onExecuteCommand) {
      onExecuteCommand(cmd);
    }

    // Check if command is an execution command that might need stdin
    const isExecutionCmd =
      cmd.startsWith('run') ||
      cmd.startsWith('python') ||
      cmd.startsWith('node') ||
      cmd.startsWith('gcc') ||
      cmd.startsWith('g++') ||
      cmd.startsWith('./');

    const hasExplicitInput = cmd.includes('|') || cmd.includes('<') || cmd.includes('-i') || cmd.includes('--stdin');

    let resolvedTargetFile = '';
    if (cmd.startsWith('run')) {
      const arg = cmd.replace(/^run\s*/, '').trim();
      resolvedTargetFile =
        arg ||
        (activeFile ? activeFile.name : '') ||
        files.find((f) => !f.isFolder && (f.name.startsWith('main.') || f.name.startsWith('index.')))?.name ||
        files.find((f) => !f.isFolder)?.name ||
        'main.py';
    } else if (cmd.startsWith('python')) {
      resolvedTargetFile = cmd.replace(/^python\s*/, '').split(' ')[0].trim() || 'main.py';
    } else if (cmd.startsWith('node')) {
      resolvedTargetFile = cmd.replace(/^node\s*/, '').split(' ')[0].trim() || 'index.js';
    } else if (cmd.startsWith('g++') || cmd.startsWith('gcc')) {
      const isCpp = cmd.startsWith('g++');
      resolvedTargetFile = cmd.replace(/^(gcc|g\+\+)\s*/, '').replace(/-o\s+\S+/, '').split(' ')[0].trim() || (isCpp ? 'main.cpp' : 'main.c');
    } else if (cmd.startsWith('./main') || cmd.startsWith('./a.out')) {
      resolvedTargetFile = (activeFile && (activeFile.name.endsWith('.cpp') || activeFile.name.endsWith('.c')))
        ? activeFile.name
        : files.find((f) => !f.isFolder && (f.name.endsWith('.cpp') || f.name.endsWith('.c')))?.name || 'main.cpp';
    }

    if (isExecutionCmd && !hasExplicitInput && resolvedTargetFile) {
      const foundFile = files.find((f) => !f.isFolder && f.name === resolvedTargetFile);
      const expectsStdin = foundFile ? codeRequiresStdin(foundFile.content, foundFile.name) : false;

      if (expectsStdin) {
        addLinesToActiveTab([
          {
            id: `info-${Date.now()}`,
            type: 'info',
            content: `Program (${resolvedTargetFile}) expects user input via stdin. Enter input below and press Enter:`,
          },
        ]);
        setPendingStdinCommand({ command: cmd, targetFile: resolvedTargetFile });
        return;
      }
    }

    // Execute directly
    await executeTerminalCommand(
      cmd,
      effectiveStdin || '',
      true,
      resolvedTargetFile || (activeFile ? activeFile.name : undefined)
    );
  };

  const renderLineContent = (item: TerminalLine) => {
    switch (item.type) {
      case 'prompt':
        return (
          <div className="flex items-start font-mono leading-[22px] text-[13.5px]">
            <span className={isDarkMode ? 'text-[#ff9100] font-semibold' : 'text-[#d97706] font-semibold'}>sandbox</span>
            <span className={isDarkMode ? 'text-[#6b7280]' : 'text-slate-500'}>:~/workspace $ </span>
            <span className={isDarkMode ? 'text-[#ffffff] font-medium' : 'text-slate-900 font-medium'}>{item.content}</span>
          </div>
        );

      case 'system':
        return (
          <div className={`font-mono leading-[22px] text-[13.5px] ${isDarkMode ? 'text-[#ff9100]' : 'text-[#d97706]'}`}>
            {item.content}
          </div>
        );

      case 'info':
        return (
          <div className={`font-mono leading-[22px] text-[13.5px] ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
            {item.content}
          </div>
        );

      case 'stdout':
        return (
          <pre className={`whitespace-pre-wrap font-mono leading-[22px] text-[13.5px] m-0 ${isDarkMode ? 'text-[#cccccc]' : 'text-slate-800'}`}>
            {item.content}
          </pre>
        );

      case 'stderr':
        return (
          <div className={`font-mono leading-[22px] text-[13.5px] whitespace-pre-wrap ${isDarkMode ? 'text-[#f14c4c]' : 'text-rose-600'}`}>
            {item.content}
          </div>
        );

      case 'warning':
        return (
          <div className={`font-mono leading-[22px] text-[13.5px] whitespace-pre-wrap ${isDarkMode ? 'text-[#cca700]' : 'text-amber-600'}`}>
            {item.content}
          </div>
        );

      case 'success':
        return (
          <div className={`font-mono leading-[22px] text-[13.5px] whitespace-pre-wrap ${isDarkMode ? 'text-[#89d185]' : 'text-emerald-600'}`}>
            {item.content}
          </div>
        );

      case 'stdin':
        return (
          <div className="flex items-start font-mono leading-[22px] text-[13.5px]">
            <span className={isDarkMode ? 'text-amber-400 font-semibold' : 'text-amber-600 font-semibold'}>&gt; [stdin]: </span>
            <span className={isDarkMode ? 'text-amber-200 font-medium' : 'text-amber-900 font-medium'}>{item.content}</span>
          </div>
        );

      default:
        return (
          <div className={`font-mono leading-[22px] text-[13.5px] ${isDarkMode ? 'text-[#cccccc]' : 'text-slate-800'}`}>
            {item.content}
          </div>
        );
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`h-full flex flex-col font-['Consolas','Courier_New',monospace] text-[13px] select-text overflow-hidden cursor-text transition-colors duration-200 ${
        isDarkMode ? 'bg-[#141518] text-[#cccccc]' : 'bg-white text-slate-800'
      }`}
    >
      {/* VS Code Integrated Terminal Tab & Action Header Bar */}
      <div className={`h-8 border-b flex items-center justify-between px-2 select-none transition-colors duration-200 ${
        isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-slate-100 border-slate-200'
      }`}>
        {/* Left: Terminal Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto h-full">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTabId(tab.id);
                }}
                className={`h-full flex items-center space-x-1.5 px-2.5 text-xs transition border-b-2 font-heading font-semibold tracking-wide ${
                  isActive
                    ? isDarkMode
                      ? 'bg-[#141518] text-white border-[#ff9100]'
                      : 'bg-white text-slate-900 border-[#ff9100] shadow-sm'
                    : isDarkMode
                      ? 'text-gray-500 hover:text-gray-300 hover:bg-[#1c1e24] border-transparent'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200 border-transparent'
                }`}
              >
                <TerminalIcon className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#4ec9b0]' : 'text-[#0d9488]'}`} />
                <span>{tab.name}</span>
              </button>
            );
          })}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNewTerminal();
            }}
            title="New Terminal (bash)"
            className={`p-1 rounded transition ${
              isDarkMode ? 'text-[#969696] hover:text-white hover:bg-[#2a2d2e]' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: VS Code Terminal Toolbar Actions */}
        <div className={`flex items-center space-x-1 ${isDarkMode ? 'text-[#969696]' : 'text-slate-500'}`}>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNewTerminal();
            }}
            title="Split Terminal"
            className={`p-1 rounded transition ${isDarkMode ? 'hover:text-white hover:bg-[#2a2d2e]' : 'hover:text-slate-900 hover:bg-slate-200'}`}
          >
            <Split className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              clearActiveTab();
            }}
            title="Clear Terminal Buffer"
            className={`p-1 rounded transition ${isDarkMode ? 'hover:text-white hover:bg-[#2a2d2e]' : 'hover:text-slate-900 hover:bg-slate-200'}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCloseActiveTerminal();
            }}
            title="Kill Terminal Session"
            className={`p-1 rounded transition ${isDarkMode ? 'hover:text-[#f14c4c] hover:bg-[#2a2d2e]' : 'hover:text-rose-600 hover:bg-rose-100'}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal History Output Stream */}
      <div className={`flex-1 overflow-y-auto px-3 py-2 space-y-1 ${
        isDarkMode ? 'scrollbar-thin scrollbar-thumb-[#2d2f37] scrollbar-track-transparent' : 'scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent'
      }`}>
        {activeTab.lines.map((item) => (
          <div key={item.id}>{renderLineContent(item)}</div>
        ))}

        {/* Active Command Prompt Line */}
        <form onSubmit={handleCommand} className="flex items-center pt-0.5 leading-[20px]">
          {pendingStdinCommand ? (
            <>
              <span className={isDarkMode ? 'text-amber-400 font-semibold' : 'text-amber-600 font-semibold'}>stdin</span>
              <span className={isDarkMode ? 'text-[#6b7280]' : 'text-slate-500'}> (input) &gt; </span>
            </>
          ) : (
            <>
              <span className={isDarkMode ? 'text-[#ff9100] font-semibold' : 'text-[#d97706] font-semibold'}>sandbox</span>
              <span className={isDarkMode ? 'text-[#6b7280]' : 'text-slate-500'}>:~/workspace $ </span>
            </>
          )}
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingStdinCommand ? 'Type input and press Enter (or Esc to cancel)...' : undefined}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className={`flex-1 bg-transparent font-['Consolas','Courier_New',monospace] text-[13px] outline-none border-none p-0 m-0 leading-[20px] ${
              isDarkMode ? 'text-[#ffffff]' : 'text-slate-900'
            }`}
          />
          {/* Authentic VS Code block cursor */}
          <span className="w-2 h-4 bg-[#ff9100] inline-block animate-pulse -ml-1 pointer-events-none opacity-80" />
        </form>

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
