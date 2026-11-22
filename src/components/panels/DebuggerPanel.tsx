'use client';

import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowRight, 
  ArrowDown, 
  ArrowUp, 
  Plus, 
  Trash2, 
  CircleDot,
  Layers,
  Variable,
  Eye
} from 'lucide-react';

interface DebuggerPanelProps {
  isDebugging: boolean;
  onStartDebug: () => void;
  onStopDebug: () => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onResume: () => void;
  breakpoints: number[];
  onToggleBreakpoint: (line: number) => void;
  activeLine?: number;
  variables?: Record<string, any>;
  callStack?: Array<{ name: string; file: string; line: number }>;
  isDarkMode?: boolean;
}

export const DebuggerPanel: React.FC<DebuggerPanelProps> = ({
  isDebugging,
  onStartDebug,
  onStopDebug,
  onStepOver,
  onStepInto,
  onStepOut,
  onResume,
  breakpoints,
  onToggleBreakpoint,
  activeLine,
  variables = {},
  callStack = [],
  isDarkMode = true,
}) => {
  const [watchExpressions, setWatchExpressions] = useState<string[]>([]);
  const [newWatch, setNewWatch] = useState('');

  const handleAddWatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWatch.trim()) return;
    setWatchExpressions((prev) => [...prev, newWatch.trim()]);
    setNewWatch('');
  };

  const handleRemoveWatch = (expr: string) => {
    setWatchExpressions((prev) => prev.filter((w) => w !== expr));
  };

  return (
    <div className={`h-full flex flex-col text-xs font-mono select-text overflow-hidden transition-colors duration-200 ${
      isDarkMode ? 'bg-[#141518] text-gray-200' : 'bg-white text-slate-800'
    }`}>
      {/* Debugger Control Bar */}
      <div className={`px-3.5 py-2 border-b flex items-center justify-between transition-colors duration-200 ${
        isDarkMode ? 'bg-[#101114] border-[#1f2024]' : 'bg-slate-100 border-slate-200'
      }`}>
        <div className="flex items-center space-x-1.5">
          {!isDebugging ? (
            <button
              onClick={onStartDebug}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-slate-950 rounded font-heading font-bold text-xs transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Debugger</span>
            </button>
          ) : (
            <>
              <button
                onClick={onResume}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-sm"
                title="Continue (F5)"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                onClick={onStepOver}
                className={`p-1.5 rounded transition ${
                  isDarkMode ? 'bg-[#252830] hover:bg-[#30333d] text-gray-200 hover:text-white' : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm'
                }`}
                title="Step Over (F10)"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onStepInto}
                className={`p-1.5 rounded transition ${
                  isDarkMode ? 'bg-[#252830] hover:bg-[#30333d] text-gray-200 hover:text-white' : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm'
                }`}
                title="Step Into (F11)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onStepOut}
                className={`p-1.5 rounded transition ${
                  isDarkMode ? 'bg-[#252830] hover:bg-[#30333d] text-gray-200 hover:text-white' : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-sm'
                }`}
                title="Step Out (Shift+F11)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onStopDebug}
                className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded shadow-sm"
                title="Stop Debugging"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
          {isDebugging && activeLine && (
            <span className="text-amber-500 font-heading font-bold">Paused on line {activeLine}</span>
          )}
        </div>
      </div>

      {/* Main Debugger Views (Call Stack, Variables, Breakpoints) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Variables Inspector */}
        <div>
          <div className={`flex items-center space-x-1.5 font-heading font-bold mb-1.5 text-xs ${
            isDarkMode ? 'text-gray-200' : 'text-slate-900'
          }`}>
            <Variable className="w-3.5 h-3.5 text-[#ff9100]" />
            <span>Variables</span>
          </div>
          <div className={`rounded p-2.5 space-y-1.5 border ${
            isDarkMode ? 'bg-[#18191d] border-[#282a33]' : 'bg-slate-50 border-slate-200 shadow-sm'
          }`}>
            {Object.entries(variables).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{k}:</span>
                <span className={`font-mono ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Watch Expressions */}
        <div>
          <div className={`flex items-center justify-between font-heading font-bold mb-1.5 text-xs ${
            isDarkMode ? 'text-gray-200' : 'text-slate-900'
          }`}>
            <div className="flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-[#ff9100]" />
              <span>Watch Expressions</span>
            </div>
          </div>
          <div className={`rounded p-2.5 space-y-2 border ${
            isDarkMode ? 'bg-[#18191d] border-[#282a33]' : 'bg-slate-50 border-slate-200 shadow-sm'
          }`}>
            {(watchExpressions?.length ?? 0) === 0 && (
              <p className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>No expressions being watched. Add one below.</p>
            )}
            {(watchExpressions || []).map((expr) => (
              <div key={expr} className="flex items-center justify-between text-xs">
                <span className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>{expr}:</span>
                <div className="flex items-center space-x-2">
                  <span className={`font-mono ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {String(variables[expr.trim()] ?? variables[expr] ?? 'undefined')}
                  </span>
                  <button onClick={() => handleRemoveWatch(expr)} className={`${isDarkMode ? 'text-gray-500 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'}`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            <form onSubmit={handleAddWatch} className={`flex items-center space-x-1 pt-1.5 border-t ${
              isDarkMode ? 'border-[#262832]' : 'border-slate-200'
            }`}>
              <input
                type="text"
                value={newWatch}
                onChange={(e) => setNewWatch(e.target.value)}
                placeholder="+ Expression to watch..."
                className={`w-full px-2.5 py-1 rounded text-xs border focus:outline-none focus:border-[#ff9100] ${
                  isDarkMode ? 'bg-[#121316] text-gray-200 border-[#2d303b]' : 'bg-white text-slate-800 border-slate-200 shadow-sm'
                }`}
              />
            </form>
          </div>
        </div>

        {/* Call Stack */}
        <div>
          <div className={`flex items-center space-x-1.5 font-heading font-bold mb-1.5 text-xs ${
            isDarkMode ? 'text-gray-200' : 'text-slate-900'
          }`}>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Call Stack</span>
          </div>
          <div className={`rounded divide-y border ${
            isDarkMode ? 'bg-[#18191d] border-[#282a33] divide-[#262832]' : 'bg-slate-50 border-slate-200 divide-slate-200 shadow-sm'
          }`}>
            {(callStack || []).map((frame, idx) => (
              <div key={idx} className={`p-2.5 flex items-center justify-between text-xs transition ${
                isDarkMode ? 'hover:bg-[#1f2128]' : 'hover:bg-slate-100'
              }`}>
                <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-slate-900'}`}>{frame.name}</span>
                <span className={`font-mono ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{frame.file}:{frame.line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Breakpoints List */}
        <div>
          <div className={`flex items-center space-x-1.5 font-heading font-bold mb-1.5 text-xs ${
            isDarkMode ? 'text-gray-200' : 'text-slate-900'
          }`}>
            <CircleDot className="w-3.5 h-3.5 text-rose-500" />
            <span>Breakpoints ({(breakpoints?.length ?? 0)})</span>
          </div>
          {(breakpoints?.length ?? 0) === 0 ? (
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              No breakpoints set. Click the editor gutter to toggle.
            </p>
          ) : (
            <div className={`rounded divide-y border ${
              isDarkMode ? 'bg-[#18191d] border-[#282a33] divide-[#262832]' : 'bg-slate-50 border-slate-200 divide-slate-200 shadow-sm'
            }`}>
              {(breakpoints || []).map((line) => (
                <div key={line} className="p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    <span className={isDarkMode ? 'text-gray-200' : 'text-slate-800'}>Line {line}</span>
                  </div>
                  <button
                    onClick={() => onToggleBreakpoint(line)}
                    className={`${isDarkMode ? 'text-gray-500 hover:text-rose-400' : 'text-slate-400 hover:text-rose-600'}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
