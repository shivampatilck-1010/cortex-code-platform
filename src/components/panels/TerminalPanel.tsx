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

interface TerminalPanelProps {
  files: ProjectFile[];
  onSyncFiles?: (files: ProjectFile[]) => void;
  onExecuteCommand?: (cmd: string) => void;
}

interface TerminalLine {
  id: string;
  type: 'system' | 'prompt' | 'stdout' | 'stderr' | 'warning' | 'success' | 'info';
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

const DEFAULT_WELCOME_LINES: TerminalLine[] = [
  {
    id: 'sys-1',
    type: 'system',
    content: 'Cortex Terminal (bash)',
  },
  {
    id: 'sys-2',
    type: 'stdout',
    content: "Type 'help' for available commands.",
  },
];

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ files, onSyncFiles, onExecuteCommand }) => {
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
        'help',
        'ls',
        'cat',
        'pwd',
        'clear',
        'npm install',
        'pip install',
        'cargo add',
        'git status',
        'git log',
        'whoami',
        'uname -a',
        'date',
        'echo',
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

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setInputVal('');

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
          content: 'Cortex Interactive Workspace Terminal:',
        },
        {
          id: `out-${Date.now()}-2`,
          type: 'stdout',
          content: `  run [file]            Compile and execute active program
  python [file] [args]  Execute Python script (e.g. python main.py)
  node [file] [args]    Execute JavaScript script (e.g. node index.js)
  g++ [files...]        Compile C++ files with G++
  gcc [files...]        Compile C files with GCC
  ls [-la]              List workspace files and folders
  cat <file>            Display file contents
  touch <file>          Create a new file in workspace
  mkdir <dir>           Create a new folder in workspace
  rm [-r] <file/dir>    Delete file or folder from workspace
  pwd                   Print current working directory (/home/sandbox/workspace)
  whoami                Print current sandbox user
  date                  Print current date and time
  echo <text>           Print text or write to file
  clear                 Clear terminal output`,
        },
      ]);
      return;
    }

    // Immediately display prompt line for instant feedback
    addLinesToActiveTab([promptLine]);

    if (onExecuteCommand) {
      onExecuteCommand(cmd);
    }

    try {
      const response = await fetch('/api/v1/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmd,
          files,
        }),
      });

      const data = await response.json();
      const newLines: TerminalLine[] = [];

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

  const renderLineContent = (item: TerminalLine) => {
    switch (item.type) {
      case 'prompt':
        return (
          <div className="flex items-start font-mono leading-[22px] text-[13.5px]">
            <span className="text-[#ff9100] font-semibold">sandbox</span>
            <span className="text-[#6b7280]">:~/workspace $ </span>
            <span className="text-[#ffffff] font-medium">{item.content}</span>
          </div>
        );

      case 'system':
        return (
          <div className="text-[#ff9100] font-mono leading-[22px] text-[13.5px]">
            {item.content}
          </div>
        );

      case 'info':
        return (
          <div className="text-gray-300 font-mono leading-[22px] text-[13.5px]">
            {item.content}
          </div>
        );

      case 'stdout':
        return (
          <pre className="text-[#cccccc] whitespace-pre-wrap font-mono leading-[22px] text-[13.5px] m-0">
            {item.content}
          </pre>
        );

      case 'stderr':
        return (
          <div className="text-[#f14c4c] font-mono leading-[22px] text-[13.5px] whitespace-pre-wrap">
            {item.content}
          </div>
        );

      case 'warning':
        return (
          <div className="text-[#cca700] font-mono leading-[22px] text-[13.5px] whitespace-pre-wrap">
            {item.content}
          </div>
        );

      case 'success':
        return (
          <div className="text-[#89d185] font-mono leading-[22px] text-[13.5px] whitespace-pre-wrap">
            {item.content}
          </div>
        );

      default:
        return (
          <div className="text-[#cccccc] font-mono leading-[22px] text-[13.5px]">
            {item.content}
          </div>
        );
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="h-full flex flex-col bg-[#141518] text-[#cccccc] font-['Consolas','Courier_New',monospace] text-[13px] select-text overflow-hidden cursor-text"
    >
      {/* VS Code Integrated Terminal Tab & Action Header Bar */}
      <div className="h-8 bg-[#101114] border-b border-[#1f2024] flex items-center justify-between px-2 select-none">
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
                    ? 'bg-[#141518] text-white border-[#ff9100]'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1c1e24] border-transparent'
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5 text-[#4ec9b0]" />
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
            className="p-1 text-[#969696] hover:text-white hover:bg-[#2a2d2e] rounded transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: VS Code Terminal Toolbar Actions */}
        <div className="flex items-center space-x-1 text-[#969696]">

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNewTerminal();
            }}
            title="Split Terminal"
            className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition"
          >
            <Split className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              clearActiveTab();
            }}
            title="Clear Terminal Buffer"
            className="p-1 hover:text-white hover:bg-[#2a2d2e] rounded transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCloseActiveTerminal();
            }}
            title="Kill Terminal Session"
            className="p-1 hover:text-[#f14c4c] hover:bg-[#2a2d2e] rounded transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal History Output Stream */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-[#2d2f37] scrollbar-track-transparent">
        {activeTab.lines.map((item) => (
          <div key={item.id}>{renderLineContent(item)}</div>
        ))}

        {/* Active Command Prompt Line */}
        <form onSubmit={handleCommand} className="flex items-center pt-0.5 leading-[20px]">
          <span className="text-[#ff9100] font-semibold">sandbox</span>
          <span className="text-[#6b7280]">:~/workspace $ </span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent text-[#ffffff] font-['Consolas','Courier_New',monospace] text-[13px] outline-none border-none p-0 m-0 leading-[20px]"
          />
          {/* Authentic VS Code block cursor */}
          <span className="w-2 h-4 bg-[#ff9100] inline-block animate-pulse -ml-1 pointer-events-none opacity-80" />
        </form>

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
