'use client';

import React, { useState } from 'react';
import { Handshake, Check, X, Loader2 } from 'lucide-react';
import { CollaborationRequest } from '@/lib/classroom/types';

interface CollaborationPromptModalProps {
  request: CollaborationRequest | null;
  onAccept: (requestId: string, fromId?: string) => Promise<void> | void;
  onDecline: (requestId: string, fromId?: string) => Promise<void> | void;
  onDismiss?: (requestId: string, fromId?: string) => void;
}

export const CollaborationPromptModal: React.FC<CollaborationPromptModalProps> = ({
  request,
  onAccept,
  onDecline,
  onDismiss,
}) => {
  const [isResponding, setIsResponding] = useState<'accept' | 'decline' | null>(null);

  if (!request) return null;

  const handleDecline = async () => {
    if (isResponding) return;
    setIsResponding('decline');
    try {
      await onDecline(request.id, request.fromId);
    } catch (e) {
      console.error('Error declining request:', e);
    } finally {
      setIsResponding(null);
    }
  };

  const handleAccept = async () => {
    if (isResponding) return;
    setIsResponding('accept');
    try {
      await onAccept(request.id, request.fromId);
    } catch (e) {
      console.error('Error accepting request:', e);
    } finally {
      setIsResponding(null);
    }
  };

  const handleDismiss = () => {
    if (isResponding) return;
    if (onDismiss) {
      onDismiss(request.id, request.fromId);
    } else {
      handleDecline();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      <div className="bg-[#14151e] border border-[#2b2e40] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in zoom-in-95 duration-200 relative">
        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isResponding !== null}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20222f] transition disabled:opacity-40"
          title="Dismiss Request"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Avatar */}
        <div className="relative mx-auto w-14 h-14 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner">
            <Handshake className="w-7 h-7" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h3 className="font-heading font-bold text-base text-white">
            Collaboration Request
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            <strong className="text-[#ff9100] font-semibold">{request.fromName}</strong> wants to collaborate with you on this code.
          </p>
          <p className="text-[11px] text-gray-400">
            Accepting connects your workspaces in real-time synchronized mode.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding !== null}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#1e202c] hover:bg-[#282a3c] text-gray-300 text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center space-x-1.5 active:scale-95"
          >
            {isResponding === 'decline' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                <span>Declining...</span>
              </>
            ) : (
              <span>Decline</span>
            )}
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={isResponding !== null}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-heading font-bold shadow-lg shadow-emerald-900/30 transition flex items-center justify-center space-x-1.5 disabled:opacity-50 active:scale-95"
          >
            {isResponding === 'accept' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Allow Access</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
