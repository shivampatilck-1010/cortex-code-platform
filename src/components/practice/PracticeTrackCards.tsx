'use client';

import React from 'react';
import { Layers, Code2, GitBranch, Database } from 'lucide-react';
import { ChallengeTrack } from '@/lib/challenges/challenges-data';

export type TrackFilter = 'All' | ChallengeTrack;

export interface TrackCardStats {
  id: TrackFilter;
  label: string;
  subtitle: string;
  total: number;
  solved: number;
}

interface PracticeTrackCardsProps {
  stats: TrackCardStats[];
  selectedTrack: TrackFilter;
  onSelectTrack: (track: TrackFilter) => void;
  isDarkMode: boolean;
}

const TRACK_ICONS: Record<TrackFilter, React.ComponentType<{ className?: string }>> = {
  All: Layers,
  Programming: Code2,
  DSA: GitBranch,
  SQL: Database,
};

export const PracticeTrackCards: React.FC<PracticeTrackCardsProps> = ({
  stats,
  selectedTrack,
  onSelectTrack,
  isDarkMode,
}) => {
  return (
    <section aria-label="Practice Tracks">
      <div className="flex items-center justify-between mb-2.5">
        <span
          className={`text-[11px] font-heading font-semibold uppercase tracking-widest ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}
        >
          Practice Tracks
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map((track) => {
          const Icon = TRACK_ICONS[track.id];
          const isActive = selectedTrack === track.id;
          const pct = track.total > 0 ? Math.round((track.solved / track.total) * 100) : 0;

          return (
            <button
              key={track.id}
              type="button"
              onClick={() => onSelectTrack(track.id)}
              aria-pressed={isActive}
              data-testid={`track-card-${track.id.toLowerCase()}`}
              className={`group text-left rounded-xl p-4 border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9100] ${
                isActive
                  ? isDarkMode
                    ? 'bg-[#171410] border-[#ff9100] shadow-[0_0_0_1px_rgba(255,145,0,0.25)]'
                    : 'bg-amber-50/70 border-[#ff9100] shadow-sm'
                  : isDarkMode
                    ? 'bg-[#121318] border-[#1f2024] hover:border-[#2e313d] hover:bg-[#15171e]'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                      isActive
                        ? 'bg-[#ff9100]/15 border-[#ff9100]/40 text-[#ff9100]'
                        : isDarkMode
                          ? 'bg-[#191b22] border-[#262936] text-gray-300 group-hover:text-[#ff9100]'
                          : 'bg-slate-100 border-slate-200 text-slate-600 group-hover:text-[#d97706]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`font-heading font-semibold text-sm truncate ${
                        isDarkMode ? 'text-[#e6edf3]' : 'text-slate-900'
                      }`}
                    >
                      {track.label}
                    </div>
                    <div
                      className={`text-xs truncate ${
                        isDarkMode ? 'text-gray-400' : 'text-slate-500'
                      }`}
                    >
                      {track.subtitle}
                    </div>
                  </div>
                </div>

                <span
                  className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border ${
                    isActive
                      ? isDarkMode
                        ? 'bg-[#ff9100]/15 border-[#ff9100]/40 text-[#ffb347]'
                        : 'bg-[#ff9100]/15 border-[#ff9100]/50 text-[#b45309]'
                      : isDarkMode
                        ? 'bg-[#191b22] border-[#262936] text-gray-300'
                        : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {track.solved}/{track.total}
                </span>
              </div>

              <div className="mt-3.5 flex items-center gap-2.5">
                <div
                  className={`flex-1 h-1.5 rounded-full overflow-hidden ${
                    isDarkMode ? 'bg-[#1e2029]' : 'bg-slate-200'
                  }`}
                >
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      isActive ? 'bg-[#ff9100]' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] font-mono shrink-0 whitespace-nowrap ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                  }`}
                >
                  {track.total} total
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
