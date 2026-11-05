import React from 'react';
import Link from 'next/link';
import { CortexLogo } from '@/components/brand/CortexLogo';
import { useClassroom } from '@/context/ClassroomContext';
import { useFollowTeacher } from '@/context/FollowTeacherContext';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Settings, 
  Eye, 
  Compass, 
  UserCheck, 
  Crown,
  Users,
  Maximize2,
  Minimize2
} from 'lucide-react';

export const ClassroomHeader: React.FC = () => {
  const { 
    session, 
    userRole, 
    connectionStatus, 
    setIsSettingsOpen, 
    participants,
    isParticipantsOpen,
    setIsParticipantsOpen,
    isFullscreen,
    toggleFullscreen,
    exitFullscreen,
  } = useClassroom();

  const { followMode, teacherActivity } = useFollowTeacher();

  return (
    <header className="h-14 bg-bg-surface border-b border-border-subtle px-4 flex items-center justify-between select-none z-20 shrink-0">
      {/* Brand Identity & Global Breadcrumbs */}
      <div className="flex items-center space-x-3 min-w-0">
        <Link
          href="/"
          onClick={() => { exitFullscreen().catch(() => {}); }}
          className="flex items-center group transition"
          title="Return to IDE"
        >
          <CortexLogo variant="header" size="sm" />
        </Link>

        {/* Global Navigation Breadcrumbs */}
        <div className="flex items-center space-x-1.5 text-xs font-heading">
          <span className="text-gray-600">/</span>
          <Link
            href="/"
            onClick={() => { exitFullscreen().catch(() => {}); }}
            className="text-gray-400 hover:text-white transition"
          >
            IDE
          </Link>
          <span className="text-gray-600">/</span>
          <Link
            href="/classroom"
            onClick={() => { exitFullscreen().catch(() => {}); }}
            className="text-gray-400 hover:text-[#FF9100] transition"
            title="Return to Classroom Lobby"
          >
            Classroom
          </Link>
          <span className="text-gray-600">/</span>
          <span className="font-mono font-bold text-xs text-[#FF9100] tracking-wider truncate max-w-[120px]" title={session.title}>
            {session.courseCode || session.id}
          </span>
        </div>

        <div className="h-4 w-px bg-border-subtle mx-1 hidden sm:block" />

        {/* Title, Session Status & Participant Roster Indicator */}
        <div className="hidden md:flex flex-col min-w-0 max-w-xs lg:max-w-md truncate">
          <span className="text-xs font-medium text-text-main truncate" title={session.title}>
            {session.title}
          </span>
          <div className="flex items-center space-x-2 text-[10px] text-text-muted">
            <span className="inline-flex items-center space-x-1 text-[#10B981]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>Active Session</span>
            </span>
            <span>•</span>
            <button
              onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
              className="inline-flex items-center space-x-1 text-text-muted hover:text-white transition"
              title="Click to view participant roster"
            >
              <Users className="w-3 h-3 text-[#A855F7]" />
              <span>{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Center: Realtime Broadcast / Follow Teacher Status */}
      <div className="hidden md:flex items-center space-x-2 whitespace-nowrap">
        {userRole === 'teacher' ? (
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[#FF9100]/10 border border-[#FF9100]/30 text-[#FF9100] text-xs font-medium shadow-glow-primary">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span className="tracking-wide">Broadcasting Surface</span>
            <span className="text-[10px] font-mono opacity-80 uppercase px-1 rounded bg-[#FF9100]/20">
              {teacherActivity.module}
            </span>
          </div>
        ) : followMode === 'following' ? (
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-medium">
            <Eye className="w-3.5 h-3.5" />
            <span>Following Teacher</span>
            <span className="text-[10px] font-mono opacity-80 uppercase px-1 rounded bg-[#10B981]/20">
              {teacherActivity.module}
            </span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/40 text-[#EAB308] text-xs">
            <Compass className="w-3.5 h-3.5 text-[#EAB308]" />
            <span className="font-medium">Independent Mode</span>
          </div>
        )}
      </div>

      {/* Right: Authenticated Role Indicator, Connection State & Settings */}
      <div className="flex items-center space-x-3">
        {/* Connection status badge */}
        <div 
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary border border-border-subtle text-[11px]"
          title={`Connection: ${connectionStatus}`}
        >
          {connectionStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <Wifi className="w-3 h-3 text-[#10B981]" />
              <span className="text-text-secondary hidden lg:inline">Connected</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <WifiOff className="w-3 h-3 text-[#EF4444]" />
              <span className="text-[#EF4444]">Reconnecting</span>
            </>
          )}
        </div>

        {/* Verified User Role Indicator (Derived strictly from session authentication) */}
        {userRole === 'teacher' ? (
          <div 
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 text-xs font-semibold text-[#FF9100]"
            title="Authenticated Session Role: Instructor"
          >
            <Crown className="w-3.5 h-3.5 text-[#FF9100]" />
            <span>Instructor</span>
          </div>
        ) : (
          <div 
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-bg-secondary border border-border text-xs text-[#A1A1AA]"
            title="Authenticated Session Role: Student"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Student</span>
          </div>
        )}

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className={`p-1.5 rounded-lg border transition focus-ring ${
            isFullscreen
              ? 'bg-[#FF9100]/20 border-[#FF9100]/40 text-[#FF9100]'
              : 'bg-bg-secondary hover:bg-bg-tertiary border-border-subtle text-text-secondary hover:text-text-main'
          }`}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#FF9100]" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Hardware Audio & Video Device Settings */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 rounded-lg bg-bg-secondary hover:bg-bg-tertiary border border-border-subtle text-text-secondary hover:text-text-main transition focus-ring"
          title="Audio & Video Settings"
          aria-label="Audio and Video Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
