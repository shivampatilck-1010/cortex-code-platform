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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#14151a] border border-[#2d303f] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 select-none">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Handshake className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-gray-100">
              Collaboration Request
            </h3>
            <p className="text-xs text-gray-400">Mutual consent required</p>
          </div>
        </div>

        <div className="p-3 bg-[#1a1c24] border border-[#282a36] rounded-lg text-xs text-gray-200">
          <strong className="text-[#ff9100]">{request.fromName}</strong> would like to collaborate with you in a temporary shared session.
          <p className="text-gray-400 text-[11px] mt-1.5">
            Both of you will be able to write and edit code together in real time. Your original individual workspace will be preserved.
          </p>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-1">
          <button
            onClick={() => onDecline(request.id)}
            className="px-4 py-1.5 rounded-lg bg-[#20222b] hover:bg-[#282a36] text-gray-300 text-xs font-medium transition flex items-center space-x-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>
          <button
            onClick={() => onAccept(request.id)}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-heading font-bold shadow transition flex items-center space-x-1"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Accept &amp; Collaborate</span>
          </button>
        </div>
      </div>
    </div>
  );
};
