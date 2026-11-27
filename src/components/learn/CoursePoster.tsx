'use client';

import React from 'react';
import {
  Braces,
  Code2,
  Cpu,
  Database,
  Globe,
  LineChart,
  Network,
  ShieldCheck,
} from 'lucide-react';
import type { Course } from '@/types/learn';

interface CoursePosterProps {
  course: Course;
}

function getPosterIcon(motif: NonNullable<Course['poster']>['motif']) {
  switch (motif) {
    case 'dsa':
      return Network;
    case 'cpp':
      return Cpu;
    case 'sql':
      return Database;
    case 'python':
      return Braces;
    case 'ml':
      return LineChart;
    case 'data':
      return LineChart;
    case 'web':
      return Globe;
    case 'security':
      return ShieldCheck;
    default:
      return Code2;
  }
}

export const CoursePoster: React.FC<CoursePosterProps> = ({ course }) => {
  const poster = course.poster ?? {
    gradient: 'from-[#181C24] via-[#212531] to-[#0F1218]',
    accentHex: '#F3912E',
    badge: course.category.toUpperCase(),
    kicker: course.level.toUpperCase(),
    headline: course.title,
    codeSnippet: '// cortex studio track',
    motif: 'dsa' as const,
  };

  const Icon = getPosterIcon(poster.motif);

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-br ${poster.gradient} overflow-hidden select-none flex flex-col justify-between p-4`}
    >
      {/* Subtle architectural grid & ambient glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute -right-8 -top-8 w-36 h-36 rounded-full blur-2xl opacity-25"
        style={{ backgroundColor: poster.accentHex }}
      />

      {/* Top badge + motif icon */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="px-2 py-0.5 rounded bg-black/45 border border-white/[0.1] font-mono text-[9.5px] tracking-wider text-zinc-200">
          {poster.badge}
        </span>
        <span className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[#F3912E]">
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Center studio headline */}
      <div className="relative z-10 space-y-1 my-auto py-1">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#F3912E] font-semibold">
          {poster.kicker}
        </div>
        <div className="text-[17px] sm:text-[18px] font-extrabold tracking-tight leading-[1.18] text-white line-clamp-2">
          {poster.headline}
        </div>
      </div>

      {/* Bottom code bar */}
      <div className="relative z-10 px-2.5 py-1.5 rounded-md bg-black/55 border border-white/[0.08] font-mono text-[10.5px] text-zinc-300 truncate flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F3912E] shrink-0" />
        <span className="truncate">{poster.codeSnippet}</span>
      </div>
    </div>
  );
};
