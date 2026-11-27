'use client';

import React from 'react';
import type { Course } from '@/types/learn';
import { getCourseStats } from '@/data/courses';
import { CoursePoster } from './CoursePoster';

interface CourseCardProps {
  course: Course;
  progressPct?: number;
  completedCount?: number;
  onClick: () => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  progressPct = 0,
  completedCount = 0,
  onClick,
}) => {
  const stats = getCourseStats(course);

  return (
    <article
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      data-testid={`course-card-${course.id}`}
      className={`group rounded-xl overflow-hidden bg-white dark:bg-[#22252C] dark:hover:bg-[#282C34] border transition-all duration-200 hover:-translate-y-[3px] hover:border-[#F3912E]/65 dark:hover:border-[#F3912E]/65 hover:shadow-[0_12px_26px_-10px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_14px_30px_-10px_rgba(0,0,0,0.6)] cursor-pointer flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F3912E] ${
        course.featured
          ? 'border-[#F3912E]/55'
          : 'border-[#E2E8F0] dark:border-white/[0.07]'
      }`}
    >
      <div>
        <div className="aspect-video w-full overflow-hidden relative bg-[#0F1117]">
          <div className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]">
            <CoursePoster course={course} />
          </div>
          {completedCount > 0 && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur font-mono text-[10.5px] font-semibold text-emerald-400 border border-emerald-500/35">
              {progressPct}% done
            </span>
          )}
        </div>

        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#F3912E]/15 text-[#F3912E]">
              {course.category}
            </span>
            <span className="text-[11px] font-medium text-[#64748B] dark:text-zinc-400">
              {course.level}
            </span>
          </div>

          <h3 className="text-[15.5px] font-bold tracking-[-0.01em] leading-[1.35] text-[#0F172A] dark:text-white line-clamp-2 min-h-[42px]">
            {course.title}
          </h3>

          <div className="space-y-0.5 text-[12.5px] text-[#64748B] dark:text-zinc-400">
            <div>
              No. of lessons:{' '}
              <span className="font-semibold text-[#0F172A] dark:text-zinc-100">
                {stats.totalItems}
              </span>
            </div>
            <div>
              Course time:{' '}
              <span className="font-semibold text-[#0F172A] dark:text-zinc-100">
                {course.estimatedHours} hours
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-1 flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-full bg-slate-900 dark:bg-[#1A1D24] border border-[#F3912E]/50 text-[#F3912E] font-bold text-[11px] inline-flex items-center justify-center shrink-0">
          {course.instructorInit}
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold text-[#0F172A] dark:text-zinc-100 truncate">
            {course.instructor}
          </div>
          <div className="text-[11px] text-[#64748B] dark:text-zinc-400">Instructor</div>
        </div>
      </div>
    </article>
  );
};
