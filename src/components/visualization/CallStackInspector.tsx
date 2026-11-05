'use client';

import React from 'react';
import { CallStackFrame } from '@/lib/visualization/types';
import { Layers } from 'lucide-react';

interface CallStackInspectorProps {
  callStack: CallStackFrame[];
}

export const CallStackInspector: React.FC<CallStackInspectorProps> = ({ callStack }) => {
  if (!callStack || callStack.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center text-[#71717A]">
        <Layers className="w-7 h-7 mb-1.5 opacity-30" />
        <p className="text-xs font-mono">Module scope (root level execution)</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {callStack.map((frame, idx) => {
        const isTop = idx === callStack.length - 1;
        return (
          <div
            key={idx}
            className={`flex items-center justify-between px-3 py-1.5 rounded font-mono text-xs border ${
              isTop
                ? 'bg-[#FF9100]/10 border-[#FF9100]/40 text-white font-semibold'
                : 'bg-[#15161C] border-[#22242D] text-[#71717A]'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${isTop ? 'bg-[#FF9100] animate-pulse' : 'bg-[#71717A]/40'}`} />
              <span className={isTop ? 'text-white' : 'text-[#A1A1AA]'}>
                {frame.name}()
              </span>
            </div>
            <span className="text-[10px] text-[#71717A]">
              {frame.file}:{frame.line}
            </span>
          </div>
        );
      })}
    </div>
  );
};
