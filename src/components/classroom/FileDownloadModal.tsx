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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#14151a] border border-[#2d303f] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 select-none">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-gray-100">
              File Download Request
            </h3>
            <p className="text-xs text-gray-400">Owner authorization required</p>
          </div>
        </div>

        <div className="p-3.5 bg-[#1a1c24] border border-[#282a36] rounded-lg text-xs text-gray-200 space-y-2">
          <div>
            <strong className="text-cyan-400">{request.requesterName}</strong> wants to download a copy of:
            <div className="mt-1 font-mono font-bold text-white bg-[#101115] px-2.5 py-1.5 rounded border border-[#262832]">
              📄 {request.fileName}
            </div>
          </div>
          <p className="text-gray-400 text-[11px] leading-relaxed">
            Downloading gives the requester a read-only local copy. They will <strong>never</strong> receive write or delete access to your original file.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
          <button
            onClick={() => onRespond(request.id, 'denied')}
            className="px-3 py-1.5 rounded-lg bg-[#20222b] hover:bg-rose-900/40 text-rose-300 border border-[#2e313d] text-xs font-medium transition flex items-center justify-center space-x-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Deny</span>
          </button>

          <button
            onClick={() => onRespond(request.id, 'allow_once')}
            className="px-3.5 py-1.5 rounded-lg bg-[#20222b] hover:bg-[#282a36] text-gray-200 border border-[#2e313d] text-xs font-medium transition flex items-center justify-center space-x-1"
          >
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            <span>Allow Once</span>
          </button>

          <button
            onClick={() => onRespond(request.id, 'allow_session')}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-heading font-bold shadow transition flex items-center justify-center space-x-1"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Allow For This Session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
