'use client';

import React, { useRef, useState, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { X, Plus, FileCode, Sparkles, Play, ChevronDown, Bug } from 'lucide-react';
import { ProjectFile, DiagnosticError } from '@/lib/execution/types';
import { AIFixResult, fetchInlineSuggestion } from '@/lib/ai/assistant';
import { registerMonacoSnippets } from '@/lib/editor/snippets';
import { InlineQuickFixWidget } from './InlineQuickFixWidget';

export interface MonacoCodeEditorProps {
  files: ProjectFile[];
  openFileIds?: string[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCloseFile: (id: string) => void;
  onNewFile?: () => void;
  onContentChange: (newContent: string) => void;
  language: string;
  theme?: string;
  fontSize?: number;
  wordWrap?: 'on' | 'off';
  readOnly?: boolean;
  breakpoints: number[];
  onToggleBreakpoint: (lineNumber: number) => void;
  activeLine?: number;
  diagnostics?: DiagnosticError[];
  onCursorChange?: (line: number, col: number) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: (coords?: { x: number; y: number }) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  quickFixResult?: AIFixResult | null;
  isQuickFixOpen?: boolean;
  onCloseQuickFix?: () => void;
  onApplyExplanationComment?: (comment: string, line: number) => void;
  onApplyLiveFix?: (fix: AIFixResult) => void;
  aiProvider?: 'gemini' | 'offline';
  apiKey?: string;
  onSaveApiKey?: (key: string) => void;
  isAnalyzingFix?: boolean;
  onReanalyzeWithKey?: (key: string) => void;
  enableInlineSuggestions?: boolean;
  onToggleInlineSuggestions?: () => void;
  onEditorMount?: (editor: any, monaco: any) => void;
  saveStatus?: 'saved' | 'saving' | 'error' | 'conflict';
  onForceSave?: () => void;
  onRun?: () => void;
  isRunning?: boolean;
  onDebug?: () => void;
  isDebugging?: boolean;
  isExecutable?: boolean;
  practiceMode?: boolean;
  hideChrome?: boolean;
  showMinimap?: boolean;
  tabSize?: number;
  jumpToLine?: { fileId: string; line: number; nonce: number } | null;
  onFormatReady?: (formatFn: () => void) => void;
}

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  files,
  openFileIds,
  activeFileId,
  onSelectFile,
  onCloseFile,
  onNewFile,
  onContentChange,
  language,
  theme = 'cortex-dark',
  fontSize = 14,
  wordWrap = 'on',
  breakpoints,
  onToggleBreakpoint,
  activeLine,
  diagnostics = [],
  onCursorChange,
  isDarkMode = true,
  onToggleDarkMode,
  isFullscreen = false,
  onToggleFullscreen,
  quickFixResult,
  isQuickFixOpen = false,
  onCloseQuickFix,
  onApplyExplanationComment,
  onApplyLiveFix,
  aiProvider = 'offline',
  apiKey = '',
  onSaveApiKey,
  isAnalyzingFix = false,
  onReanalyzeWithKey,
  enableInlineSuggestions = false,
  onToggleInlineSuggestions,
  onEditorMount,
  saveStatus = 'saved',
  onForceSave,
  onRun,
  isRunning = false,
  onDebug,
  isDebugging = false,
  isExecutable = true,
  practiceMode = false,
  hideChrome = false,
  showMinimap = false,
  tabSize = 4,
  jumpToLine = null,
  onFormatReady,
}) => {
  const [isRunDropdownOpen, setIsRunDropdownOpen] = useState(false);
  const runDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (runDropdownRef.current && !runDropdownRef.current.contains(e.target as Node)) {
        setIsRunDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsRunDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const inlineProviderDisposableRef = useRef<any>(null);

  const enableInlineSuggestionsRef = useRef(enableInlineSuggestions);
  enableInlineSuggestionsRef.current = enableInlineSuggestions;
  const languageRef = useRef(language);
  languageRef.current = language;
  
  

  const tabFiles = openFileIds
    ? files.filter((f) => !f.isFolder && openFileIds.includes(f.id))
    : files.filter((f) => !f.isFolder);

  const activeFile = tabFiles.find((f) => f.id === activeFileId) || (tabFiles.length > 0 ? tabFiles[0] : null);
  const snippetsRegisteredRef = useRef(false);
  const lastReportedValueRef = useRef<string>(activeFile?.content || '');
  const pendingReportedValuesRef = useRef<Set<string>>(new Set());
  const prevFileIdRef = useRef(activeFileId);

  // Synchronize active selection if activeFileId was reset but tabFiles are available
  useEffect(() => {
    if (tabFiles.length > 0 && (!activeFileId || !tabFiles.some((f) => f.id === activeFileId))) {
      onSelectFile(tabFiles[0].id);
    }
  }, [activeFileId, tabFiles, onSelectFile]);

  // Sync external file content / file switches without fighting user keystrokes
  useEffect(() => {
    if (!activeFile) {
      prevFileIdRef.current = '';
      return;
    }
    if (!editorRef.current) return;
    const currentVal = editorRef.current.getValue();
    
    // File switch: always sync
    if (prevFileIdRef.current !== activeFileId) {
      prevFileIdRef.current = activeFileId;
      lastReportedValueRef.current = activeFile?.content || '';
      pendingReportedValuesRef.current.clear();
      if (activeFile && currentVal !== activeFile.content) {
        editorRef.current.setValue(activeFile.content || '');
      }
      return;
    }
    
    // External update (starter code loaded, AI fix applied, etc.)
    // Only apply if it wasn't typed by the user directly in this editor
    if (
      activeFile && 
      activeFile.content !== currentVal && 
      activeFile.content !== lastReportedValueRef.current &&
      !pendingReportedValuesRef.current.has(activeFile.content)
    ) {
      lastReportedValueRef.current = activeFile.content;
      pendingReportedValuesRef.current.clear();
      const prevSelection = editorRef.current.getSelection();
      const model = editorRef.current.getModel();
            if (model) {
        editorRef.current.executeEdits('external', [{
          range: model.getFullModelRange(),
          text: activeFile.content,
          forceMoveMarkers: true,
        }]);
        if (prevSelection) {
          editorRef.current.setSelection(prevSelection);
        }
      } else {
        editorRef.current.setValue(activeFile.content);
        if (prevSelection) {
          editorRef.current.setSelection(prevSelection);
        }
      }
    } else if (activeFile && pendingReportedValuesRef.current.has(activeFile.content)) {
      pendingReportedValuesRef.current.delete(activeFile.content);
    }
  }, [activeFileId, activeFile?.content]);

  const effectiveTheme = practiceMode
    ? (isDarkMode ? 'practice-dark' : 'practice-light')
    : theme;

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    if (onEditorMount) {
        onEditorMount(editor, monaco);
    }

    if (onFormatReady) {
      onFormatReady(() => {
        editor.getAction('editor.action.formatDocument')?.run();
      });
    }

    // Define Cortex calm monochrome dark theme with #0C0C0E background
    monaco.editor.defineTheme('cortex-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC' },
        { token: 'keyword.operator', foreground: '93C5FD' },
        { token: 'identifier.function', foreground: '7DD3FC' },
        { token: 'entity.name.function', foreground: '7DD3FC' },
        { token: 'string', foreground: '86EFAC' },
        { token: 'number', foreground: 'FDBA74' },
        { token: 'type', foreground: '93C5FD' },
      ],
      colors: {
        'editor.background': '#0C0C0E',
        'editor.foreground': '#F4F4F5',
        'editorLineNumber.foreground': '#52525B',
        'editorLineNumber.activeForeground': '#A1A1AA',
        'editor.lineHighlightBackground': '#18181C',
        'editorCursor.foreground': '#F59E0B',
        'editorWhitespace.foreground': '#27272A',
        'editorIndentGuide.background': '#1C1C22',
        'editorIndentGuide.activeBackground': '#3F3F46',
      },
    });

    // Define Practice dark theme matched to #1C1C1E floating card
    monaco.editor.defineTheme('practice-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC' },
        { token: 'keyword.operator', foreground: '93C5FD' },
        { token: 'string', foreground: '86EFAC' },
        { token: 'number', foreground: 'FDBA74' },
        { token: 'type', foreground: '7DD3FC' },
      ],
      colors: {
        'editor.background': '#1C1C1E',
        'editor.foreground': '#F4F4F5',
        'editorLineNumber.foreground': '#52525B',
        'editorLineNumber.activeForeground': '#A1A1AA',
        'editor.lineHighlightBackground': '#262629',
        'editorCursor.foreground': '#F59E0B',
        'editorWhitespace.foreground': '#27272A',
        'editorIndentGuide.background': '#27272A',
        'editorIndentGuide.activeBackground': '#3F3F46',
      },
    });

    // Define Cortex light theme for the editor
    monaco.editor.defineTheme('cortex-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: '7C3AED' },
        { token: 'string', foreground: '15803D' },
        { token: 'number', foreground: 'C2410C' },
        { token: 'type', foreground: '0369A1' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#18181B',
        'editorLineNumber.foreground': '#A1A1AA',
        'editorLineNumber.activeForeground': '#52525B',
        'editor.lineHighlightBackground': '#F4F4F6',
        'editorCursor.foreground': '#D97706',
      },
    });

    // Define Practice light theme matched to #FFFFFF floating card
    monaco.editor.defineTheme('practice-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '71717a', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'd97706' },
        { token: 'string', foreground: 'b45309' },
        { token: 'number', foreground: '047857' },
        { token: 'type', foreground: '0284c7' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#18181b',
        'editorLineNumber.foreground': '#a1a1aa',
        'editorLineNumber.activeForeground': '#52525b',
        'editor.lineHighlightBackground': '#f7f7f8',
        'editorCursor.foreground': '#d97706',
      },
    });

    monaco.editor.setTheme(effectiveTheme);

    // Register standard VS Code Snippets & IntelliSense across all languages once
    if (!snippetsRegisteredRef.current) {
      registerMonacoSnippets(monaco);
      snippetsRegisteredRef.current = true;
    }

    // Register Inline Completions Provider for Ghost Text (Copilot-style)
    if (!inlineProviderDisposableRef.current && monaco.languages.registerInlineCompletionsProvider) {
      try {
        const supportedLangs = [
          'cpp', 'c', 'python', 'javascript', 'typescript', 'java',
          'rust', 'go', 'csharp', 'php', 'ruby', 'kotlin', 'swift',
          'dart', 'sql', 'r', '*'
        ];

        const providerDisposables: { dispose: () => void }[] = [];

        for (const langSelector of supportedLangs) {
          const d = monaco.languages.registerInlineCompletionsProvider(langSelector, {
            provideInlineCompletions: async (model: any, position: any, context: any, token: any) => {
              // If disabled, return no suggestions
              if (!enableInlineSuggestionsRef.current) {
                return { items: [] };
              }

              const lineContent = model.getLineContent(position.lineNumber);
              const currentLinePrefix = lineContent.substring(0, position.column - 1);

              // Don't suggest on empty blank line
              if (!currentLinePrefix.trim()) {
                return { items: [] };
              }

              const word = model.getWordUntilPosition(position);
              const currentWord = word?.word || '';

              const textBefore = model.getValueInRange({
                startLineNumber: Math.max(1, position.lineNumber - 20),
                startColumn: 1,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              });

              const textAfter = model.getValueInRange({
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 10),
                endColumn: 100,
              });

              const suggestion = await fetchInlineSuggestion(
                textBefore,
                currentLinePrefix,
                languageRef.current,
                textAfter,
                undefined
              );

              if (!suggestion || token.isCancellationRequested) {
                return { items: [] };
              }

              // If suggestion starts with currentWord, start replacement range at word.startColumn
              let startCol = position.column;
              if (currentWord && suggestion.toLowerCase().startsWith(currentWord.toLowerCase())) {
                startCol = word.startColumn;
              }

              return {
                items: [
                  {
                    insertText: suggestion,
                    range: new monaco.Range(
                      position.lineNumber,
                      startCol,
                      position.lineNumber,
                      position.column
                    ),
                  },
                ],
              };
            },
            freeInlineCompletions: () => {},
          });
          providerDisposables.push(d);
        }

        inlineProviderDisposableRef.current = {
          dispose: () => {
            providerDisposables.forEach((p) => p.dispose());
          },
        };
      } catch (e) {
        console.warn('Failed to register inline completions provider:', e);
      }
    }

    // Gutter click for breakpoints
    editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
        const line = e.target.position?.lineNumber;
        if (line) {
          onToggleBreakpoint(line);
        }
      }
    });

    // Cursor position broadcast
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column);
      }
    });
  };

  // Sync inline suggestion state with Monaco editor
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        inlineSuggest: {
          enabled: Boolean(enableInlineSuggestions),
          mode: 'subwordSmart',
        },
      });
    }
  }, [enableInlineSuggestions]);

  // Clean up inline provider on unmount
  useEffect(() => {
    return () => {
      if (inlineProviderDisposableRef.current) {
        inlineProviderDisposableRef.current.dispose();
      }
    };
  }, []);

  // Sync theme changes with Monaco
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(effectiveTheme);
    }
  }, [effectiveTheme]);

  // Sync practice/editor typography & layout options
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize,
        tabSize,
        lineHeight: practiceMode ? 20 : 21,
        minimap: { enabled: !practiceMode && Boolean(showMinimap) },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        padding: { top: 10, bottom: 10 },
      });
    }
  }, [fontSize, tabSize, practiceMode, showMinimap]);

  // Jump to requested search line when file matches
  useEffect(() => {
    if (
      jumpToLine &&
      jumpToLine.fileId === activeFileId &&
      jumpToLine.line > 0 &&
      editorRef.current
    ) {
      editorRef.current.revealLineInCenter(jumpToLine.line);
      editorRef.current.setPosition({ lineNumber: jumpToLine.line, column: 1 });
      editorRef.current.focus();
    }
  }, [jumpToLine, activeFileId]);

  // Recalculate layout on fullscreen or resize
  useEffect(() => {
    const timer = setTimeout(() => {
      editorRef.current?.layout();
    }, 100);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Reveal error line when quick fix opens
  useEffect(() => {
    if (isQuickFixOpen && quickFixResult?.targetLine && editorRef.current) {
      editorRef.current.revealLineInCenter(quickFixResult.targetLine);
      editorRef.current.setPosition({ lineNumber: quickFixResult.targetLine, column: 1 });
    }
  }, [isQuickFixOpen, quickFixResult]);

  // Update Breakpoint & Diagnostic Decorations
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const newDecorations: any[] = [];

    // Breakpoints
    breakpoints.forEach((line) => {
      newDecorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'breakpoint-glyph',
          linesDecorationsClassName: 'bg-rose-900/40 border-l-2 border-rose-500',
        },
      });
    });

    // Active debugger line
    if (activeLine) {
      newDecorations.push({
        range: new monaco.Range(activeLine, 1, activeLine, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: 'bg-amber-900/50 border-l-4 border-amber-400 font-bold',
        },
      });
    }

    // Diagnostics (Errors / Warnings)
    diagnostics.forEach((diag) => {
      if (diag.line > 0) {
        newDecorations.push({
          range: new monaco.Range(diag.line, 1, diag.line, 100),
          options: {
            isWholeLine: false,
            inlineClassName:
              diag.severity === 'error'
                ? 'underline decoration-wavy decoration-red-500'
                : 'underline decoration-wavy decoration-yellow-400',
            hoverMessage: { value: `**${diag.severity.toUpperCase()}**: ${diag.message}` },
          },
        });
      }
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [breakpoints, activeLine, diagnostics]);

  const suppressTopChrome = Boolean(practiceMode || hideChrome);

  return (
    <div className={`flex flex-col h-full ${
      suppressTopChrome
        ? (isDarkMode ? (practiceMode ? 'bg-[#1C1C1E]' : 'bg-[#0C0C0E]') : 'bg-white')
        : `${isDarkMode ? 'bg-[#0C0C0E] border-white/[0.07]' : 'bg-white border-black/[0.08]'} border-r`
    } ${
      isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
    }`}>
      {/* File Tabs Bar (hidden when managed by PracticeWorkspace or CortexIdeShell) */}
      {!suppressTopChrome && (
      <div className={`h-9 ${isDarkMode ? 'bg-[#0F0F12] border-white/[0.07]' : 'bg-[#F4F4F6] border-black/[0.08]'} flex items-center justify-between border-b text-xs select-none`}>
        <div className="flex items-center overflow-x-auto h-full">
          {tabFiles.map((file) => {
              const isActive = file.id === activeFile?.id;
              return (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file.id)}
                  className={`flex items-center space-x-2 px-3.5 h-full border-r ${isDarkMode ? 'border-[#1f2024]' : 'border-slate-200'} cursor-pointer transition font-mono ${
                    isActive
                      ? isDarkMode
                        ? 'bg-[#0b0c0e] text-[#ff9100] font-medium border-t-2 border-t-[#ff9100]'
                        : 'bg-[#ffffff] text-[#0f172a] font-medium border-t-2 border-t-[#ff9100]'
                      : isDarkMode
                      ? 'text-gray-400 hover:bg-[#16171c] hover:text-gray-200'
                      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-[#ff9100]' : isDarkMode ? 'text-gray-500' : 'text-slate-400'}`} />
                  <span>{file.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseFile(file.id);
                    }}
                    className={`p-0.5 rounded-full transition ml-1 border border-transparent ${
                      isDarkMode
                        ? 'hover:bg-[#252830] text-gray-500 hover:text-gray-200'
                        : 'hover:bg-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300'
                    }`}
                    title="Close file"
                    aria-label={`Close ${file.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          <button
            onClick={onNewFile}
            className={`p-1.5 ml-1 rounded transition border border-transparent ${
              isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-[#1c1e24]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200 hover:border-slate-300'
            }`}
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Controls for Just this Editor Part */}
        <div className="flex items-center space-x-1.5 pr-2.5">
          {/* Inline Suggestions Toggle Indicator */}
          {onToggleInlineSuggestions && (
            <button
              onClick={onToggleInlineSuggestions}
              className={`px-2.5 py-1 rounded transition flex items-center space-x-1.5 text-xs font-heading font-semibold border ${
                enableInlineSuggestions
                  ? 'bg-[#ff9100]/20 text-[#ff9100] border-[#ff9100]/50 shadow-sm'
                  : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-[#1f2024] border-[#2b2d35]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-300 hover:border-slate-400 shadow-sm'
              }`}
              title={
                enableInlineSuggestions
                  ? 'Inline Suggestions: ON (Press Tab to accept, Esc to dismiss). Click to turn OFF.'
                  : 'Inline Suggestions: OFF (Default). Click or enable in Settings to turn ON.'
              }
            >
              <Sparkles className={`w-3.5 h-3.5 ${enableInlineSuggestions ? 'text-[#ff9100]' : 'text-gray-500'}`} />
              <span className="hidden sm:inline text-[11px]">
                {enableInlineSuggestions ? 'Suggestions: On' : 'Suggestions: Off'}
              </span>
            </button>
          )}

          {/* Relocated Run & Debug Split Button */}
          {onRun && (
            <div ref={runDropdownRef} className="relative inline-flex items-center rounded-md shadow-sm shrink-0">
              {/* Main Action Button (Executes Run by default) */}
              <button
                type="button"
                onClick={onRun}
                disabled={isRunning || !isExecutable || !activeFile}
                className={`h-[26px] flex items-center space-x-1.5 px-2.5 rounded-l-md text-xs font-bold font-heading tracking-wide transition active:scale-95 border ${
                  !isExecutable || !activeFile
                    ? isDarkMode
                      ? 'bg-[#181920] text-gray-500 border-[#252830] cursor-not-allowed'
                      : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
                    : isRunning
                    ? 'bg-emerald-800 text-emerald-200 border-emerald-700 cursor-not-allowed'
                    : isDarkMode
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 hover:border-emerald-500'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 hover:border-emerald-700'
                }`}
                title={
                  !activeFile
                    ? 'No file open'
                    : !isExecutable
                    ? 'Syntax Highlighting Only (Non-executable format)'
                    : 'Run File (Ctrl+Enter)'
                }
              >
                <Play className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : (!isExecutable || !activeFile) ? 'text-gray-400' : 'fill-current'}`} />
                <span>{!activeFile ? 'Run' : !isExecutable ? 'Preview Only' : (isRunning ? 'Running...' : 'Run')}</span>
              </button>

              {/* Adjacent Downward-Facing Arrow Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isExecutable && activeFile) {
                    setIsRunDropdownOpen((prev) => !prev);
                  }
                }}
                disabled={!isExecutable || !activeFile}
                className={`h-[26px] px-1.5 rounded-r-md border-t border-b border-r transition flex items-center justify-center ${
                  !isExecutable
                    ? isDarkMode
                      ? 'bg-[#181920] text-gray-600 border-[#252830] cursor-not-allowed'
                      : 'bg-slate-100 text-slate-400 border-slate-300 cursor-not-allowed'
                    : isDarkMode
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-800/60'
                    : 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-700 hover:border-emerald-800'
                }`}
                title="Execution Options (Run or Debug)"
                aria-expanded={isRunDropdownOpen}
                aria-haspopup="menu"
                aria-label="Execution options"
              >
                <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isRunDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Execution Options Dropdown Popover */}
              {isRunDropdownOpen && isExecutable && (
                <div
                  role="menu"
                  aria-label="Execution options"
                  className={`absolute right-0 top-full mt-1 w-40 rounded-md border shadow-2xl py-1 z-50 transition-colors ${
                    isDarkMode ? 'border-[#2b2d35] bg-[#14161b]' : 'border-slate-200 bg-white shadow-xl'
                  }`}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsRunDropdownOpen(false);
                      onRun();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition font-semibold border border-transparent ${
                      isDarkMode
                        ? 'hover:bg-[#1f2128] hover:border-[#2b2d35] text-emerald-400 bg-[#181a22]'
                        : 'hover:bg-emerald-50 hover:border-slate-200 text-emerald-700 bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Play className={`w-3.5 h-3.5 fill-current ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                      <span>Run</span>
                    </div>
                    <span className={`text-[10px] font-mono ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>Default</span>
                  </button>

                  {onDebug && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsRunDropdownOpen(false);
                        onDebug();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition font-semibold border border-transparent ${
                        isDarkMode
                          ? 'hover:bg-[#1f2128] hover:border-[#2b2d35] text-amber-400'
                          : 'hover:bg-amber-50 hover:border-slate-200 text-amber-700'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Bug className={`w-3.5 h-3.5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
                        <span>Debug</span>
                      </div>
                      {isDebugging && (
                        <span className={`text-[10px] font-mono ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>Active</span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Active Theme Toggle Pill Switch (LIGHT / DARK) */}
          {onToggleDarkMode && (
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(isDarkMode)}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = typeof e.clientX === 'number' && e.clientX > 0 ? e.clientX : rect.left + rect.width / 2;
                const y = typeof e.clientY === 'number' && e.clientY > 0 ? e.clientY : rect.top + rect.height / 2;
                onToggleDarkMode({ x, y });
              }}
              className={`relative h-[26px] w-[80px] rounded-full p-[2px] transition-colors duration-300 flex items-center select-none cursor-pointer border shrink-0 ${
                isDarkMode
                  ? 'bg-black border-zinc-700 hover:border-zinc-500 shadow-inner'
                  : 'bg-[#eceef1] border-slate-300 hover:border-slate-400 shadow-inner'
              }`}
              title={isDarkMode ? 'Dark Mode active (Click to switch to Light Mode)' : 'Light Mode active (Click to switch to Dark Mode)'}
            >
              {/* Sliding Circular Knob */}
              <div
                className={`absolute top-[1px] w-[22px] h-[22px] rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ease-out z-10 ${
                  isDarkMode ? 'left-[2px] translate-x-0' : 'left-[2px] translate-x-[54px]'
                }`}
              >
                {isDarkMode ? (
                  /* Dark Mode: Moon with sparkle stars */
                  <svg
                    className="w-3.5 h-3.5 text-black"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    <path d="M19 4v3" strokeWidth="2" />
                    <path d="M17.5 5.5h3" strokeWidth="2" />
                  </svg>
                ) : (
                  /* Light Mode: Sun with radial rays */
                  <svg
                    className="w-3.5 h-3.5 text-black"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2" x2="12" y2="4.5" />
                    <line x1="12" y1="19.5" x2="12" y2="22" />
                    <line x1="4.5" y1="4.5" x2="6.2" y2="6.2" />
                    <line x1="17.8" y1="17.8" x2="19.5" y2="19.5" />
                    <line x1="2" y1="12" x2="4.5" y2="12" />
                    <line x1="19.5" y1="12" x2="22" y2="12" />
                    <line x1="4.5" y1="19.5" x2="6.2" y2="17.8" />
                    <line x1="17.8" y1="6.2" x2="19.5" y2="4.5" />
                  </svg>
                )}
              </div>

              {/* Text Label */}
              <div className="w-full flex items-center justify-between text-[9px] font-black tracking-wider uppercase font-sans">
                {isDarkMode ? (
                  <>
                    <span className="w-[22px] shrink-0" aria-hidden="true" />
                    <span className="text-white pr-2 pl-0.5 truncate select-none text-right flex-1">DARK</span>
                  </>
                ) : (
                  <>
                    <span className="text-black pl-2 pr-0.5 truncate select-none text-left flex-1">LIGHT</span>
                    <span className="w-[22px] shrink-0" aria-hidden="true" />
                  </>
                )}
              </div>
            </button>
          )}
        </div>
      </div>
      )}

      {/* Editor Body */}
      <div className={`flex-1 relative select-text transition-colors ${
        practiceMode
          ? (isDarkMode ? 'bg-[#1C1C1E]' : 'bg-white')
          : (isDarkMode ? 'bg-[#0C0C0E]' : 'bg-[#FFFFFF]')
      }`}>
        {/* Copilot-Style Inline Quick-Fix Widget */}
        {isQuickFixOpen && (
          <InlineQuickFixWidget
            isOpen={isQuickFixOpen}
            onClose={onCloseQuickFix || (() => {})}
            fixResult={quickFixResult}
            onApplyExplanationComment={onApplyExplanationComment || (() => {})}
            onApplyLiveFix={onApplyLiveFix || (() => {})}
            isDarkMode={isDarkMode}
            aiProvider={aiProvider}
            apiKey={apiKey}
            onSaveApiKey={onSaveApiKey}
            isAnalyzing={isAnalyzingFix}
            onReanalyzeWithKey={onReanalyzeWithKey}
          />
        )}

        {!activeFile ? (
          <div className={`flex flex-col items-center justify-center h-full text-center p-8 select-none ${
            isDarkMode ? 'text-zinc-500 bg-[#0C0C0E]' : 'text-zinc-500 bg-white'
          }`}>
            <FileCode className="w-10 h-10 mb-3 opacity-35 text-amber-500" />
            <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-zinc-200' : 'text-zinc-800'}`}>
              No Files Open
            </h3>
            <p className="text-xs max-w-sm mb-4 text-zinc-500">
              Select a file from Explorer or create a new file to begin editing.
            </p>
            {onNewFile && (
              <button
                type="button"
                onClick={onNewFile}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                  isDarkMode
                    ? 'bg-[#222227] border-white/[0.1] text-zinc-100 hover:bg-[#2a2a30]'
                    : 'bg-zinc-900 border-black/15 text-white hover:bg-zinc-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New File</span>
              </button>
            )}
          </div>
        ) : (
          <Editor
            height="100%"
            language={language}
            path={activeFile.id}
            defaultValue={activeFile.content || ''}
            theme={effectiveTheme}
            onChange={(value) => {
              const nextVal = value || '';
              lastReportedValueRef.current = nextVal;
              pendingReportedValuesRef.current.add(nextVal);
              if (pendingReportedValuesRef.current.size > 100) {
                const first = pendingReportedValuesRef.current.values().next().value;
                if (first !== undefined) pendingReportedValuesRef.current.delete(first);
              }
              onContentChange(nextVal);
            }}
            onMount={handleEditorMount}
            options={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize,
              lineHeight: practiceMode ? 20 : 21,
              fontLigatures: true,
              wordWrap,
              minimap: { enabled: !practiceMode && Boolean(showMinimap) },
              glyphMargin: !practiceMode,
              scrollBeyondLastLine: false,
              padding: { top: 10, bottom: 10 },
              smoothScrolling: true,
              automaticLayout: true,
              formatOnPaste: false,
              formatOnType: false,
              tabSize,
              cursorBlinking: 'smooth',
              lineNumbersMinChars: 3,
              renderLineHighlight: 'line',
              selectOnLineNumbers: true,
              contextmenu: true,
              dragAndDrop: true,
              multiCursorModifier: 'alt',
              copyWithSyntaxHighlighting: true,
              emptySelectionClipboard: false,
              selectionHighlight: true,
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              autoSurround: 'languageDefined',
              bracketPairColorization: { enabled: true },
              inlineSuggest: {
                enabled: Boolean(enableInlineSuggestions),
                mode: 'subwordSmart',
                showToolbar: 'onHover',
              },
              quickSuggestions: {
                other: true,
                comments: false,
                strings: true,
              },
              suggestOnTriggerCharacters: true,
              tabCompletion: 'on',
              snippetSuggestions: 'top',
              wordBasedSuggestions: 'currentDocument',
            }}
          />
        )}
      </div>
    </div>
  );
};
