'use client';

import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Crown, 
  Lock, 
  Unlock, 
  Play, 
  RotateCcw, 
  UserMinus, 
  Handshake, 
  Download,
  Eye,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { ClassroomParticipant, ClassroomRole } from '@/lib/classroom/types';

interface UserListPanelProps {
  participants: Record<string, ClassroomParticipant>;
  currentUserId: string;
  currentUserRole: ClassroomRole;
  slotAUserId?: string;
  slotBUserId?: string;
  onSelectSlotA: (userId: string) => void;
  onSelectSlotB: (userId: string) => void;
  onRequestCollaboration: (targetUserId: string) => void;
  onRequestFileDownload: (ownerId: string, fileId: string) => void;
  onAdminAction: (action: any) => void;
  onOpenPrivacyModal?: () => void;
}

export const UserListPanel: React.FC<UserListPanelProps> = ({
  participants,
  currentUserId,
  currentUserRole,
  slotAUserId,
  slotBUserId,
  onSelectSlotA,
  onSelectSlotB,
  onRequestCollaboration,
  onRequestFileDownload,
  onAdminAction,
  onOpenPrivacyModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const participantList = Object.values(participants)
    .filter((p) => p && p.id && p.name && p.name !== 'Classroom Host')
    .sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (b.role === 'admin' && a.role !== 'admin') return 1;
      if (a.id === currentUserId) return -1;
      if (b.id === currentUserId) return 1;
      return a.name.localeCompare(b.name);
    });
  const totalUsers = participantList.length;
  const onlineCount = participantList.filter((p) => p.online).length;
  const codingCount = participantList.filter((p) => p.online && p.status === 'coding').length;

  const filtered = participantList.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.currentLanguage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-[#111216] border-r border-[#1f2026] text-gray-200 select-none">
      {/* 1. Header & Live Stats */}
      <div className="p-3 border-b border-[#1f2026] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#ff9100]" />
            <span className="font-heading font-bold text-xs tracking-wider uppercase text-gray-200">
              Classroom Users
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-[#181a20] border border-[#2b2d38] text-[11px] font-mono text-emerald-400 font-bold">
            {onlineCount}/{totalUsers} Online
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
          <input
            type="text"
            placeholder="Search users or language..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#16171d] text-xs text-gray-200 placeholder-gray-500 border border-[#262832] rounded-md focus:outline-none focus:border-[#ff9100] transition"
          />
        </div>

        {/* Mini stats */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 px-1">
          <span>Active coding: <strong className="text-gray-200">{codingCount}</strong></span>
          {onOpenPrivacyModal && (
            <button
              onClick={onOpenPrivacyModal}
              className="hover:text-[#ff9100] transition flex items-center space-x-1"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>My Privacy</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Virtualized / Scrollable User Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-transparent">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-500">
            No users match &ldquo;{searchTerm}&rdquo;
          </div>
        ) : (
          filtered.map((user) => {
            const isSelf = user.id === currentUserId;
            const isAdmin = user.role === 'admin';
            const isSlotA = slotAUserId === user.id;
            const isSlotB = slotBUserId === user.id;

            return (
              <div
                key={user.id}
                className={`p-2.5 rounded-lg border transition space-y-2 ${
                  isSlotA
                    ? 'bg-cyan-950/20 border-cyan-500/40'
                    : isSlotB
                    ? 'bg-purple-950/20 border-purple-500/40'
                    : 'bg-[#15161c] hover:bg-[#1a1c24] border-[#22242e]'
                }`}
              >
                {/* User Info Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    {/* Presence Dot */}
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        user.online
                          ? user.status === 'coding'
                            ? 'bg-emerald-400 animate-pulse'
                            : 'bg-emerald-400'
                          : 'bg-gray-600'
                      }`}
                      title={user.online ? `Online (${user.status})` : 'Offline'}
                    />

                    {/* Name */}
                    <span className="font-heading font-semibold text-xs text-gray-200 truncate">
                      {user.name}
                    </span>

                    {/* Admin or Self Tag */}
                    {isAdmin && (
                      <span className="flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[9.5px] font-bold border border-amber-500/30">
                        <Crown className="w-2.5 h-2.5" />
                        <span>Admin</span>
                      </span>
                    )}
                    {isSelf && (
                      <span className="text-[9.5px] text-gray-400 font-mono">
                        (You)
                      </span>
                    )}
                  </div>

                  {/* Slot Indicators */}
                  <div className="flex items-center space-x-1">
                    {isSlotA && (
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-cyan-900/60 text-cyan-300 border border-cyan-500/40">
                        Slot A
                      </span>
                    )}
                    {isSlotB && (
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-purple-900/60 text-purple-300 border border-purple-500/40">
                        Slot B
                      </span>
                    )}
                  </div>
                </div>

                {/* Sub-info: Language & Active file */}
                <div className="flex items-center justify-between text-[10.5px] text-gray-400">
                  <span className="font-mono text-gray-300 capitalize">
                    {user.currentLanguage || 'python'} • {user.activeFileName || 'main.py'}
                  </span>
                  <span className="capitalize text-[10px] text-gray-500">
                    {user.online ? user.status : 'offline'}
                  </span>
                </div>

                {/* Action Controls */}
                <div className="flex items-center justify-between pt-1 border-t border-[#20222a] text-xs">
                  {/* Slot Selection Buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onSelectSlotA(user.id)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition ${
                        isSlotA
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-[#20222b] hover:bg-[#282a36] text-gray-300'
                      }`}
                      title="Display in Workspace A"
                    >
                      A
                    </button>
                    <button
                      onClick={() => onSelectSlotB(user.id)}
                      className={`px-2 py-0.5 rounded text-[10.5px] font-medium transition ${
                        isSlotB
                          ? 'bg-purple-600 text-white font-bold'
                          : 'bg-[#20222b] hover:bg-[#282a36] text-gray-300'
                      }`}
                      title="Display in Workspace B"
                    >
                      B
                    </button>
                  </div>

                  {/* Collaboration & File Download */}
                  <div className="flex items-center space-x-1">
                    {!isSelf && (
                      <button
                        onClick={() => onRequestCollaboration(user.id)}
                        className="p-1 rounded bg-[#20222b] hover:bg-[#ff9100]/20 hover:text-[#ff9100] text-gray-300 transition"
                        title={`Request mutual collaboration with ${user.name}`}
                      >
                        <Handshake className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!isSelf && user.files && user.files.length > 0 && (
                      <button
                        onClick={() => onRequestFileDownload(user.id, user.files[0].id)}
                        className="p-1 rounded bg-[#20222b] hover:bg-cyan-500/20 hover:text-cyan-300 text-gray-300 transition"
                        title={`Request download of ${user.files[0].name}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Admin Moderation Controls */}
                    {currentUserRole === 'admin' && !isSelf && (
                      <>
                        <button
                          onClick={() =>
                            onAdminAction({
                              type: user.isLocked ? 'unlock_user' : 'lock_user',
                              targetUserId: user.id,
                            })
                          }
                          className={`p-1 rounded transition ${
                            user.isLocked
                              ? 'bg-amber-900/40 text-amber-300'
                              : 'bg-[#20222b] hover:bg-amber-500/20 text-gray-400'
                          }`}
                          title={user.isLocked ? 'Unlock Workspace' : 'Lock Workspace'}
                        >
                          {user.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() =>
                            onAdminAction({
                              type: 'reset_workspace',
                              targetUserId: user.id,
                            })
                          }
                          className="p-1 rounded bg-[#20222b] hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 transition"
                          title="Reset Workspace"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setConfirmRemoveId(user.id)}
                          className="p-1 rounded bg-[#20222b] hover:bg-rose-900/60 text-gray-400 hover:text-rose-400 transition"
                          title="Remove user from classroom"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Confirm Remove Dialog */}
                {confirmRemoveId === user.id && (
                  <div className="mt-2 p-2 bg-rose-950/40 border border-rose-800/40 rounded text-[11px] space-y-1.5 animate-in fade-in">
                    <p className="text-rose-300 font-medium">Remove {user.name} from classroom?</p>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 text-[10px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onAdminAction({ type: 'remove_user', targetUserId: user.id });
                          setConfirmRemoveId(null);
                        }}
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
