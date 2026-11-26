'use client';

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  Play,
  Wand2,
} from 'lucide-react';
import { ExecutionResult } from '@/lib/execution/types';

export interface OutputPanelProps {
  result: ExecutionResult | null;
  isRunning: boolean;
  onJumpToLine?: (line: number) => void;
  onTriggerAutoFix?: () => void;
  isDarkMode?: boolean;
  customStdin?: string;
  onChangeCustomStdin?: (stdin: string) => void;
  stdin?: string;
  onStdinChange?: (stdin: string) => void;
  onRun?: () => void;
}

/**
 * Zero-overflow horizontal split Output & Stdin panel.
 * Renders execution stream on the left and persistent side-by-side Stdin input on the right.
 */
export const OutputPanel: React.FC<OutputPanelProps> = ({
  result,
  isRunning,
  onJumpToLine,
  onTriggerAutoFix,
  isDarkMode = true,
  customStdin = '',
  onChangeCustomStdin,
  stdin,
  onStdinChange,
  onRun,
}) => {
  const effectiveStdin = stdin !== undefined ? stdin : customStdin;
  const handleStdinChange = onStdinChange || onChangeCustomStdin;
  const displayedStdin =
    result?.stdin && result.stdin.trim()
      ? result.stdin
      : effectiveStdin && effectiveStdin.trim()
        ? effectiveStdin
        : '';

  const isSuccess = result?.status === 'success';
  const hasErrors =
    result?.status === 'compilation_error' || result?.status === 'runtime_error';

  return (
    <div
      data-testid="ide-output-split"
      className={`${
        isDarkMode ? 'dark bg-[#0F0F12] text-zinc-200' : 'bg-[#F8F8FA] text-zinc-800'
      } h-full flex divide-x divide-black/[0.07] dark:divide-white/[0.07] font-mono text-[12px] overflow-hidden select-text`}
    >
      {/* Left: Execution Output Stream */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {result && !isRunning && (
          <div className="h-8 px-3 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2 shrink-0 bg-black/[0.015] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2.5 min-w-0">
              {isSuccess ? (
                <span className="inline-flex items-center gap-1.5 font-sans font-medium text-[11.5px] text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-sans font-medium text-[11.5px] text-rose-600 dark:text-rose-400">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>
                    {result.status === 'compilation_error'
                      ? 'Compilation Failed'
                      : 'Runtime Error'}
                  </span>
                </span>
              )}
              <span className="text-[11px] text-zinc-500">Exit {result.exitCode}</span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-zinc-500 shrink-0">
              <span className="inline-flex items-center gap-1" title="Execution Time">
                <Clock className="w-3 h-3" />
                <span>{result.executionTimeMs} ms</span>
              </span>
              <span className="inline-flex items-center gap-1" title="Memory">
                <Cpu className="w-3 h-3" />
                <span>{result.memoryUsageMb} MB</span>
              </span>
              {hasErrors && onTriggerAutoFix && (
                <button
                  type="button"
                  onClick={onTriggerAutoFix}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-sans font-medium text-[11px] border border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 transition-colors"
                  title="Quick Fix"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Quick Fix</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-3 leading-relaxed">
          {isRunning ? (
            <div className="h-full flex items-center justify-center gap-2 text-zinc-500">
              <span className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              <span>Running program...</span>
            </div>
          ) : !result ? (
            <div className="h-full flex items-center justify-center text-zinc-500">
              <span>
                Press{' '}
                <kbd className="mx-1 px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.06] text-[11px]">
                  Ctrl + Enter
                </kbd>{' '}
                to run
              </span>
            </div>
          ) : (
            <>
              {/* Diagnostics */}
              {result.diagnostics && result.diagnostics.length > 0 && (
                <div className="rounded-md p-2.5 space-y-1 border border-rose-500/25 bg-rose-500/[0.06] text-rose-700 dark:text-rose-200">
                  <div className="flex items-center gap-1.5 font-sans font-medium text-[11.5px] text-rose-600 dark:text-rose-400 pb-1 border-b border-rose-500/20">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Problems ({result.diagnostics.length})</span>
                  </div>
                  {result.diagnostics.map((diag, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (onJumpToLine) onJumpToLine(diag.line);
                        if (onTriggerAutoFix) onTriggerAutoFix();
                      }}
                      className="w-full flex items-center justify-between px-2 py-1 rounded text-left text-[11.5px] hover:bg-rose-500/10 group transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-amber-600 dark:text-amber-400 font-medium shrink-0">
                          Line {diag.line}
                        </span>
                        <span className="truncate">{diag.message}</span>
                      </span>
                      <span className="text-[11px] font-sans text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 shrink-0 ml-2">
                        Quick Fix
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Echoed Standard Input (stdin) */}
              {Boolean(displayedStdin) && (
                <div className="space-y-1">
                  <span className="text-[10.5px] uppercase tracking-wider text-zinc-500 block">
                    Standard Input (stdin)
                  </span>
                  <pre className="p-2.5 rounded-md whitespace-pre-wrap break-words bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300">
                    {displayedStdin}
                  </pre>
                </div>
              )}

              {isSuccess && !result.stdout && !result.stderr && (
                <div className="text-zinc-500 py-1">
                  Process completed with exit code 0 (no output).
                </div>
              )}

              {result.stdout && (
                <div className="space-y-1">
                  <span className="text-[10.5px] uppercase tracking-wider text-zinc-500 block">
                    Standard Output
                  </span>
                  <pre className="p-2.5 rounded-md whitespace-pre-wrap break-words bg-white dark:bg-[#141418] border border-black/[0.06] dark:border-white/[0.07] text-zinc-900 dark:text-zinc-100">
                    {result.stdout}
                  </pre>
                </div>
              )}

              {result.stderr && (
                <div className="space-y-1">
                  <span className="text-[10.5px] uppercase tracking-wider text-rose-600 dark:text-rose-400 block">
                    Standard Error
                  </span>
                  <pre className="p-2.5 rounded-md whitespace-pre-wrap break-words bg-rose-500/[0.05] border border-rose-500/20 text-rose-700 dark:text-rose-300">
                    {result.stderr}
                  </pre>
                  {hasErrors &&
                    (result.stderr.includes('EOFError') ||
                      result.stderr.toLowerCase().includes('eof when reading') ||
                      result.stderr.toLowerCase().includes('expected input')) && (
                      <div className="p-2 rounded-md text-[11px] font-sans border border-amber-500/25 bg-amber-500/[0.07] text-amber-700 dark:text-amber-300">
                        This program waited for stdin. Add input on the right and click Run with Input.
                      </div>
                    )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: Side-by-Side Stdin Input (Never clips off bottom) */}
      {handleStdinChange && (
        <div
          data-testid="ide-stdin-pane"
          className="w-[34%] min-w-[200px] max-w-[360px] h-full flex flex-col bg-black/[0.015] dark:bg-black/25 shrink-0"
        >
          <div className="h-8 px-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.05] shrink-0">
            <span className="text-[10.5px] uppercase tracking-wider text-zinc-500">
              Program Input (stdin)
            </span>
            {onRun && (
              <button
                type="button"
                onClick={onRun}
                disabled={isRunning}
                data-testid="ide-run-with-stdin-btn"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-sans text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 transition-colors"
              >
                <Play className="w-2.5 h-2.5 fill-current" />
                <span>Run</span>
              </button>
            )}
          </div>
          <textarea
            value={effectiveStdin}
            onChange={(e) => handleStdinChange(e.target.value)}
            placeholder="Optional stdin lines..."
            data-testid="ide-stdin-textarea"
            className="flex-1 w-full p-3 bg-transparent text-[12px] text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none resize-none"
          />
        </div>
      )}
    </div>
  );
};
