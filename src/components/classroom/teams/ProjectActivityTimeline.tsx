'use client';

import React from 'react';
import { 
  Activity, 
  Users, 
  Palette, 
  Settings, 
  UserPlus, 
  UserMinus, 
  ShieldCheck, 
  Archive, 
  Sparkles,
  RefreshCw,
  Clock
} from 'lucide-react';
import { ProjectActivityRecord } from '@/lib/classroom/models';

interface ProjectActivityTimelineProps {
  activity: ProjectActivityRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function ProjectActivityTimeline({
  activity,
  isLoading,
  onRefresh,
}: ProjectActivityTimelineProps) {
  const getActionMeta = (eventType: string) => {
    switch (eventType) {
      case 'TEAM_CREATED':
        return {
          icon: Users,
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          title: 'Project Team Created',
        };
      case 'MEMBERS_AUTO_ASSIGNED':
        return {
          icon: Sparkles,
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
          title: 'Automated Team Balancing Executed',
        };
      case 'MEMBER_ADDED':
        return {
          icon: UserPlus,
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          title: 'Student Assigned to Team',
        };
      case 'MEMBER_REMOVED':
        return {
          icon: UserMinus,
          color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
          title: 'Member Removed from Team',
        };
      case 'MEMBER_ROLE_UPDATED':
        return {
          icon: ShieldCheck,
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          title: 'Team Member Role Updated',
        };
      case 'THEME_UPDATED':
        return {
          icon: Palette,
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
          title: 'Theme Studio Preset Changed',
        };
      case 'SETTINGS_UPDATED':
        return {
          icon: Settings,
          color: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
          title: 'Formation Settings Modified',
        };
      case 'TEAM_ARCHIVED':
        return {
          icon: Archive,
          color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
          title: 'Project Team Archived',
        };
      default:
        return {
          icon: Activity,
          color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
          title: eventType.replace(/_/g, ' '),
        };
    }
  };

  const formatDetails = (details?: Record<string, any>) => {
    if (!details) return null;
    try {
      const entries = Object.entries(details);
      if (entries.length === 0) return null;
      return (
        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] font-mono">
          {entries.slice(0, 4).map(([k, v]) => (
            <span key={k} className="px-2 py-0.5 rounded bg-black/40 text-[#A0A0A0] border border-white/5">
              <span className="text-[#666]">{k}:</span> {String(v)}
            </span>
          ))}
        </div>
      );
    } catch {
      return null;
    }
  };

  return (
    <div className="bg-[#111216] border border-[#282A36] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#282A36] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF9100]/10 border border-[#FF9100]/30 flex items-center justify-center text-[#FF9100]">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Project Activity Audit Log</h3>
            <p className="text-xs text-[#8A8F98]">Verified timeline of team formation, membership, and design changes</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-[#8A8F98] hover:text-white hover:bg-white/5 transition flex items-center gap-1.5 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {activity.length === 0 ? (
        <div className="py-12 text-center text-[#8A8F98]">
          <Activity className="w-8 h-8 mx-auto text-[#444] mb-2" />
          <p className="text-sm">No project activity recorded yet</p>
          <p className="text-xs text-[#666] mt-0.5">Events will appear here as teams form and interact</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#282A36]">
          {activity.map((item) => {
            const meta = getActionMeta(item.eventType);
            const Icon = meta.icon;

            return (
              <div key={item.id} className="relative group">
                <div
                  className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${meta.color}`}
                >
                  <Icon className="w-2.5 h-2.5" />
                </div>

                <div className="bg-[#14151B] border border-[#282A36] rounded-lg p-3 hover:border-[#3E4251] transition">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white">{meta.title}</span>
                    <span className="text-[11px] text-[#8A8F98] font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#666]" />
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {formatDetails(item.details)}

                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#666]">
                    <span>Actor: {item.actorName || item.actorUserId || 'System'}</span>
                    {item.teamId && <span className="font-mono text-[#888]">Team ID: {item.teamId.slice(0, 12)}...</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
