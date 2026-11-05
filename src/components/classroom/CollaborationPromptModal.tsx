'use client';

import React, { useState, useEffect } from 'react';
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
  const [timeLeft, setTimeLeft] = useState(30);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (!request) {
      setTimeLeft(30);
      return;
    }
    setTimeLeft(30);
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          if (onDismiss) onDismiss(request.id, request.fromId);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [request?.id]);

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
    <div className="fixed bottom-20 right-5 z-50 max-w-sm w-full animate-in slide-in-from-right-5 fade-in duration-300 pointer-events-auto select-none">
      <div className="bg-[#14151e]/97 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-[0_8px_40px_rgba(16,185,129,0.15)] p-4 space-y-3 relative overflow-hidden">
        {/* Countdown progress bar */}
        <div className="absolute top-0 left-0 h-0.5 bg-emerald-500/80 transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / 30) * 100}%` }} />

        {/* Dismiss (X) */}
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isResponding !== null}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-[#737373] hover:text-white hover:bg-[#20222f] transition disabled:opacity-40"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Header Row */}
        <div className="flex items-center space-x-3 pr-6">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-heading font-bold text-sm text-white leading-tight">
              Collaboration Request
            </h4>
            <p className="text-xs text-[#A3A3A3] mt-0.5 leading-snug">
              <strong className="text-[#ff9100] font-semibold">{request.fromName}</strong> wants to collaborate
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDecline}
            disabled={isResponding !== null}
            className="flex-1 py-2 px-3 rounded-xl bg-[#1a1b28] hover:bg-[#282a3c] text-[#A3A3A3] hover:text-white text-xs font-semibold transition disabled:opacity-50 flex items-center justify-center space-x-1.5 active:scale-95 border border-[#2b2e40]"
          >
            {isResponding === 'decline' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#737373]" />
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
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-heading font-bold shadow-lg shadow-emerald-900/30 transition flex items-center justify-center space-x-1.5 disabled:opacity-50 active:scale-95"
          >
            {isResponding === 'accept' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Allow Access</span>
              </>
            )}
          </button>
        </div>

        {/* Timer hint */}
        <p className="text-[10px] text-[#555] text-center">Auto-dismisses in {timeLeft}s</p>
      </div>
    </div>
  );
};
