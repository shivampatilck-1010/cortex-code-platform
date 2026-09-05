'use client';

import React, { useState } from 'react';
import { 
  Users, 
  Crown, 
  Copy, 
  Check, 
  QrCode, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck,
  X
} from 'lucide-react';

interface ClassroomLobbyModalProps {
  isOpen: boolean;
  onClose?: () => void;
  defaultRoomId?: string;
  onCreateRoom: (adminName: string) => Promise<any>;
  onJoinRoom: (roomId: string, name: string) => Promise<any>;
  onEnterRoom?: (roomId: string) => void;
}

export const ClassroomLobbyModal: React.FC<ClassroomLobbyModalProps> = ({
  isOpen,
  onClose,
  defaultRoomId = '',
  onCreateRoom,
  onJoinRoom,
  onEnterRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'join' | 'create'>(defaultRoomId ? 'join' : 'join');
  
  // Join form
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [userName, setUserName] = useState('');
  
  // Create form
  const [adminName, setAdminName] = useState('');

  // Result state
  const [createdInfo, setCreatedInfo] = useState<{ roomId: string; inviteUrl: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await onCreateRoom(adminName.trim());
      setCreatedInfo({
        roomId: res.roomId,
        inviteUrl: res.inviteUrl,
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to create classroom');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !userName.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      await onJoinRoom(roomId.trim(), userName.trim());
    } catch (err: any) {
      setError(err?.message || 'Failed to join classroom');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in select-none">
      <div className="bg-[#121318] border border-[#262834] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#20222d] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ff9100]/10 border border-[#ff9100]/30 flex items-center justify-center text-[#ff9100]">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-gray-100">
                Cortex Classroom
              </h2>
              <p className="text-xs text-gray-400">Collaborative Coding &amp; Workspace Arena</p>
            </div>
          </div>

          {onClose && (
            <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tab Toggle (Join vs Create) */}
        {!createdInfo && (
          <div className="flex border-b border-[#20222d] bg-[#0e0f13] text-xs font-heading font-semibold">
            <button
              type="button"
              onClick={() => { setActiveTab('join'); setError(null); }}
              className={`flex-1 py-3 text-center transition ${
                activeTab === 'join'
                  ? 'text-[#ff9100] border-b-2 border-[#ff9100] bg-[#14151b]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Join Classroom
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('create'); setError(null); }}
              className={`flex-1 py-3 text-center transition flex items-center justify-center space-x-1.5 ${
                activeTab === 'create'
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-[#14151b]'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Create (Admin)</span>
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-lg text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Success Created Screen */}
          {createdInfo ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-heading font-bold text-gray-100">
                  Classroom Created Successfully!
                </h3>
                <p className="text-xs text-gray-400">Share the invite link or Room ID with your students.</p>
              </div>

              {/* Room ID & Link Cards */}
              <div className="space-y-2.5 bg-[#171920] p-4 rounded-xl border border-[#262834]">
                <div>
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Room ID:</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono font-bold text-base text-[#ff9100] tracking-wider">
                      {createdInfo.roomId}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdInfo.roomId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 1500);
                      }}
                      className="px-2.5 py-1 rounded bg-[#22242f] hover:bg-[#2c2f3d] text-xs text-gray-200 transition flex items-center space-x-1"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#242633]">
                  <span className="text-[11px] text-gray-400 font-semibold block uppercase">Invite Link:</span>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-xs text-gray-300 truncate mr-2">
                      {createdInfo.inviteUrl}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdInfo.inviteUrl);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 1500);
                      }}
                      className="px-2.5 py-1 rounded bg-[#ff9100] hover:bg-[#e08000] text-xs font-bold text-black transition flex items-center space-x-1 flex-shrink-0"
                    >
                      {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#242633] flex justify-between items-center text-xs text-gray-400">
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="flex items-center space-x-1 hover:text-gray-200 transition"
                  >
                    <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{showQR ? 'Hide QR Code' : 'Show QR Code'}</span>
                  </button>
                </div>

                {showQR && (
                  <div className="p-3 bg-white rounded-lg flex flex-col items-center justify-center mx-auto w-40 h-40 mt-2">
                    {/* Clean SVG QR Placeholder */}
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <rect width="100" height="100" fill="white" />
                      <rect x="10" y="10" width="30" height="30" fill="black" />
                      <rect x="15" y="15" width="20" height="20" fill="white" />
                      <rect x="20" y="20" width="10" height="10" fill="black" />
                      <rect x="60" y="10" width="30" height="30" fill="black" />
                      <rect x="65" y="15" width="20" height="20" fill="white" />
                      <rect x="70" y="20" width="10" height="10" fill="black" />
                      <rect x="10" y="60" width="30" height="30" fill="black" />
                      <rect x="15" y="65" width="20" height="20" fill="white" />
                      <rect x="20" y="70" width="10" height="10" fill="black" />
                      <rect x="50" y="50" width="10" height="10" fill="black" />
                      <rect x="65" y="65" width="20" height="10" fill="black" />
                      <rect x="75" y="80" width="15" height="10" fill="black" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (createdInfo) {
                      if (onEnterRoom) {
                        onEnterRoom(createdInfo.roomId);
                      } else {
                        window.location.href = `/classroom/${createdInfo.roomId}`;
                      }
                    }
                    if (onClose) onClose();
                  }}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-bold text-xs transition shadow-md"
                >
                  Enter Classroom Arena →
                </button>
              </div>
            </div>
          ) : activeTab === 'join' ? (
            /* Join Form */
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 block">Classroom Room ID</label>
                <input
                  type="text"
                  placeholder="e.g. CORTEX-7K92"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-[#171920] border border-[#2b2d39] rounded-lg text-xs font-mono font-bold text-[#ff9100] placeholder-gray-600 focus:outline-none focus:border-[#ff9100]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 block">Your Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shivam"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#171920] border border-[#2b2d39] rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#ff9100]"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !roomId.trim() || !userName.trim()}
                className="w-full py-2.5 rounded-lg bg-[#ff9100] hover:bg-[#e08000] text-black font-heading font-bold text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <span>{isLoading ? 'Joining Room...' : 'Join Classroom'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* Create Form */
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300 block">Your Name (Admin)</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Sharma"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#171920] border border-[#2b2d39] rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-400"
                  required
                />
                <span className="text-[11px] text-gray-400">
                  You will have full classroom management access and workspace monitoring privileges.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !adminName.trim()}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-[#ff9100] hover:from-amber-400 hover:to-[#ffa229] text-black font-heading font-bold text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Generating Room...' : 'Create Classroom'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
