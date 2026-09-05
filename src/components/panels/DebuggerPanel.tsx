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
    <div className="h-full flex flex-col bg-[#141518] text-xs font-mono select-text overflow-hidden">
      {/* Debugger Control Bar */}
      <div className="px-3.5 py-2 bg-[#101114] border-b border-[#1f2024] flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          {!isDebugging ? (
            <button
              onClick={onStartDebug}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] rounded font-heading font-bold text-xs transition shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Debugger</span>
            </button>
          ) : (
            <>
              <button
                onClick={onResume}
                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded"
                title="Continue (F5)"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
              <button
                onClick={onStepOver}
                className="p-1.5 bg-[#252830] hover:bg-[#30333d] text-gray-200 hover:text-white rounded"
                title="Step Over (F10)"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onStepInto}
                className="p-1.5 bg-[#252830] hover:bg-[#30333d] text-gray-200 hover:text-white rounded"
                title="Step Into (F11)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onStepOut}
                className="p-1.5 bg-[#252830] hover:bg-[#30333d] text-gray-200 hover:text-white rounded"
                title="Step Out (Shift+F11)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onStopDebug}
                className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded"
                title="Stop Debugging"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="text-xs text-gray-400">
          {isDebugging && activeLine && (
            <span className="text-amber-400 font-heading font-bold">Paused on line {activeLine}</span>
          )}
        </div>
      </div>

      {/* Main Debugger Views (Call Stack, Variables, Breakpoints) */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Variables Inspector */}
        <div>
          <div className="flex items-center space-x-1.5 text-gray-200 font-heading font-bold mb-1.5 text-xs">
            <Variable className="w-3.5 h-3.5 text-[#ff9100]" />
            <span>Variables</span>
          </div>
          <div className="bg-[#18191d] border border-[#282a33] rounded p-2.5 space-y-1.5">
            {Object.entries(variables).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-gray-300 font-semibold">{k}:</span>
                <span className="text-amber-300 font-mono">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Watch Expressions */}
        <div>
          <div className="flex items-center justify-between text-gray-200 font-heading font-bold mb-1.5 text-xs">
            <div className="flex items-center space-x-1.5">
              <Eye className="w-3.5 h-3.5 text-[#ff9100]" />
              <span>Watch Expressions</span>
            </div>
          </div>
          <div className="bg-[#18191d] border border-[#282a33] rounded p-2.5 space-y-2">
            {watchExpressions.length === 0 && (
              <p className="text-gray-500 text-xs italic">No expressions being watched. Add one below.</p>
            )}
            {watchExpressions.map((expr) => (
              <div key={expr} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{expr}:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-400 font-mono">
                    {String(variables[expr.trim()] ?? variables[expr] ?? 'undefined')}
                  </span>
                  <button onClick={() => handleRemoveWatch(expr)} className="text-gray-500 hover:text-rose-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
            <form onSubmit={handleAddWatch} className="flex items-center space-x-1 pt-1.5 border-t border-[#262832]">
              <input
                type="text"
                value={newWatch}
                onChange={(e) => setNewWatch(e.target.value)}
                placeholder="+ Expression to watch..."
                className="w-full bg-[#121316] text-gray-200 px-2.5 py-1 rounded text-xs border border-[#2d303b] focus:outline-none focus:border-[#ff9100]"
              />
            </form>
          </div>
        </div>

        {/* Call Stack */}
        <div>
          <div className="flex items-center space-x-1.5 text-gray-200 font-heading font-bold mb-1.5 text-xs">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>Call Stack</span>
          </div>
          <div className="bg-[#18191d] border border-[#282a33] rounded divide-y divide-[#262832]">
            {callStack.map((frame, idx) => (
              <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                <span className="text-gray-200 font-semibold">{frame.name}</span>
                <span className="text-gray-400 font-mono">{frame.file}:{frame.line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Breakpoints List */}
        <div>
          <div className="flex items-center space-x-1.5 text-gray-200 font-heading font-bold mb-1.5 text-xs">
            <CircleDot className="w-3.5 h-3.5 text-rose-500" />
            <span>Breakpoints ({breakpoints.length})</span>
          </div>
          {breakpoints.length === 0 ? (
            <p className="text-gray-400 text-xs">
              No breakpoints set. Click the editor gutter to toggle.
            </p>
          ) : (
            <div className="bg-[#18191d] border border-[#282a33] rounded divide-y divide-[#262832]">
              {breakpoints.map((line) => (
                <div key={line} className="p-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    <span className="text-gray-200">Line {line}</span>
                  </div>
                  <button
                    onClick={() => onToggleBreakpoint(line)}
                    className="text-gray-500 hover:text-rose-400"
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
