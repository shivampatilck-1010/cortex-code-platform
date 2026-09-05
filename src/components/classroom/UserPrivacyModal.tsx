'use client';

import React from 'react';
import { Shield, Eye, Lock, X } from 'lucide-react';
import { UserPrivacySettings } from '@/lib/classroom/types';

interface UserPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  privacy: UserPrivacySettings;
  onUpdatePrivacy: (privacy: Partial<UserPrivacySettings>) => void;
}

export const UserPrivacyModal: React.FC<UserPrivacyModalProps> = ({
  isOpen,
  onClose,
  privacy,
  onUpdatePrivacy,
}) => {
  if (!isOpen) return null;

  const safePrivacy: UserPrivacySettings = privacy || {
    workspaceVisibility: 'public',
    allowCollaboration: true,
    requireDownloadPermission: false,
  };

  const isPublic = safePrivacy.workspaceVisibility === 'public';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[#14151e] border border-[#2b2e40] rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#242634] pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#ff9100]/15 border border-[#ff9100]/30 flex items-center justify-center text-[#ff9100]">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-bold text-sm text-gray-100">
              Workspace Privacy Settings
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e202c] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Simple Toggle Cards */}
        <div className="space-y-2.5 text-xs">
          {/* Workspace Visibility */}
          <div className="p-3.5 bg-[#191b24] border border-[#262834] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="font-semibold text-gray-200 block">
                {isPublic ? 'Public Workspace' : 'Private Workspace'}
              </span>
              <span className="text-gray-400 text-[11px] block">
                {isPublic ? 'Classroom participants can inspect your code' : 'Other users must ask permission to view your code'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePrivacy({ workspaceVisibility: isPublic ? 'private' : 'public' })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 flex-shrink-0 ${
                isPublic
                  ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-600/20 border border-amber-500/40 text-amber-300'
              }`}
            >
              {isPublic ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{isPublic ? 'Public' : 'Private'}</span>
            </button>
          </div>

          {/* Incoming Collaboration */}
          <div className="p-3.5 bg-[#191b24] border border-[#262834] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="font-semibold text-gray-200 block">Allow Collaboration Requests</span>
              <span className="text-gray-400 text-[11px] block">Let other students request to pair code with you</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePrivacy({ allowCollaboration: !safePrivacy.allowCollaboration })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 p-0.5 ${
                safePrivacy.allowCollaboration ? 'bg-[#ff9100]' : 'bg-[#2a2d3c]'
              }`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                safePrivacy.allowCollaboration ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Download Permission */}
          <div className="p-3.5 bg-[#191b24] border border-[#262834] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-3">
              <span className="font-semibold text-gray-200 block">Require Download Approval</span>
              <span className="text-gray-400 text-[11px] block">Require your consent before anyone downloads your file</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdatePrivacy({ requireDownloadPermission: !safePrivacy.requireDownloadPermission })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 p-0.5 ${
                safePrivacy.requireDownloadPermission ? 'bg-[#ff9100]' : 'bg-[#2a2d3c]'
              }`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                safePrivacy.requireDownloadPermission ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Done Button */}
        <div className="pt-1 flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#ff9100] hover:bg-[#e08000] text-black font-heading font-bold text-xs shadow-md transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
