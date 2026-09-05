'use client';

import React, { useState } from 'react';
import { Settings, Shield, Megaphone, Power, X, Send } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[#14151e] border border-[#2b2e40] rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#242634] pb-3">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-bold text-sm text-gray-100">
              Admin Control Center
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e202c] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Classroom Settings */}
        <div className="space-y-2 text-xs">
          {/* Student-to-Student Collab */}
          <div className="p-3 bg-[#191b24] border border-[#262834] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="font-semibold text-gray-200 block">Student Collaboration</span>
              <span className="text-gray-400 text-[11px] block">Allow participants to collaborate via mutual consent</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ userToUserCollaboration: !settings.userToUserCollaboration })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 p-0.5 ${
                settings.userToUserCollaboration ? 'bg-[#ff9100]' : 'bg-[#2a2d3c]'
              }`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.userToUserCollaboration ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Code Execution */}
          <div className="p-3 bg-[#191b24] border border-[#262834] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="font-semibold text-gray-200 block">Cloud Code Execution</span>
              <span className="text-gray-400 text-[11px] block">Allow students to run code in cloud sandboxes</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ codeExecutionEnabled: !settings.codeExecutionEnabled })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 p-0.5 ${
                settings.codeExecutionEnabled ? 'bg-[#ff9100]' : 'bg-[#2a2d3c]'
              }`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.codeExecutionEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* File Downloads */}
          <div className="p-3 bg-[#191b24] border border-[#262834] rounded-xl flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="font-semibold text-gray-200 block">File Downloads</span>
              <span className="text-gray-400 text-[11px] block">Allow downloading authorized code files</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSettings({ fileDownloadsAllowed: !settings.fileDownloadsAllowed })}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 p-0.5 ${
                settings.fileDownloadsAllowed ? 'bg-[#ff9100]' : 'bg-[#2a2d3c]'
              }`}
            >
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                settings.fileDownloadsAllowed ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Room Announcement */}
        <form onSubmit={handleSendAnnouncement} className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
            <Megaphone className="w-3.5 h-3.5 text-[#ff9100]" />
            <span>Broadcast Announcement</span>
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Send message to all students..."
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              className="flex-1 bg-[#191b24] border border-[#2b2d38] rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-[#ff9100]"
            />
            <button
              type="submit"
              disabled={!announcement.trim()}
              className="px-3.5 py-2 rounded-xl bg-[#ff9100] hover:bg-[#e08000] text-black font-bold text-xs disabled:opacity-50 transition flex items-center space-x-1"
            >
              <Send className="w-3 h-3" />
              <span>Send</span>
            </button>
          </div>
        </form>

        {/* End Session */}
        <div className="pt-2 border-t border-[#242634]">
          {!confirmEnd ? (
            <button
              onClick={() => setConfirmEnd(true)}
              className="w-full py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 text-xs font-bold transition flex items-center justify-center space-x-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              <span>End Classroom Session</span>
            </button>
          ) : (
            <div className="p-3 bg-rose-950/60 border border-rose-800/60 rounded-xl space-y-2 text-xs text-center">
              <p className="text-rose-200 font-medium">End classroom and disconnect all users?</p>
              <div className="flex justify-center space-x-2">
                <button
                  type="button"
                  onClick={() => setConfirmEnd(false)}
                  className="px-4 py-1.5 rounded-lg bg-[#20222e] text-gray-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onEndClassroom}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                >
                  Confirm End
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
