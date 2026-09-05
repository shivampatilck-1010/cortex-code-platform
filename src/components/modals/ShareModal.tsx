'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Globe, Lock, EyeOff, Share2 } from 'lucide-react';
import { CortexLogo } from '@/components/brand/CortexLogo';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  projectName = 'Cortex Cloud IDE Project',
}) => {
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');

  if (!isOpen) return null;

  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/project/shared-${Math.random().toString(36).substring(2, 8)}`
    : 'https://cortex-ide.dev/project/shared-demo';

  const embedSnippet = `<iframe src="${shareUrl}?embed=true" width="100%" height="500" frameborder="0" sandbox="allow-scripts allow-same-origin"></iframe>`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141518] border border-[#282a34] rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="px-4 py-3 bg-[#18191e] border-b border-[#252830] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 text-gray-200">
            <CortexLogo variant="icon" size="sm" />
            <span className="font-bold text-sm text-white">Share Project</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#252834]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Visibility Controls */}
          <div>
            <label className="text-gray-400 text-[11px] block mb-2 font-semibold">Project Visibility:</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'public', label: 'Public', icon: Globe },
                { id: 'unlisted', label: 'Unlisted', icon: EyeOff },
                { id: 'private', label: 'Private', icon: Lock },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setVisibility(item.id as any)}
                    className={`flex items-center justify-center space-x-1.5 p-2 rounded border transition ${
                      visibility === item.id
                        ? 'border-[#ff9100] bg-[#ff9100]/10 text-[#ff9100] font-semibold'
                        : 'border-[#2e313d] bg-[#141518] text-gray-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Share Link */}
          <div>
            <label className="text-gray-400 text-[11px] block mb-1 font-semibold">Shareable Link:</label>
            <div className="flex items-center space-x-1 bg-[#121316] border border-[#2e313d] rounded p-1.5">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-transparent text-gray-200 text-xs font-mono px-1 focus:outline-none"
              />
              <button
                onClick={() => handleCopy(shareUrl)}
                className="px-3 py-1 bg-[#ff9100] hover:bg-[#e08000] text-[#0b0c0e] font-heading font-bold text-xs rounded flex items-center space-x-1.5 transition shadow-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Embed Snippet */}
          <div>
            <label className="text-gray-400 text-[11px] block mb-1 font-semibold">Embed Code in Docs / Blog:</label>
            <textarea
              readOnly
              rows={3}
              value={embedSnippet}
              className="w-full bg-[#121316] border border-[#2e313d] rounded p-2 text-[10px] font-mono text-gray-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#1e2028] border-t border-[#2a2c36] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1 rounded bg-[#252830] text-gray-300 hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
