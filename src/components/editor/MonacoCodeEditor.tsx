'use client';

import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { X, Plus, FileCode, Sun, Moon, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { ProjectFile, DiagnosticError } from '@/lib/execution/types';
import { AIFixResult, fetchInlineSuggestion } from '@/lib/ai/assistant';
import { registerMonacoSnippets } from '@/lib/editor/snippets';
import { InlineQuickFixWidget } from './InlineQuickFixWidget';

interface MonacoCodeEditorProps {
  files: ProjectFile[];
  activeFileId: string;
  onSelectFile: (id: string) => void;
  onCloseFile: (id: string) => void;
  onNewFile: () => void;
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
  onToggleDarkMode?: () => void;
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
}

export const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({
  files,
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
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const inlineProviderDisposableRef = useRef<any>(null);

  const enableInlineSuggestionsRef = useRef(enableInlineSuggestions);
  enableInlineSuggestionsRef.current = enableInlineSuggestions;
  const languageRef = useRef(language);
  languageRef.current = language;
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define Cortex deep dark theme with #0b0c0e background
    monaco.editor.defineTheme('cortex-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff9100' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: '4ec9b0' },
      ],
      colors: {
        'editor.background': '#0b0c0e',
        'editor.foreground': '#e6edf3',
        'editorLineNumber.foreground': '#4d4c4b',
        'editorLineNumber.activeForeground': '#ff9100',
        'editor.lineHighlightBackground': '#14161b',
        'editorCursor.foreground': '#ff9100',
        'editorWhitespace.foreground': '#222329',
        'editorIndentGuide.background': '#1c1d24',
        'editorIndentGuide.activeBackground': '#3a3b45',
      },
    });

    // Define Cortex light theme for the editor
    monaco.editor.defineTheme('cortex-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'd97706' },
        { token: 'string', foreground: 'b45309' },
        { token: 'number', foreground: '047857' },
        { token: 'type', foreground: '0284c7' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#1f2937',
        'editorLineNumber.foreground': '#9ca3af',
        'editorLineNumber.activeForeground': '#ff9100',
        'editor.lineHighlightBackground': '#f8f9fa',
        'editorCursor.foreground': '#ff9100',
      },
    });

    monaco.editor.setTheme(theme);

    // Register standard VS Code Snippets & IntelliSense across all languages
    registerMonacoSnippets(monaco);

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
                apiKeyRef.current
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
      monacoRef.current.editor.setTheme(theme);
    }
  }, [theme]);

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

  return (
    <div className={`flex flex-col h-full bg-[#0b0c0e] border-r border-[#1f2024] select-none ${
      isFullscreen ? 'fixed inset-0 z-50 w-screen h-screen' : ''
    }`}>
      {/* File Tabs Bar */}
      <div className="h-9 bg-[#101114] flex items-center justify-between border-b border-[#1f2024] text-xs">
        <div className="flex items-center overflow-x-auto h-full">
          {files
            .filter((f) => !f.isFolder)
            .map((file) => {
              const isActive = file.id === activeFile?.id;
              return (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file.id)}
                  className={`flex items-center space-x-2 px-3.5 h-full border-r border-[#1f2024] cursor-pointer transition font-mono ${
                    isActive
                      ? isDarkMode
                        ? 'bg-[#0b0c0e] text-[#ff9100] font-medium border-t-2 border-t-[#ff9100]'
                        : 'bg-[#ffffff] text-[#0f172a] font-medium border-t-2 border-t-[#ff9100]'
                      : 'text-gray-400 hover:bg-[#16171c] hover:text-gray-200'
                  }`}
                >
                  <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-[#ff9100]' : 'text-gray-500'}`} />
                  <span>{file.name}</span>
                  {files.filter((f) => !f.isFolder).length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseFile(file.id);
                      }}
                      className="p-0.5 hover:bg-[#252830] rounded-full text-gray-500 hover:text-gray-200 transition ml-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          <button
            onClick={onNewFile}
            className="p-1.5 ml-1 text-gray-400 hover:text-white hover:bg-[#1c1e24] rounded transition"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action Controls for Just this Editor Part */}
        <div className="flex items-center space-x-1 pr-2.5">
          {/* Inline Suggestions Toggle Indicator */}
          {onToggleInlineSuggestions && (
            <button
              onClick={onToggleInlineSuggestions}
              className={`px-2.5 py-1 rounded transition flex items-center space-x-1.5 text-xs font-heading font-semibold border ${
                enableInlineSuggestions
                  ? 'bg-[#ff9100]/20 text-[#ff9100] border-[#ff9100]/50 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f2024] border-[#2b2d35]'
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

          {/* Editor Dark / Light Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-[#1f2024] transition flex items-center space-x-1.5 text-xs font-mono border border-transparent hover:border-[#2b2d35]"
              title={isDarkMode ? 'Switch code editor to light theme' : 'Switch code editor to dark theme'}
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline text-[11px] text-gray-300">Editor Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-300" />
                  <span className="hidden md:inline text-[11px] text-gray-300">Editor Dark</span>
                </>
              )}
            </button>
          )}

          {/* Full Screen Code Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`px-2 py-1 rounded transition flex items-center space-x-1.5 text-xs font-mono border ${
                isFullscreen 
                  ? 'bg-[#1f2024] text-[#ff9100] border-[#ff9100]/50' 
                  : 'text-gray-400 hover:text-white hover:bg-[#1f2024] border-transparent hover:border-[#2b2d35]'
              }`}
              title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Full Screen Code (F11)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-[#ff9100]" />
                  <span className="hidden md:inline text-[11px] text-[#ff9100]">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline text-[11px] text-gray-300">Fullscreen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className={`flex-1 relative transition-colors ${isDarkMode ? 'bg-[#0b0c0e]' : 'bg-[#ffffff]'}`}>
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

        <Editor
          height="100%"
          language={language}
          value={activeFile?.content || ''}
          theme={theme}
          onChange={(value) => onContentChange(value || '')}
          onMount={handleEditorMount}
          options={{
            fontFamily: "'JetBrains Mono', 'Consolas', 'Courier New', monospace",
            fontSize,
            fontLigatures: true,
            wordWrap,
            minimap: { enabled: true },
            glyphMargin: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 4,
            cursorBlinking: 'smooth',
            lineNumbersMinChars: 3,
            renderLineHighlight: 'all',
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
      </div>
    </div>
  );
};
