'use client';

import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Terminal, 
  ChevronRight, 
  ChevronDown,
  Wand2,
  Info
} from 'lucide-react';
import { ExecutionResult, DiagnosticError } from '@/lib/execution/types';

interface OutputPanelProps {
  result: ExecutionResult | null;
  isRunning: boolean;
  onJumpToLine?: (line: number) => void;
  onTriggerAutoFix?: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  result,
  isRunning,
  onJumpToLine,
  onTriggerAutoFix,
}) => {
  if (isRunning) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 space-x-2">
        <div className="w-4 h-4 border-2 border-[#ff9100] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Running...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
        <Terminal className="w-6 h-6 opacity-30" />
        <p className="text-xs font-mono">Press Run (Ctrl+Enter) to execute</p>
      </div>
    );
  }

  const isSuccess = result.status === 'success';
  const hasErrors = result.status === 'compilation_error' || result.status === 'runtime_error';

  return (
    <div className="h-full flex flex-col bg-[#141518] text-xs font-mono select-text overflow-hidden">
      {/* Telemetry Header */}
      <div className="px-3.5 py-2 bg-[#18191e] border-b border-[#252830] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          {isSuccess ? (
            <div className="flex items-center space-x-1.5 text-emerald-400 font-heading font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-rose-400 font-heading font-bold text-xs">
              <XCircle className="w-4 h-4" />
              <span>{result.status === 'compilation_error' ? 'Compilation Failed' : 'Runtime Error'}</span>
            </div>
          )}
          <span className="text-gray-400 text-xs font-mono">Exit Code {result.exitCode}</span>
        </div>

        <div className="flex items-center space-x-3.5 text-gray-300 text-xs">
          <div className="flex items-center space-x-1.5" title="Execution Time">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-mono">{result.executionTimeMs} ms</span>
          </div>
          <div className="flex items-center space-x-1.5" title="Memory">
            <Cpu className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-mono">{result.memoryUsageMb} MB</span>
          </div>

          {hasErrors && onTriggerAutoFix && (
            <button
              onClick={onTriggerAutoFix}
              className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold text-xs transition shadow-sm"
              title="Quick Fix"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Quick Fix</span>
            </button>
          )}
        </div>
      </div>

      {/* Output Stream Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Diagnostics & Line Errors */}
        {result.diagnostics && result.diagnostics.length > 0 && (
          <div className="bg-rose-950/20 border border-rose-800/40 rounded p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-rose-400 font-heading font-bold text-xs pb-1.5 border-b border-rose-900/30">
              <div className="flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Problems ({result.diagnostics.length})</span>
              </div>
            </div>
            {result.diagnostics.map((diag, i) => (
              <div
                key={i}
                onClick={() => {
                  if (onJumpToLine) onJumpToLine(diag.line);
                  if (onTriggerAutoFix) onTriggerAutoFix();
                }}
                className="flex items-center justify-between text-rose-200 hover:bg-rose-900/30 p-2 rounded cursor-pointer transition text-xs group"
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <span className="text-[#ff9100] font-heading font-bold flex-shrink-0">Line {diag.line}</span>
                  <span className="truncate font-mono">{diag.message}</span>
                </div>
                <span className="text-xs text-[#ff9100] font-heading font-semibold opacity-0 group-hover:opacity-100 transition flex-shrink-0 ml-2">Quick Fix &rarr;</span>
              </div>
            ))}
          </div>
        )}

        {/* Clean Empty Output Notice */}
        {isSuccess && !result.stdout && !result.stderr && (
          <div className="text-gray-400 text-xs py-2">
            Process completed with exit code 0 (no output).
          </div>
        )}

        {/* Standard Output */}
        {result.stdout && (
          <div>
            <span className="text-xs uppercase text-gray-400 font-heading font-bold tracking-wider block mb-1.5">Standard Output:</span>
            <pre className="text-gray-200 bg-[#18191d] p-3 rounded border border-[#262832] whitespace-pre-wrap leading-relaxed font-mono text-[13px]">
              {result.stdout}
            </pre>
          </div>
        )}

        {/* Standard Error */}
        {result.stderr && (
          <div>
            <span className="text-xs uppercase text-rose-400 font-heading font-bold tracking-wider block mb-1.5">Standard Error:</span>
            <pre className="text-rose-300 bg-rose-950/20 p-3 rounded border border-rose-900/40 whitespace-pre-wrap leading-relaxed font-mono text-[13px]">
              {result.stderr}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
