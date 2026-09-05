'use client';

import React from 'react';
import { Download, Check, ShieldCheck, X } from 'lucide-react';
import { FileDownloadRequest, FileDownloadDecision } from '@/lib/classroom/types';

interface FileDownloadModalProps {
  request: FileDownloadRequest | null;
  onRespond: (requestId: string, decision: FileDownloadDecision) => void;
}

export const FileDownloadModal: React.FC<FileDownloadModalProps> = ({
  request,
  onRespond,
}) => {
  if (!request) return null;

  return (
    <div className="fixed top-14 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300 select-none">
      <div className="bg-[#14151c]/95 backdrop-blur-md border border-cyan-500/60 ring-2 ring-cyan-500/20 rounded-xl shadow-2xl shadow-black/90 p-4 space-y-3">
        {/* Header with live pulse */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
            </span>

            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Download className="w-4 h-4" />
            </div>

            <div>
              <h4 className="font-heading font-bold text-xs text-white tracking-wide">
                File Download Request
              </h4>
              <p className="text-[10.5px] text-gray-400">Read-Only File Access</p>
            </div>
          </div>

          <button
            onClick={() => onRespond(request.id, 'denied')}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#20222e] transition"
            title="Deny request"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Message body */}
        <div className="p-2.5 bg-[#0f1015] border border-[#232534] rounded-lg text-xs text-gray-200 space-y-1">
          <div>
            <span className="font-semibold text-cyan-400">{request.requesterName}</span> requests a copy of:
            <span className="font-mono text-[11px] text-white block bg-[#161720] px-2 py-1 rounded border border-[#2b2d3d] mt-1 truncate">
              📄 {request.fileName}
            </span>
          </div>
          <p className="text-gray-400 text-[10.5px] mt-1 leading-snug">
            Grants a read-only local download copy. Your original file cannot be modified.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-1.5 pt-0.5">
          <button
            onClick={() => onRespond(request.id, 'denied')}
            className="px-2.5 py-1 rounded bg-[#1f212c] hover:bg-rose-950/40 text-rose-300 border border-rose-900/30 text-xs font-medium transition flex items-center space-x-1"
          >
            <X className="w-3 h-3" />
            <span>Deny</span>
          </button>

          <button
            onClick={() => onRespond(request.id, 'allow_once')}
            className="px-2.5 py-1 rounded bg-[#1f212c] hover:bg-[#2c2f40] text-gray-200 border border-[#2f3244] text-xs font-medium transition flex items-center space-x-1"
          >
            <Check className="w-3 h-3 text-cyan-400" />
            <span>Allow Once</span>
          </button>

          <button
            onClick={() => onRespond(request.id, 'allow_session')}
            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-heading font-bold shadow-md transition flex items-center space-x-1 active:scale-95"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Allow Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
