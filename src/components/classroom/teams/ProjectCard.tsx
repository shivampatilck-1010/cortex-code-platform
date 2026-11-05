'use client';

import React from 'react';
import { 
  Users, 
  Lock, 
  ExternalLink, 
  Palette, 
  Shield, 
  ChevronRight, 
  UserPlus, 
  UserMinus,
  Clock
} from 'lucide-react';
import { ThemePresetId, ProjectTeamMember, TeamThemePolicy } from '@/lib/classroom/models';
import { THEME_PRESETS } from './theme-presets';

export interface GalleryProjectCardData {
  id: string;
  name: string;
  project_title: string;
  description: string | null;
  theme_preset_id: string;
  status: string;
  max_size: number;
  repo_url: string | null;
  member_count: number;
  is_locked: boolean;
  created_at: number;
  updated_at: number;
  members: ProjectTeamMember[];
}

interface ProjectCardProps {
  card: GalleryProjectCardData;
  currentUserId: string;
  currentUserRole: string;
  themePolicy: TeamThemePolicy;
  onOpenDetails: (team: GalleryProjectCardData) => void;
  onOpenThemeStudio: (team: GalleryProjectCardData) => void;
  onJoinTeam?: (teamId: string) => void;
  onLeaveTeam?: (teamId: string) => void;
  canJoin?: boolean;
}

export function ProjectCard({
  card,
  currentUserId,
  currentUserRole,
  themePolicy,
  onOpenDetails,
  onOpenThemeStudio,
  onJoinTeam,
  onLeaveTeam,
  canJoin,
}: ProjectCardProps) {
  const presetId = (card.theme_preset_id as ThemePresetId) || 'cortex_signature';
  const theme = THEME_PRESETS[presetId] || THEME_PRESETS.cortex_signature;

  // Determine membership of current user
  const currentMember = card.members.find((m) => m.userId === currentUserId);
  const isMember = Boolean(currentMember);
  const isLeader = currentMember?.teamRole === 'leader';
  const isTeacherOrAdmin = currentUserRole === 'teacher' || currentUserRole === 'admin';

  // Determine theme customization permission
  let canCustomizeTheme = false;
  if (isTeacherOrAdmin) {
    canCustomizeTheme = true;
  } else if (themePolicy === 'approval_required' && isMember) {
    canCustomizeTheme = true;
  } else if (themePolicy === 'team_leader' && isLeader) {
    canCustomizeTheme = true;
  }

  // Format status badge
  const formatStatus = (s: string) => {
    switch (s.toLowerCase()) {
      case 'forming':
        return { label: 'Forming', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'in_progress':
      case 'active':
        return { label: 'Active', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
      case 'submitted':
        return { label: 'Submitted', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
      case 'completed':
        return { label: 'Completed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'archived':
        return { label: 'Archived', bg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
      default:
        return { label: s, bg: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' };
    }
  };

  const statusStyle = formatStatus(card.status);
  const isFull = card.member_count >= card.max_size;

  const getInitials = (name?: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div
      className={`group relative rounded-xl border p-5 flex flex-col justify-between overflow-hidden transition-all duration-200 hover:shadow-xl ${theme.cardBg} ${theme.cardBorder}`}
    >
      {/* Dynamic theme accent gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.headerGradient} pointer-events-none opacity-40 group-hover:opacity-75 transition`}
      />

      {/* Top Header Row */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusStyle.bg}`}
            >
              {statusStyle.label}
            </span>
            <span
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText}`}
            >
              {theme.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#8A8F98]">
            {card.is_locked ? (
              <span className="flex items-center gap-1 text-amber-400 text-[11px] font-mono">
                <Lock className="w-3 h-3" />
                Locked
              </span>
            ) : (
              <span className={`text-[11px] font-mono ${isFull ? 'text-amber-400' : 'text-[#8A8F98]'}`}>
                {card.member_count} / {card.max_size} members
              </span>
            )}
          </div>
        </div>

        {/* Title and Team Name */}
        <div className="mb-3">
          <h3 className="text-base font-bold text-white group-hover:text-white transition line-clamp-1">
            {card.project_title || 'Untitled Project'}
          </h3>
          <p className="text-xs text-[#A0A0A0] font-mono mt-0.5 flex items-center gap-1.5">
            <span>{card.name}</span>
            {isMember && (
              <span className="text-[10px] bg-[#FF9100]/20 text-[#FF9100] px-1.5 py-0.2 rounded font-sans">
                {isLeader ? 'You (Leader)' : 'You (Member)'}
              </span>
            )}
          </p>
        </div>

        {/* Description */}
        <p className="text-xs text-[#8A8F98] line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
          {card.description || 'No project description provided yet.'}
        </p>

        {/* Repository Link (if present) */}
        {card.repo_url && (
          <div className="mb-3">
            <a
              href={card.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-[#A0A0A0] hover:text-[#FF9100] transition font-mono bg-black/30 px-2 py-1 rounded border border-white/5"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="truncate max-w-[220px]">{card.repo_url.replace(/^https?:\/\//, '')}</span>
            </a>
          </div>
        )}

        {/* Members Roster Stack */}
        <div className="pt-3 border-t border-white/5 flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="flex -space-x-2 overflow-hidden">
              {card.members.slice(0, 4).map((member) => (
                <div
                  key={member.id}
                  title={`${member.userName || member.userId} (${member.teamRole})`}
                  className={`relative w-7 h-7 rounded-full border border-[#17181F] flex items-center justify-center text-[10px] font-semibold text-white ${
                    member.teamRole === 'leader'
                      ? 'bg-[#FF9100]/30 text-[#FF9100] ring-1 ring-[#FF9100]/50'
                      : 'bg-[#282A36]'
                  }`}
                >
                  {getInitials(member.userName)}
                  {member.teamRole === 'leader' && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#FF9100] text-black flex items-center justify-center">
                      <Shield className="w-2 h-2" />
                    </div>
                  )}
                </div>
              ))}
              {card.members.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-[#1C1E26] border border-[#282A36] flex items-center justify-center text-[10px] text-[#8A8F98] font-mono">
                  +{card.members.length - 4}
                </div>
              )}
            </div>

            {card.members.length === 0 && (
              <span className="text-xs text-[#666] italic flex items-center gap-1">
                <Users className="w-3 h-3" />
                No members assigned
              </span>
            )}
          </div>

          <div className="text-[11px] text-[#666] flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3" />
            {new Date(card.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 pt-2 flex items-center justify-between border-t border-white/5 gap-2">
        <div className="flex items-center gap-1.5">
          {canCustomizeTheme && (
            <button
              type="button"
              onClick={() => onOpenThemeStudio(card)}
              title="Open Theme Studio"
              className="p-1.5 rounded-lg text-[#8A8F98] hover:text-[#FF9100] hover:bg-white/5 transition flex items-center gap-1 text-xs"
            >
              <Palette className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Theme</span>
            </button>
          )}

          {isMember && onLeaveTeam && (
            <button
              type="button"
              onClick={() => onLeaveTeam(card.id)}
              title="Leave this team"
              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition flex items-center gap-1 text-[11px]"
            >
              <UserMinus className="w-3 h-3" />
              <span>Leave</span>
            </button>
          )}

          {!isMember && canJoin && !card.is_locked && !isFull && onJoinTeam && (
            <button
              type="button"
              onClick={() => onJoinTeam(card.id)}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition flex items-center gap-1 text-[11px] font-medium"
            >
              <UserPlus className="w-3 h-3" />
              <span>Join</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onOpenDetails(card)}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium transition flex items-center gap-1 group/btn border border-white/10"
        >
          <span>Workspace</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#8A8F98] group-hover/btn:translate-x-0.5 transition" />
        </button>
      </div>
    </div>
  );
}
