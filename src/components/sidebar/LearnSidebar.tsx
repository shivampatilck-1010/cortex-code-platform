'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  ExternalLink, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown, 
  Award,
  Clock, 
  Code2
} from 'lucide-react';
import { COURSES, Course, Lesson } from '@/lib/learning/courses-data';

interface LearnSidebarProps {
  width?: number;
  currentLanguage?: string;
  onLoadLesson?: (code: string, language: string, title: string) => void;
  onClose?: () => void;
  isDarkMode?: boolean;
}

export const LearnSidebar: React.FC<LearnSidebarProps> = ({
  width = 240,
  currentLanguage = 'python',
  onLoadLesson,
  onClose,
  isDarkMode = true,
}) => {
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(COURSES[0]?.id || null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const toggleCourse = (courseId: string) => {
    setExpandedCourseId((prev) => (prev === courseId ? null : courseId));
  };

  const handleSelectLesson = (lesson: Lesson, course: Course) => {
    if (onLoadLesson) {
      onLoadLesson(lesson.starterCode, lesson.language, lesson.title);
      setStatusMessage(`Loaded "${lesson.title}"`);
      setTimeout(() => setStatusMessage(null), 2500);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Beginner':
        return isDarkMode
          ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
          : 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Intermediate':
        return isDarkMode
          ? 'text-amber-400 bg-amber-950/60 border-amber-800/40'
          : 'text-amber-700 bg-amber-50 border-amber-200';
      case 'Advanced':
        return isDarkMode
          ? 'text-rose-400 bg-rose-950/60 border-rose-800/40'
          : 'text-rose-700 bg-rose-50 border-rose-200';
      default:
        return isDarkMode
          ? 'text-gray-400 bg-gray-800 border-gray-700'
          : 'text-slate-600 bg-slate-100 border-slate-200';
    }
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className={`h-full flex flex-col select-none text-xs transition-colors duration-200 ${
        isDarkMode ? 'bg-[#0F0F12] text-zinc-200' : 'bg-[#F8F8FA] text-zinc-800'
      }`}
    >
      {/* Header */}
      <div className={`h-[34px] px-3 border-b flex items-center justify-between shrink-0 transition-colors ${
        isDarkMode ? 'border-white/[0.07] bg-[#0F0F12]' : 'border-black/[0.08] bg-[#F8F8FA]'
      }`}>
        <div className="flex items-center space-x-2">
          <BookOpen className="w-3.5 h-3.5 text-amber-500" />
          <span className={`font-semibold uppercase tracking-wider text-[11px] ${
            isDarkMode ? 'text-zinc-300' : 'text-zinc-700'
          }`}>
            Reference
          </span>
        </div>
        <Link
          href="/learn"
          className="flex items-center space-x-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
          title="Open Learning Catalog"
        >
          <span>Catalog</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Course Banner */}
      <div className={`p-2.5 border-b shrink-0 transition-colors ${
        isDarkMode ? 'bg-[#0c0d10] border-[#1f2024]' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className={`flex items-center space-x-1.5 mb-1 font-medium ${
          isDarkMode ? 'text-gray-200' : 'text-slate-800'
        }`}>
          <Award className="w-3.5 h-3.5 text-[#ff9100]" />
          <span>Interactive Curricula</span>
        </div>
        <p className={`text-[10px] leading-relaxed ${
          isDarkMode ? 'text-gray-400' : 'text-slate-500'
        }`}>
          Step-by-step programming tracks with live editor verification and instant terminal feedback.
        </p>
      </div>

      {/* Status notification */}
      {statusMessage && (
        <div className="mx-2.5 mt-2 px-2.5 py-1.5 bg-emerald-950/60 border border-emerald-700/50 rounded text-[11px] text-emerald-300 flex items-center space-x-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">{statusMessage}</span>
        </div>
      )}

      {/* Courses Accordion List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {COURSES.map((course) => {
          const isExpanded = expandedCourseId === course.id;

          return (
            <div
              key={course.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                isDarkMode ? 'border-[#1e2026] bg-[#121318]' : 'border-slate-200 bg-slate-50 shadow-sm'
              }`}
            >
              {/* Course Title Header */}
              <button
                onClick={() => toggleCourse(course.id)}
                className={`w-full p-2.5 flex items-center justify-between text-left transition ${
                  isDarkMode ? 'hover:bg-[#15161e]' : 'hover:bg-slate-100'
                }`}
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center space-x-1.5 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${getLevelColor(
                        course.level
                      )}`}
                    >
                      {course.level}
                    </span>
                    <span className={`text-[10px] font-mono ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                      {course.lessonsCount} lessons
                    </span>
                  </div>
                  <div className={`font-semibold text-xs line-clamp-1 ${
                    isDarkMode ? 'text-gray-200' : 'text-slate-800'
                  }`}>
                    {course.title}
                  </div>
                </div>

                <div className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[#ff9100]" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </button>

              {/* Expanded Lessons */}
              {isExpanded && (
                <div className={`p-2 border-t space-y-1.5 ${
                  isDarkMode ? 'border-[#1b1c24] bg-[#0d0e12]' : 'border-slate-200 bg-white'
                }`}>
                  <div className={`text-[10px] mb-2 leading-relaxed px-1 ${
                    isDarkMode ? 'text-gray-400' : 'text-slate-600'
                  }`}>
                    {course.description}
                  </div>

                  {course.lessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className={`p-2 border rounded-md transition flex items-center justify-between ${
                        isDarkMode
                          ? 'bg-[#14151b] hover:bg-[#181922] border-[#20222c]'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className={`font-medium text-[11px] line-clamp-1 ${
                          isDarkMode ? 'text-gray-200' : 'text-slate-800'
                        }`}>
                          {lesson.title}
                        </div>
                        <div className={`flex items-center space-x-1 text-[9px] mt-0.5 font-mono ${
                          isDarkMode ? 'text-gray-500' : 'text-slate-500'
                        }`}>
                          <Clock className="w-2.5 h-2.5" />
                          <span>{lesson.durationMinutes}m</span>
                          <span>•</span>
                          <span className="uppercase">{lesson.language}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleSelectLesson(lesson, course)}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition flex items-center space-x-1 border ${
                            isDarkMode
                              ? 'bg-[#222227] hover:bg-[#2a2a30] text-zinc-200 border-white/[0.08]'
                              : 'bg-white hover:bg-zinc-100 text-zinc-700 border-black/[0.08]'
                          }`}
                          title="Load lesson starter code into IDE"
                        >
                          <Code2 className="w-3 h-3" />
                          <span>Load</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="pt-1.5">
                    <Link
                      href={`/learn/${course.slug}`}
                      className={`w-full py-1.5 px-2 rounded text-[10px] font-medium flex items-center justify-center space-x-1 border transition ${
                        isDarkMode
                          ? 'bg-[#191a22] hover:bg-[#222430] text-gray-300 hover:text-white border-[#252834]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-200 shadow-sm'
                      }`}
                    >
                      <span>Open Full Course</span>
                      <ExternalLink className="w-3 h-3 text-[#ff9100]" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
