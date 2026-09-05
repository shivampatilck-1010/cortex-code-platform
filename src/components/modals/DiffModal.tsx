'use client';

import React from 'react';
import { Sparkles, Check, X, Undo2, AlertTriangle, ArrowRight } from 'lucide-react';
import { AIFixResult } from '@/lib/ai/assistant';

interface DiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  fixResult: AIFixResult | null;
  onApplyFix: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export const DiffModal: React.FC<DiffModalProps> = ({
  isOpen,
  onClose,
  fixResult,
  onApplyFix,
  onUndo,
  canUndo,
}) => {
  if (!isOpen || !fixResult) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#18191e] border border-[#2f323e] rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-xs font-mono">
        {/* Header */}
        <div className="px-4 py-3 bg-[#14151a] border-b border-[#252830] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[#ff9100]">
            <Sparkles className="w-4 h-4" />
            <span className="font-heading font-black text-sm text-white">Review Code Changes</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#20222a] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnosis Summary Banner */}
        <div className="px-4 py-2.5 bg-[#171820] border-b border-[#252830] space-y-1">
          <div className="flex items-center space-x-2 text-amber-300 font-heading font-bold text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Cause: {fixResult.cause}</span>
          </div>
          <p className="text-gray-300 text-xs leading-relaxed pl-5">
            {fixResult.explanation}
          </p>
        </div>

        {/* Diff Content View */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="bg-[#0b0c0e] border border-[#22242e] rounded p-3 text-[13px] leading-relaxed font-mono overflow-x-auto divide-y divide-[#1e2025]">
            {fixResult.diffChanges.map((part, index) => {
              const color = part.added
                ? 'bg-emerald-950/40 text-emerald-300 border-l-4 border-emerald-500 pl-2'
                : part.removed
                ? 'bg-rose-950/40 text-rose-300 border-l-4 border-rose-500 pl-2 line-through'
                : 'text-gray-400 pl-2';
              return (
                <div key={index} className={`py-1 whitespace-pre-wrap ${color}`}>
                  {part.value}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 py-3 bg-[#14151a] border-t border-[#252830] flex items-center justify-between">
          <div>
            {canUndo && (
              <button
                onClick={onUndo}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-[#20222a] hover:bg-[#2a2c38] text-gray-300 hover:text-white font-heading font-semibold text-xs transition"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo Previous Fix</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded bg-[#1e2028] hover:bg-[#282a36] text-gray-400 hover:text-white font-heading font-semibold text-xs transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApplyFix();
                onClose();
              }}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold text-xs shadow transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply Fix</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
