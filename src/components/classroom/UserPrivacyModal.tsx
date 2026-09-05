'use client';

import React from 'react';
import { Shield, Eye, Lock, Handshake, Download, X } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#14151a] border border-[#2d303f] rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 select-none">
        <div className="flex items-center justify-between border-b border-[#242632] pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#ff9100]" />
            <h3 className="font-heading font-bold text-sm text-gray-100">
              My Workspace Privacy
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Workspace Visibility */}
          <div className="space-y-1.5 bg-[#191b22] p-3 rounded-lg border border-[#262834]">
            <span className="font-semibold text-gray-200 block">Workspace Visibility</span>
            <div className="space-y-1 pt-1">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="private"
                  checked={privacy.workspaceVisibility === 'private'}
                  onChange={() => onUpdatePrivacy({ workspaceVisibility: 'private' })}
                  className="accent-[#ff9100]"
                />
                <span className="text-gray-300">Private (Requires permission to view)</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value="public"
                  checked={privacy.workspaceVisibility === 'public'}
                  onChange={() => onUpdatePrivacy({ workspaceVisibility: 'public' })}
                  className="accent-[#ff9100]"
                />
                <span className="text-gray-300">Open to Classroom (Classroom users can inspect)</span>
              </label>
            </div>
          </div>

          {/* Collaboration Toggle */}
          <div className="flex items-center justify-between bg-[#191b22] p-3 rounded-lg border border-[#262834]">
            <div>
              <span className="font-semibold text-gray-200 block">Incoming Collaboration</span>
              <span className="text-gray-400 text-[11px]">Allow other users to send collaboration requests.</span>
            </div>
            <input
              type="checkbox"
              checked={privacy.allowCollaboration}
              onChange={(e) => onUpdatePrivacy({ allowCollaboration: e.target.checked })}
              className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
            />
          </div>

          {/* Download Permission Toggle */}
          <div className="flex items-center justify-between bg-[#191b22] p-3 rounded-lg border border-[#262834]">
            <div>
              <span className="font-semibold text-gray-200 block">Require Download Approval</span>
              <span className="text-gray-400 text-[11px]">Always require your consent before another user can download your code.</span>
            </div>
            <input
              type="checkbox"
              checked={privacy.requireDownloadPermission}
              onChange={(e) => onUpdatePrivacy({ requireDownloadPermission: e.target.checked })}
              className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-[#ff9100] hover:bg-[#e08000] text-black font-bold text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
