'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Terminal as TermIcon, 
  CheckSquare, 
  Sparkles, 
  Bug, 
  Globe, 
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Navbar } from '@/components/layout/Navbar';
import { MonacoCodeEditor } from '@/components/editor/MonacoCodeEditor';
import { FileExplorer } from '@/components/sidebar/FileExplorer';
import { OutputPanel } from '@/components/panels/OutputPanel';
import { TerminalPanel } from '@/components/panels/TerminalPanel';
import { TestCasesPanel } from '@/components/panels/TestCasesPanel';
import { AIAssistantPanel } from '@/components/panels/AIAssistantPanel';
import { DebuggerPanel } from '@/components/panels/DebuggerPanel';
import { WebPreviewPanel } from '@/components/panels/WebPreviewPanel';
import { DiffModal } from '@/components/modals/DiffModal';
import { SettingsModal } from '@/components/modals/SettingsModal';
import { ShareModal } from '@/components/modals/ShareModal';
import { FeedbackModal } from '@/components/modals/FeedbackModal';
import { SUPPORTED_LANGUAGES, LanguageConfig, getLanguageConfig } from '@/config/languages';
import { ProjectFile, ExecutionResult, TestCase, BenchmarkMetrics } from '@/lib/execution/types';
import { executeInCloudSandbox, runTestCases, benchmarkExecution } from '@/lib/execution/engine';
import { 
  AISettings, 
  DEFAULT_AI_SETTINGS, 
  AIFixResult, 
  analyzeAndFixErrorOffline, 
  autoFixWithGeminiOrOffline,
  analyzeCode, 
  convertCode,
  AIAnalysisResult 
} from '@/lib/ai/assistant';
import { CollaborationBroker, Collaborator } from '@/lib/collaboration/broker';

const getStarterContentForFile = (filename: string, langConfig: LanguageConfig): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const baseName = filename.split('.')[0] || 'Helper';
  
  switch (ext) {
    case 'java':
      return `public class ${baseName} {\n    public ${baseName}() {\n        \n    }\n}\n`;
    case 'cpp':
    case 'cc':
    case 'cxx':
      return `#include <iostream>\n\n`;
    case 'h':
    case 'hpp':
      return `#pragma once\n\n`;
    case 'c':
      return `#include <stdio.h>\n\n`;
    case 'py':
      return `# Python module\n\n`;
    case 'js':
      return `// JavaScript module\nexport const helper = () => {\n  \n};\n`;
    case 'ts':
      return `// TypeScript module\nexport interface Config {\n  \n}\n`;
    case 'go':
      return `package main\n\n`;
    case 'rs':
      return `// Rust module\npub fn helper() {\n    \n}\n`;
    case 'cs':
      return `using System;\n\npublic class ${baseName} {\n    \n}\n`;
    case 'php':
      return `<?php\n\n`;
    case 'rb':
      return `# Ruby module\n\n`;
    case 'swift':
      return `import Foundation\n\n`;
    case 'kt':
      return `// Kotlin module\nclass ${baseName} {\n}\n`;
    case 'json':
      return `{\n  \n}\n`;
    case 'html':
      return `<!DOCTYPE html>\n<html>\n<head>\n  <title>Preview</title>\n</head>\n<body>\n  \n</body>\n</html>\n`;
    case 'css':
      return `/* Styles */\n\n`;
    case 'sql':
      return `-- SQL Query\n\n`;
    case 'md':
      return `# ${baseName}\n\n`;
    default:
      return '';
  }
};

const getMonacoLangForFile = (filename: string, defaultMonacoLang: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    py: 'python',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hpp: 'cpp',
    h: 'cpp',
    c: 'c',
    java: 'java',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    rs: 'rust',
    go: 'go',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    kt: 'kotlin',
    kts: 'kotlin',
    swift: 'swift',
    r: 'r',
    dart: 'dart',
    sql: 'sql',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    markdown: 'markdown',
    sh: 'shell',
    bash: 'shell',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return (ext && map[ext]) ? map[ext] : defaultMonacoLang;
};

export default function CloudIDEPage() {
  // 1. Language & Files State
  const [currentLang, setCurrentLang] = useState<LanguageConfig>(SUPPORTED_LANGUAGES[0]); // Python default
  const [files, setFiles] = useState<ProjectFile[]>([
    {
      id: 'main',
      name: SUPPORTED_LANGUAGES[0].defaultFileName,
      path: `/${SUPPORTED_LANGUAGES[0].defaultFileName}`,
      content: SUPPORTED_LANGUAGES[0].starterCode,
    },
    {
      id: 'readme',
      name: 'README.md',
      path: '/README.md',
      content: `# Cortex — Code Beyond Limits\n**COMPILE | CREATE | COLLABORATE | DEPLOY**\n\nFast multi-language cloud development & sandbox environment across 16+ runtimes with autonomous AI Auto-Fix.\n\nPress **Ctrl+Enter** to compile & execute code.`,
    },
  ]);
  const [activeFileId, setActiveFileId] = useState('main');

  // 2. Execution & Diagnostics State
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [customStdin, setCustomStdin] = useState('');
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 'tc-sample-1',
      name: 'Sample Output Validation',
      stdin: '',
      expectedStdout: 'Squares: [1, 4, 9, 16, 25]',
      isHidden: false,
    },
  ]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkMetrics | null>(null);

  // 3. Bottom / Side Panels State
  const [activeBottomTab, setActiveBottomTab] = useState<'output' | 'terminal' | 'tests' | 'ai' | 'debug' | 'preview'>('output');
  const [isBottomCollapsed, setIsBottomCollapsed] = useState(false);

  // 4. Debugger State
  const [isDebugging, setIsDebugging] = useState(false);
  const [breakpoints, setBreakpoints] = useState<number[]>([6]);
  const [activeDebugLine, setActiveDebugLine] = useState<number | undefined>(undefined);

  // 5. AI Assistant & Auto-Fix State
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'explain' | 'optimize' | 'refactor' | null>(null);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [fixResult, setFixResult] = useState<AIFixResult | null>(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isQuickFixOpen, setIsQuickFixOpen] = useState(false);
  const [isAnalyzingFix, setIsAnalyzingFix] = useState(false);
  const [previousCodeSnapshot, setPreviousCodeSnapshot] = useState<string | null>(null);
  const [enableInlineSuggestions, setEnableInlineSuggestions] = useState(false);

  // Load saved Gemini API Key and inline suggestions setting from browser storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('cortex_gemini_api_key');
      if (savedKey) {
        setAiSettings((prev) => ({ ...prev, apiKey: savedKey, provider: 'gemini' }));
      }
      const savedSuggestions = localStorage.getItem('cortex_inline_suggestions');
      if (savedSuggestions === 'true') {
        setEnableInlineSuggestions(true);
        setAiSettings((prev) => ({ ...prev, enableInlineSuggestions: true }));
      }
    }
  }, []);

  const handleToggleInlineSuggestions = () => {
    setEnableInlineSuggestions((prev) => {
      const next = !prev;
      setAiSettings((s) => ({ ...s, enableInlineSuggestions: next }));
      if (typeof window !== 'undefined') {
        localStorage.setItem('cortex_inline_suggestions', String(next));
      }
      return next;
    });
  };

  // 6. Settings & Share Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [theme, setTheme] = useState('cortex-dark');

  // 7. Resizable Panels & Fullscreen State
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [dockHeight, setDockHeight] = useState(280);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingDock, setIsResizingDock] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const startResizingSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  };

  const startResizingDock = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingDock(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.min(Math.max(e.clientX, 150), 600);
        setSidebarWidth(newWidth);
      }
      if (isResizingDock) {
        const newHeight = Math.min(Math.max(window.innerHeight - e.clientY, 80), window.innerHeight - 120);
        setDockHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingDock(false);
    };

    if (isResizingSidebar || isResizingDock) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, isResizingDock]);

  // Fullscreen Keyboard Listeners (F11 / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setTheme(next ? 'cortex-dark' : 'cortex-light');
      return next;
    });
  };

  // 8. Collaboration Broker
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const collabBrokerRef = useRef<CollaborationBroker | null>(null);

  // Initialize Real-time Collaboration
  useEffect(() => {
    const broker = new CollaborationBroker({ name: 'Local Dev' });
    collabBrokerRef.current = broker;
    const unsub = broker.subscribe((list) => {
      setCollaborators(list);
    });
    return () => {
      unsub();
      broker.destroy();
    };
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId && !f.isFolder) || files.find((f) => !f.isFolder) || files[0];

  // Auto-Save / Content Update
  const handleContentChange = (newContent: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: newContent } : f))
    );
    if (collabBrokerRef.current) {
      collabBrokerRef.current.broadcastFileChange(activeFileId, newContent);
    }
  };

  // Language Change Handler
  const handleLanguageChange = (newLang: LanguageConfig) => {
    setCurrentLang(newLang);
    setFiles((prevFiles) => {
      const mainIdx = prevFiles.findIndex(
        (f) => f.id === 'main' || f.name.startsWith('main.') || f.name.startsWith('index.') || f.name.startsWith('Main.')
      );
      if (mainIdx !== -1) {
        return prevFiles.map((f, idx) =>
          idx === mainIdx
            ? {
                ...f,
                id: 'main',
                name: newLang.defaultFileName,
                path: `/${newLang.defaultFileName}`,
                content: newLang.starterCode,
              }
            : f
        );
      } else {
        return [
          {
            id: 'main',
            name: newLang.defaultFileName,
            path: `/${newLang.defaultFileName}`,
            content: newLang.starterCode,
          },
          ...prevFiles,
        ];
      }
    });
    setActiveFileId('main');
    setExecutionResult(null);
    if (newLang.id === 'html' || newLang.id === 'css') {
      setActiveBottomTab('preview');
      setIsBottomCollapsed(false);
    }
  };

  // AI Auto-Fix Workflow: Instant Dual-Stage Engine (Instant 0ms Open + Non-blocking AI Refinement)
  const processAutoFix = useCallback(
    async (code: string, stderr: string, diagnostics: any[], forceKey?: string) => {
      // Stage 1: Instant Local AST Diagnostic Repair (Opens in 0ms - zero delay)
      const instantFix = analyzeAndFixErrorOffline(code, stderr, currentLang.id, diagnostics);
      setFixResult(instantFix);
      setIsQuickFixOpen(true);
      setIsAnalyzingFix(false);

      // Stage 2: Background AI Refinement (asynchronous, non-blocking)
      const keyToUse =
        forceKey ||
        aiSettings.apiKey ||
        (typeof window !== 'undefined' ? localStorage.getItem('cortex_gemini_api_key') || '' : '');

      if (keyToUse) {
        autoFixWithGeminiOrOffline(code, stderr, currentLang.id, diagnostics, keyToUse)
          .then(({ provider, fix }) => {
            if (provider === 'gemini' && fix && fix.fixedCode) {
              setFixResult(fix);
            }
          })
          .catch(() => {
            // Keep instant fix
          });
      }
    },
    [currentLang.id, aiSettings.apiKey]
  );

  const handleSaveApiKey = (newKey: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cortex_gemini_api_key', newKey);
    }
    setAiSettings((prev) => ({ ...prev, apiKey: newKey, provider: 'gemini' }));
  };

  const handleReanalyzeWithKey = async (newKey: string) => {
    handleSaveApiKey(newKey);
    setIsAnalyzingFix(true);
    try {
      const res = await autoFixWithGeminiOrOffline(
        activeFile.content,
        executionResult?.stderr || '',
        currentLang.id,
        executionResult?.diagnostics || [],
        newKey
      );
      if (res.fix) {
        setFixResult(res.fix);
      }
    } catch {
      // Keep existing fix
    } finally {
      setIsAnalyzingFix(false);
    }
  };

  // Option 1: Insert explanatory comments beside all error lines
  const handleApplyExplanationComment = (comment: string, targetLine: number, commentedCode?: string) => {
    setPreviousCodeSnapshot(activeFile.content);

    // If multi-error commentedCode is available, apply all comments across the entire file
    if (commentedCode && commentedCode.trim().length > 0) {
      handleContentChange(commentedCode);
      setIsQuickFixOpen(false);
      return;
    }

    const lines = activeFile.content.split('\n');
    const lineIdx = Math.max(0, targetLine - 1);

    if (lineIdx < lines.length) {
      const lineText = lines[lineIdx];
      // If line is reasonably short (< 55 chars) and doesn't already have a comment, place beside it
      if (lineText.trim().length > 0 && lineText.length < 55 && !lineText.includes('#') && !lineText.includes('//')) {
        lines[lineIdx] = `${lineText}  ${comment}`;
      } else {
        // Otherwise, place directly above the line with matching indentation
        const indent = lineText.match(/^\s*/)?.[0] || '';
        lines.splice(lineIdx, 0, `${indent}${comment}`);
      }
    } else {
      lines.push(comment);
    }

    const newContent = lines.join('\n');
    handleContentChange(newContent);
    setIsQuickFixOpen(false);
  };

  // Option 2: Live Auto-Fix directly in front of the user & re-verify
  const handleApplyLiveFix = async (fixToApply: AIFixResult) => {
    setIsQuickFixOpen(false);
    await applyFixAndReverify(fixToApply);
  };

  // Code Execution Handler
  const handleRun = async () => {
    if (currentLang.id === 'html' || currentLang.id === 'css') {
      setActiveBottomTab('preview');
      setIsBottomCollapsed(false);
      return;
    }

    setIsRunning(true);
    setActiveBottomTab('output');
    setIsBottomCollapsed(false);

    try {
      const mainFile = files.find(
        (f) => !f.isFolder && (f.name === currentLang.defaultFileName || f.id === 'main')
      ) || activeFile;

      const res = await executeInCloudSandbox({
        language: currentLang.id,
        files: files.filter((f) => !f.isFolder),
        entrypoint: mainFile?.name || activeFile.name,
        stdin: customStdin,
      });

      setExecutionResult(res);
    } finally {
      setIsRunning(false);
    }
  };

  // Apply Fix & Re-Verify
  const applyFixAndReverify = async (fixToApply: AIFixResult) => {
    setPreviousCodeSnapshot(activeFile.content);
    // Step 6: Apply fix
    handleContentChange(fixToApply.fixedCode);

    // Step 7: Recompile & Re-run
    setIsRunning(true);
    try {
      const updatedFiles = files.map((f) =>
        f.id === activeFileId ? { ...f, content: fixToApply.fixedCode } : f
      );
      const retestRes = await executeInCloudSandbox({
        language: currentLang.id,
        files: updatedFiles,
        entrypoint: activeFile.name,
        stdin: customStdin,
      });

      setExecutionResult(retestRes);

      // Step 8 & 9: Verify result
      if (retestRes.status === 'success') {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Undo Fix
  const handleUndoFix = () => {
    if (previousCodeSnapshot) {
      handleContentChange(previousCodeSnapshot);
      setPreviousCodeSnapshot(null);
    }
  };

  // Automated Test Cases Runner
  const handleRunAllTests = async () => {
    setIsRunningTests(true);
    try {
      const { testCases: evaluated, passedCount, totalCount } = await runTestCases(
        {
          language: currentLang.id,
          files: files.filter((f) => !f.isFolder),
          entrypoint: activeFile.name,
        },
        testCases
      );
      setTestCases(evaluated);

      if (passedCount === totalCount && totalCount > 0) {
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      }
    } finally {
      setIsRunningTests(false);
    }
  };

  // Benchmark Runner
  const handleRunBenchmark = async () => {
    const res = await benchmarkExecution({
      language: currentLang.id,
      files: files.filter((f) => !f.isFolder),
      entrypoint: activeFile.name,
    });
    setBenchmarkResult(res);
  };

  // Keyboard Shortcuts Listener (Ctrl+Enter, Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [files, activeFile, currentLang, customStdin]);

  // Visual Debugger Controls
  const handleStartDebug = () => {
    setIsDebugging(true);
    setActiveBottomTab('debug');
    setIsBottomCollapsed(false);
    setActiveDebugLine(breakpoints[0] || 1);
  };

  const handleStopDebug = () => {
    setIsDebugging(false);
    setActiveDebugLine(undefined);
  };

  const handleStepOver = () => {
    setActiveDebugLine((prev) => (prev ? prev + 1 : 1));
  };

  // Real Dynamic Debugger Variable & Callstack Parser
  const parsedDebugInfo = useMemo(() => {
    if (!activeFile?.content) return { variables: {}, callStack: [] };

    const lines = activeFile.content.split('\n');
    const limit = activeDebugLine ? Math.min(activeDebugLine, lines.length) : lines.length;
    const vars: Record<string, any> = {};
    const frames: Array<{ name: string; file: string; line: number }> = [
      { name: 'main (global)', file: activeFile.name, line: activeDebugLine || 1 },
    ];

    for (let i = 0; i < limit; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      // Detect function definitions
      const fnMatch = line.match(/(?:def|function|const|let|var)\s+([a-zA-Z0-9_]+)\s*(?:=\s*(?:async\s*)?\([^)]*\)\s*=>|\()/);
      if (fnMatch && fnMatch[1]) {
        frames.unshift({ name: `${fnMatch[1]}()`, file: activeFile.name, line: i + 1 });
      }

      // Variable assignments (Python, JS, TS, C++, C, etc.)
      const assignMatch = line.match(/^(?:let|const|var|auto|int|float|double|char|string)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;]+);?$/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const rawVal = assignMatch[2].trim();
        if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
          vars[varName] = Number(rawVal);
        } else if (rawVal === 'true' || rawVal === 'false') {
          vars[varName] = rawVal === 'true';
        } else if (rawVal.startsWith('[') || rawVal.startsWith('{') || rawVal.startsWith('"') || rawVal.startsWith("'")) {
          vars[varName] = rawVal;
        } else {
          vars[varName] = rawVal;
        }
      }
    }

    return { variables: vars, callStack: frames };
  }, [activeFile?.content, activeFile?.name, activeDebugLine]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0c0e] text-[#e6edf3] overflow-hidden font-sans select-none">
      {/* 1. Header Navigation (Permanently sleek Cortex dark #0b0c0e without theme toggle) */}
      <Navbar
        currentLanguage={currentLang}
        onLanguageChange={handleLanguageChange}
        onRun={handleRun}
        isRunning={isRunning}
        onDebug={handleStartDebug}
        isDebugging={isDebugging}
        autoFixEnabled={aiSettings.autoFixErrors}
        onToggleAutoFix={() =>
          setAiSettings((s) => ({ ...s, autoFixErrors: !s.autoFixErrors }))
        }
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
      />

      {/* 2. Main Work Area: 3-Pane Layout with Resizable Splitters */}
      <div className="flex-1 flex overflow-hidden bg-[#0b0c0e]">
        {/* Left Sidebar: File Explorer (Resizable width & custom #3d3c3b background) */}
        <FileExplorer
          width={sidebarWidth}
          files={files}
          activeFileId={activeFileId}
          onSelectFile={setActiveFileId}
          currentLanguage={currentLang}
          onOpenFeedback={() => setIsFeedbackOpen(true)}
          hasActiveError={Boolean((executionResult && executionResult.status !== 'success') || executionResult?.stderr?.trim())}
          onCreateFile={(name, isFolder, parentFolderId) => {
            const parent = parentFolderId ? files.find((f) => f.id === parentFolderId) : null;
            const parentPath = parent ? parent.path.replace(/\/$/, '') : '';
            const initialContent = isFolder ? '' : getStarterContentForFile(name, currentLang);
            const newF: ProjectFile = {
              id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name,
              path: parent ? `${parentPath}/${name}` : `/${name}`,
              content: initialContent,
              isFolder,
              parentId: parentFolderId || undefined,
            };
            setFiles((prev) => [...prev, newF]);
            if (!isFolder) setActiveFileId(newF.id);
          }}
          onDeleteFile={(id) => {
            const getDescendantIds = (targetId: string): string[] => {
              const children = files.filter((f) => f.parentId === targetId);
              return [targetId, ...children.flatMap((c) => getDescendantIds(c.id))];
            };
            const idsToDelete = new Set(getDescendantIds(id));
            setFiles((prev) => prev.filter((f) => !idsToDelete.has(f.id)));
            if (idsToDelete.has(activeFileId)) {
              const remaining = files.filter((f) => !idsToDelete.has(f.id) && !f.isFolder);
              setActiveFileId(remaining[0]?.id || 'main');
            }
          }}
          onRenameFile={(id, newName) => {
            setFiles((prev) =>
              prev.map((f) => {
                if (f.id !== id) return f;
                const parent = f.parentId ? prev.find((p) => p.id === f.parentId) : null;
                const parentPath = parent ? parent.path.replace(/\/$/, '') : '';
                return {
                  ...f,
                  name: newName,
                  path: parent ? `${parentPath}/${newName}` : `/${newName}`,
                };
              })
            );
          }}
          onExportProject={() => {
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(files, null, 2));
            const dl = document.createElement('a');
            dl.setAttribute('href', dataStr);
            dl.setAttribute('download', `${currentLang.id}-project.json`);
            dl.click();
          }}
          isDarkMode={true}
        />

        {/* Horizontal Resize Splitter */}
        <div
          onMouseDown={startResizingSidebar}
          className="w-1 hover:w-1.5 bg-[#1f2024] hover:bg-[#ff9100] active:bg-[#ff9100] cursor-col-resize transition-all z-20 select-none flex-shrink-0"
          title="Drag to adjust sidebar size"
        />

        {/* Center & Bottom Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0b0c0e]">
          {/* Center Pane: Monaco Editor (Fullscreen mode & local dark/light theme switch) */}
          <div className="flex-1 overflow-hidden relative">
            <MonacoCodeEditor
              files={files}
              activeFileId={activeFileId}
              onSelectFile={setActiveFileId}
              onCloseFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onNewFile={() => {
                const nonFolders = files.filter((f) => !f.isFolder);
                const fileName = `file_${nonFolders.length + 1}${currentLang.fileExtension}`;
                const newF: ProjectFile = {
                  id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  name: fileName,
                  path: `/${fileName}`,
                  content: getStarterContentForFile(fileName, currentLang),
                };
                setFiles((prev) => [...prev, newF]);
                setActiveFileId(newF.id);
              }}
              onContentChange={handleContentChange}
              language={getMonacoLangForFile(activeFile?.name || '', currentLang.monacoLang)}
              theme={theme}
              fontSize={fontSize}
              breakpoints={breakpoints}
              onToggleBreakpoint={(line) => {
                setBreakpoints((prev) =>
                  prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line]
                );
              }}
              activeLine={activeDebugLine}
              diagnostics={executionResult?.diagnostics}
              onCursorChange={(l, c) => {
                if (collabBrokerRef.current) {
                  collabBrokerRef.current.updateCursor(activeFileId, l, c);
                }
              }}
              isDarkMode={isDarkMode}
              onToggleDarkMode={handleToggleDarkMode}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
              quickFixResult={fixResult}
              isQuickFixOpen={isQuickFixOpen}
              onCloseQuickFix={() => setIsQuickFixOpen(false)}
              onApplyExplanationComment={handleApplyExplanationComment}
              onApplyLiveFix={handleApplyLiveFix}
              aiProvider={aiSettings.provider === 'gemini' || Boolean(aiSettings.apiKey) ? 'gemini' : 'offline'}
              apiKey={aiSettings.apiKey || ''}
              onSaveApiKey={handleSaveApiKey}
              isAnalyzingFix={isAnalyzingFix}
              onReanalyzeWithKey={handleReanalyzeWithKey}
              enableInlineSuggestions={enableInlineSuggestions}
              onToggleInlineSuggestions={handleToggleInlineSuggestions}
            />
          </div>

          {/* Vertical Resize Splitter */}
          {!isBottomCollapsed && (
            <div
              onMouseDown={startResizingDock}
              className="h-1 hover:h-1.5 bg-[#1f2024] hover:bg-[#ff9100] active:bg-[#ff9100] cursor-row-resize transition-all z-20 select-none flex-shrink-0"
              title="Drag to adjust bottom bar size"
            />
          )}

          {/* Bottom Dock: Tabbed Panels with Resizable Height */}
          <div
            style={{ height: isBottomCollapsed ? 36 : dockHeight }}
            className={`border-t border-[#1f2024] bg-[#0b0c0e] flex flex-col ${
              isResizingDock ? '' : 'transition-all duration-150'
            }`}
          >
            {/* Dock Tab Selector Header */}
            <div className="h-9 bg-[#101114] border-b border-[#1f2024] flex items-center justify-between px-2 text-xs select-none">
              <div className="flex items-center space-x-1">
                {[
                  { id: 'output', label: 'Output', icon: TermIcon },
                  { id: 'terminal', label: 'Terminal', icon: TermIcon },
                  { id: 'tests', label: 'Tests', icon: CheckSquare },
                  { id: 'ai', label: 'Assistant', icon: Sparkles },
                  { id: 'debug', label: 'Debugger', icon: Bug },
                  { id: 'preview', label: 'Preview', icon: Globe },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeBottomTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveBottomTab(tab.id as any);
                        setIsBottomCollapsed(false);
                      }}
                      className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded transition font-heading font-semibold text-xs tracking-wide ${
                        isActive && !isBottomCollapsed
                          ? 'bg-[#18191f] text-[#ff9100] border-b-2 border-[#ff9100]'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#14151a]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Right Side: Status Summary & Collapse Toggle */}
              <div className="flex items-center space-x-2">
                {executionResult && !isBottomCollapsed && (
                  <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-gray-300 pr-2 border-r border-[#1f2024]">
                    <span className={executionResult.status === 'success' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                      Exit {executionResult.exitCode}
                    </span>
                    <span>•</span>
                    <span>{executionResult.executionTimeMs}ms</span>
                  </div>
                )}

                <button
                  onClick={() => setIsBottomCollapsed(!isBottomCollapsed)}
                  className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#1c1e24] transition"
                  title={isBottomCollapsed ? 'Expand Dock' : 'Collapse Dock'}
                >
                  {isBottomCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Panel View Container */}
            {!isBottomCollapsed && (
              <div className="flex-1 overflow-hidden">
                {activeBottomTab === 'output' && (
                  <OutputPanel
                    result={executionResult}
                    isRunning={isRunning}
                    onTriggerAutoFix={() =>
                      processAutoFix(
                        activeFile.content,
                        executionResult?.stderr || '',
                        executionResult?.diagnostics || []
                      )
                    }
                  />
                )}
                {activeBottomTab === 'terminal' && (
                  <TerminalPanel files={files} onSyncFiles={setFiles} />
                )}
                {activeBottomTab === 'tests' && (
                  <TestCasesPanel
                    testCases={testCases}
                    onAddTestCase={(tc) =>
                      setTestCases((prev) => [...prev, { ...tc, id: `tc_${Date.now()}` }])
                    }
                    onDeleteTestCase={(id) =>
                      setTestCases((prev) => prev.filter((t) => t.id !== id))
                    }
                    onRunAllTests={handleRunAllTests}
                    onRunBenchmark={handleRunBenchmark}
                    isRunningTests={isRunningTests}
                    benchmarkResult={benchmarkResult}
                    customStdin={customStdin}
                    onChangeCustomStdin={setCustomStdin}
                  />
                )}
                {activeBottomTab === 'ai' && (
                  <AIAssistantPanel
                    currentCode={activeFile.content}
                    language={currentLang.id}
                    settings={aiSettings}
                    onUpdateSettings={(s) => setAiSettings((prev) => ({ ...prev, ...s }))}
                    onTriggerExplain={async () => {
                      setAnalysisMode('explain');
                      setIsAnalyzingAI(true);
                      const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'explain');
                      setAiAnalysis(res);
                      setIsAnalyzingAI(false);
                    }}
                    onTriggerOptimize={async () => {
                      setAnalysisMode('optimize');
                      setIsAnalyzingAI(true);
                      const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'optimize');
                      setAiAnalysis(res);
                      setIsAnalyzingAI(false);
                    }}
                    onTriggerRefactor={async () => {
                      setAnalysisMode('refactor');
                      setIsAnalyzingAI(true);
                      const res = await analyzeCode(activeFile.content, currentLang.id, aiSettings, 'refactor');
                      setAiAnalysis(res);
                      setIsAnalyzingAI(false);
                    }}
                    onTriggerConvert={async (toLang) => {
                      const res = await convertCode(activeFile.content, currentLang.id, toLang, aiSettings.apiKey);
                      const targetLangConfig = getLanguageConfig(toLang);
                      setCurrentLang(targetLangConfig);
                      handleContentChange(res.convertedCode);
                    }}
                    onTriggerAutoFix={() =>
                      processAutoFix(
                        activeFile.content,
                        executionResult?.stderr || '',
                        executionResult?.diagnostics || []
                      )
                    }
                    analysisResult={aiAnalysis}
                    isAnalyzing={isAnalyzingAI}
                    analysisMode={analysisMode}
                  />
                )}
                {activeBottomTab === 'debug' && (
                  <DebuggerPanel
                    isDebugging={isDebugging}
                    onStartDebug={handleStartDebug}
                    onStopDebug={handleStopDebug}
                    onStepOver={handleStepOver}
                    onStepInto={() => handleStepOver()}
                    onStepOut={() => handleStepOver()}
                    onResume={() => handleStepOver()}
                    breakpoints={breakpoints}
                    onToggleBreakpoint={(l) =>
                      setBreakpoints((prev) =>
                        prev.includes(l) ? prev.filter((item) => item !== l) : [...prev, l]
                      )
                    }
                    activeLine={activeDebugLine}
                    variables={parsedDebugInfo.variables}
                    callStack={parsedDebugInfo.callStack}
                  />
                )}
                {activeBottomTab === 'preview' && <WebPreviewPanel files={files} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Global Modals */}
      <DiffModal
        isOpen={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        fixResult={fixResult}
        onApplyFix={() => fixResult && applyFixAndReverify(fixResult)}
        onUndo={handleUndoFix}
        canUndo={previousCodeSnapshot !== null}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        aiSettings={aiSettings}
        onUpdateAISettings={(s) => {
          setAiSettings((prev) => ({ ...prev, ...s }));
          if (s.enableInlineSuggestions !== undefined) {
            setEnableInlineSuggestions(s.enableInlineSuggestions);
          }
        }}
        fontSize={fontSize}
        onChangeFontSize={setFontSize}
        theme={theme}
        onChangeTheme={setTheme}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        projectName={`${currentLang.name} Sandbox`}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        diagnostics={{
          language: currentLang.name,
          activeFile: activeFile.name,
          executionStatus: executionResult?.status,
          exitCode: executionResult?.exitCode,
          stderr: executionResult?.stderr,
          diagnosticsList: executionResult?.diagnostics,
          codeSnippet: activeFile.content ? activeFile.content.slice(0, 2000) : undefined,
          systemInfo: typeof window !== 'undefined' ? {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            url: window.location.href,
          } : undefined,
        }}
      />

      {/* Semantic Search Engine Crawler Content (Screen-reader & Search Engine Indexable) */}
      <section className="sr-only" aria-label="Cortex Platform Semantic SEO Overview">
        <h1>Free Online Compiler, Cloud IDE & AI Code Debugger — Cortex</h1>
        <p>
          Cortex is an advanced online code compiler, free online programming environment, and cloud IDE supporting 16+ programming languages. Execute code online, run Python online, compile C++ online, test Java online, and transpile TypeScript in your browser with zero installation.
        </p>

        <h2>Supported Online Compilers & Runtimes</h2>
        <ul>
          <li><a href="/python-online-compiler">Python Online Compiler & Cloud IDE (Python 3.12)</a> - run Python online, online Python debugger, free Python compiler.</li>
          <li><a href="/cpp-online-compiler">C++ Online Compiler (C++20/C++23 GCC)</a> - online C++ compiler, compile C++ online, free C++ IDE.</li>
          <li><a href="/c-online-compiler">C Online Compiler (GCC)</a> - run C online, online C compiler with stdin and memory inspection.</li>
          <li><a href="/java-online-compiler">Java Online Compiler (OpenJDK 21 LTS)</a> - online Java compiler, Java online IDE, run Java code online.</li>
          <li><a href="/javascript-online-compiler">JavaScript Online Compiler & Node.js IDE</a> - execute JavaScript online with live Web Preview and npm runner.</li>
          <li><a href="/typescript-online-compiler">TypeScript Online Compiler & Playground</a> - run TypeScript online with strict type checking.</li>
          <li><a href="/rust-online-compiler">Rust Online Compiler & Cargo Playground</a> - compile Rust online with borrow checker auto-fix.</li>
          <li><a href="/go-online-compiler">Go Online Compiler (Golang)</a> - online Go compiler with concurrency and goroutines.</li>
          <li><a href="/csharp-online-compiler">C# Online Compiler (.NET 8)</a> - run C# online with LINQ and async/await.</li>
          <li><a href="/php-online-compiler">PHP Online Compiler (PHP 8.3)</a> - online PHP script runner.</li>
          <li><a href="/ruby-online-compiler">Ruby Online Compiler (Ruby 3.3)</a> - run Ruby online with interactive terminal.</li>
          <li><a href="/kotlin-online-compiler">Kotlin Online Compiler & Playground</a> - compile Kotlin online for JVM.</li>
          <li><a href="/swift-online-compiler">Swift Online Compiler</a> - write Swift online without a Mac.</li>
          <li><a href="/dart-online-compiler">Dart Online Compiler</a> - compile Dart 3 with null safety.</li>
          <li><a href="/r-online-compiler">R Online Compiler & Statistics IDE</a> - run R online for statistical computing.</li>
          <li><a href="/sql-online-editor">SQL Online Editor & Database Compiler</a> - execute ANSI SQL queries online with table outputs.</li>
        </ul>

        <h2>AI Coding Assistant & Error Fixer</h2>
        <p>
          Fix coding errors with AI, explain compiler errors, automatic code fixing, AI code debugger, and algorithm performance analyzer powered by Google Gemini 2.5 Flash.
        </p>

        <h2>Cloud Development & Competitive Programming Practice</h2>
        <p>
          Practice competitive programming challenges, online coding tests, algorithm practice, and benchmark execution latency and memory consumption.
        </p>
        <nav aria-label="Core Navigation">
          <a href="/">Universal Online IDE & Cloud Compiler</a>
          <a href="/compare">Algorithm Benchmark & Dual Code Comparison</a>
        </nav>
      </section>
    </div>
  );

}
