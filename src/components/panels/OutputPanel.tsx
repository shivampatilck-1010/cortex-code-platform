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
  isDarkMode?: boolean;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  result,
  isRunning,
  onJumpToLine,
  onTriggerAutoFix,
  isDarkMode = true,
}) => {
  if (isRunning) {
    return (
      <div className={`flex items-center justify-center h-full space-x-2 ${isDarkMode ? 'bg-[#141518] text-gray-400' : 'bg-white text-slate-500'}`}>
        <div className="w-4 h-4 border-2 border-[#ff9100] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Running...</span>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`flex flex-col items-center justify-center h-full space-y-2 ${isDarkMode ? 'bg-[#141518] text-gray-500' : 'bg-white text-slate-400'}`}>
        <Terminal className="w-6 h-6 opacity-30" />
        <p className="text-xs font-mono">Press Run (Ctrl+Enter) to execute</p>
      </div>
    );
  }

  const isSuccess = result.status === 'success';
  const hasErrors = result.status === 'compilation_error' || result.status === 'runtime_error';

  return (
    <div className={`h-full flex flex-col text-xs font-mono select-text overflow-hidden transition-colors duration-200 ${
      isDarkMode ? 'bg-[#141518] text-gray-200' : 'bg-white text-slate-800'
    }`}>
      {/* Telemetry Header */}
      <div className={`px-3.5 py-2 border-b flex items-center justify-between transition-colors duration-200 ${
        isDarkMode ? 'bg-[#18191e] border-[#252830]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex items-center space-x-2.5">
          {isSuccess ? (
            <div className={`flex items-center space-x-1.5 font-heading font-bold text-xs ${
              isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed</span>
            </div>
          ) : (
            <div className={`flex items-center space-x-1.5 font-heading font-bold text-xs ${
              isDarkMode ? 'text-rose-400' : 'text-rose-600'
            }`}>
              <XCircle className="w-4 h-4" />
              <span>{result.status === 'compilation_error' ? 'Compilation Failed' : 'Runtime Error'}</span>
            </div>
          )}
          <span className={`text-xs font-mono ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
            Exit Code {result.exitCode}
          </span>
        </div>

        <div className={`flex items-center space-x-3.5 text-xs ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
          <div className="flex items-center space-x-1.5" title="Execution Time">
            <Clock className={`w-3.5 h-3.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`} />
            <span className="font-mono">{result.executionTimeMs} ms</span>
          </div>
          <div className="flex items-center space-x-1.5" title="Memory">
            <Cpu className={`w-3.5 h-3.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`} />
            <span className="font-mono">{result.memoryUsageMb} MB</span>
          </div>

          {hasErrors && onTriggerAutoFix && (
            <button
              onClick={onTriggerAutoFix}
              className="flex items-center space-x-1.5 px-3 py-1 rounded bg-[#ff9100] hover:bg-[#e08000] text-slate-950 font-heading font-bold text-xs transition shadow-sm"
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
          <div className={`rounded p-2.5 space-y-1.5 border ${
            isDarkMode ? 'bg-rose-950/20 border-rose-800/40 text-rose-200' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className={`flex items-center justify-between font-heading font-bold text-xs pb-1.5 border-b ${
              isDarkMode ? 'text-rose-400 border-rose-900/30' : 'text-rose-700 border-rose-200'
            }`}>
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
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition text-xs group ${
                  isDarkMode ? 'text-rose-200 hover:bg-rose-900/30' : 'text-rose-900 hover:bg-rose-100/70'
                }`}
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
          <div className={`text-xs py-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
            Process completed with exit code 0 (no output).
          </div>
        )}

        {/* Standard Output */}
        {result.stdout && (
          <div>
            <span className={`text-xs uppercase font-heading font-bold tracking-wider block mb-1.5 ${
              isDarkMode ? 'text-gray-400' : 'text-slate-600'
            }`}>
              Standard Output:
            </span>
            <pre className={`p-3 rounded whitespace-pre-wrap leading-relaxed font-mono text-[13px] border ${
              isDarkMode ? 'text-gray-200 bg-[#18191d] border-[#262832]' : 'text-slate-900 bg-slate-50 border-slate-200 shadow-sm'
            }`}>
              {result.stdout}
            </pre>
          </div>
        )}

        {/* Standard Error */}
        {result.stderr && (
          <div>
            <span className={`text-xs uppercase font-heading font-bold tracking-wider block mb-1.5 ${
              isDarkMode ? 'text-rose-400' : 'text-rose-700'
            }`}>
              Standard Error:
            </span>
            <pre className={`p-3 rounded whitespace-pre-wrap leading-relaxed font-mono text-[13px] border ${
              isDarkMode ? 'text-rose-300 bg-rose-950/20 border-rose-900/40' : 'text-rose-900 bg-rose-50 border-rose-200 shadow-sm'
            }`}>
              {result.stderr}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
