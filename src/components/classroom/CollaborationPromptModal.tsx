'use client';

import React from 'react';
import { Handshake, Check, X } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#14151e] border border-[#2b2e40] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
          <Handshake className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="font-heading font-bold text-base text-white">
            Collaboration Request
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            <strong className="text-[#ff9100] font-semibold">{request.fromName}</strong> wants to collaborate with you on this code.
          </p>
          <p className="text-[11px] text-gray-500">
            Accepting connects your workspaces in live synchronized mode.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={() => onDecline(request.id)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#1e202c] hover:bg-[#282a3c] text-gray-300 text-xs font-semibold transition"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onAccept(request.id)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-heading font-bold shadow-lg shadow-emerald-900/30 transition flex items-center justify-center space-x-1.5 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Allow Access</span>
          </button>
        </div>
      </div>
    </div>
  );
};
