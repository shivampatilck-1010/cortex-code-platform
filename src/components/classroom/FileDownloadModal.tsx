'use client';

import React from 'react';
import { Download, Check, X, FileCode } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-[#14151e] border border-[#2b2e40] rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-inner">
          <Download className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="font-heading font-bold text-base text-white">
            File Download Request
          </h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            <strong className="text-cyan-400 font-semibold">{request.requesterName}</strong> wants to download your file:
          </p>
          <div className="bg-[#191b24] border border-[#2b2d3d] rounded-lg px-3 py-2 text-xs font-mono text-gray-200 flex items-center justify-center space-x-2">
            <FileCode className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="truncate">{request.fileName}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            type="button"
            onClick={() => onRespond(request.id, 'denied')}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#1e202c] hover:bg-[#282a3c] text-gray-300 text-xs font-semibold transition"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onRespond(request.id, 'allow_once')}
            className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-heading font-bold shadow-lg shadow-cyan-900/30 transition flex items-center justify-center space-x-1.5 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Allow Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
