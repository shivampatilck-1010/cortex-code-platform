'use client';

import React from 'react';
import { Handshake, Check, X, ShieldAlert } from 'lucide-react';
import { CollaborationRequest } from '@/lib/classroom/types';

interface CollaborationPromptModalProps {
  request: CollaborationRequest | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
}

export const CollaborationPromptModal: React.FC<CollaborationPromptModalProps> = ({
  request,
  onAccept,
  onDecline,
}) => {
  if (!request) return null;

  return (
    <div className="fixed top-14 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300 select-none">
      <div className="bg-[#14151c]/95 backdrop-blur-md border border-[#ff9100]/60 ring-2 ring-[#ff9100]/20 rounded-xl shadow-2xl shadow-black/90 p-4 space-y-3">
        {/* Header with live pulsing alert */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff9100] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ff9100]"></span>
            </span>

            <div className="w-7 h-7 rounded-lg bg-[#ff9100]/15 border border-[#ff9100]/40 flex items-center justify-center text-[#ff9100]">
              <Handshake className="w-4 h-4" />
            </div>

            <div>
              <h4 className="font-heading font-bold text-xs text-white tracking-wide">
                Workspace Access Request
              </h4>
              <p className="text-[10.5px] text-gray-400">Collaboration &amp; View Permission</p>
            </div>
          </div>

          <button
            onClick={() => onDecline(request.id)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#20222e] transition"
            title="Dismiss request"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message body */}
        <div className="p-2.5 bg-[#0f1015] border border-[#232534] rounded-lg text-xs text-gray-200">
          <span className="font-semibold text-[#ff9100]">{request.fromName}</span> requested access to view and collaborate on your code.
          <p className="text-gray-400 text-[10.5px] mt-1 leading-snug">
            Accepting initiates a synchronized session. Your original workspace remains protected.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-0.5">
          <button
            onClick={() => onDecline(request.id)}
            className="px-3 py-1.5 rounded-lg bg-[#1f212c] hover:bg-[#2a2d3d] text-gray-300 text-xs font-medium transition flex items-center space-x-1"
          >
            <X className="w-3 h-3" />
            <span>Decline</span>
          </button>
          <button
            onClick={() => onAccept(request.id)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-heading font-bold shadow-md transition flex items-center space-x-1 active:scale-95"
          >
            <Check className="w-3 h-3" />
            <span>Allow Access</span>
          </button>
        </div>
      </div>
    </div>
  );
};
