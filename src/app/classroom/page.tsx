'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { ClassroomLobbyModal } from '@/components/classroom/ClassroomLobbyModal';
import { Users, Shield, Zap, Handshake, Scale, ArrowLeft } from 'lucide-react';

export default function ClassroomHubPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(true);

  const handleCreateRoom = async (adminName: string) => {
    const res = await fetch('/api/v1/classroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        name: adminName,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create classroom room');
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`cortex_participant_${data.roomId}`, data.participantId);
      localStorage.setItem(`cortex_name_${data.roomId}`, data.participantName);
      localStorage.setItem(`cortex_role_${data.roomId}`, data.role);
    }

    return data;
  };

  const handleJoinRoom = async (roomId: string, name: string) => {
    const res = await fetch('/api/v1/classroom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'join',
        roomId,
        name,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to join classroom room');
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`cortex_participant_${data.roomId}`, data.participantId);
      localStorage.setItem(`cortex_name_${data.roomId}`, data.participantName);
      localStorage.setItem(`cortex_role_${data.roomId}`, data.role);
    }

    router.push(`/classroom/${data.roomId}`);
  };

  return (
    <div className="min-h-screen w-screen bg-[#0b0c0e] text-gray-200 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="h-14 bg-[#111216] border-b border-[#1f2026] px-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center group transition" title="Return to IDE">
            <CortexLogo variant="header" size="sm" />
          </Link>
          <span className="text-gray-600">/</span>
          <span className="font-heading font-bold text-xs text-[#ff9100]">Classroom Arena</span>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1a1c22] transition"
          >
            IDE
          </Link>
          <Link
            href="/compare"
            className="px-3 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-[#1a1c22] transition"
          >
            Benchmark
          </Link>
        </div>
      </header>

      {/* Hero Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[#ff9100]/10 border border-[#ff9100]/30 flex items-center justify-center text-[#ff9100] shadow-lg">
          <Users className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-heading font-bold text-white tracking-tight">
            Cortex Collaborative Classroom
          </h1>
          <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
            Large-scale real-time coding classroom with Admin controls, mutual collaboration, side-by-side dual workspace monitor, and algorithm benchmarking.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left w-full max-w-2xl text-xs pt-2">
          <div className="p-3.5 bg-[#14151b] border border-[#242634] rounded-xl space-y-1">
            <div className="flex items-center space-x-2 text-cyan-400 font-semibold">
              <Scale className="w-4 h-4" />
              <span>Two-Workspace Model</span>
            </div>
            <p className="text-gray-400 text-[11px]">
              High browser performance: only two workspaces rendered at once, supporting classrooms up to 100+ users.
            </p>
          </div>

          <div className="p-3.5 bg-[#14151b] border border-[#242634] rounded-xl space-y-1">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
              <Handshake className="w-4 h-4" />
              <span>Mutual Permission</span>
            </div>
            <p className="text-gray-400 text-[11px]">
              Private workspaces by default. Collaboration and file downloads require explicit mutual authorization.
            </p>
          </div>

          <div className="p-3.5 bg-[#14151b] border border-[#242634] rounded-xl space-y-1">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold">
              <Shield className="w-4 h-4" />
              <span>Admin Authority</span>
            </div>
            <p className="text-gray-400 text-[11px]">
              Full classroom governance: monitor any student, lock workspaces, control code runs, and compare solutions.
            </p>
          </div>
        </div>

        <div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-2.5 rounded-xl bg-[#ff9100] hover:bg-[#e08000] text-black font-heading font-bold text-sm shadow-xl transition active:scale-95"
          >
            Open Classroom Portal
          </button>
        </div>
      </main>

      {/* Lobby Modal */}
      <ClassroomLobbyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    </div>
  );
}
