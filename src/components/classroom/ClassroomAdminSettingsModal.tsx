'use client';

import React, { useState } from 'react';
import { Settings, Shield, Megaphone, Power, X } from 'lucide-react';
import { ClassroomSettings } from '@/lib/classroom/types';

interface ClassroomAdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ClassroomSettings;
  onUpdateSettings: (settings: Partial<ClassroomSettings>) => void;
  onBroadcastAnnouncement: (text: string) => void;
  onEndClassroom: () => void;
}

export const ClassroomAdminSettingsModal: React.FC<ClassroomAdminSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onBroadcastAnnouncement,
  onEndClassroom,
}) => {
  const [announcement, setAnnouncement] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (!isOpen) return null;

  const handleSendAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    onBroadcastAnnouncement(announcement.trim());
    setAnnouncement('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-[#14151a] border border-[#2d303f] rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-5 select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#242632] pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="font-heading font-bold text-sm text-gray-100">
              Admin Classroom Control Center
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Classroom Settings */}
        <div className="space-y-3">
          <h4 className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider">
            Classroom Policy &amp; Security
          </h4>

          <div className="space-y-2 bg-[#191b22] p-3 rounded-lg border border-[#262834] text-xs">
            {/* User-to-User Collab */}
            <div className="flex items-center justify-between py-1 border-b border-[#242632]">
              <div>
                <span className="font-semibold text-gray-200 block">User-to-User Collaboration</span>
                <span className="text-gray-400 text-[11px]">Allow participants to collaborate via mutual permission.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.userToUserCollaboration}
                onChange={(e) => onUpdateSettings({ userToUserCollaboration: e.target.checked })}
                className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
              />
            </div>

            {/* Code Execution */}
            <div className="flex items-center justify-between py-1 border-b border-[#242632]">
              <div>
                <span className="font-semibold text-gray-200 block">Cloud Code Execution</span>
                <span className="text-gray-400 text-[11px]">Allow students to compile and run code in isolated sandboxes.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.codeExecutionEnabled}
                onChange={(e) => onUpdateSettings({ codeExecutionEnabled: e.target.checked })}
                className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
              />
            </div>

            {/* File Downloads */}
            <div className="flex items-center justify-between py-1">
              <div>
                <span className="font-semibold text-gray-200 block">File Downloads</span>
                <span className="text-gray-400 text-[11px]">Allow downloading authorized code files.</span>
              </div>
              <input
                type="checkbox"
                checked={settings.fileDownloadsAllowed}
                onChange={(e) => onUpdateSettings({ fileDownloadsAllowed: e.target.checked })}
                className="w-4 h-4 rounded accent-[#ff9100] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Room Announcement */}
        <form onSubmit={handleSendAnnouncement} className="space-y-2">
          <h4 className="text-xs font-heading font-bold text-gray-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Megaphone className="w-3.5 h-3.5 text-[#ff9100]" />
            <span>Room-Wide Announcement</span>
          </h4>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Type an announcement to all students..."
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="flex-1 bg-[#181920] border border-[#2b2d38] rounded-md px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-[#ff9100]"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-[#ff9100] hover:bg-[#e08000] text-black font-bold text-xs transition"
            >
              Broadcast
            </button>
          </div>
        </form>

        {/* End Classroom Session */}
        <div className="pt-2 border-t border-[#242632] space-y-2">
          {!confirmEnd ? (
            <button
              onClick={() => setConfirmEnd(true)}
              className="w-full py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-bold transition flex items-center justify-center space-x-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              <span>End Classroom Session</span>
            </button>
          ) : (
            <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-lg space-y-2 text-xs">
              <p className="text-rose-200 font-semibold">
                Are you sure you want to end this classroom session? All participants will be disconnected gracefully.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setConfirmEnd(false)}
                  className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={onEndClassroom}
                  className="px-4 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                >
                  Confirm &amp; End
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
